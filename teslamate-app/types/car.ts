export interface Car {
  id: number;
  name: string | null;
  model: string | null;
  state: string | null;
  stateSince: string | null;
  batteryLevel: number | null;
  ratedRangeKm: number | null;
  odometerKm: number | null;
  updatedAt: string | null;
}

export function isCar(value: unknown): value is Car {
  if (typeof value !== "object" || value === null) return false;
  const car = value as Record<string, unknown>;
  return Number.isSafeInteger(car.id) &&
    ["name", "model", "state"].every((key) => car[key] === null || typeof car[key] === "string") &&
    ["stateSince", "updatedAt"].every((key) => car[key] === null ||
      (typeof car[key] === "string" && Number.isFinite(Date.parse(car[key])))) &&
    ["batteryLevel", "ratedRangeKm", "odometerKm"].every((key) => car[key] === null ||
      (typeof car[key] === "number" && Number.isFinite(car[key])));
}
