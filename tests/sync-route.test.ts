import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  backfillDevice,
  fetchLatestForDevice,
  isAllowedCronToken,
  isAllowedSyncToken,
  isDemoMode,
  isRateLimited,
  writeSyncLog,
} = vi.hoisted(() => ({
  backfillDevice: vi.fn(),
  fetchLatestForDevice: vi.fn(),
  isAllowedCronToken: vi.fn(),
  isAllowedSyncToken: vi.fn(),
  isDemoMode: vi.fn(),
  isRateLimited: vi.fn(),
  writeSyncLog: vi.fn(),
}));

vi.mock("../src/lib/antares/client", () => ({ backfillDevice, fetchLatestForDevice, writeSyncLog }));
vi.mock("../src/lib/api", () => ({ isAllowedCronToken, isAllowedSyncToken, isDemoMode }));
vi.mock("../src/lib/rate-limit", () => ({
  isRateLimited,
  rateLimitedResponse: () => Response.json({ error: "rate limited" }, { status: 429 }),
}));

import { GET, POST } from "../src/app/api/sync/route";

describe("/api/sync authentication and polling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    isRateLimited.mockReturnValue(false);
    isDemoMode.mockReturnValue(false);
    fetchLatestForDevice.mockResolvedValue({
      receivedAt: "2026-11-08T10:33:03.053Z",
    });
    writeSyncLog.mockResolvedValue(undefined);
  });

  it("rejects cron requests without the configured bearer token", async () => {
    isAllowedCronToken.mockReturnValue(false);
    const response = await GET(new Request("https://example.test/api/sync"));

    expect(response.status).toBe(401);
    expect(fetchLatestForDevice).not.toHaveBeenCalled();
  });

  it("rejects cron requests when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(new Request("https://example.test/api/sync", {
      headers: { Authorization: "Bearer any-value" },
    }));

    expect(response.status).toBe(503);
    expect(isAllowedCronToken).not.toHaveBeenCalled();
    expect(fetchLatestForDevice).not.toHaveBeenCalled();
  });

  it("accepts only a Bearer authorization scheme for cron", async () => {
    isAllowedCronToken.mockReturnValue(false);
    const response = await GET(new Request("https://example.test/api/sync", {
      headers: { Authorization: "Basic test-cron-secret" },
    }));

    expect(response.status).toBe(401);
    expect(isAllowedCronToken).toHaveBeenCalledWith(null);
    expect(fetchLatestForDevice).not.toHaveBeenCalled();
  });

  it("uses the authenticated scheduled poll to sync all registered meters", async () => {
    isAllowedCronToken.mockReturnValue(true);
    const response = await GET(new Request("https://example.test/api/sync", {
      headers: { Authorization: "Bearer cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(isAllowedCronToken).toHaveBeenCalledWith("cron-secret");
    expect(fetchLatestForDevice).toHaveBeenCalledTimes(4);
    expect((await response.json()).successCount).toBe(4);
  });

  it("protects the manual sync endpoint with the internal token", async () => {
    isAllowedSyncToken.mockReturnValue(false);
    const response = await POST(new Request("https://example.test/api/sync?serial=26261652", {
      method: "POST",
    }));

    expect(response.status).toBe(401);
    expect(fetchLatestForDevice).not.toHaveBeenCalled();
  });
});
