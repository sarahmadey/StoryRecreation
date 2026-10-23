"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// The moment a link to another page is tapped, a glowing bar runs across the top of the screen until
// that page arrives (or its loading screen does), so a tap never seems to have done nothing.

export function NavProgress() {
  const path = usePathname();
  const [going, setGoing] = useState(false);

  // The new page is here.
  useEffect(() => setGoing(false), [path]);

  useEffect(() => {
    // Watched on the way down, before the link itself takes over the click.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      // Another page here (the same page with other choices in its address changes in place).
      if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname === location.pathname) return;
      setGoing(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Never left running, whatever happened to the tap.
  useEffect(() => {
    if (!going) return;
    const t = setTimeout(() => setGoing(false), 15_000);
    return () => clearTimeout(t);
  }, [going]);

  return going ? <div className="nav-progress" role="progressbar" aria-label="Opening the page" /> : null;
}
