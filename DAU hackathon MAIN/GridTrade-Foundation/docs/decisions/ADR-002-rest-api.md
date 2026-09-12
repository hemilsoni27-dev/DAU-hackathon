# ADR-002: Versioned REST API

## Decision

Expose the modular monolith through a versioned REST API under `/api/v1` and
generate frontend hooks from OpenAPI.

## Rationale

REST keeps the first implementation portable across the web app, utilities,
regulators, and future mobile clients. OpenAPI keeps agent and human clients
aligned with one contract.