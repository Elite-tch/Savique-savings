// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./PersonalVault.sol";

/**
 * @title VaultFactory
 * @dev Deploys Aave-integrated Personal Vaults as NFTs on Arbitrum Sepolia.
 */
contract VaultFactory is ERC721, ERC2981, Ownable {
    using SafeERC20 for IERC20;

    address public immutable usdcToken;
    address public immutable aavePool; 
    address public protocolTreasury;
    address public immutable implementation;

    uint256 public nextVaultId = 1;

    mapping(uint256 => address) public vaultById;
    mapping(address => bool) public isVault;
    mapping(address => address[]) public userVaults;
    address[] public allVaults;

    // Config
    uint96 public constant ROYALTY_BPS = 250; // 2.5%
    string private _baseTokenURI;

    event VaultCreated(address indexed user, address vault, uint256 vaultId, string purpose);

    constructor(
        address _usdcToken, 
        address _aavePool, 
        address _protocolTreasury,
        address _implementation
    ) ERC721("Savique Savings NFT", "SAVI") Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC");
        require(_implementation != address(0), "Invalid Implementation");
        
        usdcToken = _usdcToken;
        aavePool = _aavePool;
        protocolTreasury = _protocolTreasury;
        implementation = _implementation;

        _setDefaultRoyalty(_protocolTreasury, ROYALTY_BPS);
    }

    function createPersonalVault(
        string memory _purpose,
        uint256 _unlockTimestamp,
        uint256 _penaltyBps,
        uint256 _initialDeposit,
        address _beneficiary
    ) external returns (address) {
        uint256 vaultId = nextVaultId++;
        
        // Clone the implementation (Minimal Proxy)
        address vaultAddr = Clones.clone(implementation);
        
        // Initialize the clone
        PersonalVault(payable(vaultAddr)).initialize(
            usdcToken,
            aavePool,
            _purpose,
            _unlockTimestamp,
            _penaltyBps,
            protocolTreasury,
            _beneficiary,
            vaultId
        );

        vaultById[vaultId] = vaultAddr;
        isVault[vaultAddr] = true;
        userVaults[msg.sender].push(vaultAddr);
        allVaults.push(vaultAddr);
        
        _safeMint(msg.sender, vaultId);

        if (_initialDeposit > 0) {
            IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), _initialDeposit);
            IERC20(usdcToken).safeTransfer(vaultAddr, _initialDeposit);
            PersonalVault(payable(vaultAddr)).depositFromFactory(_initialDeposit);
        }

        emit VaultCreated(msg.sender, vaultAddr, vaultId, _purpose);
        return vaultAddr;
    }

    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        
        address vault = vaultById[tokenId];
        string memory purpose = PersonalVault(payable(vault)).purpose();
        uint256 balance = PersonalVault(payable(vault)).totalAssets();
        
        string memory svg = _generateSVG(purpose, balance);
        string memory tier = _getTier(balance);
        
        bytes memory json = abi.encodePacked(
            '{"name": "Savique ', tier, ' Vault #', Strings.toString(tokenId), '", ',
            '"description": "A tiered savings vault on Savique Protocol.", ',
            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '", ',
            '"attributes": [',
                '{"trait_type": "Purpose", "value": "', purpose, '"}, ',
                '{"trait_type": "Tier", "value": "', tier, '"}, ',
                '{"trait_type": "Balance", "value": "', Strings.toString(balance / 1e6), ' USDC"}',
            ']}'
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function _getTier(uint256 balance) internal pure returns (string memory) {
        if (balance >= 10000 * 1e6) return "Platinum";
        if (balance >= 1000 * 1e6) return "Gold";
        if (balance >= 100 * 1e6) return "Silver";
        return "Bronze";
    }

    function _generateSVG(string memory purpose, uint256 balance) internal pure returns (string memory) {
        string memory balanceStr = string(abi.encodePacked(Strings.toString(balance / 1e6), " USDC"));
        string memory tier = _getTier(balance);
        
        string memory color = "#cd7f32"; // Bronze
        string memory stroke = "#E62058";
        
        if (keccak256(bytes(tier)) == keccak256(bytes("Platinum"))) {
            color = "#E5E4E2"; stroke = "#fff";
        } else if (keccak256(bytes(tier)) == keccak256(bytes("Gold"))) {
            color = "#FFD700"; stroke = "#FFD700";
        } else if (keccak256(bytes(tier)) == keccak256(bytes("Silver"))) {
            color = "#C0C0C0"; stroke = "#C0C0C0";
        }

        return string(
            abi.encodePacked(
                '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">',
                '<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:#18181b;stop-opacity:1" />',
                '<stop offset="100%" style="stop-color:#09090b;stop-opacity:1" />',
                '</linearGradient></defs>',
                '<rect width="400" height="400" rx="24" fill="url(#grad)"/>',
                '<rect x="10" y="10" width="380" height="380" rx="20" fill="none" stroke="', stroke, '" stroke-width="1" opacity="0.4"/>',
                '<text x="40" y="70" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="', color, '">SAVIQUE</text>',
                '<text x="360" y="70" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="', color, '" text-anchor="end">', tier, '</text>',
                '<rect x="40" y="90" width="40" height="4" fill="', stroke, '"/>',
                '<text x="40" y="200" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#fff">', purpose, '</text>',
                '<text x="40" y="240" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af">Total Accumulated</text>',
                '<text x="40" y="285" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#fff">', balanceStr, '</text>',
                '<text x="40" y="360" font-family="Arial, sans-serif" font-size="12" fill="#4b5563">DECENTRALIZED SAVINGS VAULT</text>',
                '</svg>'
            )
        );
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function getUserVaults(address _user) external view returns (address[] memory) {
        return userVaults[_user];
    }

    function triggerBeneficiaryClaim(address _vault) external onlyOwner {
        PersonalVault(payable(_vault)).claimByBeneficiary();
    }
}
