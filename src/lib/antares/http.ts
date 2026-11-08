const timeoutMs = 8_000;

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
    throw new Error("ANTARES access key is not configured.");
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
      headers: { "X-M2M-Origin": accessKey, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const message = timedOut
      ? `Request timed out after ${timeoutMs} ms.`
      : sanitizeAntaresError(error instanceof Error ? error.message : "Network request failed.", accessKey);
    console.error("ANTARES request failed", { requestName, message });
    throw new Error(`ANTARES ${requestName} request failed: ${message}`);
  }

  const responseText = await response.text();
  if (!response.ok) {
    const message = sanitizeAntaresError(extractErrorMessage(responseText), accessKey);
    console.error("ANTARES request failed", { requestName, status: response.status, message });
    throw new Error(`ANTARES ${requestName} request failed with HTTP ${response.status}: ${message}`);
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    const message = "ANTARES returned an invalid JSON response.";
    console.error("ANTARES response parsing failed", { requestName, status: response.status, message });
    throw new Error(message);
  }
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
  return message.replaceAll(accessKey, "[REDACTED]").replace(/[\r\n\t]+/g, " ").slice(0, 300);
}
