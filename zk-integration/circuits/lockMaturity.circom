pragma circom 2.0.0;

// Lock Maturity circuit for the Savique zkArb SDK integration.
// Proves that a savings lock has been held for at least 90 days
// WITHOUT revealing the exact start time of the lock.
//
// Time values are unix timestamps in seconds.
//
// Private inputs : lock_start, current_time   (kept secret)
// Public output  : matured                    (1 if locked >= 90 days, else 0)

include "comparators.circom";

template LockMaturity() {
    signal input lock_start;     // private: unix time when the lock began
    signal input current_time;   // private: unix time at proof generation
    signal output matured;       // public: 1 if locked for >= 90 days, else 0

    // How long the funds have been locked, in seconds.
    signal elapsed;
    elapsed <== current_time - lock_start;

    // GreaterEqThan(64) compares large whole numbers safely.
    component check = GreaterEqThan(64);
    check.in[0] <== elapsed;
    check.in[1] <== 7776000;     // 90 days in seconds (90 * 24 * 60 * 60)

    matured <== check.out;       // result becomes the public output
}

component main = LockMaturity();
