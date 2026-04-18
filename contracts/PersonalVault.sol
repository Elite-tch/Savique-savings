// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAavePool.sol";

interface IVaultFactoryNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title PersonalVaultV3_Standalone
 * @dev Savings Vault controlled by an NFT. No inheritance to minimize clone size.
 */
contract PersonalVault is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public token; 
    IAavePool public aavePool;
    address public aTokenAddress;
    
    uint256 public unlockTimestamp;
    uint256 public penaltyBps; 
    address public treasury; 
    address public beneficiary; 
    address public factory; 
    uint256 public vaultId;
    string public purpose;

    uint256 public totalPrincipal;
    uint256 public constant GRACE_PERIOD = 365 days; 
    uint256 public constant SUCCESS_FEE_BPS = 2000; 

    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp, string typeOfWithdrawal);
    event EarlyWithdrawal(address indexed user, uint256 amountWithdraw, uint256 penaltyPaid);
    event FullWithdrawal(address indexed user, uint256 amount);
    event BeneficiaryClaimed(address indexed beneficiary, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _token,
        address _aavePool,
        string memory _purpose,
        uint256 _unlockTimestamp,
        uint256 _penaltyBps,
        address _treasury,
        address _beneficiary,
        uint256 _vaultId
    ) public initializer {
        token = IERC20(_token);
        aavePool = IAavePool(_aavePool);
        
        IAavePool.ReserveData memory data = IAavePool(_aavePool).getReserveData(_token);
        aTokenAddress = data.aTokenAddress;
        require(aTokenAddress != address(0), "Invalid aToken");

        purpose = _purpose;
        unlockTimestamp = _unlockTimestamp;
        penaltyBps = _penaltyBps;
        treasury = _treasury;
        beneficiary = _beneficiary;
        factory = msg.sender;
        vaultId = _vaultId;

        token.forceApprove(_aavePool, type(uint256).max);
    }

    function owner() public view returns (address) {
        return IVaultFactoryNFT(factory).ownerOf(vaultId);
    }

    modifier onlyOwner() {
        require(msg.sender == owner(), "Not the NFT owner");
        _;
    }

    function _supplyToAave(uint256 amount) internal {
        aavePool.supply(address(token), amount, address(this), 0);
    }

    function deposit(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount > 0");
        token.safeTransferFrom(msg.sender, address(this), amount);
        _supplyToAave(amount);
        totalPrincipal += amount;
        emit Deposited(msg.sender, amount, block.timestamp);
    }

    function depositFromFactory(uint256 amount) external nonReentrant {
        require(msg.sender == factory, "Only Factory");
        _supplyToAave(amount);
        totalPrincipal += amount;
        emit Deposited(owner(), amount, block.timestamp);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 withdrawnAmount = aavePool.withdraw(address(token), type(uint256).max, address(this));
        require(withdrawnAmount > 0, "No funds");

        if (block.timestamp >= unlockTimestamp) {
            uint256 profit = 0;
            if (withdrawnAmount > totalPrincipal) profit = withdrawnAmount - totalPrincipal;
            uint256 protocolFee = (profit * SUCCESS_FEE_BPS) / 10000;
            uint256 userReturn = withdrawnAmount - protocolFee;

            if (protocolFee > 0) token.safeTransfer(treasury, protocolFee);
            token.safeTransfer(msg.sender, userReturn);

            emit Withdrawn(msg.sender, userReturn, block.timestamp, "MATURITY");
            emit FullWithdrawal(msg.sender, userReturn);
        } else {
            uint256 penalty = (withdrawnAmount * penaltyBps) / 10000;
            uint256 remaining = withdrawnAmount - penalty;
            if (penalty > 0) token.safeTransfer(treasury, penalty);
            if (remaining > 0) token.safeTransfer(msg.sender, remaining);
            emit Withdrawn(msg.sender, remaining, block.timestamp, "EARLY_EXIT");
            emit EarlyWithdrawal(msg.sender, remaining, penalty);
        }
    }

    function totalAssets() public view returns (uint256) {
        return IERC20(aTokenAddress).balanceOf(address(this));
    }

    function claimByBeneficiary() external nonReentrant {
        require(msg.sender == factory, "Only factory");
        uint256 withdrawnAmount = aavePool.withdraw(address(token), type(uint256).max, beneficiary);
        emit BeneficiaryClaimed(beneficiary, withdrawnAmount);
    }
}
