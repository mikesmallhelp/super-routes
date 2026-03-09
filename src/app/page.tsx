"use client";

import { useSession } from "next-auth/react";
import { TripsProvider, useTrips } from "@/components/providers/trips-provider";
import { TripWizard } from "@/components/trip-wizard/trip-wizard";
import { LiveDashboard } from "@/components/live-view/live-dashboard";
import { LoginScreen } from "@/components/auth/login-screen";
import { UserMenu } from "@/components/auth/user-menu";

function AppContent() {
  const { isSetupDone, loading } = useTrips();

  return (
    <main className="min-h-screen max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Tehoreitit</h1>
        <UserMenu />
      </div>
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
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Ladataan...</p>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <TripsProvider>
      <AppContent />
    </TripsProvider>
  );
}
