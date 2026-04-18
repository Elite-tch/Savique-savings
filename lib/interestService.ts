/**
 * Interest Service
 * 
 * This service handles potential interest calculations and fetching 
 * APR/APY data from external protocols like Aave.
 */

// Arbitrum Sepolia Aave V3 Addresses
export const EXTERNAL_PROTOCOLS = {
    AAVE_V3: {
        POOL: "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff" as `0x${string}`,
        DATA_PROVIDER: "0x12373B5085e3b42D42C1D4ABF3B3Cf4Df0E0Fa01" as `0x${string}`,
        USDC_TOKEN: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as `0x${string}`,
    }
};

/**
 * Estimates the daily interest for a given amount and APY.
 * @param amount The principal amount (in USDC)
 * @param apy The Annual Percentage Interest (e.g., 0.016 for 1.6%)
 * @returns Daily interest amount
 */
export function estimateDailyInterest(amount: number, apy: number): number {
    return (amount * apy) / 365;
}

/**
 * Calculates total accrued interest over a specific time period.
 * @param amount Principal
 * @param apy APY
 * @param days Number of days elapsed
 * @returns Total accrued interest
 */
export function calculateAccruedInterest(amount: number, apy: number, days: number): number {
    // Simple interest calculation for display purposes
    // In V2 this will be fetched exactly from the contract
    return amount * apy * (days / 365);
}
