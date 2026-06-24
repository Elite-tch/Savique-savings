// -------------------- Config --------------------
export const CONTRACTS = {
    arbitrumSepolia: {
        VaultFactory: "0xE142f08E04B963f22397eE36b8BcE184c05c0875" as `0x${string}`, // CoFHE v2
        USDCToken: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as `0x${string}`,
        AavePool: "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff" as `0x${string}`,
    },
} as const;

export const AAVE_POOL_ABI = [
    {
        inputs: [{ name: "asset", type: "address" }],
        name: "getReserveData",
        outputs: [
            {
                components: [
                    { name: "configuration", type: "tuple", components: [{ name: "data", type: "uint256" }] },
                    { name: "liquidityIndex", type: "uint128" },
                    { name: "currentLiquidityRate", type: "uint128" },
                    { name: "variableBorrowIndex", type: "uint128" },
                    { name: "currentVariableBorrowRate", type: "uint128" },
                    { name: "currentStableBorrowRate", type: "uint128" },
                    { name: "lastUpdateTimestamp", type: "uint40" },
                    { name: "id", type: "uint16" },
                    { name: "aTokenAddress", type: "address" },
                    { name: "stableDebtTokenAddress", type: "address" },
                    { name: "variableDebtTokenAddress", type: "address" },
                    { name: "interestRateStrategyAddress", type: "address" },
                    { name: "accruedToTreasury", type: "uint128" },
                    { name: "unbacked", type: "uint128" },
                    { name: "isolationModeTotalDebt", type: "uint128" }
                ],
                name: "",
                type: "tuple"
            }
        ],
        stateMutability: "view",
        type: "function"
    }
] as const;

export const PRIVATE_SAVINGS_POOL_ABI = [
    {
        inputs: [
            { name: "purpose", type: "string" },
            { name: "_unlockTimestamp", type: "uint256" },
            { name: "_penaltyBps", type: "uint256" }
        ],
        name: "createVault",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { name: "vaultId", type: "uint256" },
            { name: "amount", type: "uint256" }
        ],
        name: "deposit",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { name: "vaultId", type: "uint256" },
            { name: "sharesToWithdraw", type: "uint256" }
        ],
        name: "withdraw",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { name: "user", type: "address" },
            { name: "vaultId", type: "uint256" }
        ],
        name: "getEncryptedSharesHandle",
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "user", type: "address" }],
        name: "userVaultCount",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "totalShares",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "getTotalAssets",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            { name: "user", type: "address" },
            { name: "vaultId", type: "uint256" }
        ],
        name: "getVaultDetails",
        outputs: [
            { name: "unlockTimestamp", type: "uint256" },
            { name: "penaltyBps", type: "uint256" },
            { name: "purpose", type: "string" },
            { name: "isActive", type: "bool" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "user", type: "address" },
            { indexed: true, name: "vaultId", type: "uint256" },
            { indexed: false, name: "purpose", type: "string" }
        ],
        name: "VaultCreated",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "user", type: "address" },
            { indexed: true, name: "vaultId", type: "uint256" },
            { indexed: false, name: "ctHandle", type: "bytes32" }
        ],
        name: "EncryptedSharesHandle",
        type: "event"
    }
] as const;

export const ERC20_ABI = [
    {
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" }
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        name: "mint",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;
