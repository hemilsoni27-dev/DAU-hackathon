from datetime import datetime, timezone, timedelta
from typing import Literal, List, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="GridTrade AI Service",
    version="1.0.0",
    description="Intelligent Forecasting, Pricing Signal, Anomaly Detection, and AI Assistance Boundary for GridTrade.",
)


class HistoricalReadingItem(BaseModel):
    timestamp: str | None = None
    generationKwh: float = 0.0
    consumptionKwh: float = 0.0


class GenerationPredictionRequest(BaseModel):
    solarSystemId: str | None = None
    capacityKw: float = Field(default=10.0, alias="capacity_kw")
    forecastHorizonHours: int = Field(default=24, alias="forecast_horizon_hours")
    historicalReadings: List[HistoricalReadingItem] = Field(default_factory=list, alias="historical_readings")

    class Config:
        populate_by_name = True


class DemandPredictionRequest(BaseModel):
    region: str = "NCR-NORTH"
    consumerCount: int = Field(default=100, alias="consumer_count")
    forecastHorizonHours: int = Field(default=24, alias="forecast_horizon_hours")
    historicalReadings: List[HistoricalReadingItem] = Field(default_factory=list, alias="historical_readings")

    class Config:
        populate_by_name = True


class PricePredictionRequest(BaseModel):
    region: str = "NCR-NORTH"
    horizon: str = "24h"
    surplusKwh: float = Field(default=50.0, alias="surplus_kwh")
    demandKwh: float = Field(default=40.0, alias="demand_kwh")

    class Config:
        populate_by_name = True


class AnomalyDetectionRequest(BaseModel):
    solarSystemId: str | None = Field(default=None, alias="solar_system_id")
    userId: str | None = Field(default=None, alias="user_id")
    gridRegion: str | None = Field(default=None, alias="grid_region")
    metrics: Dict[str, float] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class ForecastPoint(BaseModel):
    timestamp: str
    predictedGenerationKwh: float | None = None
    predictedDemandKwh: float | None = None
    confidence: float


class PredictionResponse(BaseModel):
    predictionType: str
    horizon: str
    status: str = "ok"
    generatedAt: str
    modelVersion: str
    payload: Dict[str, Any]
    forecast: List[ForecastPoint] = Field(default_factory=list)


@app.get("/health")
@app.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "gridtrade-ai", "version": "1.0.0"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"status": "ready", "service": "gridtrade-ai"}


@app.post("/v1/predict/generation", response_model=PredictionResponse)
def predict_generation(req: GenerationPredictionRequest) -> PredictionResponse:
    now = datetime.now(timezone.utc)
    model_version = "generation-forecast-v1.0"
    
    historical_gen = [r.generationKwh for r in req.historicalReadings if r.generationKwh > 0]
    base_avg = sum(historical_gen) / len(historical_gen) if historical_gen else (req.capacityKw * 0.42)
    
    forecast_points: List[ForecastPoint] = []
    total_projected = 0.0
    
    for h in range(1, req.forecastHorizonHours + 1):
        future_time = now + timedelta(hours=h)
        hour = future_time.hour
        
        if 6 <= hour <= 18:
            solar_factor = 1.0 - ((hour - 12) / 6.0) ** 2
            solar_factor = max(0.05, solar_factor)
        else:
            solar_factor = 0.0
            
        gen_val = round(base_avg * solar_factor * 1.1, 2)
        total_projected += gen_val
        confidence = round(0.85 + (0.10 if historical_gen else 0.0), 2)
        
        forecast_points.append(
            ForecastPoint(
                timestamp=future_time.isoformat(),
                predictedGenerationKwh=gen_val,
                confidence=confidence
            )
        )
        
    return PredictionResponse(
        predictionType="generation",
        horizon=f"{req.forecastHorizonHours}h",
        generatedAt=now.isoformat(),
        modelVersion=model_version,
        payload={
            "projectedGenerationKwh": round(total_projected, 2),
            "peakWindow": "11:00-14:00",
            "confidence": 0.88,
        },
        forecast=forecast_points
    )


@app.post("/v1/predict/demand", response_model=PredictionResponse)
def predict_demand(req: DemandPredictionRequest) -> PredictionResponse:
    now = datetime.now(timezone.utc)
    model_version = "demand-forecast-v1.0"
    
    historical_con = [r.consumptionKwh for r in req.historicalReadings if r.consumptionKwh > 0]
    base_demand = sum(historical_con) / len(historical_con) if historical_con else (req.consumerCount * 0.45)
    
    forecast_points: List[ForecastPoint] = []
    total_demand = 0.0
    
    for h in range(1, req.forecastHorizonHours + 1):
        future_time = now + timedelta(hours=h)
        hour = future_time.hour
        
        if 7 <= hour <= 9:
            demand_factor = 1.35
        elif 18 <= hour <= 22:
            demand_factor = 1.50
        elif 0 <= hour <= 5:
            demand_factor = 0.40
        else:
            demand_factor = 0.90
            
        demand_val = round(base_demand * demand_factor, 2)
        total_demand += demand_val
        confidence = round(0.82 + (0.08 if historical_con else 0.0), 2)
        
        forecast_points.append(
            ForecastPoint(
                timestamp=future_time.isoformat(),
                predictedDemandKwh=demand_val,
                confidence=confidence
            )
        )
        
    return PredictionResponse(
        predictionType="demand",
        horizon=f"{req.forecastHorizonHours}h",
        generatedAt=now.isoformat(),
        modelVersion=model_version,
        payload={
            "projectedDemandKwh": round(total_demand, 2),
            "region": req.region,
            "confidence": 0.86,
        },
        forecast=forecast_points
    )


@app.post("/v1/predict/price", response_model=PredictionResponse)
def predict_price(req: PricePredictionRequest) -> PredictionResponse:
    now = datetime.now(timezone.utc)
    model_version = "price-signal-v1.0"
    
    base_price = 4.80
    ratio = req.demandKwh / max(req.surplusKwh, 1.0)
    indicative = round(base_price * max(0.7, min(1.8, ratio)), 2)
    bounded_price = max(3.50, min(7.50, indicative))
    
    return PredictionResponse(
        predictionType="price",
        horizon=req.horizon,
        generatedAt=now.isoformat(),
        modelVersion=model_version,
        payload={
            "indicativePriceInrPerKwh": bounded_price,
            "region": req.region,
            "confidence": 0.89,
            "marketSignal": "HIGH_DEMAND" if ratio > 1.2 else ("SURPLUS" if ratio < 0.8 else "BALANCED")
        }
    )


@app.post("/v1/detect/anomaly", response_model=PredictionResponse)
def detect_anomaly(req: AnomalyDetectionRequest) -> PredictionResponse:
    now = datetime.now(timezone.utc)
    model_version = "anomaly-rule-v1.0"
    
    metrics = req.metrics
    trade_freq = metrics.get("trade_frequency", 0.0)
    cancel_rate = metrics.get("cancellation_rate", 0.0)
    energy_kwh = metrics.get("energy_kwh", 0.0)
    price_inr = metrics.get("price_inr", 0.0)
    freq_hz = metrics.get("frequency_hz", 50.0)
    
    reasons = []
    score = 0.05
    severity = "LOW"
    
    if trade_freq > 15:
        score += 0.40
        reasons.append(f"Unusually high trade frequency: {trade_freq} trades/min")
    if cancel_rate > 0.50:
        score += 0.35
        reasons.append(f"High order cancellation rate: {int(cancel_rate * 100)}%")
    if energy_kwh > 500:
        score += 0.25
        reasons.append(f"Abnormal single trade volume: {energy_kwh} kWh")
    if price_inr > 12.0 or (price_inr > 0 and price_inr < 2.0):
        score += 0.30
        reasons.append(f"Price signal outside expected grid bounds: ₹{price_inr}/kWh")
    if freq_hz < 49.5 or freq_hz > 50.5:
        score += 0.45
        reasons.append(f"Grid frequency deviation detected: {freq_hz} Hz")
        
    score = min(1.0, round(score, 2))
    
    if score >= 0.75:
        severity = "CRITICAL" if score >= 0.90 else "HIGH"
    elif score >= 0.40:
        severity = "MEDIUM"
    else:
        severity = "LOW"
        
    return PredictionResponse(
        predictionType="anomaly",
        horizon="realtime",
        generatedAt=now.isoformat(),
        modelVersion=model_version,
        payload={
            "score": score,
            "severity": severity,
            "reasons": reasons if reasons else ["Metrics within expected baseline bounds"],
            "isAnomalous": score >= 0.50
        }
    )