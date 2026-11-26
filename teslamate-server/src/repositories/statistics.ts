import type { Pool } from "pg";

export async function getStatistics(pool: Pool, carId: number, days: number, timeZone: string) {
  const { rows: [totals, ...daily] } = await pool.query(`
    WITH bounds AS (
      SELECT ((statement_timestamp() AT TIME ZONE $3)::date - ($2::integer - 1)) AS first_day,
        statement_timestamp() AT TIME ZONE 'UTC' AS as_of_utc
    ), calendar_bounds AS (
      SELECT first_day, as_of_utc, (first_day::timestamp AT TIME ZONE $3) AT TIME ZONE 'UTC' AS start_utc
      FROM bounds
    ), drive_days AS (
      SELECT ((d.start_date AT TIME ZONE 'UTC') AT TIME ZONE $3)::date AS day,
        count(*) AS drive_count, sum(d.distance) AS distance_km, sum(d.duration_min) AS drive_minutes
      FROM drives d CROSS JOIN calendar_bounds b
      WHERE d.car_id = $1::integer AND d.start_date >= b.start_utc AND d.start_date <= b.as_of_utc
        AND d.end_date <= b.as_of_utc
      GROUP BY 1
    ), charge_days AS (
      SELECT ((cp.start_date AT TIME ZONE 'UTC') AT TIME ZONE $3)::date AS day,
        count(*) AS charge_count, sum(cp.charge_energy_added) AS energy_added,
        sum(cp.charge_energy_used) AS energy_used, sum(cp.cost) AS cost, count(cp.cost) AS cost_count
      FROM charging_processes cp CROSS JOIN calendar_bounds b
      WHERE cp.car_id = $1::integer AND cp.start_date >= b.start_utc AND cp.start_date <= b.as_of_utc
        AND cp.end_date <= b.as_of_utc
      GROUP BY 1
    ), calendar AS (
      SELECT b.first_day + n AS day FROM calendar_bounds b CROSS JOIN generate_series(0, $2::integer - 1) AS n
      WHERE EXISTS (SELECT 1 FROM cars WHERE id = $1::integer)
    )
    SELECT to_char(calendar.day, 'YYYY-MM-DD') AS date,
      COALESCE(sum(d.drive_count), 0)::int AS "driveCount",
      sum(d.distance_km)::float8 AS "distanceKm",
      sum(d.drive_minutes)::float8 AS "driveMinutes",
      COALESCE(sum(cp.charge_count), 0)::int AS "chargeCount",
      sum(cp.energy_added)::float8 AS "energyAddedKwh",
      sum(cp.energy_used)::float8 AS "energyUsedKwh",
      sum(cp.cost)::float8 AS "chargeCost",
      COALESCE(sum(cp.cost_count), 0)::int AS "chargeCostCount"
    FROM calendar
    LEFT JOIN drive_days d ON d.day = calendar.day
    LEFT JOIN charge_days cp ON cp.day = calendar.day
    GROUP BY GROUPING SETS ((), (calendar.day))
    ORDER BY calendar.day NULLS FIRST
  `, [carId, days, timeZone]);

  if (daily.length === 0) return null;
  const { date: _date, ...summary } = totals;
  return { days, timeZone, summary, daily };
}
