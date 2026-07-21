"use client";

import { useEffect, useMemo, useRef } from "react";

import { getStoredBrowserSessionWalletKind } from "./browser-wallet-session";
import type { AuthProvider, UsageEventType, UserSession } from "./core-api";

const sessionIdKey = "conviction-product-analytics-session";
const heartbeatMs = 15_000;

export type ProductAnalyticsEvent = {
  area?: string | null;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
  session?: UserSession | null;
  type: UsageEventType;
  value?: number | null;
};

type ProductAnalyticsOptions = {
  area: string;
  enabled?: boolean;
  session?: UserSession | null;
};

export function useProductAnalytics({ area, enabled = true, session }: ProductAnalyticsOptions) {
  const lastPageKeyRef = useRef("");
  const sessionKey = useMemo(() => getClientAnalyticsSessionId(), []);

  useEffect(() => {
    if (!enabled || !sessionKey) return;

    const pageKey = getPath() + "::" + area + "::" + (session?.user.id ?? "guest");

    if (lastPageKeyRef.current !== pageKey) {
      lastPageKeyRef.current = pageKey;
      void trackProductEvent({
        area,
        session,
        type: area === "telegram" ? "MINIAPP_OPEN" : "PAGE_VIEW",
      });
    }

    const interval = window.setInterval(() => {
      void trackProductEvent({ area, session, type: "HEARTBEAT" });
    }, heartbeatMs);

    return () => window.clearInterval(interval);
  }, [area, enabled, session, sessionKey]);
}

export async function trackProductEvent(event: ProductAnalyticsEvent) {
  if (typeof window === "undefined") return;

  const clientSessionId = getClientAnalyticsSessionId();
  if (!clientSessionId) return;

  const payload = {
    area: event.area ?? inferAreaFromPath(),
    authProvider: inferAuthProvider(event.session),
    clientSessionId,
    label: event.label ?? null,
    metadata: event.metadata ?? null,
    path: getPath(),
    referrer: document.referrer || null,
    socialAccountId: event.session?.socialAccount.id ?? null,
    source: isTelegramMiniApp() ? "TELEGRAM_MINI_APP" : "WEB_APP",
    type: event.type,
    userId: event.session?.user.id ?? null,
    value: event.value ?? null,
  };

  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Analytics should never interrupt trading, posting, or wallet flows.
  }
}

function getClientAnalyticsSessionId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(sessionIdKey);
  if (existing && /^[a-zA-Z0-9:_-]{8,120}$/.test(existing)) return existing;

  const next =
    "web_" +
    (window.crypto?.randomUUID?.() ??
      Math.random().toString(36).slice(2) + Date.now().toString(36));
  window.localStorage.setItem(sessionIdKey, next);
  return next;
}

function inferAuthProvider(session?: UserSession | null): AuthProvider {
  if (session?.socialAccount.authProvider) return session.socialAccount.authProvider;
  if (session?.socialAccount.platform === "TELEGRAM") return "TELEGRAM";
  if (session?.socialAccount.platform === "FARCASTER") return "FARCASTER";
  if (
    session?.socialAccount.platform === "WEB" &&
    session.socialAccount.platformUserId.startsWith("ton:")
  )
    return "TON_WALLET";

  const kind = getStoredBrowserSessionWalletKind();
  if (kind === "smart") return "THIRDWEB_SMART_WALLET";
  if (kind === "ton") return "TON_WALLET";
  if (kind === "polymarket") return "POLYMARKET_WALLET";
  if (kind === "eoa") return "EVM_EOA";

  return session?.socialAccount.platform === "WEB" ? "EVM_EOA" : "UNKNOWN";
}

function inferAreaFromPath() {
  const segment = getPath().split("?")[0]?.split("/").filter(Boolean)[0];
  return segment || "home";
}

function getPath() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

function isTelegramMiniApp() {
  if (typeof window === "undefined") return false;
  return (
    Boolean((window as Window & { Telegram?: unknown }).Telegram) ||
    window.location.pathname.startsWith("/telegram")
  );
}
