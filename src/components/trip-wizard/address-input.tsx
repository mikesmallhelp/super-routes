"use client";

import { useState, startTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { GeocodedAddress } from "@/lib/types";

interface AddressInputProps {
  onSearch: (origin: GeocodedAddress, destination: GeocodedAddress) => void;
}

export function AddressInput({ onSearch }: AddressInputProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!origin.trim() || !destination.trim()) {
      setError("Syötä sekä lähtöpiste että loppupiste");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // async-parallel: fetch both addresses in parallel
      const [originRes, destRes] = await Promise.all([
        fetch(`/api/geocode?text=${encodeURIComponent(origin.trim())}`),
        fetch(`/api/geocode?text=${encodeURIComponent(destination.trim())}`),
      ]);

      if (!originRes.ok) {
        setError(`Lähtöpistettä "${origin}" ei löytynyt`);
        return;
      }
      if (!destRes.ok) {
        setError(`Loppupistettä "${destination}" ei löytynyt`);
        return;
      }

      const originData = await originRes.json();
      const destData = await destRes.json();

      startTransition(() => {
        onSearch(
          {
            label: originData.label,
            coordinates: { latitude: originData.lat, longitude: originData.lon },
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
      <div className="space-y-2">
        <label className="text-sm font-medium">Lähtöpiste</label>
        <Input
          placeholder="esim. Kaivokatu 1"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Loppupiste</label>
        <Input
          placeholder="esim. Nuuksiontie 84"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button onClick={handleSearch} disabled={loading} className="w-full">
        {loading ? "Haetaan..." : "Hae reitit"}
      </Button>
    </div>
  );
}
