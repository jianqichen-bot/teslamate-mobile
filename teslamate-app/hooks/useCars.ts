import { fetchCars } from "../services/api";
import { useApiRequest } from "./useApiRequest";

export function useCars() {
  const { state, refresh } = useApiRequest(fetchCars, "无法读取车辆数据");
  return { state: state.status === "ready" ? { status: "ready" as const, cars: state.data } : state, refresh };
}
