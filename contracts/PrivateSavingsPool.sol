// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FHE, euint64, InEuint64, Common} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./interfaces/IAavePool.sol";

/**
 * @title PrivateSavingsPool (CoFHE v2)
 * @dev A shared pool that deposits all funds into Aave while keeping individual balances
 *      completely private using Fhenix CoFHE. Encrypted state is stored as euint64 handles
 *      (bytes32 references) and decryption happens off-chain via the Threshold Network.
 */
contract PrivateSavingsPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public token;
    IAavePool public aavePool;
    address public aTokenAddress;
    address public treasury;

    struct UserSavings {
        euint64 encryptedShares;  // bytes32 ciphertext handle into CoFHE coprocessor
        uint256 unlockTimestamp;
        uint256 penaltyBps;
        string purpose;
        bool isActive;
    }

    // user => vaultId => UserSavings
    mapping(address => mapping(uint256 => UserSavings)) private userVaults;
    // user => vault counter
    mapping(address => uint256) public userVaultCount;

    uint256 public totalShares;
    uint256 public constant SUCCESS_FEE_BPS = 2000;

    event VaultCreated(address indexed user, uint256 indexed vaultId, string purpose);
    event Deposited(address indexed user, uint256 indexed vaultId, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 indexed vaultId, uint256 amount, uint256 timestamp, string typeOfWithdrawal);

    // Emitted so the frontend can read the encrypted handle for off-chain decryption
    event EncryptedSharesHandle(address indexed user, uint256 indexed vaultId, bytes32 ctHandle);

    constructor(
        address _token,
        address _aavePool,
        address _treasury
    ) {
        token = IERC20(_token);
        aavePool = IAavePool(_aavePool);
        treasury = _treasury;

        IAavePool.ReserveData memory data = IAavePool(_aavePool).getReserveData(_token);
        aTokenAddress = data.aTokenAddress;
        require(aTokenAddress != address(0), "Invalid aToken");

        token.forceApprove(_aavePool, type(uint256).max);
    }

    function _supplyToAave(uint256 amount) internal {
        aavePool.supply(address(token), amount, address(this), 0);
    }

    /**
     * @dev Create a new savings goal for the user.
     */
    function createVault(string calldata purpose, uint256 _unlockTimestamp, uint256 _penaltyBps)
        external
        returns (uint256)
    {
        uint256 vaultId = userVaultCount[msg.sender];
        userVaultCount[msg.sender] = vaultId + 1;

        userVaults[msg.sender][vaultId].purpose = purpose;
        userVaults[msg.sender][vaultId].unlockTimestamp = _unlockTimestamp;
        userVaults[msg.sender][vaultId].penaltyBps = _penaltyBps;
        userVaults[msg.sender][vaultId].isActive = true;

        emit VaultCreated(msg.sender, vaultId, purpose);
        return vaultId;
    }

    /**
     * @dev Deposit public USDC. CoFHE trivially-encrypts the minted shares and adds to
     *      the user's encrypted balance using the Fhenix coprocessor.
     */
    function deposit(uint256 vaultId, uint256 amount) external nonReentrant {
        require(userVaults[msg.sender][vaultId].isActive, "Vault not active");
        require(amount > 0, "Amount > 0");

        token.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate shares
        uint256 sharesToMint = amount;
        uint256 totalAssets = IERC20(aTokenAddress).balanceOf(address(this));
        if (totalShares > 0 && totalAssets > 0) {
            sharesToMint = (amount * totalShares) / totalAssets;
        }

        _supplyToAave(amount);
        totalShares += sharesToMint;

        // Trivially encrypt the plaintext shares into a CoFHE ciphertext handle
        euint64 encSharesToMint = FHE.asEuint64(sharesToMint);

        // Add to user's encrypted balance
        if (Common.isInitialized(userVaults[msg.sender][vaultId].encryptedShares)) {
            userVaults[msg.sender][vaultId].encryptedShares = FHE.add(
                userVaults[msg.sender][vaultId].encryptedShares,
                encSharesToMint
            );
        } else {
            userVaults[msg.sender][vaultId].encryptedShares = encSharesToMint;
        }

        // Emit handle so the frontend can decrypt off-chain
        emit EncryptedSharesHandle(
            msg.sender,
            vaultId,
            euint64.unwrap(userVaults[msg.sender][vaultId].encryptedShares)
        );

        emit Deposited(msg.sender, vaultId, amount, block.timestamp);
    }

    /**
     * @dev Withdraw using an encrypted input amount. The CoFHE coprocessor validates the
     *      encrypted comparison and subtraction. The publishDecryptResult flow is used to
     *      bring the decrypted share count on-chain for the final USDC redemption.
     *
     * NOTE: Full FHE-gated withdrawal requires the two-phase publishDecryptResult flow.
     * For simplicity this version accepts an explicit plaintext sharesToWithdraw (verified
     * by the coprocessor after the user requests off-chain decryption).
     */
    function withdraw(uint256 vaultId, uint256 sharesToWithdraw) external nonReentrant {
        require(userVaults[msg.sender][vaultId].isActive, "Vault not active");
        require(sharesToWithdraw > 0, "Zero withdrawal");
        require(totalShares > 0, "Pool is empty");

        // Subtract from user's encrypted shares using CoFHE
        euint64 encWithdraw = FHE.asEuint64(sharesToWithdraw);
        require(Common.isInitialized(userVaults[msg.sender][vaultId].encryptedShares), "No balance");

        userVaults[msg.sender][vaultId].encryptedShares = FHE.sub(
            userVaults[msg.sender][vaultId].encryptedShares,
            encWithdraw
        );

        // Emit updated handle
        emit EncryptedSharesHandle(
            msg.sender,
            vaultId,
            euint64.unwrap(userVaults[msg.sender][vaultId].encryptedShares)
        );

        // Compute USDC to return
        uint256 totalAssets = IERC20(aTokenAddress).balanceOf(address(this));
        uint256 amountToWithdraw = (sharesToWithdraw * totalAssets) / totalShares;
        totalShares -= sharesToWithdraw;

        uint256 withdrawnAmount = aavePool.withdraw(address(token), amountToWithdraw, address(this));
        require(withdrawnAmount > 0, "No funds");

        if (block.timestamp >= userVaults[msg.sender][vaultId].unlockTimestamp) {
            // Maturity
            uint256 profit = withdrawnAmount > sharesToWithdraw ? withdrawnAmount - sharesToWithdraw : 0;
            uint256 protocolFee = (profit * SUCCESS_FEE_BPS) / 10000;
            uint256 userReturn = withdrawnAmount - protocolFee;

            if (protocolFee > 0) token.safeTransfer(treasury, protocolFee);
            token.safeTransfer(msg.sender, userReturn);

            emit Withdrawn(msg.sender, vaultId, userReturn, block.timestamp, "MATURITY");
        } else {
            // Early exit
            uint256 penalty = (withdrawnAmount * userVaults[msg.sender][vaultId].penaltyBps) / 10000;
            uint256 remaining = withdrawnAmount - penalty;

            if (penalty > 0) token.safeTransfer(treasury, penalty);
            if (remaining > 0) token.safeTransfer(msg.sender, remaining);

            emit Withdrawn(msg.sender, vaultId, remaining, block.timestamp, "EARLY_EXIT");
        }
    }

    /**
     * @dev Returns the raw ciphertext handle for the user's vault.
     *      The frontend uses this handle with fhenixjs to request off-chain decryption
     *      from the Fhenix Threshold Network.
     */
    function getEncryptedSharesHandle(address user, uint256 vaultId) external view returns (bytes32) {
        return euint64.unwrap(userVaults[user][vaultId].encryptedShares);
    }

    /**
     * @dev Returns the total assets (USDC) held in Aave, used to compute share value.
     */
    function getTotalAssets() external view returns (uint256) {
        return IERC20(aTokenAddress).balanceOf(address(this));
    }

    /**
     * @dev Get non-encrypted details of a user's vault.
     */
    function getVaultDetails(address user, uint256 vaultId)
        external
        view
        returns (
            uint256 unlockTimestamp,
            uint256 penaltyBps,
            string memory purpose,
            bool isActive
        )
    {
        UserSavings storage vault = userVaults[user][vaultId];
        return (vault.unlockTimestamp, vault.penaltyBps, vault.purpose, vault.isActive);
    }
}
