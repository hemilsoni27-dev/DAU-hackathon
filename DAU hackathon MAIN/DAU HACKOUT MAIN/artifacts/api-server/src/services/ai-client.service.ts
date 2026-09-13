import { logger } from "../lib/logger";

export type AiServiceStatus = "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";

export interface GenerationPredictionInput {
  solarSystemId?: string;
  capacityKw?: number;
  forecastHorizonHours?: number;
  historicalReadings?: Array<{ timestamp?: string; generationKwh: number; consumptionKwh: number }>;
}

export interface DemandPredictionInput {
  region?: string;
  consumerCount?: number;
  forecastHorizonHours?: number;
  historicalReadings?: Array<{ timestamp?: string; generationKwh: number; consumptionKwh: number }>;
}

export interface PricePredictionInput {
  region?: string;
  horizon?: string;
  surplusKwh: number;
  demandKwh: number;
}

export interface AnomalyDetectionInput {
  solarSystemId?: string;
  userId?: string;
  gridRegion?: string;
  metrics: Record<string, number>;
}

export interface ForecastPoint {
  timestamp: string;
  predictedGenerationKwh?: number;
  predictedDemandKwh?: number;
  confidence: number;
}

export interface PredictionServiceResponse {
  predictionType: string;
  horizon: string;
  status: string;
  generatedAt: string;
  modelVersion: string;
  payload: Record<string, any>;
  forecast: ForecastPoint[];
}

export class AiClientService {
  private baseUrl: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const defaultTimeout = process.env.NODE_ENV === "test" ? "500" : "10000";
    this.timeoutMs = parseInt(process.env.AI_SERVICE_TIMEOUT_MS || defaultTimeout, 10);
  }

  async checkHealth(): Promise<{ status: AiServiceStatus; details?: any }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const body = await res.json();
        return { status: "AVAILABLE", details: body };
      }
      return { status: "DEGRADED", details: { httpStatus: res.status } };
    } catch (error) {
      return { status: "UNAVAILABLE", details: { error: String(error) } };
    }
  }

  private async fetchWithTimeout<T>(path: string, body: any): Promise<T | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        logger.warn({ path, status: res.status }, "AI service returned non-200 status");
        return null;
      }

      const json = await res.json();
      return json as T;
    } catch (error) {
      logger.warn({ path, err: error }, "Failed to communicate with AI service endpoint");
      return null;
    }
  }

  async predictGeneration(input: GenerationPredictionInput): Promise<PredictionServiceResponse | null> {
    return this.fetchWithTimeout<PredictionServiceResponse>("/v1/predict/generation", input);
  }

  async predictDemand(input: DemandPredictionInput): Promise<PredictionServiceResponse | null> {
    return this.fetchWithTimeout<PredictionServiceResponse>("/v1/predict/demand", input);
  }

  async predictPrice(input: PricePredictionInput): Promise<PredictionServiceResponse | null> {
    return this.fetchWithTimeout<PredictionServiceResponse>("/v1/predict/price", input);
  }

  async detectAnomaly(input: AnomalyDetectionInput): Promise<PredictionServiceResponse | null> {
    return this.fetchWithTimeout<PredictionServiceResponse>("/v1/detect/anomaly", input);
  }
}

export const aiClientService = new AiClientService();
