import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchLatestForDevice, isAntaresConfigured } = vi.hoisted(() => ({
  fetchLatestForDevice: vi.fn(),
  isAntaresConfigured: vi.fn(),
}));

vi.mock("../src/lib/antares/client", () => ({ fetchLatestForDevice }));
vi.mock("../src/lib/antares/http", () => ({ isAntaresConfigured }));

import { GET } from "../src/app/api/antares/latest/route";

describe("GET /api/antares/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports missing server credentials without calling ANTARES", async () => {
    isAntaresConfigured.mockReturnValue(false);
    const response = await GET(new Request("http://localhost/api/antares/latest", {
      headers: { "x-real-ip": "test-missing-key" },
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Missing ANTARES_ACCESS_KEY server configuration." });
    expect(fetchLatestForDevice).not.toHaveBeenCalled();
  });

  it("returns latest data without requesting database persistence", async () => {
    const reading = {
      serial: "26261652",
      devEui: "8cf95720001cd395",
      receivedAt: "2026-11-08T09:54:10.000Z",
      payloadHex: "6810",
      rssi: -73,
      snr: 12.25,
    };
    isAntaresConfigured.mockReturnValue(true);
    fetchLatestForDevice.mockResolvedValue(reading);
    const response = await GET(new Request("http://localhost/api/antares/latest", {
      headers: { "x-real-ip": "test-live-reading" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reading, status: expect.stringMatching(/^(fresh|stale)$/) });
    expect(fetchLatestForDevice).toHaveBeenCalledWith("26261652", { persist: false });
  });
});
