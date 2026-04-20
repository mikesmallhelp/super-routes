"use client";

import { useSyncExternalStore } from "react";

/*
 * Shared time subscription. One interval ticks module-wide while components
 * are mounted; getSnapshot returns a stable value between ticks so
 * useSyncExternalStore doesn't enter an update loop.
 */

const INTERVAL_MS = 30_000;

let snapshot = 0;
const subscribers = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void): () => void {
  if (subscribers.size === 0) {
    snapshot = Date.now();
    intervalId = setInterval(() => {
      snapshot = Date.now();
      for (const cb of subscribers) cb();
    }, INTERVAL_MS);
  }
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return snapshot;
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Returns the current Date.now() value, re-rendering every 30 s.
 * Stable snapshot semantics keep React from rendering in a tight loop.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
