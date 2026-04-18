// -------------------- Config --------------------
export const CONTRACTS = {
    arbitrumSepolia: {
        VaultFactory: "0x85856bFecBe6d46863e2B11A22c1aD58B74A2Ab1" as `0x${string}`,
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

export const VAULT_FACTORY_ABI = [
    {
        inputs: [
            { name: "_purpose", type: "string" },
            { name: "_unlockTimestamp", type: "uint256" },
            { name: "_penaltyBps", type: "uint256" },
            { name: "_initialDeposit", type: "uint256" },
            { name: "_beneficiary", type: "address" }
        ],
        name: "createPersonalVault",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [],
        name: "usdcToken",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "user", type: "address" }],
        name: "getUserVaults",
        outputs: [{ name: "", type: "address[]" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "getAllVaults",
        outputs: [{ name: "", type: "address[]" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "owner",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "_vault", type: "address" }],
        name: "triggerBeneficiaryClaim",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { name: "_vault", type: "address" },
            { name: "_amount", type: "uint256" }
        ],
        name: "executeAutoDeposit",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "user", type: "address" },
            { indexed: false, name: "vault", type: "address" },
            { indexed: false, name: "vaultId", type: "uint256" },
            { indexed: false, name: "purpose", type: "string" }
        ],
        name: "VaultCreated",
        type: "event"
    }
] as const;

export const VAULT_ABI = [
    {
        inputs: [],
        name: "purpose",
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "totalAssets",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "unlockTimestamp",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "token",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "amount", type: "uint256" }],
        name: "deposit",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [],
        name: "withdraw",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [],
        name: "beneficiary",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "GRACE_PERIOD",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "claimByBeneficiary",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ name: "amount", type: "uint256" }],
        name: "depositFromFactory",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
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
