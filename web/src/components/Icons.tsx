import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export const PhoneIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6.5 3h3l1.5 4-2 1.4a12 12 0 0 0 5.6 5.6L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3Z" />
  </svg>
);

export const StopIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const MicIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
);

export const MicOffIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M9 5a3 3 0 0 1 6 0v5m-6 1.2V11" />
    <path d="M5.5 11a6.5 6.5 0 0 0 10 5.5M18.5 11v.4M12 17.5V21" />
    <path d="m4 3 16 18" />
  </svg>
);

export const RefreshIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5" />
  </svg>
);

export const CalendarIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8.5 3v4M15.5 3v4M8 14h3" />
  </svg>
);

export const ClockIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);

export const SparkIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13 4.5 11l5.6-2Z" />
  </svg>
);

export const UserIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </svg>
);

export const ShieldIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3.2 19 6v5.6c0 4.2-2.8 7.4-7 9.2-4.2-1.8-7-5-7-9.2V6Z" />
    <path d="m9 12 2.2 2.2L15.4 10" />
  </svg>
);

export const RouteIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="6" cy="6" r="2.6" />
    <circle cx="18" cy="18" r="2.6" />
    <path d="M8.6 6h4.9A4.5 4.5 0 0 1 13.5 15H10a4.5 4.5 0 0 0 0 3h5.4" />
  </svg>
);

export const BoltIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M13.2 2.5 5 13.6h5.4L10 21.5 18.6 10H13Z" />
  </svg>
);

export const XIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const ArrowIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5 12h13.5M13 6.5 19 12l-6 5.5" />
  </svg>
);

export const WaveMark = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
    <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M5 10v4" />
      <path d="M9.5 6.5v11" />
      <path d="M14.5 4v16" />
      <path d="M19 9v6" />
    </g>
  </svg>
);
