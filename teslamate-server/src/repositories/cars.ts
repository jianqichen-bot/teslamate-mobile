import type { Pool } from "pg";

// Preserve cars without telemetry. TeslaMate timestamps are UTC; distances are km.
export const carsQuery = `
  SELECT c.id, c.name, c.model,
    s.state::text AS state,
    s.start_date AT TIME ZONE 'UTC' AS "stateSince",
    p.battery_level AS "batteryLevel",
    p.rated_battery_range_km::float8 AS "ratedRangeKm",
    p.odometer::float8 AS "odometerKm",
    p.date AT TIME ZONE 'UTC' AS "updatedAt"
  FROM cars c
  LEFT JOIN LATERAL (
    SELECT state, start_date FROM states
    WHERE car_id = c.id AND end_date IS NULL
    ORDER BY start_date DESC, id DESC LIMIT 1
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT battery_level, rated_battery_range_km, odometer, date
    FROM positions WHERE car_id = c.id
    ORDER BY date DESC, id DESC LIMIT 1
  ) p ON true
  ORDER BY c.id
`;

export async function listCars(pool: Pool) {
  return (await pool.query(carsQuery)).rows;
}
