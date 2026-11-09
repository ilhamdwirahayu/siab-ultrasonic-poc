import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedCronToken, isAllowedSyncToken } from "../src/lib/api";

describe("server synchronization token checks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only the configured cron secret", () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-value");

    expect(isAllowedCronToken("test-cron-secret-value")).toBe(true);
    expect(isAllowedCronToken("incorrect-value")).toBe(false);
    expect(isAllowedCronToken(null)).toBe(false);
  });

  it("rejects an unset or placeholder cron secret", () => {
    vi.stubEnv("CRON_SECRET", "REPLACE_CRON_SECRET");

    expect(isAllowedCronToken("REPLACE_CRON_SECRET")).toBe(false);
    vi.stubEnv("CRON_SECRET", "");
    expect(isAllowedCronToken("")).toBe(false);
  });

  it("rejects weak or whitespace-padded cron secrets", () => {
    vi.stubEnv("CRON_SECRET", "short");
    expect(isAllowedCronToken("short")).toBe(false);
    vi.stubEnv("CRON_SECRET", "padded-secret-value ");
    expect(isAllowedCronToken("padded-secret-value ")).toBe(false);
  });

  it("keeps manual sync authorization separate from cron authorization", () => {
    vi.stubEnv("INTERNAL_SYNC_TOKEN", "test-admin-sync-token");
    vi.stubEnv("CRON_SECRET", "test-cron-secret-value");

    expect(isAllowedSyncToken("test-admin-sync-token")).toBe(true);
    expect(isAllowedSyncToken("test-cron-secret-value")).toBe(false);
    expect(isAllowedCronToken("test-admin-sync-token")).toBe(false);
  });
});
