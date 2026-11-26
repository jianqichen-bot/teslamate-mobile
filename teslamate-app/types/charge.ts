export type Charge = {
  id: number;
  startedAt: string;
  endedAt: string;
  durationMinutes: number | null;
  energyAddedKwh: number | null;
  startBatteryLevel: number | null;
  endBatteryLevel: number | null;
  location: string | null;
};

export type ChargePowerPoint = { recordedAt: string; powerKw: number };

export type ChargeDetail = Charge & {
  energyUsedKwh: number | null;
  cost: number | null;
  peakPowerKw: number | null;
  powerSampled: boolean;
  powerPoints: ChargePowerPoint[];
};

function isDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNullableNumber(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isCharge(value: unknown): value is Charge {
  if (typeof value !== "object" || value === null) return false;
  const charge = value as Partial<Charge>;
  return typeof charge.id === "number" && Number.isSafeInteger(charge.id) && charge.id > 0
    && isDate(charge.startedAt) && isDate(charge.endedAt)
    && (charge.location === null || typeof charge.location === "string")
    && [charge.durationMinutes, charge.energyAddedKwh, charge.startBatteryLevel, charge.endBatteryLevel].every(isNullableNumber);
}

function isPowerPoint(value: unknown): value is ChargePowerPoint {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Partial<ChargePowerPoint>;
  return isDate(point.recordedAt) && typeof point.powerKw === "number" && Number.isFinite(point.powerKw) && point.powerKw >= 0;
}

export function isChargeDetail(value: unknown): value is ChargeDetail {
  if (!isCharge(value)) return false;
  const detail = value as Partial<ChargeDetail>;
  return [detail.energyUsedKwh, detail.cost, detail.peakPowerKw].every(isNullableNumber)
    && typeof detail.powerSampled === "boolean"
    && Array.isArray(detail.powerPoints) && detail.powerPoints.length <= 120 && detail.powerPoints.every(isPowerPoint);
}
