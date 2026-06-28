pragma circom 2.0.0;

// Goal Reached circuit for the Savique zkArb SDK integration.
// Proves a user's savings reached their goal WITHOUT revealing the
// actual savings amount. Supports the Sinking Fund / goal-tracking feature.
//
// Amounts are in token base units (USDC has 6 decimals, so $1,000 = 1000000000).
//
// Private input : savings   (kept secret)
// Public output : reached   (1 if savings >= goal, otherwise 0)

include "comparators.circom";

template GoalReached() {
    signal input savings;     // private: the user's actual savings (never revealed)
    signal output reached;    // public: 1 if the goal is met, else 0

    // GreaterEqThan(64) compares large whole numbers safely.
    component check = GreaterEqThan(64);
    check.in[0] <== savings;
    check.in[1] <== 1000000000;   // goal: $1,000 in USDC base units (6 decimals)

    reached <== check.out;        // result becomes the public output
}

component main = GoalReached();
