import { timingSafeEqual } from "node:crypto";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

export function isAllowedSyncToken(value: string | null): boolean {
  return isAllowedToken(value, process.env.INTERNAL_SYNC_TOKEN, "REPLACE_RANDOM_LONG_SECRET");
}

export function isAllowedCronToken(value: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16 || expected.trim() !== expected) return false;
  return isAllowedToken(value, expected, "REPLACE_CRON_SECRET");
}

function isAllowedToken(value: string | null, expected: string | undefined, placeholder: string): boolean {
  if (!expected || expected === placeholder || !value) return false;
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
