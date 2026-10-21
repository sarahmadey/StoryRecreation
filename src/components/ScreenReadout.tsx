"use client";

import { useEffect, useState } from "react";

const KEY = "storyhollow:screen-readout";

function measure(): string[] {
  const vv = window.visualViewport;
  const ios = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  const homeScreen =
    (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
  return [
    `Phone screen ${screen.width} × ${screen.height}${ios ? ` · iOS ${ios[1]}.${ios[2]}` : ""} · ${homeScreen ? "Home Screen app" : "browser tab"}`,
    `Window ${innerWidth} × ${innerHeight}`,
    vv ? `Visible ${Math.round(vv.width)} × ${Math.round(vv.height)} · down ${Math.round(vv.offsetTop)} · zoom ${vv.scale.toFixed(2)}` : "Visible: unknown",
    `Scrolled ${Math.round(scrollY)} of ${document.documentElement.scrollHeight - innerHeight}`,
    `Keyboard fix: ${document.documentElement.dataset.viewportFix ?? "not needed yet"}`,
  ];
}

/**
 * The test copy's label. Tapping it shows which update is running, and how tall the phone says the
 * screen is, live, so a screenshot of a layout problem carries the numbers needed to fix it.
 */
export function ScreenReadout({ version }: { version: string | null }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const update = () => setLines(measure());
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [open]);

  const toggle = () => {
    setOpen(!open);
    try {
      sessionStorage.setItem(KEY, open ? "0" : "1");
    } catch {
      // ignore
    }
  };

  return (
    <>
      <button type="button" className="test-chip" onClick={toggle} aria-expanded={open}>
        🧪 Test copy
      </button>
      {open && (
        <div className="screen-readout" role="status" onClick={toggle}>
          <div>Running: {version ?? "unknown"}</div>
          {lines.map((l) => (
            <div key={l.slice(0, 12)}>{l}</div>
          ))}
        </div>
      )}
    </>
  );
}
