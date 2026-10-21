"use client";

import { useEffect } from "react";

const isTypingIn = (el: EventTarget | Element | null) =>
  el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable]");

/**
 * iPhones (especially with the app on the Home Screen) can come back from the keyboard with a screen
 * that's too short: the bottom menu hides, and the page stops scrolling before the end, bouncing back
 * short of the Next button. When the screen is shorter after typing than it was before, the page is
 * hidden for two frames and shown again, which makes the phone measure the screen afresh.
 */
export function KeyboardFix() {
  useEffect(() => {
    const root = document.documentElement;
    let before = 0; // how tall the screen was before the keyboard came up
    let timer: ReturnType<typeof setTimeout> | undefined;
    const log = (note: string) => {
      root.dataset.viewportFix = `${note} at ${new Date().toLocaleTimeString()}`;
    };

    const remeasure = (was: number, from: number) => {
      const app = document.querySelector<HTMLElement>(".app");
      if (!app) return;
      const y = window.scrollY;
      app.style.display = "none";
      void app.offsetHeight;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          app.style.display = "";
          void app.offsetHeight;
          window.scrollTo(window.scrollX, y);
          setTimeout(() => log(`re-measured ${from} → ${window.innerHeight} (${was} before typing)`), 300);
        }),
      );
    };

    const onFocusIn = (e: FocusEvent) => {
      clearTimeout(timer);
      if (isTypingIn(e.target) && !before) before = window.innerHeight;
    };
    const onFocusOut = () => {
      clearTimeout(timer);
      // Moving on to another field keeps the keyboard up; check once typing is done and the keyboard has gone.
      timer = setTimeout(() => {
        if (isTypingIn(document.activeElement) || !before) return;
        const now = window.innerHeight;
        if (now < before - 30) remeasure(before, now);
        else log(`screen fine after typing (${before} → ${now})`);
        before = 0;
      }, 450);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return null;
}
