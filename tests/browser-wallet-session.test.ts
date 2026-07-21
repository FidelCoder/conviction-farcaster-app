import assert from "node:assert/strict";
import test from "node:test";

import type { UserSession } from "../src/lib/core-api";
import {
  clearStoredBrowserWalletSession,
  getStoredBrowserSessionWalletKind,
  getStoredBrowserWalletSession,
  setStoredBrowserSessionWalletKind,
  setStoredBrowserWalletSession,
} from "../src/lib/browser-wallet-session";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

function installBrowser() {
  const localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage, dispatchEvent: () => true },
  });
  if (!("CustomEvent" in globalThis)) {
    Object.defineProperty(globalThis, "CustomEvent", {
      configurable: true,
      value: class CustomEvent {
        constructor(
          public type: string,
          public init?: { detail?: unknown },
        ) {}
      },
    });
  }
  return localStorage;
}

function walletSession(): UserSession {
  return {
    user: { id: "user" },
    socialAccount: {
      platform: "WEB",
      platformUserId: `0x${"1".repeat(40)}`,
    },
    traderProfile: { id: "profile", userId: "user", handle: "release.viction" },
  } as UserSession;
}

test("restores an existing EVM session and wallet kind after navigation or refresh", () => {
  installBrowser();
  const session = walletSession();
  setStoredBrowserWalletSession(session);
  setStoredBrowserSessionWalletKind("smart");
  assert.deepEqual(getStoredBrowserWalletSession(), session);
  assert.equal(getStoredBrowserSessionWalletKind(), "smart");
});
test("restores a primary Polymarket session after navigation or refresh", () => {
  installBrowser();
  setStoredBrowserWalletSession(walletSession());
  setStoredBrowserSessionWalletKind("polymarket");
  assert.equal(getStoredBrowserSessionWalletKind(), "polymarket");
});

test("rejects malformed stored sessions and clears them", () => {
  const storage = installBrowser();
  storage.setItem("conviction-browser-session", JSON.stringify({ user: { id: "bad" } }));
  assert.equal(getStoredBrowserWalletSession(), null);
  assert.equal(storage.getItem("conviction-browser-session"), null);
});

test("clears both identity and wallet kind on explicit sign out", () => {
  installBrowser();
  setStoredBrowserWalletSession(walletSession());
  setStoredBrowserSessionWalletKind("eoa");
  clearStoredBrowserWalletSession();
  assert.equal(getStoredBrowserWalletSession(), null);
  assert.equal(getStoredBrowserSessionWalletKind(), null);
});
