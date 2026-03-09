"use client";

import { TripsProvider, useTrips } from "@/components/providers/trips-provider";
import { TripWizard } from "@/components/trip-wizard/trip-wizard";
import { LiveDashboard } from "@/components/live-view/live-dashboard";

function AppContent() {
  const { isSetupDone, loading } = useTrips();

  return (
    <main className="min-h-screen max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-primary mb-6">Tehoreitit</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">Ladataan...</p>
      ) : isSetupDone ? (
        <LiveDashboard />
      ) : (
        <TripWizard />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <TripsProvider>
      <AppContent />
    </TripsProvider>
  );
}
