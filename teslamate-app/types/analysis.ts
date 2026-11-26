export type ReportKind = "drives" | "charges" | "states" | "updates" | "timeline" | "journeys"
  | "places" | "battery" | "efficiency" | "drain" | "database" | "mileage";

export type ReportRow = Record<string, number | string | null>;
export type AnalysisReport = {
  from: string;
  to: string;
  page: number;
  rowCount: number;
  metrics: Record<string, number | null>;
  rows: ReportRow[];
  version?: string;
};

function numeric(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAnalysisReport(value: unknown, page: number): value is AnalysisReport {
  return isRecord(value) && value.page === page
    && typeof value.from === "string" && Number.isFinite(Date.parse(value.from))
    && typeof value.to === "string" && Number.isFinite(Date.parse(value.to))
    && typeof value.rowCount === "number" && Number.isSafeInteger(value.rowCount) && value.rowCount >= 0
    && (value.version === undefined || typeof value.version === "string")
    && isRecord(value.metrics) && Object.values(value.metrics).every((item) => item === null || numeric(item))
    && Array.isArray(value.rows) && value.rows.every((row) =>
      isRecord(row) && Object.values(row).every((item) => item === null || typeof item === "string" || numeric(item)));
}

export function amount(row: ReportRow, key: string) {
  const value = row[key];
  return typeof value === "number" ? value : null;
}

export function field(row: ReportRow, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}
