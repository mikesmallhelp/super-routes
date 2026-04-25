"use client";

import { useSyncExternalStore } from "react";
import { getMockUserPosition, getMockScenarioLabel, SCENARIO_INTERVAL_MS } from "@/lib/mock-data";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
const GEOLOCATION_POLL_INTERVAL_MS = 10_000;
const GEOLOCATION_MAXIMUM_AGE_MS = 5_000;
const GEOLOCATION_TIMEOUT_MS = 10_000;

interface GeoPosition {
  latitude: number;
  longitude: number;
}

function initialPosition(): GeoPosition | null {
  if (USE_MOCK) return null;
  const devLat = process.env.NEXT_PUBLIC_DEV_LAT;
  const devLon = process.env.NEXT_PUBLIC_DEV_LON;
  if (devLat && devLon) {
    return { latitude: parseFloat(devLat), longitude: parseFloat(devLon) };
  }
  return null;
}

let snapshot: GeoPosition | null = initialPosition();
const subscribers = new Set<() => void>();
let mockIntervalId: ReturnType<typeof setInterval> | null = null;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let watchId: number | null = null;

const geolocationOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: GEOLOCATION_MAXIMUM_AGE_MS,
  timeout: GEOLOCATION_TIMEOUT_MS,
};

function setSnapshot(position: GeoPosition | null) {
  snapshot = position;
  for (const callback of subscribers) callback();
}

function updateFromBrowserPosition(pos: GeolocationPosition) {
  setSnapshot({
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  });
}

function requestBrowserPosition() {
  navigator.geolocation.getCurrentPosition(
    updateFromBrowserPosition,
    () => {
      // Permission denied or error — keep the previous known position.
    },
    geolocationOptions
  );
}

function startMockLocation() {
  const update = () => {
    const pos = getMockUserPosition();
    console.log(`[Geolocation] Mock: ${getMockScenarioLabel()}`, pos);
    setSnapshot(pos);
  };
  // Poll faster than scenario interval to stay in sync (min 500ms, max 5s)
  const pollInterval = Math.max(500, Math.min(5_000, Math.floor(SCENARIO_INTERVAL_MS / 6)));
  update();
  mockIntervalId = setInterval(update, pollInterval);
}

function startBrowserLocation() {
  if (!navigator.geolocation) return;

  requestBrowserPosition();

  watchId = navigator.geolocation.watchPosition(
    updateFromBrowserPosition,
    () => {
      // Permission denied or error — keep the previous known position.
    },
    geolocationOptions
  );

  pollIntervalId = setInterval(() => {
    requestBrowserPosition();
  }, GEOLOCATION_POLL_INTERVAL_MS);
}

function startLocationUpdates() {
  if (USE_MOCK) {
    startMockLocation();
    return;
  }

  // Dev override already applied by initialPosition — nothing more to do.
  const devLat = process.env.NEXT_PUBLIC_DEV_LAT;
  const devLon = process.env.NEXT_PUBLIC_DEV_LON;
  if (devLat && devLon) return;

  startBrowserLocation();
}

function stopLocationUpdates() {
  if (mockIntervalId !== null) {
    clearInterval(mockIntervalId);
    mockIntervalId = null;
  }
  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function subscribe(callback: () => void): () => void {
  const shouldStart = subscribers.size === 0;
  subscribers.add(callback);
  if (shouldStart) startLocationUpdates();
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0) stopLocationUpdates();
  };
}

function getSnapshot(): GeoPosition | null {
  return snapshot;
}

function getServerSnapshot(): GeoPosition | null {
  return snapshot;
}

export function useGeolocation() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Haversine distance in meters between two points */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
