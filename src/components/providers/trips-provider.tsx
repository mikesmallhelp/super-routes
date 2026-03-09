"use client";

import {
  createContext,
  use,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { SavedTrip } from "@/lib/types";

interface TripsContextValue {
  trips: SavedTrip[];
  addTrip: (trip: Omit<SavedTrip, "id">) => Promise<SavedTrip>;
  removeTrip: (id: string) => Promise<void>;
  isSetupDone: boolean;
  finishSetup: () => void;
  goBackToSetup: () => void;
  loading: boolean;
}

const TripsContext = createContext<TripsContextValue | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isSetupDone, setIsSetupDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trips")
      .then((res) => res.json())
      .then((data: SavedTrip[]) => {
        setTrips(data);
        if (data.length > 0) setIsSetupDone(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const addTrip = useCallback(async (trip: Omit<SavedTrip, "id">) => {
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
    const saved: SavedTrip = await res.json();
    setTrips((prev) => [...prev, saved]);
    return saved;
  }, []);

  const removeTrip = useCallback(async (id: string) => {
    await fetch(`/api/trips/${id}`, { method: "DELETE" });
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const finishSetup = useCallback(() => setIsSetupDone(true), []);
  const goBackToSetup = useCallback(() => setIsSetupDone(false), []);

  return (
    <TripsContext
      value={{
        trips,
        addTrip,
        removeTrip,
        isSetupDone,
        finishSetup,
        goBackToSetup,
        loading,
      }}
    >
      {children}
    </TripsContext>
  );
}

export function useTrips() {
  const ctx = use(TripsContext);
  if (!ctx) throw new Error("useTrips must be used within TripsProvider");
  return ctx;
}
