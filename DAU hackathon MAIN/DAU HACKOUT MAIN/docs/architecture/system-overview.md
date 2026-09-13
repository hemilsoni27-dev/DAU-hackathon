# GridTrade System Overview

GridTrade is a digital coordination, intelligence, marketplace, and transaction-record layer operating alongside the electrical power grid.

## Runtime Shape

```text
React 19 + Vite Frontend (Control Room UI)
       |
       v
Express REST API (/api/v1)
       |
       +--> PostgreSQL (Prisma ORM — Durable Domain State)
       +--> Redis (ioredis — Cache, Queues, Rate Limits, Realtime Events)
       +--> FastAPI AI Boundary (/v1/predict/*, /v1/detect/*)
```

## Layer Responsibilities

1. **Express API Server:** Modular monolith using Controller -> Service -> Repository layers. Route handlers remain thin.
2. **PostgreSQL + Prisma:** Canonical database storing users, solar systems, energy telemetry, listings, demands, trades, transactions, payments, SHA-256 hash records, grid snapshots, predictions, and audit logs.
3. **Redis Infrastructure:** Temporary fast coordination layer. Provides caching, job queues, rate limiting, and pub/sub. Includes local fallback when Redis is absent.
4. **FastAPI AI Service:** Python service boundary for machine learning prediction models (generation, demand, pricing, anomaly detection).
5. **React Control Room UI:** High-fidelity dashboard, marketplace, grid monitoring, asset management, and activity feed.

## Core Workflow

```text
Generate Telemetry → Calculate Surplus → Create Listing / Demand →
Grid Aware Constraint Check → Multi-Factor Match → Price Discovery →
Execute Trade → Settle Transaction → Compute SHA-256 Hash → Append Audit Log
```