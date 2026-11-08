const buckets = new Map<string, { startedAt: number; count: number }>();

export function isRateLimited(request: Request, route: string, limit = 120, windowMs = 60_000): boolean {
  const forwarded = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${route}:${forwarded || "unknown"}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    if (buckets.size > 10_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (now - bucket.startedAt >= windowMs) buckets.delete(bucketKey);
      }
    }
    return false;
  }

  current.count += 1;
  return current.count > limit;
}

export function rateLimitedResponse() {
  return Response.json({ error: "Terlalu banyak permintaan. Silakan coba kembali sebentar lagi." }, {
    status: 429,
    headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
}
