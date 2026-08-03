import { useEffect, useMemo, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import "./App.css";

type CallStatus =
  | "idle"
  | "connecting"
  | "in_call"
  | "agent_speaking"
  | "listening"
  | "ended"
  | "error";

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Ready to talk",
  connecting: "Connecting…",
  in_call: "Connected",
  agent_speaking: "Agent is speaking",
  listening: "Listening to you",
  ended: "Call ended",
  error: "Something went wrong",
};

export default function App() {
  const clientRef = useRef<RetellWebClient | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);

  const inCall = status === "in_call" || status === "agent_speaking" || status === "listening";

  const client = useMemo(() => {
    const c = new RetellWebClient();
    clientRef.current = c;
    return c;
  }, []);

  useEffect(() => {
    const onStarted = () => setStatus("in_call");
    const onEnded = () => {
      setStatus("ended");
      setMuted(false);
    };
    const onAgentStart = () => setStatus("agent_speaking");
    const onAgentStop = () => setStatus("listening");
    const onUpdate = (update: { transcript?: Array<{ role: string; content: string }> }) => {
      if (!update.transcript?.length) return;
      setTranscript(update.transcript.map((t) => `${t.role}: ${t.content}`));
    };
    const onError = (err: Error | string) => {
      const message = typeof err === "string" ? err : err.message;
      setError(message);
      setStatus("error");
      client.stopCall();
    };

    client.on("call_started", onStarted);
    client.on("call_ended", onEnded);
    client.on("agent_start_talking", onAgentStart);
    client.on("agent_stop_talking", onAgentStop);
    client.on("update", onUpdate);
    client.on("error", onError);

    return () => {
      client.off("call_started", onStarted);
      client.off("call_ended", onEnded);
      client.off("agent_start_talking", onAgentStart);
      client.off("agent_stop_talking", onAgentStop);
      client.off("update", onUpdate);
      client.off("error", onError);
    };
  }, [client]);

  async function startCall() {
    setError(null);
    setTranscript([]);
    setCallId(null);
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
      await client.startCall({ accessToken: data.accessToken });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start call";
      setError(message);
      setStatus("error");
    }
  }

  function endCall() {
    client.stopCall();
  }

  function toggleMute() {
    if (!inCall) return;
    if (muted) {
      client.unmute();
      setMuted(false);
    } else {
      client.mute();
      setMuted(true);
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="brand">Bright Smile Dental</p>
        <h1>Talk to our receptionist</h1>
        <p className="lede">
          Start a live voice conversation in your browser. Allow microphone access when prompted.
        </p>
      </header>

      <section className="panel" aria-live="polite">
        <div className={`status-dot status-${status}`} />
        <p className="status-text">{STATUS_LABEL[status]}</p>
        {callId ? <p className="call-id">Call ID: {callId}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="actions">
          {!inCall && status !== "connecting" ? (
            <button type="button" className="btn primary" onClick={() => void startCall()}>
              Start call
            </button>
          ) : null}
          {status === "connecting" ? (
            <button type="button" className="btn primary" disabled>
              Connecting…
            </button>
          ) : null}
          {inCall ? (
            <>
              <button type="button" className="btn secondary" onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </button>
              <button type="button" className="btn danger" onClick={endCall}>
                End call
              </button>
            </>
          ) : null}
          {status === "ended" || status === "error" ? (
            <button type="button" className="btn secondary" onClick={() => setStatus("idle")}>
              Reset
            </button>
          ) : null}
        </div>

        {transcript.length > 0 ? (
          <div className="transcript">
            <h2>Live transcript</h2>
            <ul>
              {transcript.map((line, i) => (
                <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
