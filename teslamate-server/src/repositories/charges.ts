import type { Pool } from "pg";

const summaryColumns = `
  cp.id,
  cp.start_date AT TIME ZONE 'UTC' AS "startedAt",
  cp.end_date AT TIME ZONE 'UTC' AS "endedAt",
  cp.duration_min AS "durationMinutes",
  cp.charge_energy_added::float8 AS "energyAddedKwh",
  cp.start_battery_level AS "startBatteryLevel",
  cp.end_battery_level AS "endBatteryLevel",
  COALESCE(NULLIF(g.name, ''), NULLIF(a.display_name, '')) AS location
`;

export async function listRecentCharges(pool: Pool, carId: number) {
  const { rows } = await pool.query(`
    SELECT ${summaryColumns}
    FROM cars c
    LEFT JOIN LATERAL (
      SELECT id, start_date, end_date, duration_min, charge_energy_added,
        start_battery_level, end_battery_level, address_id, geofence_id
      FROM charging_processes
      WHERE car_id = c.id AND end_date IS NOT NULL
      ORDER BY start_date DESC, id DESC
      LIMIT 20
    ) cp ON true
    LEFT JOIN addresses a ON a.id = cp.address_id
    LEFT JOIN geofences g ON g.id = cp.geofence_id
    WHERE c.id = $1::integer
    ORDER BY cp.start_date DESC, cp.id DESC
  `, [carId]);

  if (rows.length === 0) return null;
  return rows.filter((charge) => charge.id !== null);
}

export async function getCharge(pool: Pool, carId: number, chargeId: number) {
  const { rows } = await pool.query(`
    SELECT ${summaryColumns},
      cp.charge_energy_used::float8 AS "energyUsedKwh",
      cp.cost::float8 AS cost,
      power."peakPowerKw", power."powerSampled", power."powerPoints"
    FROM charging_processes cp
    LEFT JOIN addresses a ON a.id = cp.address_id
    LEFT JOIN geofences g ON g.id = cp.geofence_id
    LEFT JOIN LATERAL (
      SELECT max(peak)::float8 AS "peakPowerKw",
        COALESCE(sum(sample_count) > 120, false) AS "powerSampled",
        COALESCE(json_agg(json_build_object(
          'recordedAt', recorded_at AT TIME ZONE 'UTC', 'powerKw', average_power
        ) ORDER BY bucket), '[]'::json) AS "powerPoints"
      FROM (
        SELECT bucket, CASE WHEN bucket = 120 THEN max(date) ELSE min(date) END AS recorded_at,
          avg(charger_power)::float8 AS average_power, max(charger_power) AS peak, count(*) AS sample_count
        FROM (
          SELECT date, charger_power, ntile(120) OVER (ORDER BY date, id) AS bucket
          FROM charges
          WHERE charging_process_id = cp.id AND charger_power >= 0
        ) samples
        GROUP BY bucket
      ) buckets
    ) power ON true
    WHERE cp.car_id = $1::integer AND cp.id = $2::integer AND cp.end_date IS NOT NULL
  `, [carId, chargeId]);
  return rows[0] ?? null;
}
