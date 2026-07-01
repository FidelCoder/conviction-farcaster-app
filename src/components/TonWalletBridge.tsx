"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { UserSession } from "../lib/core-api";

type TonWalletInfo = {
  account?: { address?: string; chain?: string; publicKey?: string };
  device?: { appName?: string };
};

type TonConnectUI = {
  connectWallet: () => Promise<TonWalletInfo | null>;
  disconnect: () => Promise<void>;
  onStatusChange: (callback: (wallet: TonWalletInfo | null) => void) => () => void;
  openModal?: () => Promise<void>;
  wallet?: TonWalletInfo | null;
};

type TonConnectActionsConfiguration = {
  returnStrategy?: "back" | "none" | `${string}://${string}`;
  twaReturnUrl?: `${string}://${string}`;
};

type TonConnectUIConstructor = new (options: {
  manifestUrl: string;
  buttonRootId?: string | null;
  actionsConfiguration?: TonConnectActionsConfiguration;
  enableAndroidBackHandler?: boolean;
}) => TonConnectUI;
const TELEGRAM_BOT_URL = "https://t.me/ConvictionMarkets_bot";

type TonSessionResponse =
  | { ok: true; data: { session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

type TonWalletBridgeProps = {
  activeAddress?: string | null;
  onDisconnectSession: () => void;
  onSessionReady: (session: UserSession) => void;
  onStatus: (type: "success" | "info", message: string) => void;
  onTonWalletActive: (address: string) => void;
};

export function TonWalletBridge({
  activeAddress,
  onDisconnectSession,
  onSessionReady,
  onStatus,
  onTonWalletActive,
}: TonWalletBridgeProps) {
  const [tonUi, setTonUi] = useState<TonConnectUI | null>(null);
  const syncingAddressRef = useRef<string | null>(null);

  const syncTonSession = useCallback(async (address: string) => {
    if (syncingAddressRef.current === address) return;
    syncingAddressRef.current = address;
    onTonWalletActive(address);

    if (activeAddress === address) {
      syncingAddressRef.current = null;
      return;
    }

    try {
      const response = await fetch("/api/ton-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tonAddress: address, displayName: "TON " + shortAddress(address) }),
      });
      const body = (await response.json()) as TonSessionResponse;

      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "TON session failed." : body.error.message);
      }

      onSessionReady(body.data.session);
      onStatus("success", "TON wallet signed in and registered with core.");
    } catch (error) {
      onStatus("info", error instanceof Error ? error.message : "TON wallet session failed.");
    } finally {
      syncingAddressRef.current = null;
    }
  }, [activeAddress, onSessionReady, onStatus, onTonWalletActive]);

  useEffect(() => {
    if (tonUi) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let attempts = 0;
    let timer: number | undefined;

    function boot() {
      const constructor = (window as Window & { TON_CONNECT_UI?: { TonConnectUI?: TonConnectUIConstructor } }).TON_CONNECT_UI?.TonConnectUI;

      if (!constructor) {
        attempts += 1;
        if (attempts <= 40) timer = window.setTimeout(boot, 150);
        return;
      }

      if (cancelled) return;

      const ui = new constructor({
        manifestUrl: window.location.origin + "/tonconnect-manifest.json",
        buttonRootId: null,
        ...(isTelegramMiniApp() ? { actionsConfiguration: getTonConnectActionsConfiguration(), enableAndroidBackHandler: false } : {}),
      });
      setTonUi(ui);

      if (ui.wallet?.account?.address) {
        void syncTonSession(ui.wallet.account.address);
      }

      unsubscribe = ui.onStatusChange((wallet) => {
        const address = wallet?.account?.address ?? null;
        if (address) {
          void syncTonSession(address);
          return;
        }
        onDisconnectSession();
      });
    }

    boot();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, [onDisconnectSession, syncTonSession, tonUi]);

  useEffect(() => {
    function handleConnectRequest() {
      if (!tonUi) {
        onStatus("info", "TON Connect is still loading. Try again in a moment.");
        return;
      }
      void (tonUi.openModal ? tonUi.openModal() : tonUi.connectWallet()).catch(() => {
        onStatus("info", "TON wallet connection was cancelled or failed.");
      });
    }

    function handleDisconnectRequest() {
      void tonUi?.disconnect().catch(() => {
        onStatus("info", "TON wallet disconnect failed.");
      });
    }

    window.addEventListener("conviction-ton-connect", handleConnectRequest);
    window.addEventListener("conviction-ton-disconnect", handleDisconnectRequest);

    return () => {
      window.removeEventListener("conviction-ton-connect", handleConnectRequest);
      window.removeEventListener("conviction-ton-disconnect", handleDisconnectRequest);
    };
  }, [onStatus, tonUi]);



  return null;
}

function getTonConnectActionsConfiguration(): TonConnectActionsConfiguration {
  return {
    returnStrategy: "back",
    twaReturnUrl: getTelegramTwaReturnUrl(),
  };
}

function getTelegramTwaReturnUrl(): `${string}://${string}` {
  const configuredUrl = process.env.NEXT_PUBLIC_TELEGRAM_TWA_RETURN_URL?.trim();
  if (configuredUrl && /^https:\/\/t\.me\/[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)?(?:\?.*)?$/.test(configuredUrl)) {
    return configuredUrl as `${string}://${string}`;
  }

  return TELEGRAM_BOT_URL;
}

function shortAddress(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function isTelegramMiniApp() {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp);
}
