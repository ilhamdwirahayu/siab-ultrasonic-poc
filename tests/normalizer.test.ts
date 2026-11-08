import { describe, expect, it } from "vitest";
import {
  getAntaresReadingTimestamp,
  normalizeAntaresEnvelope,
  normalizeAntaresLatest,
  parseAntaresTimestamp,
} from "../src/lib/antares/normalizer";
import fixture from "./fixtures/meter52-uplink.json";

describe("normalizeAntaresLatest", () => {
  it("normalizes the documented m2m:cin string content shape", () => {
    const result = normalizeAntaresLatest({ "m2m:cin": { con: JSON.stringify(fixture) } });
    expect(result.devEui).toBe("8cf95720001cd395");
    expect(result.port).toBe(8);
    expect(result.data).toHaveLength(86);
  });

  it("rejects the wrong device and invalid hex", () => {
    expect(() => normalizeAntaresLatest({ "m2m:cin": { con: { ...fixture, data: "not-hex" } } })).toThrow();
    expect(() => normalizeAntaresLatest({ bad: true })).toThrow();
  });

  it("preserves the ANTARES content-instance ID and converts its UTC creation time", () => {
    const rawResponse = {
      "m2m:cin": { ri: "/antares-cse/cin-fixture", ct: "20261108T095410", con: JSON.stringify(fixture) },
    };
    const result = normalizeAntaresEnvelope(rawResponse);
    expect(result.resourceId).toBe("/antares-cse/cin-fixture");
    expect(result.createdAt).toBe("2026-11-08T09:54:10.000Z");
    expect(result.rawResponse).toBe(rawResponse);
  });

  it("rejects malformed ANTARES timestamps without inventing a date", () => {
    expect(parseAntaresTimestamp("20261399T999999")).toBeNull();
  });

  it("uses the radio uplink time instead of the local Antares resource time", () => {
    expect(getAntaresReadingTimestamp(
      "2026-11-08T17:33:03.000Z",
      "2026-11-08T10:33:03.053+00:00",
    )).toBe("2026-11-08T10:33:03.053+00:00");
  });
});
