"use client";

import { useState, useMemo, useCallback } from "react";
import type { GeocodedAddress, Connection, VehicleFilterMode } from "@/lib/types";
import { useTrips } from "@/components/providers/trips-provider";
import { AddressInput } from "./address-input";
import { ConnectionCard } from "./connection-card";
import { VehicleFilter } from "./vehicle-filter";
import { TripSummary } from "./trip-summary";
import { Button } from "@/components/ui/button";

type WizardStep = "address" | "results" | "done";
type VehicleState = "none" | "include" | "exclude";

export function TripWizard() {
  const { trips, addTrip, removeTrip, finishSetup } = useTrips();
  const [step, setStep] = useState<WizardStep>("address");
  const [originAddr, setOriginAddr] = useState<GeocodedAddress | null>(null);
  const [destAddr, setDestAddr] = useState<GeocodedAddress | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [vehicleStates, setVehicleStates] = useState<Record<string, VehicleState>>({});
  const [filterMode, setFilterMode] = useState<VehicleFilterMode>("and");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allVehicles = useMemo(() => {
    const set = new Set<string>();
    connections.forEach((conn) =>
      conn.legs.forEach((leg) => {
        if (leg.trip?.routeShortName) set.add(leg.trip.routeShortName);
      })
    );
    return Array.from(set).sort();
  }, [connections]);

  const includedVehicles = useMemo(
    () => Object.entries(vehicleStates).filter(([, s]) => s === "include").map(([v]) => v),
    [vehicleStates]
  );

  const excludedVehicles = useMemo(
    () => Object.entries(vehicleStates).filter(([, s]) => s === "exclude").map(([v]) => v),
    [vehicleStates]
  );

  const filteredConnections = useMemo(() => {
    if (includedVehicles.length === 0 && excludedVehicles.length === 0)
      return connections;
    return connections.filter((conn) => {
      const vehiclesInConn = conn.legs
        .filter((leg) => leg.trip?.routeShortName)
        .map((leg) => leg.trip!.routeShortName);

      if (excludedVehicles.some((v) => vehiclesInConn.includes(v)))
        return false;

      if (includedVehicles.length === 0) return true;
      if (filterMode === "and") {
        return includedVehicles.every((v) => vehiclesInConn.includes(v));
      } else {
        return includedVehicles.some((v) => vehiclesInConn.includes(v));
      }
    });
  }, [connections, includedVehicles, excludedVehicles, filterMode]);

  const handleSearch = useCallback(
    async (origin: GeocodedAddress, dest: GeocodedAddress) => {
      setOriginAddr(origin);
      setDestAddr(dest);
      setLoading(true);
      setError("");
      setVehicleStates({});
      setFilterMode("and");

      try {
        const res = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: origin.coordinates,
            destination: dest.coordinates,
            numItineraries: 5,
          }),
        });

        if (!res.ok) throw new Error("Failed to fetch routes");
        const data = await res.json();
        setConnections(data.connections);
        setStep("results");
      } catch {
        setError("Reittien haku epäonnistui. Yritä uudelleen.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleCycleVehicle = useCallback((vehicle: string) => {
    setVehicleStates((prev) => {
      const current = prev[vehicle] ?? "none";
      const next: VehicleState =
        current === "none" ? "include" : current === "include" ? "exclude" : "none";
      const updated = { ...prev };
      if (next === "none") {
        delete updated[vehicle];
      } else {
        updated[vehicle] = next;
      }
      return updated;
    });
  }, []);

  const handleTripDone = useCallback(async () => {
    if (!originAddr || !destAddr) return;

    await addTrip({
      originLabel: originAddr.label,
      destinationLabel: destAddr.label,
      originCoords: originAddr.coordinates,
      destinationCoords: destAddr.coordinates,
      selectedVehicles: includedVehicles,
      excludedVehicles,
      vehicleFilterMode: filterMode,
    });

    setStep("done");
  }, [originAddr, destAddr, includedVehicles, excludedVehicles, filterMode, addTrip]);

  const handleNewTrip = useCallback(() => {
    setStep("address");
    setOriginAddr(null);
    setDestAddr(null);
    setConnections([]);
    setVehicleStates({});
    setFilterMode("and");
    setError("");
  }, []);

  if (step === "done") {
    return (
      <div className="space-y-4">
        {trips.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Tallennetut matkat:</p>
            {trips.map((t) => (
              <TripSummary key={t.id} trip={t} onRemove={removeTrip} />
            ))}
          </div>
        )}

        <p className="text-sm font-medium">Haluatko lisätä uuden matkan?</p>
        <div className="flex gap-2">
          <Button onClick={handleNewTrip} className="flex-1">
            Lisää matka
          </Button>
          <Button
            onClick={finishSetup}
            variant="secondary"
            className="flex-1"
            disabled={trips.length === 0}
          >
            Näytä reaaliaikaiset reitit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trips.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Tallennetut matkat:</p>
          {trips.map((t) => (
            <TripSummary key={t.id} trip={t} onRemove={removeTrip} />
          ))}
        </div>
      )}

      {step === "address" && (
        <>
          <h2 className="text-lg font-semibold">Lisää matka</h2>
          <AddressInput onSearch={handleSearch} />
          {loading && (
            <p className="text-sm text-muted-foreground">Haetaan reittejä...</p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          {trips.length > 0 && (
            <Button
              onClick={finishSetup}
              variant="secondary"
              className="w-full"
            >
              Näytä reaaliaikaiset reitit
            </Button>
          )}
        </>
      )}

      {step === "results" && (
        <>
          <h2 className="text-lg font-semibold">
            {originAddr?.label} → {destAddr?.label}
          </h2>

          <VehicleFilter
            allVehicles={allVehicles}
            includedVehicles={includedVehicles}
            excludedVehicles={excludedVehicles}
            filterMode={filterMode}
            onCycleVehicle={handleCycleVehicle}
            onSetFilterMode={setFilterMode}
            onFinish={handleTripDone}
          />

          {filteredConnections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ei yhteyksiä valituilla suodattimilla.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredConnections.map((conn, i) => (
                <ConnectionCard
                  key={i}
                  connection={conn}
                  index={i + 1}
                  highlightVehicles={includedVehicles}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
