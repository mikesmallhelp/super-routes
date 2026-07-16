import {
  Bus,
  Ship,
  TrainFront,
  TramFront,
} from "lucide-react";

interface VehicleIconProps {
  mode: string;
  className?: string;
}

function MetroRight({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 17V8a2 2 0 0 1 2-2h12l4 4v7" />
      <path d="M17 6v4h4" />
      <path d="M6 9h3v4H6zM11 9h3v4h-3z" />
      <path d="M3 17h18M6 20h.01M18 20h.01M8 17v3M16 17v3" />
    </svg>
  );
}

export function VehicleIcon({ mode, className = "size-4" }: VehicleIconProps) {
  const iconClassName = `${className} -scale-x-100`;
  switch (mode) {
    case "BUS":
      return <Bus aria-hidden="true" className={className} />;
    case "TRAM":
      return <TramFront aria-hidden="true" className={iconClassName} />;
    case "FERRY":
      return <Ship aria-hidden="true" className={iconClassName} />;
    case "RAIL":
      return <TrainFront aria-hidden="true" className={iconClassName} />;
    case "SUBWAY":
      return <MetroRight className={className} />;
    default:
      return <TrainFront aria-hidden="true" className={iconClassName} />;
  }
}
