import { useEffect, useState } from "react";

type RequestState<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

export function useApiRequest<T>(load: (signal: AbortSignal) => Promise<T>, fallbackMessage: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RequestState<T>>({ status: "loading" });
  useEffect(() => {
    let active = true;
    let timedOut = false;
    const controller = new AbortController();
    setState({ status: "loading" });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
    load(controller.signal)
      .then((data) => { if (active) setState({ status: "ready", data }); })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: timedOut ? "读取超时，请稍后重试" : error instanceof Error ? error.message : fallbackMessage });
      })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [attempt, load, fallbackMessage]);
  return { state, refresh: () => setAttempt((value) => value + 1) };
}
