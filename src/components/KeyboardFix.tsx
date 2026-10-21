"use client";

import { useEffect } from "react";

const isTypingIn = (el: Element | null) => el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable]");

/**
 * iPhones sometimes carry on as if the keyboard were still open after it closes: the bottom menu
 * stays hidden below the screen and the page won't scroll to the end. A one-pixel nudge once
 * typing is done makes Safari measure the screen again.
 */
export function KeyboardFix() {
  useEffect(() => {
    const nudge = () => {
      window.scrollBy(0, 1);
      window.scrollBy(0, -1);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFocusOut = () => {
      clearTimeout(timer);
      // Moving on to another field keeps the keyboard up, so only nudge once nothing is being typed in.
      timer = setTimeout(() => !isTypingIn(document.activeElement) && nudge(), 150);
    };
    const vv = window.visualViewport;
    const onResize = () => {
      // Keyboard gone (full height, not pinch-zoomed) but the view still pushed down: put it back.
      if (vv && Math.abs(vv.scale - 1) < 0.01 && vv.height > window.innerHeight * 0.9 && vv.offsetTop > 0) nudge();
    };
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", onResize);
    };
  }, []);
  return null;
}
