import { useEffect, useState } from "react";
import { useApiHealth } from "../hooks/useApiHealth";
import type { ApiHealth } from "../hooks/useApiHealth";
import { WaveMark } from "./Icons";
import "./TopBar.css";

const HEALTH_COPY: Record<ApiHealth, string> = {
  checking: "Checking API",
  online: "All systems live",
  degraded: "Database degraded",
  offline: "API offline",
};

const LINKS = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#pipeline", label: "How it works" },
  { href: "#stack", label: "Stack" },
];

export default function TopBar() {
  const health = useApiHealth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`topbar ${scrolled ? "is-scrolled" : ""}`}>
      <div className="topbar__inner container">
        <a className="brand" href="#top">
          <span className="brand__mark">
            <WaveMark width="20" height="20" />
          </span>
          <span className="brand__text">
            <strong>Bright Smile</strong>
            <span>Dental · AI Reception</span>
          </span>
        </a>

        <nav className="topbar__nav" aria-label="Sections">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="topbar__right">
          <span className={`health health--${health}`} title="Backend /health endpoint">
            <span className="health__dot" />
            {HEALTH_COPY[health]}
          </span>
          <a className="topbar__cta" href="#demo">
            Try the agent
          </a>
        </div>
      </div>
    </header>
  );
}
