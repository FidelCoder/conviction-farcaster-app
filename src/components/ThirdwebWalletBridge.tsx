"use client";

import { useEffect, useMemo, useRef } from "react";
import { ConnectButton, ThirdwebProvider, useActiveAccount, useDisconnect, useActiveWallet } from "thirdweb/react";

import type { UserSession } from "../lib/core-api";
import {
  convictionAccountAbstraction,
  convictionThirdwebChains,
  convictionWallets,
  isThirdwebConfigured,
  thirdwebClient,
} from "../lib/thirdweb-client";

type BrowserSessionResponse =
  | { ok: true; data: { session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

type ThirdwebWalletBridgeProps = {
  activeAddress?: string | null;
  onSessionReady: (session: UserSession) => void;
  onDisconnectSession: () => void;
  onStatus: (type: "success" | "info", message: string) => void;
};

export function ThirdwebWalletProvider({ children }: { children: React.ReactNode }) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}

export function ThirdwebWalletBridge({
  activeAddress,
  onDisconnectSession,
  onSessionReady,
  onStatus,
}: ThirdwebWalletBridgeProps) {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const syncingAddressRef = useRef<string | null>(null);
  const address = account?.address ?? null;
  const configured = isThirdwebConfigured();

  useEffect(() => {
    if (!configured) return;

    function handleConnectRequest() {
      const button = document.querySelector<HTMLButtonElement>(".thirdweb-connect-trigger");
      button?.click();
    }

    window.addEventListener("conviction-thirdweb-connect", handleConnectRequest);

    return () => {
      window.removeEventListener("conviction-thirdweb-connect", handleConnectRequest);
    };
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    if (!wallet) return;

    function handleDisconnectRequest() {
      void disconnect(wallet);
    }

    window.addEventListener("conviction-thirdweb-disconnect", handleDisconnectRequest);

    return () => {
      window.removeEventListener("conviction-thirdweb-disconnect", handleDisconnectRequest);
    };
  }, [configured, disconnect, wallet]);

  useEffect(() => {
    if (!configured) return;
    if (!address) return;
    if (activeAddress?.toLowerCase() === address.toLowerCase()) return;
    if (syncingAddressRef.current?.toLowerCase() === address.toLowerCase()) return;

    syncingAddressRef.current = address;

    void fetch("/api/browser-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address }),
    })
      .then(async (response) => {
        const body = (await response.json()) as BrowserSessionResponse;

        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "Wallet session failed." : body.error.message);
        }

        onSessionReady(body.data.session);
        onStatus("success", "Signed in and registered with core.");
      })
      .catch((error) => {
        onStatus("info", error instanceof Error ? error.message : "Wallet session failed.");
      })
      .finally(() => {
        syncingAddressRef.current = null;
      });
  }, [activeAddress, address, configured, onSessionReady, onStatus]);

  const detailsButton = useMemo(() => ({
    displayBalanceToken: {
      [baseSepoliaId]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    },
  }), []);

  if (!configured) {
    return null;
  }

  return (
    <div className="thirdweb-wallet-bridge" aria-hidden="true">
      <ConnectButton
        accountAbstraction={convictionAccountAbstraction}
        appMetadata={{
          name: "Conviction Markets",
          url: "https://convictionmarkets.xyz",
        }}
        chains={[...convictionThirdwebChains]}
        client={thirdwebClient}
        connectButton={{
          className: "thirdweb-connect-trigger",
          label: "Sign in",
        }}
        connectModal={{
          size: "compact",
          title: "Sign in to Conviction Markets",
          titleIcon: "/logo/conviction-markets-icon.png",
        }}
        detailsButton={detailsButton}
        onDisconnect={() => {
          if (wallet) {
            void disconnect(wallet);
          }
          onDisconnectSession();
        }}
        wallets={convictionWallets}
      />
    </div>
  );
}

const baseSepoliaId = 84532;
