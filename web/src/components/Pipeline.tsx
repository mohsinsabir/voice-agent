import type { CSSProperties } from "react";
import { ArrowIcon } from "./Icons";
import "./Pipeline.css";

const STEPS = [
  {
    step: "01",
    title: "Caller speaks",
    body: "Retell streams audio both ways with barge-in, so the caller can cut the agent off mid-sentence.",
    meta: "Retell AI · WebRTC",
  },
  {
    step: "02",
    title: "Agent calls a tool",
    body: "The model hits the Fastify /tools endpoint behind a shared secret. Every call is logged with its latency.",
    meta: "Fastify · Zod",
  },
  {
    step: "03",
    title: "Truth is written down",
    body: "Google Calendar and Postgres are updated together, guarded by an exclusion constraint on overlapping slots.",
    meta: "Google Calendar · Supabase",
  },
  {
    step: "04",
    title: "Automation takes over",
    body: "On hang-up a call.completed event reaches n8n, which upserts the CRM contact and queues the follow-up.",
    meta: "n8n · HubSpot",
  },
];

const STACK = [
  "TypeScript",
  "Fastify",
  "Retell AI",
  "Supabase Postgres",
  "Google Calendar",
  "HubSpot",
  "n8n",
  "React + Vite",
  "Vitest",
];

export default function Pipeline() {
  return (
    <>
      <section className="section" id="pipeline">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow reveal">
              <span className="eyebrow__dot">
                <ArrowIcon width="13" height="13" />
              </span>
              Call lifecycle
            </span>
            <h2 className="section__title reveal">From “hello” to a CRM record in one call.</h2>
            <p className="section__lede reveal">
              The voice layer stays fast because nothing slow happens inside the conversation.
              Anything that can wait is pushed to post-call automation.
            </p>
          </div>

          <ol className="flow">
            {STEPS.map((item, index) => (
              <li
                key={item.step}
                className="flow__item reveal"
                style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}
              >
                <span className="flow__step mono">{item.step}</span>
                <h3 className="flow__title">{item.title}</h3>
                <p className="flow__body">{item.body}</p>
                <span className="flow__meta">{item.meta}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section stack" id="stack">
        <div className="container stack__inner">
          <p className="stack__label">Built with</p>
          <ul className="stack__list">
            {STACK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
