const SCALE = 10_000n;

function parseScaled(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(normalized)) {
    throw new Error("Energy values must be non-negative decimal quantities");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0") || "0");
}

function formatScaled(value: bigint): string {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(4, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function calculateSurplus(generationKwh: string, consumptionKwh: string) {
  const netSurplus = parseScaled(generationKwh) - parseScaled(consumptionKwh);
  return {
    netSurplusKwh: formatScaled(netSurplus),
    marketableSurplusKwh: formatScaled(netSurplus > 0n ? netSurplus : 0n),
  };
}

export function assertPositiveEnergy(value: string, fieldName: string) {
  if (parseScaled(value) <= 0n) {
    throw new Error(`${fieldName} must be greater than zero`);
  }
}

export function assertValidAvailability(
  availableFrom: Date,
  availableUntil: Date,
) {
  if (availableUntil <= availableFrom) {
    throw new Error("availableUntil must be after availableFrom");
  }
}