import { afterEach, describe, expect, it, vi } from "vitest";
import { getReadingStatus } from "../src/lib/telemetry/status";
import { getDemoReadings } from "../src/lib/telemetry/demo";

describe("device freshness status", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns NO DATA without an uplink and STALE after the configured threshold", () => {
    vi.stubEnv("ANTARES_FRESHNESS_MINUTES", "60");
    const reading = getDemoReadings()[0];

    expect(getReadingStatus(null, Date.parse(reading.receivedAt))).toBe("no-data");
    expect(getReadingStatus(reading, Date.parse(reading.receivedAt) + 60 * 60_000 + 1)).toBe("stale");
  });

  it("does not call an uplink from the future fresh", () => {
    const reading = getDemoReadings()[0];
    expect(getReadingStatus(reading, Date.parse(reading.receivedAt) - 1)).toBe("stale");
  });

  it("uses an eight-hour default freshness threshold", () => {
    vi.stubEnv("ANTARES_FRESHNESS_MINUTES", "");
    const reading = getDemoReadings()[0];
    const receivedAt = Date.parse(reading.receivedAt);

    expect(getReadingStatus(reading, receivedAt + 8 * 60 * 60_000 - 1)).toBe("fresh");
    expect(getReadingStatus(reading, receivedAt + 8 * 60 * 60_000 + 1)).toBe("stale");
  });
});
