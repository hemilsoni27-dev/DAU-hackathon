# GridTrade AI service

This FastAPI service is an explicit boundary for generation, demand, pricing,
and anomaly models. The foundation intentionally returns a deterministic
boundary response instead of pretending to provide a trained forecast.

```bash
uvicorn main:app --reload --port 8000
```