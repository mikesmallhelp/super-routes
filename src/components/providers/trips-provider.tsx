"use client";

import { createContext, use, useState, useCallback, type ReactNode } from "react";
import type { SavedTrip } from "@/lib/types";

interface TripsContextValue {
  trips: SavedTrip[];
  addTrip: (trip: SavedTrip) => void;
  removeTrip: (id: string) => void;
  isSetupDone: boolean;
  finishSetup: () => void;
  goBackToSetup: () => void;
}

const TripsContext = createContext<TripsContextValue | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isSetupDone, setIsSetupDone] = useState(false);

  const addTrip = useCallback((trip: SavedTrip) => {
    setTrips((prev) => [...prev, trip]);
  }, []);

  const removeTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const finishSetup = useCallback(() => setIsSetupDone(true), []);
  const goBackToSetup = useCallback(() => setIsSetupDone(false), []);

  return (
    <TripsContext value={{
      trips,
      addTrip,
      removeTrip,
      isSetupDone,
      finishSetup,
      goBackToSetup,
    }}>
      {children}
    </TripsContext>
  );
}

export function useTrips() {
  const ctx = use(TripsContext);
  if (!ctx) throw new Error("useTrips must be used within TripsProvider");
  return ctx;
}
