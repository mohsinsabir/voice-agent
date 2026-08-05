import type { CSSProperties, ReactNode } from "react";
import {
  BoltIcon,
  CalendarIcon,
  ClockIcon,
  RouteIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
} from "./Icons";
import "./Capabilities.css";

type Capability = {
  icon: ReactNode;
  title: string;
  body: string;
  tool: string;
  accent: "mint" | "iris" | "violet";
};

const CAPABILITIES: Capability[] = [
  {
    icon: <ClockIcon width="20" height="20" />,
    title: "Real availability, not guesses",
    body: "Reads Google Calendar free/busy against the clinic's opening hours and offers slots that actually exist.",
    tool: "checkAvailability",
    accent: "mint",
  },
  {
    icon: <CalendarIcon width="20" height="20" />,
    title: "Books while you talk",
    body: "Writes the calendar event and the appointment row in one transaction, with a database constraint that makes double-booking impossible.",
    tool: "bookAppointment",
    accent: "mint",
  },
  {
    icon: <RouteIcon width="20" height="20" />,
    title: "Reschedules and cancels",
    body: "Finds the caller's existing appointment by phone number and moves or releases the slot in the same conversation.",
    tool: "rescheduleAppointment",
    accent: "iris",
  },
  {
    icon: <SparkIcon width="20" height="20" />,
    title: "Qualifies every lead",
    body: "Scores urgency, insurance and patient type as the caller answers, then stores the reasoning behind the score.",
    tool: "saveLeadQualification",
    accent: "iris",
  },
  {
    icon: <ShieldIcon width="20" height="20" />,
    title: "Knows when to escalate",
    body: "Detects emergencies, alerts staff immediately and transfers the caller to a human instead of improvising.",
    tool: "requestHumanHandoff",
    accent: "violet",
  },
  {
    icon: <BoltIcon width="20" height="20" />,
    title: "Automates the aftermath",
    body: "On hang-up it emits a call.completed event to n8n, which upserts the HubSpot contact and drives follow-ups.",
    tool: "logCallOutcome",
    accent: "violet",
  },
];

export default function Capabilities() {
  return (
    <section className="section" id="capabilities">
      <div className="container">
        <div className="section__head">
          <span className="eyebrow reveal">
            <span className="eyebrow__dot">
              <UserIcon width="13" height="13" />
            </span>
            What it actually does
          </span>
          <h2 className="section__title reveal">
            Nine tools the agent can reach for,
            <br />
            mid-sentence.
          </h2>
          <p className="section__lede reveal">
            Every card below maps to a real function the model can call over the{" "}
            <code className="inline-code">/tools</code> endpoint. Each invocation is timed, logged
            and made idempotent, so a retried call never books twice.
          </p>
        </div>

        <div className="cards">
          {CAPABILITIES.map((cap, index) => (
            <article
              key={cap.tool}
              className={`card card--${cap.accent} reveal`}
              style={{ "--reveal-delay": `${index * 60}ms` } as CSSProperties}
            >
              <span className="card__icon">{cap.icon}</span>
              <h3 className="card__title">{cap.title}</h3>
              <p className="card__body">{cap.body}</p>
              <span className="card__tool mono">{cap.tool}()</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
