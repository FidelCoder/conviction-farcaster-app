import type { TraderProfile, UserSession } from "./core-api";

export const VICTION_SUFFIX = ".viction";

const generatedHandlePatterns = [
  /^wallet[a-f0-9]{6,}\.viction$/i,
  /^trader[a-f0-9]{4,}\.viction$/i,
  /^user[a-f0-9]{4,}\.viction$/i,
  /^guest\.viction$/i,
  /^trader\.viction$/i,
  /^yourname\.viction$/i,
];

export function isClaimedVictionHandle(value: string | null | undefined) {
  const normalized = normalizeFullVictionHandle(value);

  if (!normalized.endsWith(VICTION_SUFFIX)) return false;
  if (generatedHandlePatterns.some((pattern) => pattern.test(normalized))) return false;

  return stripVictionSuffix(normalized).length >= 2;
}

export function isClaimedVictionProfile(profile: TraderProfile | null | undefined) {
  return isClaimedVictionHandle(profile?.handle);
}

export function sessionNeedsVictionClaim(session: UserSession | null | undefined) {
  return Boolean(session && !isClaimedVictionProfile(session.traderProfile));
}

export function normalizeVictionHandle(value: string) {
  return stripVictionSuffix(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 32);
}

export function buildVictionHandle(value: string) {
  const clean = normalizeVictionHandle(value) || "yourname";

  return clean + VICTION_SUFFIX;
}

export function stripVictionSuffix(value: string | null | undefined) {
  const trimmed = (value ?? "").trim().toLowerCase();

  return trimmed.endsWith(VICTION_SUFFIX) ? trimmed.slice(0, -VICTION_SUFFIX.length) : trimmed;
}

function normalizeFullVictionHandle(value: string | null | undefined) {
  const clean = normalizeVictionHandle(value ?? "");

  return clean ? clean + VICTION_SUFFIX : "";
}
