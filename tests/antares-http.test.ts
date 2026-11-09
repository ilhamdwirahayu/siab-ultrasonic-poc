import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLatestUrl,
  fetchAntaresJson,
  getAntaresDiagnostic,
  getLatestUrl,
} from "../src/lib/antares/http";

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
    expect(new Headers(options?.headers).get("Content-Type")).toBe("application/json");
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

  it("retries a transient upstream error and then succeeds", async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ "m2m:cin": { con: "{}" } }), { status: 200 }));

    const result = fetchAntaresJson("https://example.test/la", "test-access-key", "latest", request);
    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toEqual({ "m2m:cin": { con: "{}" } });
    expect(request).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("classifies a 404 and reports the exact safe endpoint configuration", async () => {
    vi.stubEnv("ANTARES_API_BASE_URL", "https://platform.antares.id:8443");
    vi.stubEnv("ANTARES_APPLICATION", "SIAB-US-01");
    vi.stubEnv("ANTARES_ACCESS_KEY", "do-not-show");
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "Resource not found" }), { status: 404 }),
    );
    let caught: unknown;
    try {
      await fetchAntaresJson(getLatestUrl("26261652"), "do-not-show", "latest", request);
    } catch (error) {
      caught = error;
    }

    const diagnostic = getAntaresDiagnostic("26261652", caught);
    expect(diagnostic).toMatchObject({
      method: "GET",
      origin: "https://platform.antares.id:8443",
      path: "/~/antares-cse/antares-id/SIAB-US-01/26261652/la",
      applicationMatchesExpected: true,
      baseUrlMatchesExpected: true,
      accessKeyConfigured: true,
      httpStatus: 404,
      failureType: "resource-not-found",
      likelyCause: "resource-path-device-or-key-scope",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("do-not-show");
  });
});
