import { createServer } from "node:http";
import type { Pool } from "pg";
import { getAnalysis, isAnalysisReport } from "./repositories/analysis.js";
import { listCars } from "./repositories/cars.js";
import { getCharge, listRecentCharges } from "./repositories/charges.js";
import { getDrive, getDriveTrack, listRecentDrives } from "./repositories/drives.js";
import { getStatistics } from "./repositories/statistics.js";

function parseId(value: string) {
  const id = Number(value);
  return String(id) === value && Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function statisticsOptions(search: string) {
  const params = new URLSearchParams(search);
  const days = params.get("days") ?? "30";
  const timeZone = params.get("timeZone") ?? "UTC";
  if (!["7", "30", "90"].includes(days) || !/^[A-Za-z][A-Za-z0-9_+/-]{0,63}$/.test(timeZone)) return null;
  try {
    const zone = new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone;
    return { days: Number(days), timeZone: zone };
  } catch {
    return null;
  }
}

export function createApp(pool: Pool | null, allowedOrigins: string[] = []) {
  return createServer(async (request, response) => {
    const path = request.url?.split("?")[0];
    const recordPath = path?.match(/^\/api\/cars\/([^/]+)\/(drives|charges)(?:\/([^/]+))?$/);
    const trackPath = path?.match(/^\/api\/cars\/([^/]+)\/drives\/([^/]+)\/track$/);
    const statisticsPath = path?.match(/^\/api\/cars\/([^/]+)\/statistics$/);
    const analysisPath = path?.match(/^\/api\/cars\/([^/]+)\/reports\/([^/]+)$/);
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : JSON.stringify(body));
    };
    response.setHeader("Cache-Control", "no-store");
    if (path !== "/health" && path !== "/api/cars" && !recordPath && !statisticsPath && !trackPath && !analysisPath) {
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
    const carPath = recordPath ?? statisticsPath ?? trackPath ?? analysisPath;
    const carId = carPath ? parseId(carPath[1]) : null;
    if (carPath && carId === null) {
      send(400, { error: { code: "INVALID_CAR_ID", message: "车辆编号格式不正确" } });
      return;
    }
    const isCharge = recordPath?.[2] === "charges";
    const recordLabel = statisticsPath || analysisPath ? "统计" : isCharge ? "充电记录" : "行程";
    const recordParam = recordPath?.[3] ?? trackPath?.[2];
    const recordId = recordParam ? parseId(recordParam) : null;
    if (recordParam && recordId === null) {
      send(400, { error: {
        code: isCharge ? "INVALID_CHARGE_ID" : "INVALID_DRIVE_ID",
        message: `${recordLabel}编号格式不正确`,
      } });
      return;
    }
    const report = analysisPath && isAnalysisReport(analysisPath[2]) ? analysisPath[2] : null;
    if (analysisPath && report === null) {
      send(404, { error: { code: "REPORT_NOT_FOUND", message: "找不到该分析报表" } });
      return;
    }
    const rangePath = statisticsPath ?? analysisPath;
    const search = rangePath ? request.url?.slice(rangePath[0].length) ?? "" : "";
    const statistics = rangePath ? statisticsOptions(search) : null;
    const page = report ? parseId(new URLSearchParams(search).get("page") ?? "1") : 1;
    if (rangePath && (statistics === null || page === null || page > 10000)) {
      send(400, { error: { code: "INVALID_STATISTICS_RANGE", message: "请选择支持的统计区间和时区" } });
      return;
    }
    if (!pool) {
      send(503, { error: { code: "DATABASE_NOT_CONFIGURED", message: "服务端尚未配置 TeslaMate 数据库" } });
      return;
    }
    try {
      if (carId === null) {
        send(200, { cars: await listCars(pool) });
        return;
      }
      if (statistics) {
        const result = report && page !== null
          ? await getAnalysis(pool, carId, report, statistics.days, statistics.timeZone, page)
          : await getStatistics(pool, carId, statistics.days, statistics.timeZone);
        if (result === null) {
          send(404, { error: { code: "CAR_NOT_FOUND", message: "找不到该车辆" } });
          return;
        }
        send(200, report ? { report: result } : { statistics: result });
        return;
      }
      if (recordId !== null) {
        const record = isCharge ? await getCharge(pool, carId, recordId)
          : trackPath ? await getDriveTrack(pool, carId, recordId) : await getDrive(pool, carId, recordId);
        if (record === null) {
          send(404, { error: {
            code: isCharge ? "CHARGE_NOT_FOUND" : "DRIVE_NOT_FOUND",
            message: `找不到该已完成${recordLabel}`,
          } });
          return;
        }
        send(200, isCharge ? { charge: record } : trackPath ? { track: record } : { drive: record });
        return;
      }
      const records = isCharge ? await listRecentCharges(pool, carId) : await listRecentDrives(pool, carId);
      if (records === null) {
        send(404, { error: { code: "CAR_NOT_FOUND", message: "找不到该车辆" } });
        return;
      }
      send(200, isCharge ? { charges: records } : { drives: records });
    } catch {
      console.error(carId === null ? "Vehicle query failed" : rangePath ? "Statistics query failed" : isCharge ? "Charge query failed" : "Drive query failed");
      const data = carId === null ? "车辆" : recordLabel;
      send(503, { error: { code: "DATABASE_UNAVAILABLE", message: `暂时无法读取${data}数据，请检查数据库连接与表结构` } });
    }
  });
}
