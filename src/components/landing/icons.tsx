import type { ReactNode } from "react";

import type { IconName } from "@/lib/landing-content";

const PATHS: Record<Exclude<IconName, "whatsapp">, ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  camera: <><path d="M3 16V8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><circle cx="12" cy="12" r="3.3" /></>,
  ai: <><path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5L15 8m-6 8-2.5 2.5m11 0L15 16M9 8 6.5 5.5" /><circle cx="12" cy="12" r="3.5" /></>,
  store: <path d="M3 7h18M5 7v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />,
  price: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  box: <path d="M21 8 12 3 3 8m18 0-9 5m9-5v9l-9 5m0-9L3 8m9 5v9M3 8v9l9 5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  euro: <path d="M19 6.5A7 7 0 1 0 19 17.5M4 10h9M4 14h7" />,
  export: <path d="M7 17 17 7M9 7h8v8" />,
  import: <path d="M17 7 7 17M15 17H7V9" />,
  truck: <><rect x="1" y="6" width="14" height="11" rx="1" /><path d="M15 9h4l3 3v5h-7z" /><circle cx="6" cy="19" r="1.6" /><circle cx="17.5" cy="19" r="1.6" /></>,
  distribution: <><circle cx="12" cy="5" r="2.4" /><circle cx="5" cy="19" r="2.4" /><circle cx="19" cy="19" r="2.4" /><path d="M12 7.4 6.5 17M12 7.4 17.5 17" /></>,
  delivery: <path d="M20 12v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6m16 0-3-7H8l-3 7m16 0H4" />,
  warehouse: <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 4 6 4 9s-1.5 6.3-4 9c-2.5-2.7-4-6-4-9s1.5-6.3 4-9Z" /></>,
  user: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" /></>,
  factory: <path d="M3 21V10l5 3v-3l5 3V8l5 3v10H3Z" />,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  publish: <path d="M12 19V5M5 12l7-7 7 7" />,
  upload: <><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></>,
  barcode: <><path d="M5 4v16M8 4v16M12 4v16M15 4v16M19 4v16" /><path d="M3 7h18M3 17h18" /></>,
  shield: <path d="M12 3 4 6v6c0 4.8 3.4 8.5 8 9 4.6-.5 8-4.2 8-9V6l-8-3Z" />,
  download: <><path d="M12 4v12M6 10l6 6 6-6" /><path d="M4 20h16" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>,
  warn: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>,
  phoneCall: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />,
};

const WHATSAPP_PATH =
  "M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.33 4.97L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.09c-.24.68-1.4 1.3-1.93 1.38-.49.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.61-.6-2.84-1.23-4.7-4.1-4.84-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08 1-2.37.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2 .88 2.15.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.18-.28.36-.23.6-.14.24.09 1.53.72 1.79.85.26.14.44.2.5.32.06.12.06.68-.18 1.36Z";

export function Ic({ name }: { name: IconName }) {
  if (name === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={WHATSAPP_PATH} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
