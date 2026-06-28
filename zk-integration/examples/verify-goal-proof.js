// Example: verifying a "goal reached" proof in Savique using the zkArb SDK.
//
// This is a reference example for other developers. It shows how Savique can
// prove a user reached their savings goal WITHOUT revealing the actual amount,
// using the "goalReached" circuit. It does not affect the live app.
//
// Docs: https://jatinsahijwani.github.io/zkArb-sdk/

const path = require("path");
const { verifyProof } = require("zkarb-sdk");

// USDC has 6 decimals, so $1,200 in base units = 1200 * 1,000,000.
const USDC = (dollars) => (BigInt(dollars) * 1000000n).toString();

async function main() {
  // The private input the user proves something about (kept secret).
  const input = { savings: USDC(1200) }; // user has $1,200 saved

  // Path to the compiled circuit folder produced by `npx zkarb-sdk compile`.
  const circuitPath = path.join(__dirname, "..", "goalReached");

  // Generate the proof and verify it on Arbitrum in a single call.
  const result = await verifyProof(input, circuitPath);

  console.log("Goal reached (public output):", result.publicSignals); // [ '1' ] = reached
  console.log("Full result:", result);
}

main().catch((err) => {
  console.error("Verification example failed:", err);
});