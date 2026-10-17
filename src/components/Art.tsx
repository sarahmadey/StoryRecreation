// Hand-drawn (well, hand-coded) gold-leaf illustrations.

const GOLD = "url(#gold)";

function GoldDefs() {
  return (
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff1c4" />
        <stop offset="0.55" stopColor="#e2b55c" />
        <stop offset="1" stopColor="#a8792b" />
      </linearGradient>
      <radialGradient id="flame" cx="0.5" cy="0.6" r="0.6">
        <stop offset="0" stopColor="#fff6d8" />
        <stop offset="0.45" stopColor="#ffcf6e" />
        <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

export function Lantern({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="lantern-glow">
      <GoldDefs />
      <path d="M24 3c-3 0-5 2-5 4.5h10C29 5 27 3 24 3z" fill={GOLD} />
      <rect x="15" y="8" width="18" height="4" rx="1.5" fill={GOLD} />
      <path d="M16 12h16l2 5H14z" fill={GOLD} opacity="0.9" />
      <rect x="15" y="17" width="18" height="20" rx="3" fill="rgba(255,190,92,.18)" stroke={GOLD} strokeWidth="2" />
      <ellipse cx="24" cy="28" rx="6" ry="8" fill="url(#flame)" />
      <path d="M24 22c2 3 3 5 0 9-3-4-2-6 0-9z" fill="#fff3cf" />
      <path d="M24 17v20M15 27h18" stroke={GOLD} strokeWidth="1" opacity="0.5" />
      <path d="M14 37h20l-2 4H16z" fill={GOLD} />
    </svg>
  );
}

/** A quill dipping into an inkwell, trailing stars. */
export function QuillArt() {
  return (
    <svg className="doorway-art" viewBox="0 0 120 120" aria-hidden="true">
      <GoldDefs />
      <path d="M38 92h44l-4 16H42z" fill={GOLD} />
      <ellipse cx="60" cy="92" rx="22" ry="5" fill="#1a110b" stroke={GOLD} strokeWidth="2" />
      <path
        d="M58 90C64 62 80 34 104 14c-6 22-18 44-38 62-2 6-5 10-8 14z"
        fill="rgba(255,236,190,.15)"
        stroke={GOLD}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M60 86C70 62 84 40 100 20" stroke={GOLD} strokeWidth="1.5" fill="none" />
      <path d="M68 72l10-4M74 60l11-4M80 48l10-4" stroke={GOLD} strokeWidth="1.2" />
      <g fill="#fff1c4">
        <path d="M24 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <path d="M36 14l1.4 3.4 3.4 1.4-3.4 1.4L36 23.6l-1.4-3.4-3.4-1.4 3.4-1.4z" opacity="0.8" />
        <circle cx="20" cy="56" r="1.8" />
        <circle cx="44" cy="40" r="1.4" opacity="0.7" />
      </g>
    </svg>
  );
}

/** An open book with sound rising off its pages. */
export function ReadArt() {
  return (
    <svg className="doorway-art" viewBox="0 0 120 120" aria-hidden="true">
      <GoldDefs />
      <path d="M60 100C46 92 30 90 12 92V40c18-2 34 0 48 8z" fill="rgba(255,236,190,.15)" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M60 100c14-8 30-10 48-8V40c-18-2-34 0-48 8z" fill="rgba(255,236,190,.15)" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M60 48v52" stroke={GOLD} strokeWidth="2" />
      <path d="M22 54c10-1 20 0 30 4M22 64c10-1 20 0 30 4M22 74c10-1 20 0 30 4M68 58c10-4 20-5 30-4M68 68c10-4 20-5 30-4M68 78c10-4 20-5 30-4" stroke={GOLD} strokeWidth="1.2" opacity="0.6" />
      <g fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round">
        <path d="M50 30c4-4 16-4 20 0" />
        <path d="M43 22c8-7 26-7 34 0" opacity="0.75" />
        <path d="M36 14c12-10 36-10 48 0" opacity="0.5" />
      </g>
    </svg>
  );
}

/** A little bookcase. */
export function ShelfArt() {
  return (
    <svg className="doorway-art" viewBox="0 0 120 120" aria-hidden="true">
      <GoldDefs />
      <rect x="16" y="12" width="88" height="96" rx="4" fill="rgba(255,236,190,.08)" stroke={GOLD} strokeWidth="2.5" />
      <path d="M16 58h88M16 104h88" stroke={GOLD} strokeWidth="3" />
      <g stroke={GOLD} strokeWidth="2" fill="rgba(255,236,190,.15)">
        <rect x="24" y="24" width="10" height="34" rx="1" />
        <rect x="36" y="20" width="12" height="38" rx="1" />
        <rect x="50" y="28" width="9" height="30" rx="1" />
        <path d="M62 58l8-32 9 2-8 32z" />
        <rect x="84" y="30" width="12" height="28" rx="1" />
        <rect x="26" y="72" width="14" height="32" rx="1" />
        <rect x="42" y="68" width="10" height="36" rx="1" />
        <rect x="56" y="76" width="16" height="28" rx="1" />
        <rect x="76" y="70" width="10" height="34" rx="1" />
      </g>
      <circle cx="91" cy="88" r="6" fill="url(#flame)" />
    </svg>
  );
}

/** Floating motes of candlelit dust. Deterministic so server and client agree. */
export function Motes({ count = 16 }: { count?: number }) {
  const motes = Array.from({ length: count }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2) % 1;
    return {
      left: `${Math.round(r(1) * 100)}%`,
      ["--s" as string]: `${2 + Math.round(r(2) * 3)}px`,
      ["--d" as string]: `${16 + Math.round(r(3) * 18)}s`,
      ["--delay" as string]: `${-Math.round(r(4) * 30)}s`,
      ["--x" as string]: `${Math.round((r(5) - 0.5) * 120)}px`,
    } as React.CSSProperties;
  });
  return (
    <div className="motes" aria-hidden="true">
      {motes.map((style, i) => (
        <span key={i} style={style} />
      ))}
    </div>
  );
}
