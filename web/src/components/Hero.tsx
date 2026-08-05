import type { CSSProperties } from "react";
import CallConsole from "./CallConsole";
import { SparkIcon } from "./Icons";
import "./Hero.css";

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

const STATS = [
  { value: "24/7", label: "Never misses a call" },
  { value: "<1.5s", label: "Target response latency" },
  { value: "9", label: "Live agent tools" },
];

const PILLS = ["Real-time availability", "Books to Google Calendar", "Barge-in enabled", "HubSpot sync"];

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__inner container">
        <div className="hero__copy">
          <span className="eyebrow reveal">
            <span className="eyebrow__dot">
              <SparkIcon width="13" height="13" />
            </span>
            AI voice receptionist
          </span>

          <h1 className="hero__title reveal" style={delay(60)}>
            The front desk that
            <br />
            <span className="gradient-text">answers on the first ring</span>
            <span className="hero__title-accent serif-accent">, every time.</span>
          </h1>

          <p className="hero__lede reveal" style={delay(120)}>
            A production voice agent that picks up the phone, checks real availability on Google
            Calendar, books the appointment, qualifies the lead, and hands off to a human when it
            matters — then fires the follow-up automation before the caller hangs up.
          </p>

          <ul className="hero__pills reveal" style={delay(180)}>
            {PILLS.map((pill) => (
              <li key={pill}>{pill}</li>
            ))}
          </ul>

          <dl className="hero__stats reveal" style={delay(240)}>
            {STATS.map((stat) => (
              <div key={stat.label} className="hero__stat">
                <dt>{stat.value}</dt>
                <dd>{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="hero__console reveal" style={delay(120)}>
          <CallConsole />
        </div>
      </div>
    </section>
  );
}
