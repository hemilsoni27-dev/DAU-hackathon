# ADR-001: PostgreSQL is durable source of truth

## Decision

Use PostgreSQL for users, solar systems, energy observations, listings, trades,
transactions, payments, hashes, grid observations, predictions, and audit
logs.

## Rationale

Trading and audit records require durable constraints, decimal semantics,
indexes, and transactional writes. Redis is not appropriate as the canonical
store for these records.