import { useCallback, useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";

export type CallStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "agent_speaking"
  | "listening"
  | "ended"
  | "error";

export type Turn = {
  role: "agent" | "user";
  content: string;
};

/** Number of radial bars the orb renders around its rim. */
export const WAVE_BINS = 56;

type RetellUpdate = {
  transcript?: Array<{ role?: string; content?: string }>;
};

const ACTIVE: ReadonlySet<CallStatus> = new Set<CallStatus>([
  "connected",
  "agent_speaking",
  "listening",
]);

export function useRetellCall() {
  const clientRef = useRef<RetellWebClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = new RetellWebClient();
  }
  const client = clientRef.current;

  const [status, setStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsed, setElapsed] = useState(0);

  /** Smoothed loudness (0–1) of the agent's voice, read every frame by the orb. */
  const levelRef = useRef(0);
  /** Smoothed per-bin waveform magnitudes (0–1) for the orb's rim. */
  const waveRef = useRef<Float32Array>(new Float32Array(WAVE_BINS));

  const inCall = ACTIVE.has(status);

  useEffect(() => {
    const onStarted = () => setStatus("connected");
    const onAgentStart = () => setStatus("agent_speaking");
    const onAgentStop = () => setStatus("listening");

    const onEnded = () => {
      setStatus((prev) => (prev === "error" ? prev : "ended"));
      setMuted(false);
      levelRef.current = 0;
      waveRef.current.fill(0);
    };

    const onUpdate = (update: RetellUpdate) => {
      const incoming = update.transcript;
      if (!incoming?.length) return;
      setTurns(
        incoming.map((t) => ({
          role: t.role === "agent" ? "agent" : "user",
          content: (t.content ?? "").trim(),
        })),
      );
    };

    const onAudio = (frame: Float32Array) => {
      if (!frame.length) return;

      let sumSquares = 0;
      for (let i = 0; i < frame.length; i += 1) {
        sumSquares += frame[i] * frame[i];
      }
      const rms = Math.sqrt(sumSquares / frame.length);
      levelRef.current = levelRef.current * 0.72 + Math.min(1, rms * 7) * 0.28;

      const bins = waveRef.current;
      const bucket = Math.max(1, Math.floor(frame.length / bins.length));
      for (let b = 0; b < bins.length; b += 1) {
        const start = b * bucket;
        let peak = 0;
        for (let i = start; i < start + bucket && i < frame.length; i += 1) {
          const magnitude = frame[i] < 0 ? -frame[i] : frame[i];
          if (magnitude > peak) peak = magnitude;
        }
        bins[b] = bins[b] * 0.6 + Math.min(1, peak * 5.5) * 0.4;
      }
    };

    const onError = (err: unknown) => {
      setError(err instanceof Error ? err.message : String(err ?? "Call error"));
      setStatus("error");
      client.stopCall();
    };

    client.on("call_started", onStarted);
    client.on("call_ended", onEnded);
    client.on("agent_start_talking", onAgentStart);
    client.on("agent_stop_talking", onAgentStop);
    client.on("update", onUpdate);
    client.on("audio", onAudio);
    client.on("error", onError);

    return () => {
      client.off("call_started", onStarted);
      client.off("call_ended", onEnded);
      client.off("agent_start_talking", onAgentStart);
      client.off("agent_stop_talking", onAgentStop);
      client.off("update", onUpdate);
      client.off("audio", onAudio);
      client.off("error", onError);
    };
  }, [client]);

  useEffect(() => {
    if (!inCall) return;
    const startedAt = Date.now() - elapsed * 1000;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
    // `elapsed` is intentionally excluded: it is seeded once per active call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCall]);

  useEffect(() => () => client.stopCall(), [client]);

  const start = useCallback(async () => {
    setError(null);
    setTurns([]);
    setCallId(null);
    setElapsed(0);
    setStatus("connecting");

    try {
      const response = await fetch("/api/web-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Server returned ${response.status}`);
      }

      const data = (await response.json()) as { accessToken: string; callId: string };
      setCallId(data.callId);
      await client.startCall({ accessToken: data.accessToken, emitRawAudioSamples: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the call");
      setStatus("error");
    }
  }, [client]);

  const stop = useCallback(() => client.stopCall(), [client]);

  const toggleMute = useCallback(() => {
    if (!ACTIVE.has(status)) return;
    setMuted((prev) => {
      if (prev) client.unmute();
      else client.mute();
      return !prev;
    });
  }, [client, status]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTurns([]);
    setCallId(null);
    setElapsed(0);
  }, []);

  return {
    status,
    inCall,
    callId,
    muted,
    error,
    turns,
    elapsed,
    levelRef,
    waveRef,
    start,
    stop,
    toggleMute,
    reset,
  };
}
