"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VehicleFilterProps {
  allVehicles: string[];
  selectedVehicles: string[];
  onToggleVehicle: (vehicle: string) => void;
  onFinish: () => void;
}

export function VehicleFilter({
  allVehicles,
  selectedVehicles,
  onToggleVehicle,
  onFinish,
}: VehicleFilterProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">
          Valitse liikennevälineet, jotka haluat esiintyvän reitissä:
        </p>
        <div className="flex flex-wrap gap-2">
          {allVehicles.map((v) => {
            const isSelected = selectedVehicles.includes(v);
            return (
              <button
                key={v}
                onClick={() => onToggleVehicle(v)}
                className="focus:outline-none"
              >
                <Badge
                  variant={isSelected ? "default" : "outline"}
                  className="text-base px-4 py-2 cursor-pointer transition-colors"
                >
                  {v}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
      <Button onClick={onFinish} className="w-full">
        Matka valmis
      </Button>
    </div>
  );
}
