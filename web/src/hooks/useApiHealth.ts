import { useEffect, useState } from "react";

export type ApiHealth = "checking" | "online" | "degraded" | "offline";

const POLL_MS = 30_000;

/** Polls the Fastify `/health` route so the header can show real backend state. */
export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch("/health", { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as {
          status?: string;
          database?: string;
        } | null;

        if (cancelled) return;
        if (!response.ok) setHealth("degraded");
        else setHealth(body?.database === "up" ? "online" : "degraded");
      } catch {
        if (!cancelled) setHealth("offline");
      }
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return health;
}
