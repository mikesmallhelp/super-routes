"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    eruda?: { init: () => void };
  }
}

/**
 * Lazily loads Eruda (https://github.com/liriliri/eruda) — an in-page mobile
 * console. Adds a floating gear icon (bottom-right) that opens a DevTools-like
 * panel with Console, Network, Elements etc. Useful for debugging on phones
 * without USB remote debugging.
 */
export function ErudaLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.eruda) return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.onload = () => window.eruda?.init();
    document.body.appendChild(script);
  }, []);
  return null;
}
