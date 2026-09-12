# AI API Reference Documentation

## Endpoints

### 1. AI Health
- `GET /v1/ai/health`: Returns Python FastAPI service connection and health status.

### 2. Predictions & Forecasting
- `GET /v1/ai/predictions`: List historical predictions with model versioning.
- `POST /v1/ai/predictions/generation`: Forecast solar generation output.
- `POST /v1/ai/predictions/demand`: Forecast consumer demand profile.
- `POST /v1/ai/predictions/price`: Forecast market price signals.

### 3. Smart Recommendations
- `GET /v1/recommendations/smart-sell`: Fetch Smart Sell recommendations.
- `GET /v1/recommendations/smart-buy`: Fetch Smart Buy recommendations.
- `POST /v1/recommendations/:id/dismiss`: Dismiss recommendation.

### 4. Anomaly Detection & Review
- `GET /v1/ai/anomalies`: List open or reviewed anomalies.
- `POST /v1/ai/anomalies/detect`: Evaluate trade/meter metrics for anomalies.
- `POST /v1/ai/anomalies/:id/review`: Transition anomaly status (`RESOLVED`, `DISMISSED`).

### 5. AI Energy Assistant
- `POST /v1/assistant/chat`: Process user queries with contextual grid data.
- `GET /v1/assistant/context`: Debug endpoint returning sanitized user context.
