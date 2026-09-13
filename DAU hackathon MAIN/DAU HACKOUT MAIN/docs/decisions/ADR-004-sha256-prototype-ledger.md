# ADR-004: SHA-256 prototype ledger

## Decision

Represent transaction integrity with an immutable hash record using SHA-256.
This is an audit mechanism, not a blockchain or smart-contract implementation.

## Rationale

Hash records provide a useful demonstration and extension point for settlement
integrity while keeping the first phase simple, portable, and transparent.