import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import pg from "pg";
import { createApp } from "../dist/server.js";
import { createDatabase } from "../dist/config/database.js";

// Only this disposable container receives fixture writes; no user DATABASE_URL is read.
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const container = docker("run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=fixture-only", "-p", "127.0.0.1::5432", "postgres:17-alpine");
const servers = [];
let admin;
let pool;
async function listen(database) {
  const server = createApp(database, ["http://localhost:8081"]);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}
try {
  const port = docker("port", container, "5432/tcp").split(":").at(-1);
  const url = `postgresql://postgres:fixture-only@127.0.0.1:${port}/postgres`;
  admin = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 1000 });
  for (let attempt = 0; ; attempt++) {
    try { await admin.query("SELECT 1"); break; }
    catch (error) { if (attempt >= 100) throw error; await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  await admin.query(`
    CREATE TABLE cars (id smallint PRIMARY KEY, name text, model text, efficiency numeric);
    CREATE TABLE states (id integer PRIMARY KEY, car_id integer, state text, start_date timestamp, end_date timestamp);
    CREATE TABLE positions (
      id integer PRIMARY KEY, car_id integer, date timestamp, battery_level integer, rated_battery_range_km numeric,
      odometer numeric, drive_id integer, latitude numeric, longitude numeric
    );
    CREATE TABLE drives (
      id integer PRIMARY KEY, car_id smallint, start_date timestamp NOT NULL, end_date timestamp,
      distance numeric, duration_min integer, start_position_id integer, end_position_id integer,
      start_address_id integer, end_address_id integer, start_geofence_id integer, end_geofence_id integer,
      start_rated_range_km numeric, end_rated_range_km numeric, start_km numeric, end_km numeric
    );
    CREATE TABLE addresses (id integer PRIMARY KEY, display_name text, city text, state text, country text, latitude numeric, longitude numeric);
    CREATE TABLE geofences (id integer PRIMARY KEY, name text, latitude numeric, longitude numeric);
    CREATE TABLE updates (id integer PRIMARY KEY, car_id smallint, start_date timestamp, end_date timestamp, version text);
    CREATE TABLE charging_processes (
      id integer PRIMARY KEY, car_id smallint, start_date timestamp NOT NULL, end_date timestamp,
      duration_min smallint, charge_energy_added numeric, charge_energy_used numeric, cost numeric,
      start_battery_level smallint, end_battery_level smallint, address_id integer, geofence_id integer
    );
    CREATE TABLE charges (id integer PRIMARY KEY, charging_process_id integer, date timestamp NOT NULL, charger_power smallint, battery_level smallint);
  `);
  pool = createDatabase(url);
  assert.equal((await pool.query("SHOW default_transaction_read_only")).rows[0].default_transaction_read_only, "on");
  await assert.rejects(pool.query("INSERT INTO cars VALUES (99, 'forbidden', '3')"), { code: "25006" });
  const base = await listen(pool);
  assert.deepEqual(await (await fetch(`${base}/api/cars`)).json(), { cars: [] });
  await admin.query(`
    INSERT INTO cars VALUES (1, '测试车', '3', 0.15), (2, NULL, NULL, NULL);
    INSERT INTO states VALUES (1, 1, 'online', '2026-10-01 00:00:00', '2026-10-02 00:00:00'), (2, 1, 'asleep', '2026-10-02 00:00:00', NULL);
    INSERT INTO positions (id, car_id, date, battery_level, rated_battery_range_km, odometer) VALUES
      (1, 1, '2026-10-02 01:00:00', 50, 200.5, 10000.2),
      (2, 1, '2026-10-01 01:00:00', 80, 350, 9999),
      (3, 1, '2026-10-02 01:00:00', 0, 0, 10000.3);
    INSERT INTO drives (id, car_id, start_date, end_date, distance, duration_min) VALUES
      (1, 1, '2026-10-02 01:00:00', '2026-10-02 02:00:00', 12.34, 60),
      (2, 1, '2026-10-02 01:00:00', '2026-10-02 01:00:45', 0, 0),
      (3, 1, '2026-10-03 01:00:00', NULL, NULL, NULL),
      (4, 2, '2026-10-04 01:00:00', '2026-10-04 01:05:00', NULL, NULL);
    INSERT INTO drives (id, car_id, start_date, end_date, distance, duration_min)
      SELECT id, 1, '2026-10-01 00:00:00', '2026-10-01 00:15:00', 1, 15
      FROM generate_series(10, 31) AS id;
    INSERT INTO addresses (id, display_name) VALUES (1, '出发地址'), (2, '到达地址');
    INSERT INTO geofences (id, name) VALUES (1, '家');
    UPDATE drives SET start_position_id = 2, end_position_id = 3, start_address_id = 1, end_address_id = 2,
      start_geofence_id = 1, start_rated_range_km = 350, end_rated_range_km = 330 WHERE id = 1;
    INSERT INTO charging_processes VALUES
      (1, 1, '2026-10-05 00:00:00', '2026-10-05 00:30:00', 30, 10.5, 11.8, 0, 40, 65, 2, 1),
      (2, 1, '2026-10-05 00:00:00', '2026-10-05 04:00:00', 240, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (3, 1, '2026-10-06 00:00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (4, 2, '2026-10-07 00:00:00', '2026-10-07 01:00:00', 60, NULL, NULL, NULL, NULL, NULL, 2, NULL);
    INSERT INTO charging_processes (id, car_id, start_date, end_date)
      SELECT id, 1, '2026-10-01 00:00:00', '2026-10-01 00:15:00' FROM generate_series(10, 31) AS id;
    INSERT INTO charges (id, charging_process_id, date, charger_power) VALUES
      (1, 1, '2026-10-05 00:00:00', 0),
      (2, 1, '2026-10-05 00:10:00', 23),
      (3, 1, '2026-10-05 00:20:00', NULL),
      (4, 1, '2026-10-05 00:25:00', -1),
      (5, 3, '2026-10-06 00:00:00', 50);
    INSERT INTO charges (id, charging_process_id, date, charger_power)
      SELECT id + 100, 2, timestamp '2026-10-05 00:00:00' + (id - 1) * interval '1 minute',
        CASE WHEN id = 241 THEN 100 ELSE 4 END
      FROM generate_series(1, 241) AS id;
  `);
  const response = await fetch(`${base}/api/cars`, { headers: { Origin: "http://localhost:8081" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:8081");
  const { cars } = await response.json();
  assert.equal(cars.length, 2);
  assert.deepEqual(cars[0], { id: 1, name: "测试车", model: "3", state: "asleep", stateSince: "2026-10-02T00:00:00.000Z", batteryLevel: 0, ratedRangeKm: 0, odometerKm: 10000.3, updatedAt: "2026-10-02T01:00:00.000Z" });
  assert.equal(cars[1].batteryLevel, null);
  assert.equal(cars[1].updatedAt, null);
  assert.equal(cars[1].state, null);
  assert.equal((await fetch(`${base}/api/cars`, { headers: { Origin: "https://untrusted.example" } })).status, 403);
  assert.equal((await fetch(`${base}/api/cars`, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${base}/api/cars`, { method: "OPTIONS" })).status, 204);
  assert.equal(await (await fetch(`${base}/api/cars`, { method: "HEAD" })).text(), "");
  assert.equal((await fetch(`${base}/missing`)).status, 404);
  const driveResponse = await fetch(`${base}/api/cars/1/drives`, { headers: { Origin: "http://localhost:8081" } });
  assert.equal(driveResponse.status, 200);
  assert.equal(driveResponse.headers.get("access-control-allow-origin"), "http://localhost:8081");
  const { drives } = await driveResponse.json();
  assert.deepEqual(drives.map((drive) => drive.id), [2, 1, ...Array.from({ length: 18 }, (_, index) => 31 - index)]);
  assert.deepEqual(drives[0], { id: 2, startedAt: "2026-10-02T01:00:00.000Z", endedAt: "2026-10-02T01:00:45.000Z", distanceKm: 0, durationMinutes: 0 });
  assert.equal(drives[1].distanceKm, 12.34);
  const detail = await fetch(`${base}/api/cars/1/drives/1`);
  assert.equal(detail.status, 200);
  assert.deepEqual(await detail.json(), {
    drive: { ...drives[1], startLocation: "家", endLocation: "到达地址", startBatteryLevel: 80, endBatteryLevel: 0, estimatedEnergyKwh: 3 },
  });
  const incompleteTelemetry = await (await fetch(`${base}/api/cars/1/drives/2`)).json();
  assert.equal(incompleteTelemetry.drive.estimatedEnergyKwh, null);
  assert.equal(incompleteTelemetry.drive.startLocation, null);
  assert.equal(incompleteTelemetry.drive.startBatteryLevel, null);
  for (const url of ["/api/cars/2/drives/1", "/api/cars/1/drives/3", "/api/cars/1/drives/9999", "/api/cars/2147483647/drives/1"]) {
    const missing = await fetch(`${base}${url}`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "DRIVE_NOT_FOUND");
  }
  const badDrive = await fetch(`${base}/api/cars/1/drives/invalid`);
  assert.equal(badDrive.status, 400);
  assert.equal((await badDrive.json()).error.code, "INVALID_DRIVE_ID");
  await admin.query(`
    INSERT INTO positions (id, car_id, drive_id, date, latitude, longitude) VALUES
      (201, 1, 1, '2026-10-02 01:00:00', 30.12, 120.12),
      (200, 1, 1, '2026-10-02 01:00:00', 30.11, 120.11),
      (202, 1, 1, '2026-10-02 01:05:00', 30.2, 120.2),
      (203, 2, 1, '2026-10-02 01:05:00', 30.3, 120.3),
      (204, 1, 1, '2026-10-02 01:05:00', 100, 120.4),
      (205, 1, 1, '2026-10-02 01:05:00', NULL, 120.5),
      (206, 1, 3, '2026-10-02 01:05:00', 30.6, 120.6);
    INSERT INTO positions (id, car_id, drive_id, date, latitude, longitude)
      SELECT n + 1000, 1, 2, timestamp '2026-10-02 01:00:00' + n * interval '0.05 second', 30, n / 1000.0
      FROM generate_series(1, 721) AS n;
  `);
  const trackResponse = await fetch(`${base}/api/cars/1/drives/1/track`, { headers: { Origin: "http://localhost:8081" } });
  assert.equal(trackResponse.status, 200);
  assert.equal(trackResponse.headers.get("access-control-allow-origin"), "http://localhost:8081");
  assert.deepEqual(await trackResponse.json(), { track: { recordedPointCount: 3, points: [
    { latitude: 30.11, longitude: 120.11 }, { latitude: 30.12, longitude: 120.12 }, { latitude: 30.2, longitude: 120.2 },
  ] } });
  const { track: sampledTrack } = await (await fetch(`${base}/api/cars/1/drives/2/track`)).json();
  assert.equal(sampledTrack.recordedPointCount, 721);
  assert.equal(sampledTrack.points.length, 360);
  assert.equal(sampledTrack.points[0].longitude, 0.001);
  assert.equal(sampledTrack.points.at(-1).longitude, 0.721);
  assert.ok(sampledTrack.points.every((point, index, samples) => index === 0 || point.longitude > samples[index - 1].longitude));
  assert.deepEqual(await (await fetch(`${base}/api/cars/1/drives/10/track`)).json(), { track: { recordedPointCount: 0, points: [] } });
  for (const path of ["/api/cars/2/drives/1/track", "/api/cars/1/drives/3/track", "/api/cars/1/drives/9999/track"]) {
    assert.equal((await fetch(`${base}${path}`)).status, 404);
  }
  assert.equal((await fetch(`${base}/api/cars/1/drives/0/track`)).status, 400);
  const chargeList = await fetch(`${base}/api/cars/1/charges`, { headers: { Origin: "http://localhost:8081" } });
  assert.equal(chargeList.status, 200);
  assert.equal(chargeList.headers.get("access-control-allow-origin"), "http://localhost:8081");
  const { charges } = await chargeList.json();
  assert.deepEqual(charges.map((charge) => charge.id), [2, 1, ...Array.from({ length: 18 }, (_, index) => 31 - index)]);
  assert.deepEqual(charges[1], {
    id: 1, startedAt: "2026-10-05T00:00:00.000Z", endedAt: "2026-10-05T00:30:00.000Z",
    durationMinutes: 30, energyAddedKwh: 10.5, startBatteryLevel: 40, endBatteryLevel: 65, location: "家",
  });
  const chargeDetail = await fetch(`${base}/api/cars/1/charges/1`);
  assert.equal(chargeDetail.status, 200);
  const { charge } = await chargeDetail.json();
  assert.deepEqual({ ...charge, powerPoints: charge.powerPoints.map((point) => [new Date(point.recordedAt).toISOString(), point.powerKw]) }, {
    ...charges[1], energyUsedKwh: 11.8, cost: 0, peakPowerKw: 23, powerSampled: false,
    powerPoints: [["2026-10-05T00:00:00.000Z", 0], ["2026-10-05T00:10:00.000Z", 23]],
  });
  const { charge: longCharge } = await (await fetch(`${base}/api/cars/1/charges/2`)).json();
  assert.equal(longCharge.powerPoints.length, 120);
  assert.equal(longCharge.powerSampled, true);
  assert.equal(longCharge.peakPowerKw, 100);
  assert.equal(new Date(longCharge.powerPoints.at(-1).recordedAt).toISOString(), "2026-10-05T04:00:00.000Z");
  const { charge: noPower } = await (await fetch(`${base}/api/cars/2/charges/4`)).json();
  assert.equal(noPower.location, "到达地址");
  assert.equal(noPower.cost, null);
  assert.equal(noPower.peakPowerKw, null);
  assert.equal(noPower.powerSampled, false);
  assert.deepEqual(noPower.powerPoints, []);
  for (const url of ["/api/cars/2/charges/1", "/api/cars/1/charges/3", "/api/cars/2147483647/charges/1"]) {
    const missing = await fetch(`${base}${url}`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "CHARGE_NOT_FOUND");
  }
  const invalidCharge = await fetch(`${base}/api/cars/1/charges/invalid`);
  assert.equal(invalidCharge.status, 400);
  assert.equal((await invalidCharge.json()).error.code, "INVALID_CHARGE_ID");
  assert.equal((await fetch(`${base}/api/cars/2147483647/charges`)).status, 404);
  await admin.query("DELETE FROM charging_processes WHERE car_id = 2");
  assert.deepEqual(await (await fetch(`${base}/api/cars/2/charges`)).json(), { charges: [] });
  await admin.query(`
    INSERT INTO cars VALUES (3, '统计测试车', '3', NULL), (4, '空车', '3', NULL);
    WITH clock AS (
      SELECT ((now() AT TIME ZONE 'Asia/Shanghai')::date::timestamp AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC' AS midnight
    )
    INSERT INTO drives (id, car_id, start_date, end_date, distance, duration_min)
    SELECT event.id, 3, midnight + event.start_offset, midnight + event.end_offset, event.distance, event.minutes
    FROM clock CROSS JOIN (VALUES
      (1000, interval '-6 days', interval '-6 days 1 hour', 45.5, 60),
      (1001, interval '-6 days -1 second', interval '-5 days', 99, 60),
      (1002, interval '-1 day', interval '-1 day 1 hour', 0, 60),
      (1003, interval '-2 days', NULL, 99, 20),
      (1004, interval '1 day', interval '2 days', 99, 20)
    ) AS event(id, start_offset, end_offset, distance, minutes);
    WITH clock AS (
      SELECT ((now() AT TIME ZONE 'Asia/Shanghai')::date::timestamp AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC' AS midnight
    )
    INSERT INTO charging_processes (id, car_id, start_date, end_date, charge_energy_added, charge_energy_used, cost)
    SELECT event.id, 3, midnight + event.start_offset, midnight + event.end_offset, event.added, event.used, event.cost
    FROM clock CROSS JOIN (VALUES
      (1000, interval '-2 days', interval '-2 days 1 hour', 10.5, 11.5, 0),
      (1001, interval '-1 day', interval '-1 day 1 hour', 20, NULL, NULL),
      (1002, interval '-4 days', interval '2 days', 99, 100, 200)
    ) AS event(id, start_offset, end_offset, added, used, cost);
  `);
  const statisticsResponse = await fetch(`${base}/api/cars/3/statistics?days=7&timeZone=Asia%2FShanghai`, { headers: { Origin: "http://localhost:8081" } });
  assert.equal(statisticsResponse.status, 200);
  assert.equal(statisticsResponse.headers.get("access-control-allow-origin"), "http://localhost:8081");
  const { statistics } = await statisticsResponse.json();
  assert.equal(statistics.days, 7);
  assert.equal(statistics.timeZone, "Asia/Shanghai");
  assert.equal(statistics.daily.length, 7);
  assert.deepEqual(statistics.summary, {
    driveCount: 2, distanceKm: 45.5, driveMinutes: 120, chargeCount: 2, energyAddedKwh: 30.5,
    energyUsedKwh: 11.5, chargeCost: 0, chargeCostCount: 1,
  });
  assert.equal(statistics.daily[0].distanceKm, 45.5);
  assert.equal(statistics.daily[1].distanceKm, null);
  assert.equal(statistics.daily.at(-2).distanceKm, 0);
  const { statistics: longer } = await (await fetch(`${base}/api/cars/3/statistics?days=90&timeZone=Asia%2FShanghai`)).json();
  assert.equal(longer.daily.length, 90);
  assert.equal(longer.summary.distanceKm, 144.5);
  const { statistics: emptyStatistics } = await (await fetch(`${base}/api/cars/4/statistics`)).json();
  assert.equal(emptyStatistics.daily.length, 30);
  assert.equal(emptyStatistics.summary.driveCount, 0);
  assert.equal(emptyStatistics.summary.chargeCount, 0);
  assert.equal(emptyStatistics.summary.chargeCost, null);
  assert.equal((await fetch(`${base}/api/cars/2147483647/statistics`)).status, 404);
  for (const query of ["days=14", "timeZone=Invalid%2FZone", "timeZone=%2B08%3A00"]) {
    const invalid = await fetch(`${base}/api/cars/3/statistics?${query}`);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_STATISTICS_RANGE");
  }
  await admin.query(`
    UPDATE cars SET efficiency = 0.15 WHERE id = 3;
    UPDATE drives SET start_rated_range_km = 400, end_rated_range_km = 380,
      start_km = 1500, end_km = 1545.5, end_address_id = 2, end_geofence_id = 1 WHERE id = 1000;
    UPDATE drives SET end_address_id = 1, end_geofence_id = 1 WHERE id = 1002;
    UPDATE addresses SET city = '测试市', state = '测试省', country = '测试国' WHERE id = 2;
    UPDATE geofences SET latitude = 30, longitude = 120 WHERE id = 1;
    INSERT INTO updates
      SELECT n, 3, (now() AT TIME ZONE 'UTC') - interval '1 day', (now() AT TIME ZONE 'UTC') - interval '23 hours', 'fixture.' || n
      FROM generate_series(1, 35) AS n;
    WITH clock AS (
      SELECT ((now() AT TIME ZONE 'Asia/Shanghai')::date::timestamp AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC' AS midnight
    )
    INSERT INTO positions (id, car_id, date, battery_level, rated_battery_range_km, odometer)
    SELECT sample.id, 3, midnight + sample.offset_at, sample.level, sample.rated, sample.odometer FROM clock
    CROSS JOIN (VALUES
      (2001, interval '-2 days 1 hour', 95, 380, 2000),
      (2002, interval '-1 day', 90, 350, 2000.1)
    ) AS sample(id, offset_at, level, rated, odometer);
  `);
  const reportsUrl = `${base}/api/cars/3/reports`;
  const range = "?days=7&timeZone=Asia%2FShanghai";
  const readReport = async (kind, suffix = "") => {
    const response = await fetch(`${reportsUrl}/${kind}${range}${suffix}`, { headers: { Origin: "http://localhost:8081" } });
    assert.equal(response.status, 200, kind);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:8081");
    return (await response.json()).report;
  };
  const driveReport = await readReport("drives");
  assert.equal(driveReport.rowCount, 2);
  assert.equal(driveReport.rows.find((row) => row.id === 1000).startOdometer, 1500);
  const chargeReport = await readReport("charges");
  assert.equal(chargeReport.rowCount, 2);
  assert.equal(chargeReport.rows.find((row) => row.id === 1000).cost, 0);
  const updatesReport = await readReport("updates", "&page=2");
  assert.equal(updatesReport.page, 2);
  assert.equal(updatesReport.rowCount, 35);
  assert.deepEqual(updatesReport.rows.map((row) => row.id), [5, 4, 3, 2, 1]);
  const destinations = await readReport("places");
  assert.equal(destinations.rowCount, 1);
  assert.equal(destinations.metrics.visits, 2);
  assert.equal(destinations.rows[0].label, "家");
  const batteryReport = await readReport("battery");
  assert.equal(batteryReport.metrics.latestLevel, 90);
  assert.ok(batteryReport.metrics.capacityKwh > 0);
  const efficiencyReport = await readReport("efficiency");
  assert.equal(efficiencyReport.metrics.samples, 1);
  assert.equal(efficiencyReport.metrics.energyKwh, 3);
  assert.equal((await readReport("mileage")).metrics.lastKm, 2000.1);
  assert.ok((await readReport("drain")).rows.some((row) => row.startLevel === 95 && row.endLevel === 90 && row.loss === 5));
  for (const kind of ["timeline", "journeys", "states", "database"]) assert.ok(Array.isArray((await readReport(kind)).rows));
  assert.equal((await fetch(`${reportsUrl}/not-a-report${range}`)).status, 404);
  assert.equal((await fetch(`${reportsUrl}/drives${range}&page=0`)).status, 400);
  assert.equal((await fetch(`${base}/api/cars/2147483647/reports/places${range}`)).status, 404);
  assert.deepEqual(await (await fetch(`${base}/api/cars/2/drives`)).json(), {
    drives: [{ id: 4, startedAt: "2026-10-04T01:00:00.000Z", endedAt: "2026-10-04T01:05:00.000Z", distanceKm: null, durationMinutes: null }],
  });
  await admin.query("DELETE FROM drives WHERE car_id = 2");
  assert.deepEqual(await (await fetch(`${base}/api/cars/2/drives`)).json(), { drives: [] });
  const unknownCar = await fetch(`${base}/api/cars/99/drives`);
  assert.equal(unknownCar.status, 404);
  assert.equal((await unknownCar.json()).error.code, "CAR_NOT_FOUND");
  assert.equal((await fetch(`${base}/api/cars/2147483647/drives`)).status, 404);
  for (const carId of ["abc", "0", "1.5", "2147483648", "1%20OR%201=1"]) {
    const invalidCar = await fetch(`${base}/api/cars/${carId}/drives`);
    assert.equal(invalidCar.status, 400);
    assert.equal((await invalidCar.json()).error.code, "INVALID_CAR_ID");
  }
  const unconfigured = await listen(null);
  assert.equal((await (await fetch(`${unconfigured}/api/cars`)).json()).error.code, "DATABASE_NOT_CONFIGURED");
  assert.equal((await (await fetch(`${unconfigured}/api/cars/1/drives`)).json()).error.code, "DATABASE_NOT_CONFIGURED");
  assert.equal((await fetch(`${unconfigured}/health`)).status, 200);
  await admin.query("DROP TABLE positions");
  const unavailable = await fetch(`${base}/api/cars`);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, "DATABASE_UNAVAILABLE");
  await admin.query("DROP TABLE drives");
  const drivesUnavailable = await fetch(`${base}/api/cars/1/drives`);
  assert.equal(drivesUnavailable.status, 503);
  assert.equal((await drivesUnavailable.json()).error.code, "DATABASE_UNAVAILABLE");
  console.log("PASS: vehicles, drives and charges, sampled power, ordering, limits, missing data, UTC, read-only enforcement, CORS, methods, health and database errors");
} finally {
  await Promise.all(servers.map((server) => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); })));
  await pool?.end();
  await admin?.end();
  docker("stop", container);
}
