export type Drive = {
  id: number;
  startedAt: string;
  endedAt: string;
  distanceKm: number | null;
  durationMinutes: number | null;
};

export type DriveDetail = Drive & {
  startLocation: string | null;
  endLocation: string | null;
  startBatteryLevel: number | null;
  endBatteryLevel: number | null;
  estimatedEnergyKwh: number | null;
};

export type TrackPoint = { latitude: number; longitude: number };

export type DriveTrack = {
  recordedPointCount: number;
  points: TrackPoint[];
};

export function isRouteId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647;
}

export function isDrive(value: unknown): value is Drive {
  if (typeof value !== "object" || value === null) return false;
  const drive = value as Partial<Drive>;
  return typeof drive.id === "number" && Number.isSafeInteger(drive.id) && drive.id > 0
    && typeof drive.startedAt === "string" && Number.isFinite(Date.parse(drive.startedAt))
    && typeof drive.endedAt === "string" && Number.isFinite(Date.parse(drive.endedAt))
    && (drive.distanceKm === null || Number.isFinite(drive.distanceKm))
    && (drive.durationMinutes === null || Number.isFinite(drive.durationMinutes));
}

export function isDriveDetail(value: unknown): value is DriveDetail {
  if (!isDrive(value)) return false;
  const drive = value as Partial<DriveDetail>;
  return [drive.startLocation, drive.endLocation].every((location) => location === null || typeof location === "string")
    && [drive.startBatteryLevel, drive.endBatteryLevel, drive.estimatedEnergyKwh].every((amount) => amount === null || Number.isFinite(amount));
}

function isTrackPoint(value: unknown): value is TrackPoint {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Partial<TrackPoint>;
  return typeof point.latitude === "number" && Math.abs(point.latitude) <= 90
    && typeof point.longitude === "number" && Math.abs(point.longitude) <= 180;
}

export function isDriveTrack(value: unknown): value is DriveTrack {
  if (typeof value !== "object" || value === null) return false;
  const track = value as Partial<DriveTrack>;
  return typeof track.recordedPointCount === "number" && Number.isSafeInteger(track.recordedPointCount)
    && track.recordedPointCount >= 0 && Array.isArray(track.points)
    && track.points.length === Math.min(track.recordedPointCount, 360) && track.points.every(isTrackPoint);
}
