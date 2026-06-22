import type { UserSession } from "./core-api";

const browserSessionKey = "conviction-browser-session";
const browserSessionWalletKindKey = "conviction-browser-session-wallet-kind";
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export type BrowserSessionWalletKind = "smart" | "eoa";

export function getStoredBrowserWalletSession() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(browserSessionKey);

  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as UserSession;

    return isBrowserWalletSession(session) ? session : null;
  } catch {
    clearStoredBrowserWalletSession();
    return null;
  }
}

export function setStoredBrowserWalletSession(session: UserSession) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(browserSessionKey, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("conviction-browser-session", { detail: session }));
}

export function getStoredBrowserSessionWalletKind(): BrowserSessionWalletKind | null {
  if (typeof window === "undefined") return null;

  const kind = window.localStorage.getItem(browserSessionWalletKindKey);

  return kind === "smart" || kind === "eoa" ? kind : null;
}

export function setStoredBrowserSessionWalletKind(kind: BrowserSessionWalletKind) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(browserSessionWalletKindKey, kind);
}

export function clearStoredBrowserWalletSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(browserSessionKey);
  window.localStorage.removeItem(browserSessionWalletKindKey);
  window.dispatchEvent(new CustomEvent("conviction-browser-session", { detail: null }));
}

export function getSessionWalletAddress(session: UserSession | null) {
  if (!isBrowserWalletSession(session)) return null;

  return session.socialAccount.platformUserId;
}

export function isBrowserWalletSession(session: UserSession | null): session is UserSession {
  if (session?.socialAccount.platform !== "WEB") return false;

  return evmAddressPattern.test(session.socialAccount.platformUserId.trim());
}
