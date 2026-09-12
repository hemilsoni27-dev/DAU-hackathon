# ADR-003: Separate FastAPI AI boundary

## Decision

Keep AI workloads behind a small FastAPI service boundary while the business
API remains a Node/Express modular monolith.

## Rationale

Python is the natural extension point for forecasting and anomaly models, but
the foundation should not pretend a model exists before it has been trained,
validated, and monitored.