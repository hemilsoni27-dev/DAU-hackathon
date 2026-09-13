import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_predict_generation():
    payload = {
        "solarSystemId": "sys-001",
        "capacity_kw": 10.0,
        "forecast_horizon_hours": 24,
        "historical_readings": [
            {"timestamp": "2026-09-13T06:00:00Z", "generationKwh": 4.5, "consumptionKwh": 1.2}
        ]
    }
    res = client.post("/v1/predict/generation", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["predictionType"] == "generation"
    assert len(data["forecast"]) == 24
    assert data["payload"]["projectedGenerationKwh"] >= 0.0

def test_predict_demand():
    payload = {
        "region": "KA_BLR_01",
        "consumer_count": 50,
        "forecast_horizon_hours": 12,
        "historical_readings": []
    }
    res = client.post("/v1/predict/demand", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["predictionType"] == "demand"
    assert len(data["forecast"]) == 12

def test_predict_price():
    payload = {
        "region": "KA_BLR_01",
        "horizon": "24h",
        "surplus_kwh": 50.0,
        "demand_kwh": 100.0
    }
    res = client.post("/v1/predict/price", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["predictionType"] == "price"
    assert 3.50 <= data["payload"]["indicativePriceInrPerKwh"] <= 7.50
    assert data["payload"]["marketSignal"] == "HIGH_DEMAND"

def test_detect_anomaly():
    payload = {
        "grid_region": "KA_BLR_01",
        "metrics": {
            "trade_frequency": 22.0,
            "cancellation_rate": 0.65,
            "frequency_hz": 48.8
        }
    }
    res = client.post("/v1/detect/anomaly", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["predictionType"] == "anomaly"
    assert data["payload"]["severity"] in ["HIGH", "CRITICAL"]
    assert data["payload"]["flagged"] is True
