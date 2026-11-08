const timeoutMs = 8_000;

export type AntaresFailureType =
  | "missing-credentials"
  | "timeout"
  | "network-error"
  | "unauthorized"
  | "forbidden"
  | "resource-not-found"
  | "http-error"
  | "invalid-json"
  | "invalid-response-payload"
  | "none"
  | "unknown";

export class AntaresHttpError extends Error {
  constructor(
    message: string,
    readonly failureType: AntaresFailureType,
    readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = "AntaresHttpError";
  }
}

export function buildLatestUrl(baseUrl: string, application: string, serial: string): string {
  return `${baseUrl.replace(/\/$/, "")}/~/antares-cse/antares-id/${encodeURIComponent(application)}/${encodeURIComponent(serial)}/la`;
}

export function getLatestUrl(serial: string): string {
  const baseUrl = process.env.ANTARES_API_BASE_URL ?? "https://platform.antares.id:8443";
  const application = process.env.ANTARES_APPLICATION ?? "SIAB-US-01";
  return buildLatestUrl(baseUrl, application, serial);
}

export function isAntaresConfigured(): boolean {
  const accessKey = process.env.ANTARES_ACCESS_KEY;
  return Boolean(accessKey && accessKey !== "REPLACE_SERVER_ONLY");
}

export async function fetchLatestAntaresResponse(serial: string): Promise<unknown> {
  const accessKey = process.env.ANTARES_ACCESS_KEY;
  if (!accessKey || accessKey === "REPLACE_SERVER_ONLY") {
    throw new AntaresHttpError("ANTARES_ACCESS_KEY is missing.", "missing-credentials", null);
  }
  return fetchAntaresJson(getLatestUrl(serial), accessKey, "latest");
}

export async function fetchAntaresJson(
  url: string,
  accessKey: string,
  requestName: string,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: {
        "X-M2M-Origin": accessKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const message = timedOut
      ? `Request timed out after ${timeoutMs} ms.`
      : sanitizeAntaresError(error instanceof Error ? error.message : "Network request failed.", accessKey);
    console.error("ANTARES request failed", { requestName, message });
    throw new AntaresHttpError(
      `ANTARES ${requestName} request failed: ${message}`,
      timedOut ? "timeout" : "network-error",
      null,
    );
  }

  const responseText = await response.text();
  if (!response.ok) {
    const message = sanitizeAntaresError(extractErrorMessage(responseText), accessKey);
    console.error("ANTARES request failed", { requestName, status: response.status, message });
    throw new AntaresHttpError(
      `ANTARES ${requestName} request failed with HTTP ${response.status}: ${message}`,
      getHttpFailureType(response.status),
      response.status,
    );
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    const message = "ANTARES returned an invalid JSON response.";
    console.error("ANTARES response parsing failed", { requestName, status: response.status, message });
    throw new AntaresHttpError(message, "invalid-json", response.status);
  }
}

export function getAntaresDiagnostic(serial: string, error: unknown) {
  const baseUrl = process.env.ANTARES_API_BASE_URL ?? "https://platform.antares.id:8443";
  const application = process.env.ANTARES_APPLICATION ?? "SIAB-US-01";
  const accessKey = process.env.ANTARES_ACCESS_KEY;
  let origin: string | null = null;
  let path: string | null = null;
  try {
    const url = new URL(buildLatestUrl(baseUrl, application, serial));
    origin = url.origin;
    path = url.pathname;
  } catch {
    // Keep diagnostics safe and useful even when the configured URL is malformed.
  }
  const failureType = error === null
    ? "none"
    : error instanceof AntaresHttpError ? error.failureType : "unknown";
  const httpStatus = error instanceof AntaresHttpError ? error.httpStatus : null;
  const applicationMatchesExpected = application === "SIAB-US-01";
  const baseUrlMatchesExpected = origin === "https://platform.antares.id:8443";
  const likelyCause = failureType === "resource-not-found"
    ? !baseUrlMatchesExpected || !applicationMatchesExpected
      ? "configured-path-mismatch"
      : "resource-path-device-or-key-scope"
    : null;

  return {
    method: "GET",
    origin,
    path,
    applicationMatchesExpected,
    baseUrlMatchesExpected,
    deviceSerial: serial,
    accessKeyConfigured: Boolean(accessKey && accessKey !== "REPLACE_SERVER_ONLY"),
    requestHeaders: ["X-M2M-Origin", "Content-Type: application/json", "Accept: application/json"],
    httpStatus,
    failureType,
    safeMessage: error instanceof Error ? sanitizeAntaresError(error.message, accessKey ?? "") : "Unknown ANTARES error.",
    likelyCause,
    recommendedAction: likelyCause === "configured-path-mismatch"
      ? "Set Vercel Production ANTARES_API_BASE_URL and ANTARES_APPLICATION to the verified local values, then redeploy."
      : likelyCause === "resource-path-device-or-key-scope"
        ? "Verify meter 26261652 exists under SIAB-US-01 and that the Vercel ANTARES_ACCESS_KEY has access to this application/device; compare settings locally without exposing the key."
        : failureType === "unauthorized" || failureType === "forbidden"
          ? "Verify the Vercel Production ANTARES_ACCESS_KEY is current and authorized for this application."
          : failureType === "missing-credentials"
            ? "Set ANTARES_ACCESS_KEY in Vercel Production Environment Variables."
            : null,
  };
}

function getHttpFailureType(status: number): AntaresFailureType {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "resource-not-found";
  return "http-error";
}

function extractErrorMessage(responseText: string): string {
  try {
    const body = JSON.parse(responseText) as unknown;
    if (typeof body === "string") return body;
    if (body && typeof body === "object") {
      const fields = body as Record<string, unknown>;
      for (const key of ["message", "error", "m2m:dbg"]) {
        if (typeof fields[key] === "string") return fields[key] as string;
      }
    }
  } catch {
    return responseText || "No error message returned.";
  }
  return responseText || "No error message returned.";
}

function sanitizeAntaresError(message: string, accessKey: string): string {
  return (accessKey ? message.replaceAll(accessKey, "[REDACTED]") : message)
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 300);
}
