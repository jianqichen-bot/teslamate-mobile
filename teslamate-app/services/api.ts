import { isCar, type Car } from "../types/car";

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export async function fetchCars(signal: AbortSignal): Promise<Car[]> {
  const response = await fetch(`${apiUrl}/api/cars`, { signal });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(typeof body?.error?.message === "string" ? body.error.message : `服务端返回 HTTP ${response.status}`);
  }
  if (!Array.isArray(body?.cars) || !body.cars.every(isCar)) {
    throw new Error("车辆数据格式不正确，请检查服务端版本");
  }
  return body.cars;
}

export async function checkServerHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch(`${apiUrl}/health`, { signal });
  if (!response.ok) throw new Error(`服务端返回 HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (
    typeof body !== "object" || body === null ||
    !("status" in body) || body.status !== "ok" ||
    !("service" in body) || body.service !== "teslamate-server"
  ) {
    throw new Error("响应不符合 TeslaMate Server 格式，请检查服务地址");
  }
}
