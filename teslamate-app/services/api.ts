import { isCar, type Car } from "../types/car";
import { isCharge, isChargeDetail, type Charge, type ChargeDetail } from "../types/charge";
import { isDrive, isDriveDetail, isDriveTrack, type Drive, type DriveDetail, type DriveTrack } from "../types/drive";
import { isStatistics, type Statistics, type StatisticsPeriod } from "../types/statistics";
import { isAnalysisReport, type AnalysisReport, type ReportKind } from "../types/analysis";

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

async function fetchApi(path: string, signal: AbortSignal) {
  const response = await fetch(`${apiUrl}${path}`, { signal });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(typeof body?.error?.message === "string" ? body.error.message : `服务端返回 HTTP ${response.status}`);
  }
  return body;
}

export async function fetchCars(signal: AbortSignal): Promise<Car[]> {
  const body = await fetchApi("/api/cars", signal);
  if (!Array.isArray(body?.cars) || !body.cars.every(isCar)) {
    throw new Error("车辆数据格式不正确，请检查服务端版本");
  }
  return body.cars;
}

export async function fetchDrives(carId: string, signal: AbortSignal): Promise<Drive[]> {
  const body = await fetchApi(`/api/cars/${encodeURIComponent(carId)}/drives`, signal);
  if (!Array.isArray(body?.drives) || !body.drives.every(isDrive)) {
    throw new Error("行程数据格式不正确，请检查服务端版本");
  }
  return body.drives;
}

export async function fetchDrive(carId: string, driveId: string, signal: AbortSignal): Promise<DriveDetail> {
  const body = await fetchApi(`/api/cars/${encodeURIComponent(carId)}/drives/${encodeURIComponent(driveId)}`, signal);
  if (!isDriveDetail(body?.drive)) {
    throw new Error("行程详情格式不正确，请检查服务端版本");
  }
  return body.drive;
}

export async function fetchDriveTrack(carId: string, driveId: string, signal: AbortSignal): Promise<DriveTrack> {
  const body = await fetchApi(`/api/cars/${encodeURIComponent(carId)}/drives/${encodeURIComponent(driveId)}/track`, signal);
  if (!isDriveTrack(body?.track)) {
    throw new Error("轨迹数据格式不正确，请检查服务端版本");
  }
  return body.track;
}

export async function fetchCharges(carId: string, signal: AbortSignal): Promise<Charge[]> {
  const body = await fetchApi(`/api/cars/${encodeURIComponent(carId)}/charges`, signal);
  if (!Array.isArray(body?.charges) || !body.charges.every(isCharge)) {
    throw new Error("充电记录格式不正确，请检查服务端版本");
  }
  return body.charges;
}

export async function fetchCharge(carId: string, chargeId: string, signal: AbortSignal): Promise<ChargeDetail> {
  const body = await fetchApi(`/api/cars/${encodeURIComponent(carId)}/charges/${encodeURIComponent(chargeId)}`, signal);
  if (!isChargeDetail(body?.charge)) {
    throw new Error("充电详情格式不正确，请检查服务端版本");
  }
  return body.charge;
}

export async function fetchStatistics(carId: number, days: StatisticsPeriod, signal: AbortSignal): Promise<Statistics> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const search = new URLSearchParams({ days: String(days), timeZone });
  const body = await fetchApi(`/api/cars/${carId}/statistics?${search}`, signal);
  if (!isStatistics(body?.statistics, days)) {
    throw new Error("统计数据格式不正确，请检查服务端版本");
  }
  return body.statistics;
}

export async function fetchAnalysisReport(
  carId: string, kind: ReportKind, days: StatisticsPeriod, page: number, signal: AbortSignal,
): Promise<AnalysisReport> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const search = new URLSearchParams({ days: String(days), page: String(page), timeZone });
  const body = await fetchApi(`/api/cars/${encodeURIComponent(carId)}/reports/${kind}?${search}`, signal);
  if (!isAnalysisReport(body?.report, page)) {
    throw new Error("报表数据格式不正确，请检查服务端版本");
  }
  return body.report;
}

export async function checkServerHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch(`${apiUrl}/health`, { signal });
  if (!response.ok) throw new Error(`服务端返回 HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (
    typeof body !== "object" || body === null ||
    !("status" in body) || body.status !== "ok" ||
    !("service" in body) || body.service !== "teslamate-server"
  ) {
    throw new Error("响应不符合 TeslaMate Server 格式，请检查服务地址");
  }
}
