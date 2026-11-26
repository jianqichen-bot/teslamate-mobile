import type { Pool } from "pg";

const driveEvents = `
  SELECT d.id, 'drive' AS kind, NULL::text AS label,
    COALESCE(NULLIF(sg.name, ''), NULLIF(sa.display_name, '')) AS "startPlace",
    COALESCE(NULLIF(eg.name, ''), NULLIF(ea.display_name, '')) AS "endPlace",
    d.start_date AS started, d.end_date AS ended, d.duration_min::float8 AS minutes,
    d.distance::float8 AS amount, NULL::float8 AS cost,
    d.start_km::float8 AS "startOdometer", d.end_km::float8 AS "endOdometer"
  FROM drives d JOIN target c ON d.car_id = c.id CROSS JOIN bounds b
  LEFT JOIN addresses sa ON sa.id = d.start_address_id
  LEFT JOIN addresses ea ON ea.id = d.end_address_id
  LEFT JOIN geofences sg ON sg.id = d.start_geofence_id
  LEFT JOIN geofences eg ON eg.id = d.end_geofence_id
  WHERE d.start_date BETWEEN b.first_at AND b.last_at AND d.end_date <= b.last_at
`;

const chargeEvents = `
  SELECT p.id, 'charge' AS kind, COALESCE(NULLIF(g.name, ''), NULLIF(a.display_name, '')) AS label,
    NULL::text AS "startPlace", NULL::text AS "endPlace", p.start_date AS started, p.end_date AS ended,
    p.duration_min::float8 AS minutes, p.charge_energy_added::float8 AS amount, p.cost::float8 AS cost,
    NULL::float8 AS "startOdometer", NULL::float8 AS "endOdometer"
  FROM charging_processes p JOIN target c ON p.car_id = c.id CROSS JOIN bounds b
  LEFT JOIN addresses a ON a.id = p.address_id
  LEFT JOIN geofences g ON g.id = p.geofence_id
  WHERE p.start_date BETWEEN b.first_at AND b.last_at AND p.end_date <= b.last_at
`;

const stateEvents = `
  SELECT s.id, 'state' AS kind, s.state::text AS label,
    NULL::text AS "startPlace", NULL::text AS "endPlace",
    GREATEST(s.start_date, b.first_at) AS started, s.end_date AS ended,
    extract(epoch FROM LEAST(COALESCE(s.end_date, b.last_at), b.last_at) - GREATEST(s.start_date, b.first_at))::float8 / 60 AS minutes,
    NULL::float8 AS amount, NULL::float8 AS cost, NULL::float8 AS "startOdometer", NULL::float8 AS "endOdometer"
  FROM states s JOIN target c ON s.car_id = c.id CROSS JOIN bounds b
  WHERE s.start_date <= b.last_at AND (s.end_date IS NULL OR s.end_date > b.first_at)
`;

const updateEvents = `
  SELECT u.id, 'update' AS kind, u.version AS label,
    NULL::text AS "startPlace", NULL::text AS "endPlace", u.start_date AS started, u.end_date AS ended,
    extract(epoch FROM u.end_date - u.start_date)::float8 / 60 AS minutes,
    NULL::float8 AS amount, NULL::float8 AS cost, NULL::float8 AS "startOdometer", NULL::float8 AS "endOdometer"
  FROM updates u JOIN target c ON u.car_id = c.id CROSS JOIN bounds b
  WHERE u.start_date BETWEEN b.first_at AND b.last_at
`;

function events(...sources: string[]) {
  return `
    WITH records AS (${sources.join(" UNION ALL ")}),
    page AS (
      SELECT id, kind, label, "startPlace", "endPlace", minutes, amount, cost, "startOdometer", "endOdometer",
        started AT TIME ZONE 'UTC' AS "startedAt", ended AT TIME ZONE 'UTC' AS "endedAt"
      FROM records ORDER BY started DESC, kind, id DESC LIMIT 30 OFFSET ($4::integer - 1) * 30
    )
    SELECT (SELECT count(*)::int FROM records) AS "rowCount",
      (SELECT json_build_object(
        'distanceKm', sum(amount) FILTER (WHERE kind = 'drive'),
        'energyAddedKwh', sum(amount) FILTER (WHERE kind = 'charge'),
        'driveCount', count(*) FILTER (WHERE kind = 'drive'),
        'chargeCount', count(*) FILTER (WHERE kind = 'charge'),
        'driveMinutes', sum(minutes) FILTER (WHERE kind = 'drive'),
        'chargeMinutes', sum(minutes) FILTER (WHERE kind = 'charge'),
        'coveredMinutes', sum(minutes) FILTER (WHERE kind = 'state'),
        'asleepMinutes', sum(minutes) FILTER (WHERE kind = 'state' AND label = 'asleep'),
        'offlineMinutes', sum(minutes) FILTER (WHERE kind = 'state' AND label = 'offline'),
        'onlineMinutes', sum(minutes) FILTER (WHERE kind = 'state' AND label = 'online')
      ) FROM records) AS metrics,
      COALESCE((SELECT json_agg(page ORDER BY "startedAt" DESC, kind, id DESC) FROM page), '[]'::json) AS rows
  `;
}

const places = `
  WITH visits AS (
    SELECT COALESCE('g' || g.id::text, 'a' || a.id::text) AS key,
      COALESCE(NULLIF(g.name, ''), NULLIF(a.display_name, '')) AS label,
      a.city, a.state, a.country, COALESCE(g.latitude, a.latitude)::float8 AS latitude,
      COALESCE(g.longitude, a.longitude)::float8 AS longitude, d.end_date AS visited
    FROM drives d JOIN target c ON d.car_id = c.id CROSS JOIN bounds b
    LEFT JOIN addresses a ON a.id = d.end_address_id
    LEFT JOIN geofences g ON g.id = d.end_geofence_id
    WHERE d.end_date BETWEEN b.first_at AND b.last_at
  ), destinations AS (
    SELECT key, label, max(city) AS city, max(state) AS state, max(country) AS country,
      max(latitude) AS latitude, max(longitude) AS longitude, count(*)::int AS count,
      max(visited) AT TIME ZONE 'UTC' AS "lastVisitedAt"
    FROM visits WHERE label IS NOT NULL
    GROUP BY key, label
  ), page AS (
    SELECT * FROM destinations ORDER BY count DESC, "lastVisitedAt" DESC, key LIMIT 30 OFFSET ($4::integer - 1) * 30
  )
  SELECT (SELECT count(*)::int FROM destinations) AS "rowCount",
    (SELECT json_build_object('visits', count(*),
      'cities', count(DISTINCT NULLIF(city, '')), 'regions', count(DISTINCT NULLIF(state, '')),
      'countries', count(DISTINCT NULLIF(country, ''))) FROM visits WHERE label IS NOT NULL) AS metrics,
    COALESCE((SELECT json_agg(page ORDER BY count DESC, "lastVisitedAt" DESC, key) FROM page), '[]'::json) AS rows
`;

const battery = `
  WITH readings AS (
    SELECT p.date AS at, p.battery_level AS level, p.rated_battery_range_km AS rated, 0 AS source, p.id
    FROM positions p JOIN target c ON p.car_id = c.id CROSS JOIN bounds b
    WHERE p.date BETWEEN b.first_at AND b.last_at
    UNION ALL
    SELECT p.date AS at, p.battery_level AS level, NULL::numeric AS rated, 1 AS source, p.id
    FROM charges p JOIN charging_processes session ON p.charging_process_id = session.id
    JOIN target c ON session.car_id = c.id CROSS JOIN bounds b
    WHERE session.start_date >= b.first_at - interval '7 days' AND session.start_date <= b.last_at
      AND p.date BETWEEN b.first_at AND b.last_at
  ), daily AS (
    SELECT to_char((at AT TIME ZONE 'UTC') AT TIME ZONE $3, 'YYYY-MM-DD') AS date,
      (min(level) FILTER (WHERE level BETWEEN 0 AND 100))::float8 AS "minLevel",
      (max(level) FILTER (WHERE level BETWEEN 0 AND 100))::float8 AS "maxLevel",
      (array_agg(level ORDER BY at DESC, source DESC, id DESC) FILTER (WHERE level BETWEEN 0 AND 100))[1]::float8 AS "latestLevel",
      (array_agg(rated ORDER BY at DESC, id DESC) FILTER (WHERE rated >= 0))[1]::float8 AS "ratedRangeKm",
      (avg(rated * 100 / NULLIF(level, 0)) FILTER (WHERE level BETWEEN 90 AND 100 AND rated > 0))::float8 AS "fullRangeKm",
      (avg(rated * 100 / NULLIF(level, 0)) FILTER (WHERE level BETWEEN 20 AND 100 AND rated > 0))::float8 AS "projectedRangeKm"
    FROM readings WHERE level BETWEEN 0 AND 100 OR rated >= 0 GROUP BY 1
  )
  SELECT count(*)::int AS "rowCount", json_build_object(
    'latestLevel', (array_agg("latestLevel" ORDER BY date DESC) FILTER (WHERE "latestLevel" IS NOT NULL))[1],
    'ratedRangeKm', (array_agg("ratedRangeKm" ORDER BY date DESC) FILTER (WHERE "ratedRangeKm" IS NOT NULL))[1],
    'fullRangeKm', (array_agg("fullRangeKm" ORDER BY date DESC) FILTER (WHERE "fullRangeKm" IS NOT NULL))[1],
    'capacityKwh', (array_agg("fullRangeKm" ORDER BY date DESC) FILTER (WHERE "fullRangeKm" IS NOT NULL))[1]
      * (SELECT efficiency FROM target WHERE efficiency > 0),
    'peakFullRangeKm', max("fullRangeKm"), 'sampleDays', count("fullRangeKm"),
    'projectedRangeKm', (array_agg("projectedRangeKm" ORDER BY date DESC) FILTER (WHERE "projectedRangeKm" IS NOT NULL))[1]
  ) AS metrics, COALESCE(json_agg(daily ORDER BY date), '[]'::json) AS rows
  FROM daily
`;

const efficiency = `
  WITH drives_data AS (
    SELECT to_char((d.start_date AT TIME ZONE 'UTC') AT TIME ZONE $3, 'YYYY-MM-DD') AS date,
      d.distance AS distance,
      (d.start_rated_range_km - d.end_rated_range_km) * c.efficiency AS energy
    FROM drives d JOIN target c ON d.car_id = c.id CROSS JOIN bounds b
    WHERE d.start_date BETWEEN b.first_at AND b.last_at AND d.end_date <= b.last_at
      AND d.distance > 0 AND c.efficiency > 0 AND d.start_rated_range_km > d.end_rated_range_km
  ), daily AS (
    SELECT date, sum(distance)::float8 AS "distanceKm", sum(energy)::float8 AS "energyKwh",
      (100 * sum(energy) / sum(distance))::float8 AS "kwhPer100Km"
    FROM drives_data GROUP BY date
  ), totals AS (
    SELECT count(*)::int AS samples, sum(distance)::float8 AS "distanceKm",
      sum(energy)::float8 AS "energyKwh", (100 * sum(energy) / NULLIF(sum(distance), 0))::float8 AS "kwhPer100Km"
    FROM drives_data
  )
  SELECT (SELECT count(*)::int FROM daily) AS "rowCount", (SELECT row_to_json(totals) FROM totals) AS metrics,
    COALESCE((SELECT json_agg(daily ORDER BY date) FROM daily), '[]'::json) AS rows
`;

const drain = `
  WITH activity AS (
    SELECT d.id, 'drive' AS kind, d.start_date AS started, d.end_date AS ended
    FROM drives d JOIN target c ON d.car_id = c.id CROSS JOIN bounds b
    WHERE d.end_date BETWEEN b.first_at AND b.last_at
    UNION ALL
    SELECT p.id, 'charge' AS kind, p.start_date AS started, p.end_date AS ended
    FROM charging_processes p JOIN target c ON p.car_id = c.id CROSS JOIN bounds b
    WHERE p.end_date BETWEEN b.first_at AND b.last_at
  ), gaps AS (
    SELECT id, kind, started AS end_date,
      max(ended) OVER (ORDER BY started, kind, id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS start_date
    FROM activity
  ), samples AS (
    SELECT i.id, i.kind, i.start_date AT TIME ZONE 'UTC' AS "startedAt", i.end_date AT TIME ZONE 'UTC' AS "endedAt",
      extract(epoch FROM i.end_date - i.start_date)::float8 / 60 AS minutes,
      begin_sample.battery_level::float8 AS "startLevel", end_sample.battery_level::float8 AS "endLevel",
      (begin_sample.battery_level - end_sample.battery_level)::float8 AS loss,
      CASE WHEN begin_sample.rated_battery_range_km >= end_sample.rated_battery_range_km AND c.efficiency > 0
        THEN ((begin_sample.rated_battery_range_km - end_sample.rated_battery_range_km) * c.efficiency)::float8 END AS "energyKwh"
    FROM gaps i CROSS JOIN target c CROSS JOIN bounds b
    JOIN LATERAL (
      SELECT p.battery_level, p.odometer, p.rated_battery_range_km FROM positions p
      WHERE p.car_id = c.id AND p.date BETWEEN i.start_date - interval '15 minutes' AND i.start_date
        AND p.battery_level BETWEEN 0 AND 100 AND p.odometer IS NOT NULL ORDER BY p.date DESC, p.id DESC LIMIT 1
    ) begin_sample ON true
    JOIN LATERAL (
      SELECT p.battery_level, p.odometer, p.rated_battery_range_km FROM positions p
      WHERE p.car_id = c.id AND p.date BETWEEN i.end_date AND i.end_date + interval '15 minutes'
        AND p.date <= b.last_at AND p.battery_level BETWEEN 0 AND 100 AND p.odometer IS NOT NULL ORDER BY p.date, p.id LIMIT 1
    ) end_sample ON true
    WHERE i.end_date >= i.start_date + interval '30 minutes'
      AND end_sample.battery_level <= begin_sample.battery_level
      AND end_sample.odometer - begin_sample.odometer >= 0 AND end_sample.odometer - begin_sample.odometer < 1
      AND NOT EXISTS (SELECT 1 FROM drives d WHERE d.car_id = c.id AND d.end_date IS NULL
        AND d.start_date >= i.start_date AND d.start_date < i.end_date)
      AND NOT EXISTS (SELECT 1 FROM charging_processes p WHERE p.car_id = c.id AND p.end_date IS NULL
        AND p.start_date >= i.start_date AND p.start_date < i.end_date)
  ), page AS (
    SELECT * FROM samples ORDER BY "startedAt" DESC, kind, id DESC LIMIT 30 OFFSET ($4::integer - 1) * 30
  )
  SELECT (SELECT count(*)::int FROM samples) AS "rowCount",
    (SELECT json_build_object('minutes', sum(minutes), 'loss', sum(loss),
      'energyKwh', sum("energyKwh"), 'lossPerDay', 1440 * sum(loss) / NULLIF(sum(minutes), 0)) FROM samples) AS metrics,
    COALESCE((SELECT json_agg(page ORDER BY "startedAt" DESC, kind, id DESC) FROM page), '[]'::json) AS rows
`;

const database = `
  SELECT 0 AS "rowCount", json_build_object(
    'sizeBytes', pg_database_size(current_database())::float8,
    'driveCount', (SELECT count(*) FROM drives d WHERE d.car_id = c.id AND d.start_date BETWEEN b.first_at AND b.last_at),
    'chargeCount', (SELECT count(*) FROM charging_processes p WHERE p.car_id = c.id AND p.start_date BETWEEN b.first_at AND b.last_at),
    'positionCount', (SELECT count(*) FROM positions p WHERE p.car_id = c.id AND p.date BETWEEN b.first_at AND b.last_at)
  ) AS metrics, '[]'::json AS rows, current_setting('server_version') AS version
  FROM target c CROSS JOIN bounds b
`;

const mileage = `
  WITH readings AS (
    SELECT to_char((p.date AT TIME ZONE 'UTC') AT TIME ZONE $3, 'YYYY-MM-DD') AS date, p.date AS at,
      p.id, p.odometer
    FROM positions p JOIN target c ON p.car_id = c.id CROSS JOIN bounds b
    WHERE p.date BETWEEN b.first_at AND b.last_at AND p.odometer >= 0
  ), daily AS (
    SELECT date, (array_agg(odometer ORDER BY at DESC, id DESC))[1]::float8 AS "odometerKm"
    FROM readings GROUP BY date
  ), totals AS (
    SELECT (array_agg(odometer ORDER BY at, id))[1]::float8 AS "firstKm",
      (array_agg(odometer ORDER BY at DESC, id DESC))[1]::float8 AS "lastKm", count(*)::int AS samples
    FROM readings
  )
  SELECT (SELECT count(*)::int FROM daily) AS "rowCount", (SELECT row_to_json(totals) FROM totals) AS metrics,
    COALESCE((SELECT json_agg(daily ORDER BY date) FROM daily), '[]'::json) AS rows
`;

const queries = {
  drives: events(driveEvents),
  charges: events(chargeEvents),
  states: events(stateEvents),
  updates: events(updateEvents),
  timeline: events(driveEvents, chargeEvents, stateEvents, updateEvents),
  journeys: events(driveEvents, chargeEvents),
  places,
  battery,
  efficiency,
  drain,
  database,
  mileage,
};

type AnalysisReport = keyof typeof queries;

export function isAnalysisReport(value: string): value is AnalysisReport {
  return Object.hasOwn(queries, value);
}

export async function getAnalysis(pool: Pool, carId: number, report: AnalysisReport, days: number, timeZone: string, page: number) {
  const { rows: [result] } = await pool.query(`
    WITH target AS (SELECT id, efficiency FROM cars WHERE id = $1::integer),
    bounds AS (
      SELECT (((statement_timestamp() AT TIME ZONE $3)::date - ($2::integer - 1))::timestamp
        AT TIME ZONE $3) AT TIME ZONE 'UTC' AS first_at,
        statement_timestamp() AT TIME ZONE 'UTC' AS last_at,
        $4::integer AS page_number
    )
    SELECT (SELECT min(id) FROM target) AS "carId", bounds.first_at AT TIME ZONE 'UTC' AS "from",
      bounds.last_at AT TIME ZONE 'UTC' AS "to", report.*
    FROM bounds LEFT JOIN LATERAL (${queries[report]}) report ON true
  `, [carId, days, timeZone, page]);
  if (result.carId === null) return null;
  const { carId: _carId, ...data } = result;
  return { ...data, page };
}
