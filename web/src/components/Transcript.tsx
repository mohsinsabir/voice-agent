import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { CallStatus, Turn } from "../hooks/useRetellCall";
import "./Transcript.css";

type TranscriptProps = {
  turns: Turn[];
  status: CallStatus;
};

export default function Transcript({ turns, status }: TranscriptProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, status]);

  const waitingOnAgent = status === "agent_speaking" && turns.at(-1)?.role !== "agent";

  return (
    <div className="transcript">
      <div className="transcript__head">
        <span className="transcript__label">Live transcript</span>
        <span className="transcript__count mono">{turns.length} turns</span>
      </div>

      <div className="transcript__scroller" ref={scrollerRef} aria-live="polite">
        {turns.map((turn, index) => (
          <article
            key={`${index}-${turn.role}`}
            className={`bubble bubble--${turn.role}`}
            style={{ "--i": Math.min(index, 12) } as CSSProperties}
          >
            <span className="bubble__who">{turn.role === "agent" ? "Receptionist" : "You"}</span>
            <p className="bubble__text">{turn.content}</p>
          </article>
        ))}

        {waitingOnAgent ? (
          <div className="bubble bubble--agent bubble--typing">
            <span className="sr-only">Receptionist is speaking</span>
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
