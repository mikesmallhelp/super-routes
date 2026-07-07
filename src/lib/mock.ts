/**
 * Mock service for development and testing.
 * Enable via NEXT_PUBLIC_MOCK_STOP=<stop_code> in .env.local.
 *
 * When enabled, the user's location is fixed at the specified stop.
 * Coordinates are fetched from the Digitransit API at startup.
 */

interface StopCoords {
  lat: number;
  lon: number;
  name: string;
}

class MockService {
  readonly stopCode: string | null;

  constructor() {
    this.stopCode = process.env.NEXT_PUBLIC_MOCK_STOP ?? null;
  }

  get isEnabled(): boolean {
    return !!this.stopCode;
  }

  async fetchUserPosition(): Promise<{ latitude: number; longitude: number } | null> {
    if (!this.stopCode) return null;
    try {
      const res = await fetch(`/api/stop-coords?code=${encodeURIComponent(this.stopCode)}`);
      if (!res.ok) {
        console.error(`[Mock] Stop not found: ${this.stopCode} (${res.status})`);
        return null;
      }
      const stop: StopCoords = await res.json();
      console.log(`[Mock] Position set to stop ${this.stopCode} (${stop.name}): ${stop.lat}, ${stop.lon}`);
      return { latitude: stop.lat, longitude: stop.lon };
    } catch (e) {
      console.error(`[Mock] Failed to fetch stop coords for ${this.stopCode}:`, e);
      return null;
    }
  }
}

export const mockService = new MockService();
