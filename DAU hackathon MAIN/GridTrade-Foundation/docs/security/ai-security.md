# AI Security, Boundaries & Rate Limiting

## 1. Safety Boundaries

The AI Assistant and Forecasting Layer are **strictly decision-support tools** and have no autonomous execution authority:
- **No Direct Database Mutations**: The AI Energy Assistant cannot create, edit, or delete listings, trades, payments, or ledger records.
- **No Direct Financial Execution**: Purchases and payments require explicit authenticated user action through regular authorization middleware.
- **Sanitized Context**: User context passed to AI providers contains only non-sensitive energy metrics, role metadata, and grid states.

---

## 2. Rate Limiting & Protection

Redis-backed sliding window rate limiters are applied to AI endpoints:
- **AI Energy Assistant**: 30 requests / minute / user.
- **Prediction Generation**: 20 requests / minute / user.
- **Anomaly Ingestion**: Bounded according to system role.
