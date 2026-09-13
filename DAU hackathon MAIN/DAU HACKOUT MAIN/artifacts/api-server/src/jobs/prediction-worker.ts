import { queueService } from "../infra/redis";
import { logger } from "../lib/logger";
import { predictionService } from "../services/prediction.service";
import { anomalyService } from "../services/anomaly.service";

export interface QueueJobPayload {
  id: string;
  type: "prediction.generation" | "prediction.demand" | "prediction.price" | "anomaly.detect";
  data: any;
  attempts?: number;
  maxAttempts?: number;
}

export class PredictionWorker {
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  async enqueueJob(type: QueueJobPayload["type"], data: any): Promise<boolean> {
    const payload: QueueJobPayload = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      data,
      attempts: 0,
      maxAttempts: 5,
    };

    logger.info({ jobId: payload.id, type }, "Enqueuing async prediction/anomaly job");
    return queueService.enqueue("prediction", payload);
  }

  startWorker(pollIntervalMs = 3000): void {
    if (this.intervalId) return;

    logger.info("Starting PredictionWorker queue consumer");
    this.intervalId = setInterval(() => this.processNextJob(), pollIntervalMs);
  }

  stopWorker(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async processNextJob(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const rawJob = await queueService.dequeue("prediction");
      if (!rawJob) {
        this.isProcessing = false;
        return;
      }

      const job = rawJob as QueueJobPayload;
      logger.info({ jobId: job.id, type: job.type, attempt: (job.attempts || 0) + 1 }, "Processing prediction worker job");

      await this.executeJob(job);
    } catch (error) {
      logger.error({ err: error }, "Error in prediction worker job processor");
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: QueueJobPayload): Promise<void> {
    const currentAttempt = (job.attempts || 0) + 1;
    const maxAttempts = job.maxAttempts || 5;

    try {
      switch (job.type) {
        case "prediction.generation":
          await predictionService.generateGenerationForecast(
            job.data.solarSystemId,
            job.data.horizonHours || 24
          );
          break;

        case "prediction.demand":
          await predictionService.generateDemandForecast(
            job.data.userId,
            job.data.region || "NCR-NORTH",
            job.data.horizonHours || 24
          );
          break;

        case "prediction.price":
          await predictionService.generatePriceSignal(
            job.data.region || "NCR-NORTH",
            job.data.surplusKwh || 50,
            job.data.demandKwh || 40
          );
          break;

        case "anomaly.detect":
          await anomalyService.evaluateAnomaly({
            userId: job.data.userId,
            entityType: job.data.entityType || "trade",
            entityId: job.data.entityId,
            metrics: job.data.metrics || {},
          });
          break;

        default:
          logger.warn({ type: job.type }, "Unknown job type in prediction worker");
      }
    } catch (error) {
      logger.warn({ jobId: job.id, attempt: currentAttempt, err: error }, "Job execution failed");
      if (currentAttempt < maxAttempts) {
        // Re-enqueue job with exponential backoff delay simulation
        job.attempts = currentAttempt;
        await queueService.enqueue("prediction", job);
      } else {
        logger.error({ jobId: job.id, maxAttempts }, "Job failed max retry attempts. Moving to DLQ.");
        await queueService.enqueue("prediction-dlq", { ...job, failedAt: new Date().toISOString(), error: String(error) });
      }
    }
  }
}

export const predictionWorker = new PredictionWorker();
