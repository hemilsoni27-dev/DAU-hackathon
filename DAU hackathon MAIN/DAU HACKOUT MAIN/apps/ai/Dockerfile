# ─── Runtime Stage (no separate build needed for Python) ──────────────────────
FROM python:3.12-slim AS runtime

# Create non-root user
RUN addgroup --system gridtrade && adduser --system --ingroup gridtrade gridtrade

WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY apps/ai/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY apps/ai/ ./

USER gridtrade

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
