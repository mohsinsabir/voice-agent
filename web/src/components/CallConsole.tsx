import type { CallStatus } from "../hooks/useRetellCall";
import { useRetellCall } from "../hooks/useRetellCall";
import VoiceOrb from "./VoiceOrb";
import Transcript from "./Transcript";
import { MicIcon, MicOffIcon, PhoneIcon, RefreshIcon, StopIcon, XIcon } from "./Icons";
import "./CallConsole.css";

const HEADLINE: Record<CallStatus, string> = {
  idle: "Ready when you are",
  connecting: "Opening a secure line",
  connected: "You're connected",
  agent_speaking: "Receptionist is speaking",
  listening: "Listening…",
  ended: "Call ended",
  error: "We hit a snag",
};

const SUBLINE: Record<CallStatus, string> = {
  idle: "Press call and allow microphone access. Try “Do you have anything Thursday morning?”",
  connecting: "Negotiating audio with the voice agent.",
  connected: "Say hello — the agent picks up from here.",
  agent_speaking: "Feel free to interrupt; barge-in is enabled.",
  listening: "Go ahead, the agent is waiting on you.",
  ended: "Post-call automation is running in the background.",
  error: "Check that the API is running, then try again.",
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function CallConsole() {
  const call = useRetellCall();
  const { status, inCall, muted, error, turns, elapsed, callId } = call;

  const showStartButton = status === "idle" || status === "ended" || status === "error";

  return (
    <section className="console" id="demo" aria-label="Live voice demo">
      <div className="console__glow" aria-hidden="true" />

      <header className="console__bar">
        <span className="console__tag">
          <span className={`console__pip console__pip--${status}`} />
          Live browser demo
        </span>
        <span className={`console__timer mono ${inCall ? "is-running" : ""}`}>
          {formatDuration(elapsed)}
        </span>
      </header>

      <VoiceOrb status={status} levelRef={call.levelRef} waveRef={call.waveRef} />

      <div className="console__status" aria-live="polite">
        <h2 className="console__headline">{HEADLINE[status]}</h2>
        <p className="console__subline">{SUBLINE[status]}</p>
      </div>

      {error ? (
        <p className="console__error" role="alert">
          <XIcon width="16" height="16" />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="console__controls">
        {showStartButton ? (
          <button type="button" className="ctrl ctrl--call" onClick={() => void call.start()}>
            <PhoneIcon width="19" height="19" />
            <span>{status === "idle" ? "Start voice call" : "Call again"}</span>
          </button>
        ) : null}

        {status === "connecting" ? (
          <button type="button" className="ctrl ctrl--call is-busy" disabled>
            <span className="spinner" aria-hidden="true" />
            <span>Connecting…</span>
          </button>
        ) : null}

        {inCall ? (
          <>
            <button
              type="button"
              className={`ctrl ctrl--ghost ${muted ? "is-active" : ""}`}
              onClick={call.toggleMute}
              aria-pressed={muted}
            >
              {muted ? <MicOffIcon width="19" height="19" /> : <MicIcon width="19" height="19" />}
              <span>{muted ? "Unmute" : "Mute"}</span>
            </button>
            <button type="button" className="ctrl ctrl--end" onClick={call.stop}>
              <StopIcon width="19" height="19" />
              <span>End call</span>
            </button>
          </>
        ) : null}

        {status === "ended" || status === "error" ? (
          <button type="button" className="ctrl ctrl--ghost" onClick={call.reset}>
            <RefreshIcon width="18" height="18" />
            <span>Reset</span>
          </button>
        ) : null}
      </div>

      <dl className="console__meta">
        <div className="console__metaItem">
          <dt>Microphone</dt>
          <dd>{inCall ? (muted ? "Muted" : "Open") : "Idle"}</dd>
        </div>
        <div className="console__metaItem">
          <dt>Call ID</dt>
          <dd className="mono console__callId">{callId ?? "—"}</dd>
        </div>
      </dl>

      {turns.length > 0 ? <Transcript turns={turns} status={status} /> : null}
    </section>
  );
}
