import { useEffect, useState } from "react";
import { checkServerHealth } from "../services/api";

type ConnectionState =
  | { status: "loading" }
  | { status: "connected" }
  | { status: "error"; message: string };

export function useServerHealth() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ConnectionState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    setState({ status: "loading" });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);

    checkServerHealth(controller.signal)
      .then(() => { if (active) setState({ status: "connected" }); })
      .catch((error: unknown) => {
        if (active) setState({
          status: "error",
          message: timedOut ? "连接超时，请检查网络和服务地址" :
            error instanceof Error ? error.message : "无法连接服务端",
        });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return { state, retry: () => setAttempt((value) => value + 1) };
}
