"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VehicleFilterMode } from "@/lib/types";

type VehicleState = "none" | "include" | "exclude";

interface VehicleFilterProps {
  allVehicles: string[];
  includedVehicles: string[];
  excludedVehicles: string[];
  filterMode: VehicleFilterMode;
  onCycleVehicle: (vehicle: string) => void;
  onSetFilterMode: (mode: VehicleFilterMode) => void;
  onFinish: () => void;
  onCancel: () => void;
}

function getVehicleState(
  vehicle: string,
  included: string[],
  excluded: string[]
): VehicleState {
  if (included.includes(vehicle)) return "include";
  if (excluded.includes(vehicle)) return "exclude";
  return "none";
}

export function VehicleFilter({
  allVehicles,
  includedVehicles,
  excludedVehicles,
  filterMode,
  onCycleVehicle,
  onSetFilterMode,
  onFinish,
  onCancel,
}: VehicleFilterProps) {
  const hasIncluded = includedVehicles.length > 0;
  const hasExcluded = excludedVehicles.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-1">
          Valitse liikennevälineet napauttamalla:
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          1× napautus = sisällytä &middot; 2× = poista &middot; 3× = tyhjennä
        </p>
        <div className="flex flex-wrap gap-2">
          {allVehicles.map((v) => {
            const state = getVehicleState(v, includedVehicles, excludedVehicles);
            return (
              <button
                key={v}
                onClick={() => onCycleVehicle(v)}
                className="focus:outline-none"
              >
                <Badge
                  variant={state === "none" ? "outline" : "default"}
                  className={`text-base px-4 py-2 cursor-pointer transition-colors ${
                    state === "include"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : state === "exclude"
                        ? "bg-red-600 hover:bg-red-700 text-white line-through"
                        : ""
                  }`}
                >
                  {state === "exclude" ? `✕ ${v}` : state === "include" ? `✓ ${v}` : v}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {hasIncluded && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Näytä reitit joissa on:</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="filterMode"
                checked={filterMode === "and"}
                onChange={() => onSetFilterMode("and")}
                className="w-4 h-4 accent-green-600"
              />
              Kaikki valitut
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="filterMode"
                checked={filterMode === "or"}
                onChange={() => onSetFilterMode("or")}
                className="w-4 h-4 accent-green-600"
              />
              Jokin valituista
            </label>
          </div>
        </div>
      )}

      {(hasIncluded || hasExcluded) && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
          {hasIncluded && (
            <p>
              Reitissä on{" "}
              {includedVehicles.map((v, i) => (
                <span key={v}>
                  {i > 0 && (
                    <span className="font-medium">
                      {filterMode === "and" ? " ja " : " tai "}
                    </span>
                  )}
                  <span className="font-semibold text-green-700">{v}</span>
                </span>
              ))}
            </p>
          )}
          {hasExcluded && (
            <p>
              Ei sisällä:{" "}
              {excludedVehicles.map((v, i) => (
                <span key={v}>
                  {i > 0 && ", "}
                  <span className="font-semibold text-red-700">{v}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Keskeytä
        </Button>
        <Button onClick={onFinish} className="flex-1">
          Matka valmis
        </Button>
      </div>
    </div>
  );
}
