import { timingSafeEqual } from "node:crypto";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

export function isAllowedSyncToken(value: string | null): boolean {
  const expected = process.env.INTERNAL_SYNC_TOKEN;
  if (!expected || expected === "REPLACE_RANDOM_LONG_SECRET" || !value) return false;
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
