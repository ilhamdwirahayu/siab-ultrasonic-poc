import { beforeEach, describe, expect, it, vi } from "vitest";

const { listReadings } = vi.hoisted(() => ({ listReadings: vi.fn() }));
vi.mock("../src/lib/db/repository", () => ({ listReadings }));

import { GET } from "../src/app/api/readings/route";

describe("GET /api/readings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves stored history without consulting ANTARES latest", async () => {
    const reading = {
      id: "/antares-cse/antares-id/SIAB-US-01/26261652/cin_example",
      serial: "26261652",
      devEui: "8cf95720001cd395",
      receivedAt: new Date().toISOString(),
      forwardM3: null,
      flowM3PerHour: null,
      source: "antares",
      antaresAccessKey: "must-not-appear-in-api-response",
    };
    listReadings.mockResolvedValue([reading]);
    const response = await GET(new Request(
      "http://localhost/api/readings?serial=26261652&range=7d&limit=100",
      { headers: { "x-real-ip": "history-independent-test" } },
    ));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ readings: [{ id: reading.id, serial: reading.serial }] });
    expect(JSON.stringify(body)).not.toContain("must-not-appear-in-api-response");
    expect(listReadings).toHaveBeenCalledWith("26261652", 100, expect.any(String));
  });

  it.each([
    ["1h", 60],
    ["6h", 360],
    ["12h", 720],
    ["24h", 1440],
    ["7d", 10080],
  ] as const)("accepts the %s dashboard period and bounds history", async (range, minutes) => {
    listReadings.mockResolvedValue([]);
    const before = Date.now();
    const response = await GET(new Request(
      `http://localhost/api/readings?serial=26261652&range=${range}&limit=100`,
      { headers: { "x-real-ip": `history-range-${range}` } },
    ));

    expect(response.status).toBe(200);
    const since = Date.parse(listReadings.mock.calls[0][2]);
    expect(since).toBeGreaterThanOrEqual(before - minutes * 60_000 - 100);
    expect(since).toBeLessThanOrEqual(before - minutes * 60_000 + 100);
  });
});
