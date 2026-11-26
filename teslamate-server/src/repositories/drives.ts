import type { Pool } from "pg";

export async function listRecentDrives(pool: Pool, carId: number) {
  const { rows } = await pool.query(`
    SELECT d.id,
      d.start_date AT TIME ZONE 'UTC' AS "startedAt",
      d.end_date AT TIME ZONE 'UTC' AS "endedAt",
      d.distance::float8 AS "distanceKm",
      d.duration_min AS "durationMinutes"
    FROM cars c
    LEFT JOIN LATERAL (
      SELECT id, start_date, end_date, distance, duration_min
      FROM drives
      WHERE car_id = c.id AND end_date IS NOT NULL
      ORDER BY start_date DESC, id DESC
      LIMIT 20
    ) d ON true
    WHERE c.id = $1::integer
    ORDER BY d.start_date DESC, d.id DESC
  `, [carId]);

  if (rows.length === 0) return null;
  return rows.filter((drive) => drive.id !== null);
}

export async function getDrive(pool: Pool, carId: number, driveId: number) {
  const { rows } = await pool.query(`
    SELECT d.id,
      d.start_date AT TIME ZONE 'UTC' AS "startedAt",
      d.end_date AT TIME ZONE 'UTC' AS "endedAt",
      d.distance::float8 AS "distanceKm",
      d.duration_min AS "durationMinutes",
      COALESCE(NULLIF(sg.name, ''), NULLIF(sa.display_name, '')) AS "startLocation",
      COALESCE(NULLIF(eg.name, ''), NULLIF(ea.display_name, '')) AS "endLocation",
      sp.battery_level AS "startBatteryLevel",
      ep.battery_level AS "endBatteryLevel",
      CASE
        WHEN d.start_rated_range_km > d.end_rated_range_km AND c.efficiency > 0
        THEN ((d.start_rated_range_km - d.end_rated_range_km) * c.efficiency)::float8
      END AS "estimatedEnergyKwh"
    FROM drives d
    JOIN cars c ON c.id = d.car_id
    LEFT JOIN positions sp ON sp.id = d.start_position_id AND sp.car_id = c.id
    LEFT JOIN positions ep ON ep.id = d.end_position_id AND ep.car_id = c.id
    LEFT JOIN addresses sa ON sa.id = d.start_address_id
    LEFT JOIN addresses ea ON ea.id = d.end_address_id
    LEFT JOIN geofences sg ON sg.id = d.start_geofence_id
    LEFT JOIN geofences eg ON eg.id = d.end_geofence_id
    WHERE d.car_id = $1::integer AND d.id = $2::integer AND d.end_date IS NOT NULL
  `, [carId, driveId]);
  return rows[0] ?? null;
}

export async function getDriveTrack(pool: Pool, carId: number, driveId: number) {
  const pointLimit = 360;
  const { rows } = await pool.query(`
    WITH drive AS (
      SELECT id, car_id FROM drives
      WHERE car_id = $1::integer AND id = $2::integer AND end_date IS NOT NULL
    ), ordered AS (
      SELECT p.latitude::float8 AS latitude, p.longitude::float8 AS longitude,
        row_number() OVER (ORDER BY p.date, p.id) AS point_number, count(*) OVER () AS point_count
      FROM drive d JOIN positions p ON p.drive_id = d.id AND p.car_id = d.car_id
      WHERE p.latitude BETWEEN -90 AND 90 AND p.longitude BETWEEN -180 AND 180
    )
    SELECT COALESCE(max(point_count), 0)::int AS "recordedPointCount",
      COALESCE(json_agg(json_build_object('latitude', latitude, 'longitude', longitude) ORDER BY point_number)
        FILTER (WHERE point_number IS NOT NULL), '[]'::json) AS points
    FROM drive
    LEFT JOIN ordered ON point_number = 1
      OR ((point_number - 1) * ($3::integer - 1)) / GREATEST(point_count - 1, 1)
        > ((point_number - 2) * ($3::integer - 1)) / GREATEST(point_count - 1, 1)
    GROUP BY drive.id
  `, [carId, driveId, pointLimit]);
  return rows[0] ?? null;
}
