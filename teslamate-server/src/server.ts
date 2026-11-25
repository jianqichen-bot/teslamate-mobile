import { createServer } from "node:http";
import type { Pool } from "pg";
import { listCars } from "./repositories/cars.js";

export function createApp(pool: Pool | null, allowedOrigins: string[] = []) {
  return createServer(async (request, response) => {
    const path = request.url?.split("?")[0];
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : JSON.stringify(body));
    };
    response.setHeader("Cache-Control", "no-store");
    if (path !== "/health" && path !== "/api/cars") {
      send(404, { error: { code: "NOT_FOUND", message: "接口不存在" } });
      return;
    }
    if (path === "/health") {
      response.setHeader("Access-Control-Allow-Origin", "*");
    } else {
      response.setHeader("Vary", "Origin");
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) {
        send(403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "当前网页来源未获允许" } });
        return;
      }
      if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
    }
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD, OPTIONS");
      send(405, { error: { code: "METHOD_NOT_ALLOWED", message: "仅支持读取" } });
      return;
    }
    if (path === "/health") {
      send(200, { status: "ok", service: "teslamate-server" });
      return;
    }
    if (!pool) {
      send(503, { error: { code: "DATABASE_NOT_CONFIGURED", message: "服务端尚未配置 TeslaMate 数据库" } });
      return;
    }
    try {
      send(200, { cars: await listCars(pool) });
    } catch {
      console.error("Vehicle query failed");
      send(503, { error: { code: "DATABASE_UNAVAILABLE", message: "暂时无法读取车辆数据，请检查数据库连接与表结构" } });
    }
  });
}
