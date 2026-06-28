# zk-integration

This folder holds the zero-knowledge (ZK) proof setup for Savique, built with the
zkArb SDK: https://jatinsahijwani.github.io/zkArb-sdk/

It lets users prove facts about their savings (for example, that they reached a
goal or held funds long enough) WITHOUT revealing private financial details.

## What's in here

- savings_verifier.circom — the main circuit: proves savings >= a threshold AND
  lock duration >= a threshold, while keeping the real amount and start time private.
- savings_verifier/ — the compiled circuit and the deployed verifier details.
- circuits/ — additional ZK circuit templates (e.g. goal reached, lock maturity).
- examples/ — reference scripts that show how to verify proofs.
- test-proof.js — a standalone test of the proof flow (no wallet, no gas).

## The flow (high level)

1. Write a circuit describing what to prove.
2. Compile it:  npx zkarb-sdk compile ./zk-integration/yourCircuit.circom
3. Deploy a verifier to Arbitrum:  npx zkarb-sdk deploy ./yourCircuit <PRIVATE_KEY>
4. Verify a proof from JavaScript:  verifyProof(input, "./yourCircuit")

## Learn more

- zkArb SDK docs: https://jatinsahijwani.github.io/zkArb-sdk/
- zkArb SDK repo: https://github.com/jatinsahijwani/zkArb-sdk
