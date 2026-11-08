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
    };
    listReadings.mockResolvedValue([reading]);
    const response = await GET(new Request(
      "http://localhost/api/readings?serial=26261652&range=30d&limit=100",
      { headers: { "x-real-ip": "history-independent-test" } },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ readings: [reading] });
    expect(listReadings).toHaveBeenCalledWith("26261652", 500);
  });
});
