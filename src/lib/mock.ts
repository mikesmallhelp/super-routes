/**
 * Mock service for development and testing.
 * Enable via either:
 * - NEXT_PUBLIC_MOCK_VEHICLE_STOP_FIRST / NEXT_PUBLIC_MOCK_VEHICLE_STOP_LAST (priority)
 * - NEXT_PUBLIC_MOCK_STOP (stop fallback)
 *
 * Vehicle mock:
 * - Picks first matching vehicle travelling FIRST -> LAST
 * - Locks to the same vehicle id for subsequent updates
 *
 * Stop mock:
 * - Fixes user's location at the specified stop
 */

interface MockPositionResponseEnabledVehicle {
  enabled: true;
  mode: "vehicle";
  latitude: number;
  longitude: number;
  vehicleId: string;
}

interface MockPositionResponseEnabledStop {
  enabled: true;
  mode: "stop";
  latitude: number;
  longitude: number;
  stopCode: string;
  stopName: string;
}

type MockPositionResponse =
  | MockPositionResponseEnabledVehicle
  | MockPositionResponseEnabledStop
  | { enabled: false };

class MockService {
  private lockedVehicleId: string | null = null;

  async fetchUserPosition(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const params = new URLSearchParams();
      if (this.lockedVehicleId) params.set("lockedVehicleId", this.lockedVehicleId);
      const query = params.toString();
      const res = await fetch(`/api/mock-user-position${query ? `?${query}` : ""}`);
      if (!res.ok) {
        console.error(`[Mock] Failed to fetch mock user position (${res.status})`);
        return null;
      }
      const payload = (await res.json()) as MockPositionResponse;
      if (!payload.enabled) {
        this.lockedVehicleId = null;
        return null;
      }

      if (payload.mode === "vehicle") {
        if (this.lockedVehicleId !== payload.vehicleId) {
          this.lockedVehicleId = payload.vehicleId;
          console.log(`[Mock] Locked to vehicle ${payload.vehicleId}`);
        }
        return { latitude: payload.latitude, longitude: payload.longitude };
      }

      this.lockedVehicleId = null;
      return { latitude: payload.latitude, longitude: payload.longitude };
    } catch (e) {
      console.error("[Mock] Failed to fetch mock user position:", e);
      return null;
    }
  }
}

export const mockService = new MockService();
