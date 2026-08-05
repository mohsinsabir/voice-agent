import { WaveMark } from "./Icons";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <span className="brand__mark">
            <WaveMark width="18" height="18" />
          </span>
          <div>
            <p className="footer__name">Bright Smile Dental</p>
            <p className="footer__note">
              Demonstration clinic for an AI voice reception system. No real patient data is stored.
            </p>
          </div>
        </div>

        <nav className="footer__links" aria-label="Footer">
          <a href="#demo">Live demo</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#pipeline">How it works</a>
          <a href="/health" target="_blank" rel="noreferrer">
            API health
          </a>
        </nav>
      </div>

      <div className="container footer__base">
        <span>© {new Date().getFullYear()} Bright Smile Dental</span>
        <span className="mono">voice-agent · phase 3</span>
      </div>
    </footer>
  );
}
