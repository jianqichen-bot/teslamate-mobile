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
    CREATE TABLE cars (id integer PRIMARY KEY, name text, model text);
    CREATE TABLE states (id integer PRIMARY KEY, car_id integer, state text, start_date timestamp, end_date timestamp);
    CREATE TABLE positions (id integer PRIMARY KEY, car_id integer, date timestamp, battery_level integer, rated_battery_range_km numeric, odometer numeric);
  `);
  pool = createDatabase(url);
  assert.equal((await pool.query("SHOW default_transaction_read_only")).rows[0].default_transaction_read_only, "on");
  await assert.rejects(pool.query("INSERT INTO cars VALUES (99, 'forbidden', '3')"), { code: "25006" });
  const base = await listen(pool);
  assert.deepEqual(await (await fetch(`${base}/api/cars`)).json(), { cars: [] });
  await admin.query(`
    INSERT INTO cars VALUES (1, '测试车', '3'), (2, NULL, NULL);
    INSERT INTO states VALUES (1, 1, 'online', '2026-10-01 00:00:00', '2026-10-02 00:00:00'), (2, 1, 'asleep', '2026-10-02 00:00:00', NULL);
    INSERT INTO positions VALUES
      (1, 1, '2026-10-02 01:00:00', 50, 200.5, 10000.2),
      (2, 1, '2026-10-01 01:00:00', 80, 350, 9999),
      (3, 1, '2026-10-02 01:00:00', 0, 0, 10000.3);
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
  const unconfigured = await listen(null);
  assert.equal((await (await fetch(`${unconfigured}/api/cars`)).json()).error.code, "DATABASE_NOT_CONFIGURED");
  assert.equal((await fetch(`${unconfigured}/health`)).status, 200);
  await admin.query("DROP TABLE positions");
  const unavailable = await fetch(`${base}/api/cars`);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, "DATABASE_UNAVAILABLE");
  console.log("PASS: empty/multiple cars, missing telemetry, chronological/tied records, numeric zero, UTC, read-only enforcement, CORS, methods, health and database errors");
} finally {
  await Promise.all(servers.map((server) => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); })));
  await pool?.end();
  await admin?.end();
  docker("stop", container);
}
