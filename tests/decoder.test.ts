import { describe, expect, it } from "vitest";
import { decodeZhongpeiPayload, METER_52_FIXTURE } from "../src/lib/decoder/zhongpei";

const identity = {
  serial: "26261652",
  devEui: "8cf95720001cd395",
  receivedAt: "2026-11-08T09:54:10.433Z",
};

describe("decodeZhongpeiPayload", () => {
  it("validates the known 43-byte frame without inventing measurement values", () => {
    const result = decodeZhongpeiPayload(METER_52_FIXTURE, identity);
    expect(result.decodeStatus).toBe("partial");
    expect(result.forwardM3).toBeNull();
    expect(result.reverseM3).toBeNull();
    expect(result.flowM3PerHour).toBeNull();
    expect(result.temperatureC).toBeNull();
    expect(result.statusRaw).toBeNull();
    expect(result.meterTime).toBeNull();
  });

  it("rejects malformed length and checksum", () => {
    expect(decodeZhongpeiPayload("68ff16", identity).decodeStatus).toBe("error");
    const corrupt = `${METER_52_FIXTURE.slice(0, -4)}ff${METER_52_FIXTURE.slice(-2)}`;
    expect(decodeZhongpeiPayload(corrupt, identity).decodeMessage).toContain("Checksum");
  });

  it("does not generalize fixture values to another frame", () => {
    const changed = `${METER_52_FIXTURE.slice(0, 30)}${METER_52_FIXTURE.slice(30)}`;
    const result = decodeZhongpeiPayload(changed, { ...identity, serial: "26261649", devEui: "8cf95720001cd496" });
    expect(result.forwardM3).toBeNull();
    expect(result.decodeStatus).toBe("partial");
  });
});
