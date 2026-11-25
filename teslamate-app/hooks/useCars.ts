import { useEffect, useState } from "react";
import { fetchCars } from "../services/api";
import type { Car } from "../types/car";

type CarsState = { status: "loading" } | { status: "ready"; cars: Car[] } | { status: "error"; message: string };

export function useCars() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CarsState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    let timedOut = false;
    const controller = new AbortController();
    setState({ status: "loading" });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
    fetchCars(controller.signal)
      .then((cars) => { if (active) setState({ status: "ready", cars }); })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: timedOut ? "读取超时，请稍后重试" : error instanceof Error ? error.message : "无法读取车辆数据" });
      })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [attempt]);
  return { state, refresh: () => setAttempt((value) => value + 1) };
}
