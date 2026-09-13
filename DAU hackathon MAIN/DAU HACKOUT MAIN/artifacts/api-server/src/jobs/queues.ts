export const GRIDTRADE_QUEUES = [
  "prediction",
  "pricing",
  "matching",
  "anomaly-detection",
  "transaction-hashing",
  "notifications",
  "webhook",
] as const;

export type GridTradeQueue = (typeof GRIDTRADE_QUEUES)[number];