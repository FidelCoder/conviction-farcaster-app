import type { UserSession } from "./core-api";

const browserSessionKey = "conviction-browser-session";
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

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

export function clearStoredBrowserWalletSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(browserSessionKey);
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
