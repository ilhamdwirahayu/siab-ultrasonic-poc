import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLatestUrl, fetchAntaresJson, getLatestUrl } from "../src/lib/antares/http";

describe("ANTARES latest endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the application latest-resource URL", () => {
    expect(buildLatestUrl("https://platform.antares.id:8443/", "SIAB-US-01", "26261652"))
      .toBe("https://platform.antares.id:8443/~/antares-cse/antares-id/SIAB-US-01/26261652/la");
  });

  it("uses the configured server key and JSON accept header", async () => {
    vi.stubEnv("ANTARES_API_BASE_URL", "https://platform.antares.id:8443");
    vi.stubEnv("ANTARES_APPLICATION", "SIAB-US-01");
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ "m2m:cin": { con: "{}" } }), { status: 200 }),
    );
    const rawResponse = await fetchAntaresJson(getLatestUrl("26261652"), "test-access-key", "latest", request);

    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://platform.antares.id:8443/~/antares-cse/antares-id/SIAB-US-01/26261652/la");
    expect(new Headers(options?.headers).get("X-M2M-Origin")).toBe("test-access-key");
    expect(new Headers(options?.headers).get("Accept")).toBe("application/json");
    expect(rawResponse).toEqual({ "m2m:cin": { con: "{}" } });
  });

  it("logs an upstream status and redacts its access key from the error", async () => {
    const key = "test-access-key";
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: `Rejected ${key}` }), { status: 403 }),
    );

    await expect(fetchAntaresJson("https://example.test/la", key, "latest", request))
      .rejects.toThrow("HTTP 403: Rejected [REDACTED]");
    expect(log).toHaveBeenCalledWith("ANTARES request failed", {
      requestName: "latest",
      status: 403,
      message: "Rejected [REDACTED]",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(key);
    log.mockRestore();
  });
});
