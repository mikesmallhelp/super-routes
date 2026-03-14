"use client";

import { useState, useRef, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete } from "./address-autocomplete";
import type { GeocodedAddress } from "@/lib/types";

interface AddressInputProps {
  onSearch: (origin: GeocodedAddress, destination: GeocodedAddress) => void;
}

interface ResolvedAddress {
  label: string;
  lat: number;
  lon: number;
}

export function AddressInput({ onSearch }: AddressInputProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const originResolved = useRef<ResolvedAddress | null>(null);
  const destResolved = useRef<ResolvedAddress | null>(null);

  async function geocodeFallback(
    text: string
  ): Promise<ResolvedAddress | null> {
    const res = await fetch(
      `/api/geocode?text=${encodeURIComponent(text.trim())}`
    );
    if (!res.ok) return null;
    return res.json();
  }

  async function handleSearch() {
    if (!origin.trim() || !destination.trim()) {
      setError("Syötä sekä lähtöpaikka että määränpää");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Use resolved addresses from autocomplete, or fall back to geocode
      const [originData, destData] = await Promise.all([
        originResolved.current ?? geocodeFallback(origin),
        destResolved.current ?? geocodeFallback(destination),
      ]);

      if (!originData) {
        setError(`Lähtöpaikkaa "${origin}" ei löytynyt`);
        return;
      }
      if (!destData) {
        setError(`Määränpäätä "${destination}" ei löytynyt`);
        return;
      }

      startTransition(() => {
        onSearch(
          {
            label: originData.label,
            coordinates: {
              latitude: originData.lat,
              longitude: originData.lon,
            },
          },
          {
            label: destData.label,
            coordinates: { latitude: destData.lat, longitude: destData.lon },
          }
        );
      });
    } catch {
      setError("Haku epäonnistui. Yritä uudelleen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <AddressAutocomplete
        label="Lähtöpaikka"
        placeholder="esim. Kaivokatu 1"
        value={origin}
        onChange={(v) => {
          setOrigin(v);
          originResolved.current = null;
        }}
        onSelect={(s) => {
          originResolved.current = s;
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
      />
      <AddressAutocomplete
        label="Määränpää"
        placeholder="esim. Nuuksiontie 84"
        value={destination}
        onChange={(v) => {
          setDestination(v);
          destResolved.current = null;
        }}
        onSelect={(s) => {
          destResolved.current = s;
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button onClick={handleSearch} disabled={loading} className="w-full">
        {loading ? "Haetaan..." : "Hae reitit"}
      </Button>
    </div>
  );
}
