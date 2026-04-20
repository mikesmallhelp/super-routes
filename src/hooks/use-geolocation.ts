"use client";

import { useState, useEffect } from "react";
import { getMockUserPosition, getMockScenarioLabel, SCENARIO_INTERVAL_MS } from "@/lib/mock-data";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

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

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(initialPosition);

  useEffect(() => {
    if (USE_MOCK) {
      const update = () => {
        const pos = getMockUserPosition();
        console.log(`[Geolocation] Mock: ${getMockScenarioLabel()}`, pos);
        setPosition(pos);
      };
      // Poll faster than scenario interval to stay in sync (min 500ms, max 5s)
      const pollInterval = Math.max(500, Math.min(5_000, Math.floor(SCENARIO_INTERVAL_MS / 6)));
      update();
      const interval = setInterval(update, pollInterval);
      return () => clearInterval(interval);
    }

    // Dev override already applied by initialPosition — nothing more to do
    const devLat = process.env.NEXT_PUBLIC_DEV_LAT;
    const devLon = process.env.NEXT_PUBLIC_DEV_LON;
    if (devLat && devLon) return;

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        // Permission denied or error — position stays null
      }
    );
  }, []);

  return position;
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
