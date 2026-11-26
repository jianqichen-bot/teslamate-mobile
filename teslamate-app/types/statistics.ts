export type StatisticsPeriod = 7 | 30 | 90;

type ActivityTotals = {
  driveCount: number;
  distanceKm: number | null;
  driveMinutes: number | null;
  chargeCount: number;
  energyAddedKwh: number | null;
  energyUsedKwh: number | null;
  chargeCost: number | null;
  chargeCostCount: number;
};

export type DailyActivity = ActivityTotals & { date: string };

export type Statistics = {
  days: StatisticsPeriod;
  timeZone: string;
  summary: ActivityTotals;
  daily: DailyActivity[];
};

function isTotals(value: unknown): value is ActivityTotals {
  if (typeof value !== "object" || value === null) return false;
  const totals = value as Partial<ActivityTotals>;
  return [totals.driveCount, totals.chargeCount, totals.chargeCostCount]
    .every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0)
    && [totals.distanceKm, totals.driveMinutes, totals.energyAddedKwh, totals.energyUsedKwh, totals.chargeCost]
      .every((amount) => amount === null || (typeof amount === "number" && Number.isFinite(amount)));
}

function isDailyActivity(value: unknown): value is DailyActivity {
  return isTotals(value) && "date" in value && typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date);
}

export function isStatistics(value: unknown, days: StatisticsPeriod): value is Statistics {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<Statistics>;
  return result.days === days && typeof result.timeZone === "string" && isTotals(result.summary)
    && Array.isArray(result.daily) && result.daily.length === days && result.daily.every(isDailyActivity);
}
