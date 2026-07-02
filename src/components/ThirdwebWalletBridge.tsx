"use client";

import { useEffect, useMemo, useRef } from "react";
import { getContract, prepareTransaction, readContract, sendTransaction, waitForReceipt } from "thirdweb";
import { encodeFunctionData, erc20Abi, parseAbi } from "viem";
import { ConnectButton, ThirdwebProvider, useActiveAccount, useDisconnect, useActiveWallet } from "thirdweb/react";

import type { UserSession } from "../lib/core-api";
import {
  convictionAccountAbstraction,
  convictionSmartWallets,
  convictionThirdwebChains,
  getThirdwebChain,
  isThirdwebConfigured,
  thirdwebClient,
} from "../lib/thirdweb-client";

type BrowserSessionResponse =
  | { ok: true; data: { session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

type ThirdwebWalletBridgeProps = {
  activeAddress?: string | null;
  onSmartWalletActive: (address: string) => void;
  onSessionReady: (session: UserSession) => void;
  onDisconnectSession: () => void;
  onStatus: (type: "success" | "info", message: string) => void;
};

type SmartVaultTransactionRequest = {
  amountUnits: string;
  chainId: number;
  collateralTokenAddress: string;
  requestId: string;
  vaultAddress: string;
};

type SmartVaultTransactionResult = {
  approvalHash: string | null;
  depositHash: string;
  requestId: string;
};

type SmartVaultTransactionFailure = { message: string; requestId: string };

export function ThirdwebWalletProvider({ children }: { children: React.ReactNode }) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}

export function ThirdwebWalletBridge({
  activeAddress,
  onDisconnectSession,
  onSmartWalletActive,
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

    window.addEventListener("conviction-thirdweb-smart-connect", handleConnectRequest);

    return () => {
      window.removeEventListener("conviction-thirdweb-smart-connect", handleConnectRequest);
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

    onSmartWalletActive(address);
  }, [address, configured, onSmartWalletActive]);

  useEffect(() => {
    if (!configured) return;
    if (!address) return;
    if (activeAddress?.toLowerCase() === address.toLowerCase()) return;
    if (syncingAddressRef.current?.toLowerCase() === address.toLowerCase()) return;

    syncingAddressRef.current = address;

    void fetch("/api/browser-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: address,
        authProvider: "THIRDWEB_SMART_WALLET",
        source: "WEB_APP",
      }),
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

  useEffect(() => {
    if (!configured) return;

    async function handleSmartVaultDeposit(event: Event) {
      const detail = (event as CustomEvent<SmartVaultTransactionRequest>).detail;

      if (!detail?.requestId) return;

      try {
        if (!account) {
          throw new Error("Smart wallet is not active in this browser. Sign in with Smart wallet again before depositing.");
        }

        const activeAccount = account;
        const chain = getThirdwebChain(detail.chainId);

        if (!chain) {
          throw new Error("Selected vault chain is not supported by smart wallet auth.");
        }

        const amountUnits = BigInt(detail.amountUnits);
        const tokenContract = getContract({
          address: detail.collateralTokenAddress,
          chain,
          client: thirdwebClient,
        });
        const allowance = await readContract({
          contract: tokenContract,
          method: "function allowance(address owner, address spender) view returns (uint256)",
          params: [activeAccount.address, detail.vaultAddress],
        });
        let approvalHash: string | null = null;

        if (BigInt(String(allowance ?? 0)) < amountUnits) {
          onStatus("info", "Approve vault access from your smart wallet.");
          const approval = await sendTransaction({
            account: activeAccount,
            transaction: prepareTransaction({
              chain,
              client: thirdwebClient,
              data: encodeApproveCall(detail.vaultAddress, amountUnits),
              to: detail.collateralTokenAddress,
            }),
          });
          approvalHash = approval.transactionHash;
          await waitForReceipt({
            chain,
            client: thirdwebClient,
            transactionHash: approval.transactionHash,
          });
        }

        onStatus("info", "Submit the vault deposit from your smart wallet.");
        const deposit = await sendTransaction({
          account,
          transaction: prepareTransaction({
            chain,
            client: thirdwebClient,
            data: encodeDepositCall(detail.collateralTokenAddress, amountUnits),
            to: detail.vaultAddress,
          }),
        });
        await waitForReceipt({
          chain,
          client: thirdwebClient,
          transactionHash: deposit.transactionHash,
        });

        window.dispatchEvent(new CustomEvent<SmartVaultTransactionResult>("conviction-thirdweb-smart-deposit-result", {
          detail: { approvalHash, depositHash: deposit.transactionHash, requestId: detail.requestId },
        }));
      } catch (error) {
        window.dispatchEvent(new CustomEvent<SmartVaultTransactionFailure>("conviction-thirdweb-smart-deposit-error", {
          detail: {
            message: error instanceof Error ? error.message : "Smart wallet deposit failed.",
            requestId: detail.requestId,
          },
        }));
      }
    }

    window.addEventListener("conviction-thirdweb-smart-deposit", handleSmartVaultDeposit);

    return () => {
      window.removeEventListener("conviction-thirdweb-smart-deposit", handleSmartVaultDeposit);
    };
  }, [account, configured, onStatus]);

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
        wallets={convictionSmartWallets}
      />
    </div>
  );
}

const baseSepoliaId = 84532;

function encodeApproveCall(spender: string, amount: bigint) {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender as `0x${string}`, amount],
  });
}

function encodeDepositCall(collateralTokenAddress: string, amount: bigint) {
  return encodeFunctionData({
    abi: parseAbi(["function deposit(address collateralToken, uint256 amount)"]),
    functionName: "deposit",
    args: [collateralTokenAddress as `0x${string}`, amount],
  });
}
