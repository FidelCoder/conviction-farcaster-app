"use client";

import Link from "next/link";
import { encodeFunctionData, parseAbi } from "viem";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  ExecutionAttempt,
  ExecutionCapabilities,
  Market,
  Position,
  PreparedMarginIntent,
  ContractTransaction,
} from "../lib/core-api";
import { executionStatusLabel, formatDate } from "../lib/display";
import { type FarcasterSessionState, useFarcasterSession } from "../hooks/useFarcasterSession";
import { FarcasterSessionPanel } from "./FarcasterSessionPanel";

const leverageOptions = [1, 2, 3, 5, 10] as const;
const marginHealthThreshold = 45;
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

type Side = "YES" | "NO";

type MarginSubmitState =
  | { status: "idle"; message: string }
  | { status: "submitting"; message: string }
  | { status: "submitted"; message: string; position: Position; executionAttempt: ExecutionAttempt }
  | { status: "error"; message: string };

type VaultTransactionState =
  | { status: "idle"; message: string }
  | { status: "preparing"; message: string }
  | { status: "prepared"; message: string; prepared: PreparedMarginIntent }
  | { status: "sending"; message: string; prepared: PreparedMarginIntent }
  | {
      status: "submitted";
      message: string;
      prepared: PreparedMarginIntent;
      transaction: ContractTransaction;
      transactionHash: string;
    }
  | { status: "error"; message: string; prepared?: PreparedMarginIntent };

type VaultPrepareResponse =
  | { ok: true; data: PreparedMarginIntent }
  | { ok: false; error: { code: string; message: string } };

type VaultTransactionResponse =
  | { ok: true; data: { transaction: ContractTransaction } }
  | { ok: false; error: { code: string; message: string } };

type MarginIntentResponse =
  | {
      ok: true;
      data: {
        position: Position;
        executionAttempt: ExecutionAttempt;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type WalletState =
  | { status: "loading"; message: string }
  | { status: "available"; message: string; provider: EthereumProvider }
  | {
      status: "ready";
      message: string;
      address: string;
      chainId: number | null;
      provider: EthereumProvider;
    }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

type EthereumProvider = {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
};

type MarginDeskProps = {
  execution: ExecutionCapabilities;
  markets: Market[];
};

export function MarginDesk({ execution, markets }: MarginDeskProps) {
  const firstPricedMarket =
    markets.find((market) => Boolean(getPriceSnapshot(market))) ?? markets[0];
  const [selectedMarketId, setSelectedMarketId] = useState(firstPricedMarket?.id ?? "");
  const [side, setSide] = useState<Side>("YES");
  const sessionState = useFarcasterSession();
  const [walletAddress, setWalletAddress] = useState("");
  const [walletState, setWalletState] = useState<WalletState>({
    status: "loading",
    message: "Detecting EVM wallet...",
  });
  const [quantity, setQuantity] = useState("");
  const [marginAmount, setMarginAmount] = useState("");
  const [leverage, setLeverage] = useState<(typeof leverageOptions)[number]>(3);
  const [chainId, setChainId] = useState(() => String(execution.chains[0]?.chainId ?? ""));
  const [submitState, setSubmitState] = useState<MarginSubmitState>({
    status: "idle",
    message: "",
  });
  const [vaultState, setVaultState] = useState<VaultTransactionState>({
    status: "idle",
    message: "",
  });
  const selectedMarket =
    markets.find((market) => market.id === selectedMarketId) ?? firstPricedMarket;
  const selectedChain = execution.chains.find((chain) => String(chain.chainId) === chainId);
  const selectedSnapshot = selectedMarket ? getPriceSnapshot(selectedMarket) : null;
  const activeMarketCount = markets.filter(
    (market) => market.status.toLowerCase() === "active",
  ).length;
  const pricedMarketCount = markets.filter((market) => Boolean(getPriceSnapshot(market))).length;
  const marketRailItems = markets.slice(0, 16);
  const preview = useMemo(
    () => buildMarginPreview(selectedMarket, side, marginAmount, leverage),
    [leverage, marginAmount, selectedMarket, side],
  );
  const isMarginLive = execution.marginExecutionEnabled && execution.leverageEnabled;
  const submitBlockReason = getSubmitBlockReason({
    chainId,
    leverage,
    marginAmount,
    quantity,
    selectedMarket,
    selectedChainId: chainId,
    sessionState,
    walletAddress,
    walletState,
  });
  const isSubmitting = submitState.status === "submitting";
  const ticketMessage = getTicketMessage({
    execution,
    preview,
    sessionState,
    submitBlockReason,
    submitState,
  });

  useEffect(() => {
    let isMounted = true;

    async function detectWallet() {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const isInMiniApp = await sdk.isInMiniApp();

        if (!isMounted) {
          return;
        }

        const provider = isInMiniApp
          ? ((await sdk.wallet.getEthereumProvider()) as EthereumProvider | undefined)
          : getBrowserEthereumProvider();

        if (!isMounted) {
          return;
        }

        if (!provider) {
          setWalletState({
            status: "unavailable",
            message: isInMiniApp
              ? "No EVM wallet provider is available in this Farcaster client."
              : "No EVM browser wallet was detected.",
          });
          return;
        }

        const accounts = normalizeAccounts(await provider.request({ method: "eth_accounts" }));
        const chain = normalizeChainId(await provider.request({ method: "eth_chainId" }));

        if (accounts[0]) {
          const address = accounts[0];

          setWalletAddress(address);
          setWalletState({
            status: "ready",
            message: buildWalletMessage(address, chain),
            address,
            chainId: chain,
            provider,
          });
          alignSelectedChain(chain, execution.chains, setChainId);
          return;
        }

        setWalletState({
          status: "available",
          message: "Connect an EVM wallet to submit a margin intent.",
          provider,
        });
      } catch {
        if (isMounted) {
          setWalletState({
            status: "error",
            message: "Unable to read the EVM wallet provider.",
          });
        }
      }
    }

    void detectWallet();

    return () => {
      isMounted = false;
    };
  }, [execution.chains]);

  async function connectWallet() {
    if (walletState.status !== "available") {
      return;
    }

    try {
      const accounts = normalizeAccounts(
        await walletState.provider.request({ method: "eth_requestAccounts" }),
      );
      const chain = normalizeChainId(await walletState.provider.request({ method: "eth_chainId" }));
      const address = accounts[0];

      if (!address) {
        setWalletState({
          status: "error",
          message: "Wallet did not return an EVM account.",
        });
        return;
      }

      setWalletAddress(address);
      setWalletState({
        status: "ready",
        message: buildWalletMessage(address, chain),
        address,
        chainId: chain,
        provider: walletState.provider,
      });
      alignSelectedChain(chain, execution.chains, setChainId);
    } catch {
      setWalletState({
        status: "error",
        message: "Wallet connection was not approved.",
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMarket || submitBlockReason || sessionState.status !== "ready") {
      setSubmitState({
        status: "error",
        message:
          submitBlockReason ??
          (sessionState.status === "ready"
            ? "Select a real market before submitting."
            : sessionState.message),
      });
      return;
    }

    setSubmitState({
      status: "submitting",
      message: "Submitting margin intent...",
    });

    try {
      const response = await fetch("/api/margin-intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: sessionState.session.user.id,
          marketId: selectedMarket.id,
          side,
          quantity: quantity.trim(),
          chainId: Number(chainId),
          walletAddress: walletAddress.trim(),
          leverageMultiplier: String(leverage),
          marginCollateral: marginAmount.trim(),
        }),
      });
      const body = (await response.json()) as MarginIntentResponse;

      if (!response.ok || !body.ok) {
        setSubmitState({
          status: "error",
          message: body.ok ? "Margin intent failed." : body.error.message,
        });
        return;
      }

      setSubmitState({
        status: "submitted",
        message: buildSubmittedMessage(body.data.executionAttempt),
        position: body.data.position,
        executionAttempt: body.data.executionAttempt,
      });
      setVaultState({
        status: "idle",
        message: "Prepare a vault transaction when contract config is active in core.",
      });
    } catch {
      setSubmitState({
        status: "error",
        message: "Core API did not accept the margin intent.",
      });
    }
  }

  async function handlePrepareVaultTransaction() {
    if (submitState.status !== "submitted") {
      return;
    }

    setVaultState({ status: "preparing", message: "Preparing vault transaction..." });

    try {
      const response = await fetch("/api/contracts/margin-intents/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: submitState.position.id, maxSlippageBps: 100 }),
      });
      const body = (await response.json()) as VaultPrepareResponse;

      if (!response.ok || !body.ok) {
        setVaultState({
          status: "error",
          message: body.ok ? "Vault transaction was not prepared." : body.error.message,
        });
        return;
      }

      setVaultState({
        status: "prepared",
        message: body.data.executionNote,
        prepared: body.data,
      });
    } catch {
      setVaultState({
        status: "error",
        message: "Unable to prepare the vault transaction from core.",
      });
    }
  }

  async function handleSubmitVaultTransaction() {
    if (vaultState.status !== "prepared" || walletState.status !== "ready") {
      return;
    }

    setVaultState({
      status: "sending",
      message: "Opening wallet transaction...",
      prepared: vaultState.prepared,
    });

    try {
      const data = encodeVaultCall(vaultState.prepared);
      const transactionHash = normalizeTransactionHash(
        await walletState.provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: walletState.address,
              to: vaultState.prepared.contractCall.contractAddress,
              data,
            },
          ],
        }),
      );

      if (!transactionHash) {
        setVaultState({
          status: "error",
          message: "Wallet did not return a transaction hash.",
          prepared: vaultState.prepared,
        });
        return;
      }

      const response = await fetch(
        "/api/contracts/transactions/" + vaultState.prepared.transaction.id,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionHash, status: "SUBMITTED" }),
        },
      );
      const body = (await response.json()) as VaultTransactionResponse;

      if (!response.ok || !body.ok) {
        setVaultState({
          status: "error",
          message: body.ok ? "Transaction hash was not recorded." : body.error.message,
          prepared: vaultState.prepared,
        });
        return;
      }

      setVaultState({
        status: "submitted",
        message: "Vault transaction submitted. Execution still requires adapter confirmation.",
        prepared: vaultState.prepared,
        transaction: body.data.transaction,
        transactionHash,
      });
    } catch {
      setVaultState({
        status: "error",
        message: "Wallet transaction was not submitted.",
        prepared: vaultState.prepared,
      });
    }
  }

  return (
    <section className="margin-desk" aria-label="Margin trading desk">
      <div className="margin-desk-header">
        <div className="desk-title">
          <p className="eyebrow">Margin desk</p>
          <h1>Size the thesis before execution.</h1>
          <p>
            Pick a market, choose YES or NO, set collateral and leverage, then submit an intent. No
            trade is marked executed until the vault flow confirms it.
          </p>
        </div>
        <div className="desk-status-stack" aria-label="Execution status">
          <div className={isMarginLive ? "live-badge ready" : "live-badge pending"}>
            <span>{isMarginLive ? "Execution live" : "Intent mode"}</span>
            <strong>{execution.evmOnly ? "EVM" : "Multichain"}</strong>
          </div>
          <dl className="desk-stat-grid">
            <div>
              <dt>Markets</dt>
              <dd>{markets.length}</dd>
            </div>
            <div>
              <dt>Active</dt>
              <dd>{activeMarketCount}</dd>
            </div>
            <div>
              <dt>Priced</dt>
              <dd>{pricedMarketCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="margin-workspace">
        <aside className="market-rail" aria-label="Market tape">
          <div className="rail-heading">
            <div>
              <span>Market tape</span>
              <small>Provider data</small>
            </div>
            <strong>{markets.length}</strong>
          </div>
          {markets.length > 0 ? (
            <div className="market-rail-list">
              {marketRailItems.map((market) => {
                const snapshot = getPriceSnapshot(market);
                const isSelected = market.id === selectedMarket?.id;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={isSelected ? "market-rail-item active" : "market-rail-item"}
                    key={market.id}
                    onClick={() => setSelectedMarketId(market.id)}
                    type="button"
                  >
                    <span className="rail-market-copy">
                      <span>{market.title}</span>
                      <small>{market.category ?? market.source}</small>
                    </span>
                    <strong>
                      {snapshot ? formatProbability(snapshot.probability) : "No price"}
                    </strong>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="desk-empty compact">
              <strong>No markets available</strong>
              <span>Connect core to a provider before trading.</span>
            </div>
          )}
        </aside>

        <form className="trade-ticket" aria-label="Margin trade ticket" onSubmit={handleSubmit}>
          <div className="ticket-topline">
            <span>Trade ticket</span>
            <strong>{selectedMarket?.source ?? "Core API"}</strong>
          </div>

          {selectedMarket ? (
            <>
              <div className="selected-market-copy">
                <div className="selected-market-title-row">
                  <div>
                    <span className="market-source-line">
                      {selectedMarket.category ?? selectedMarket.source}
                    </span>
                    <h2>{selectedMarket.title}</h2>
                  </div>
                  <div className="selected-price-pill">
                    <span>{selectedSnapshot?.source ?? "Reference"}</span>
                    <strong>
                      {selectedSnapshot
                        ? formatProbability(selectedSnapshot.probability)
                        : "No price"}
                    </strong>
                  </div>
                </div>
                <p>{getDescriptionPreview(selectedMarket.description)}</p>
                <dl className="selected-price-grid">
                  <div>
                    <dt>Last</dt>
                    <dd>{formatStoredMarketPrice(selectedMarket.lastTradePrice)}</dd>
                  </div>
                  <div>
                    <dt>Bid</dt>
                    <dd>{formatStoredMarketPrice(selectedMarket.bestBid)}</dd>
                  </div>
                  <div>
                    <dt>Ask</dt>
                    <dd>{formatStoredMarketPrice(selectedMarket.bestAsk)}</dd>
                  </div>
                  <div>
                    <dt>Close</dt>
                    <dd>{getForcedCloseLabel(selectedMarket)}</dd>
                  </div>
                </dl>
                <Link href={"/markets/" + selectedMarket.id}>Open market page</Link>
              </div>

              <FarcasterSessionPanel label="Farcaster account" sessionState={sessionState} />

              <div className="segmented-control" aria-label="Trade side">
                <button
                  className={side === "YES" ? "active yes" : "yes"}
                  onClick={() => setSide("YES")}
                  type="button"
                >
                  YES
                </button>
                <button
                  className={side === "NO" ? "active no" : "no"}
                  onClick={() => setSide("NO")}
                  type="button"
                >
                  NO
                </button>
              </div>

              <label className="ticket-field">
                <span>Requested market size</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Outcome share size"
                  type="text"
                  value={quantity}
                />
              </label>

              <label className="ticket-field">
                <span>Margin deposit</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setMarginAmount(event.target.value)}
                  placeholder="USDC collateral"
                  type="text"
                  value={marginAmount}
                />
              </label>

              <div className="leverage-row" aria-label="Leverage multiplier">
                {leverageOptions.map((option) => (
                  <button
                    aria-pressed={option === leverage}
                    className={option === leverage ? "active" : ""}
                    key={option}
                    onClick={() => setLeverage(option)}
                    type="button"
                  >
                    {option}x
                  </button>
                ))}
              </div>

              <label className="ticket-field">
                <span>Execution chain</span>
                <select onChange={(event) => setChainId(event.target.value)} value={chainId}>
                  {execution.chains.length > 0 ? (
                    execution.chains.map((chain) => (
                      <option key={chain.chainId} value={chain.chainId}>
                        {chain.chainName} ({chain.network})
                      </option>
                    ))
                  ) : (
                    <option value="">Core capabilities unavailable</option>
                  )}
                </select>
              </label>

              <div
                className={walletState.status === "ready" ? "wallet-panel ready" : "wallet-panel"}
              >
                <div>
                  <span>Wallet</span>
                  <strong>
                    {walletState.status === "ready"
                      ? truncateAddress(walletState.address)
                      : walletState.status === "loading"
                        ? "Detecting..."
                        : "Not connected"}
                  </strong>
                </div>
                <p>{walletState.message}</p>
                {walletState.status === "available" ? (
                  <button onClick={connectWallet} type="button">
                    Connect wallet
                  </button>
                ) : null}
              </div>

              <dl className="ticket-metrics">
                <div>
                  <dt>Reference price</dt>
                  <dd>{preview.referencePriceLabel}</dd>
                </div>
                <div>
                  <dt>Notional</dt>
                  <dd>{preview.notionalLabel}</dd>
                </div>
                <div>
                  <dt>Borrowed</dt>
                  <dd>{preview.borrowedLabel}</dd>
                </div>
                <div>
                  <dt>Health threshold</dt>
                  <dd>{leverage > 1 ? marginHealthThreshold + "%" : "Spot"}</dd>
                </div>
                <div>
                  <dt>Liquidation guard</dt>
                  <dd>{preview.liquidationLabel}</dd>
                </div>
                <div>
                  <dt>Forced close</dt>
                  <dd>{getForcedCloseLabel(selectedMarket)}</dd>
                </div>
              </dl>

              <button
                className="ticket-submit"
                disabled={isSubmitting || Boolean(submitBlockReason)}
                type="submit"
              >
                {isSubmitting ? "Submitting..." : "Submit margin intent"}
              </button>
              <p
                className={
                  submitState.status === "error" ? "ticket-message error" : "ticket-message"
                }
              >
                {ticketMessage}
              </p>

              {submitState.status === "submitted" ? (
                <div className="intent-confirmation" aria-live="polite">
                  <div className="intent-confirmation-topline">
                    <span>Margin intent</span>
                    <strong>{executionStatusLabel(submitState.position.status)}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Position</dt>
                      <dd>
                        <Link href={"/positions/" + submitState.position.id}>
                          {formatCompactId(submitState.position.id)}
                        </Link>
                      </dd>
                    </div>
                    <div>
                      <dt>Attempt</dt>
                      <dd>{formatCompactId(submitState.executionAttempt.id)}</dd>
                    </div>
                    <div>
                      <dt>Adapter status</dt>
                      <dd>{executionStatusLabel(submitState.executionAttempt.status)}</dd>
                    </div>
                  </dl>
                  <p>
                    {submitState.executionAttempt.failureMessage ??
                      "Execution attempt recorded; contracts and adapters decide the next state."}
                  </p>
                  <div className="vault-action-panel">
                    <div>
                      <span>Vault transaction</span>
                      <strong>{getVaultStateLabel(vaultState)}</strong>
                    </div>
                    <p>{getVaultStateMessage(vaultState)}</p>
                    {vaultState.status === "prepared" || vaultState.status === "sending" ? (
                      <dl>
                        <div>
                          <dt>Vault</dt>
                          <dd>
                            {truncateAddress(vaultState.prepared.contractCall.contractAddress)}
                          </dd>
                        </div>
                        <div>
                          <dt>Chain</dt>
                          <dd>{vaultState.prepared.contractCall.chainId}</dd>
                        </div>
                        <div>
                          <dt>Collateral</dt>
                          <dd>{vaultState.prepared.contractCall.namedArgs.collateralAmount}</dd>
                        </div>
                      </dl>
                    ) : null}
                    {vaultState.status === "submitted" ? (
                      <dl>
                        <div>
                          <dt>Hash</dt>
                          <dd>{truncateHash(vaultState.transactionHash)}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>{vaultState.transaction.status}</dd>
                        </div>
                      </dl>
                    ) : null}
                    <div className="vault-action-row">
                      <button
                        disabled={
                          vaultState.status === "preparing" || vaultState.status === "sending"
                        }
                        onClick={handlePrepareVaultTransaction}
                        type="button"
                      >
                        {vaultState.status === "preparing" ? "Preparing..." : "Prepare vault call"}
                      </button>
                      <button
                        disabled={
                          vaultState.status !== "prepared" || walletState.status !== "ready"
                        }
                        onClick={handleSubmitVaultTransaction}
                        type="button"
                      >
                        {vaultState.status === "sending" ? "Sending..." : "Submit with wallet"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="desk-empty">
              <strong>No market selected</strong>
              <span>A core API market is required before a margin intent can be prepared.</span>
            </div>
          )}
        </form>

        <aside className="risk-console" aria-label="Risk and execution status">
          <div>
            <p className="eyebrow">Execution guardrails</p>
            <h2>Intent-first until the margin stack is live.</h2>
            <p>
              The desk records real intent and thesis records. Fills, PnL, and leveraged execution
              stay off until contracts, vault liquidity, adapters, and liquidations are live.
            </p>
          </div>

          <dl className="risk-list">
            <div>
              <dt>Spot adapters</dt>
              <dd>{execution.spotExecutionEnabled ? "Live" : "Not live"}</dd>
            </div>
            <div>
              <dt>Margin adapters</dt>
              <dd>{execution.marginExecutionEnabled ? "Live" : "Not live"}</dd>
            </div>
            <div>
              <dt>Leverage</dt>
              <dd>{execution.leverageEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Selected chain</dt>
              <dd>{selectedChain ? selectedChain.chainName : "No active chain"}</dd>
            </div>
          </dl>

          <div className="process-rail" aria-label="Execution flow">
            <span>Choose real market</span>
            <span>Record margin intent</span>
            <span>Block execution safely</span>
            <span>Enable adapters later</span>
            <span>Close before resolution</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function buildMarginPreview(
  market: Market | undefined,
  side: Side,
  marginAmount: string,
  leverage: number,
) {
  const snapshot = market ? getPriceSnapshot(market) : null;
  const margin = parsePositiveNumber(marginAmount);
  const sidePrice = snapshot ? getSideReferencePrice(snapshot.probability, side) : null;
  const notional = margin === null ? null : margin * leverage;
  const borrowed = margin === null ? null : Math.max(notional ?? 0, 0) - margin;
  const liquidationPrice =
    sidePrice !== null && leverage > 1 ? Math.max(sidePrice * (1 - 0.55 / leverage), 0) : null;

  return {
    borrowedLabel: borrowed === null ? "Enter margin" : formatUsd(borrowed),
    liquidationLabel:
      leverage <= 1
        ? "No borrow"
        : liquidationPrice === null
          ? "Needs real price"
          : formatProbability(liquidationPrice),
    notionalLabel: notional === null ? "Enter margin" : formatUsd(notional),
    referencePriceLabel: sidePrice === null ? "No stored price" : formatProbability(sidePrice),
  };
}

function getSubmitBlockReason({
  chainId,
  leverage,
  marginAmount,
  quantity,
  selectedChainId,
  selectedMarket,
  sessionState,
  walletAddress,
  walletState,
}: {
  chainId: string;
  leverage: number;
  marginAmount: string;
  quantity: string;
  selectedChainId: string;
  selectedMarket: Market | undefined;
  sessionState: FarcasterSessionState;
  walletAddress: string;
  walletState: WalletState;
}) {
  if (!selectedMarket) {
    return "Select a market from the board first.";
  }

  if (sessionState.status !== "ready") {
    return sessionState.message;
  }

  if (!parsePositiveNumber(quantity)) {
    return "Enter a requested market size greater than zero.";
  }

  if (parsePositiveNumber(marginAmount) === null) {
    return "Enter a real USDC margin amount to preview notional and borrowed capital.";
  }

  if (leverage <= 1) {
    return "Choose leverage above 1x for a margin intent.";
  }

  if (!chainId) {
    return "Select an execution chain from core capabilities.";
  }

  if (walletState.status !== "ready") {
    return walletState.message;
  }

  if (!evmAddressPattern.test(walletAddress.trim())) {
    return "Connect a valid EVM wallet.";
  }

  if (walletAddress.trim().toLowerCase() !== walletState.address.toLowerCase()) {
    return "Connected wallet changed. Reconnect the EVM wallet before submitting.";
  }

  if (
    walletState.chainId !== null &&
    selectedChainId &&
    String(walletState.chainId) !== selectedChainId
  ) {
    return (
      "Connected wallet is on chain " +
      walletState.chainId +
      "; select that chain or switch wallets before submitting."
    );
  }

  return null;
}

function getTicketMessage({
  execution,
  preview,
  sessionState,
  submitBlockReason,
  submitState,
}: {
  execution: ExecutionCapabilities;
  preview: ReturnType<typeof buildMarginPreview>;
  sessionState: FarcasterSessionState;
  submitBlockReason: string | null;
  submitState: MarginSubmitState;
}) {
  if (submitState.message) {
    return submitState.message;
  }

  if (submitBlockReason) {
    return submitBlockReason;
  }

  if (sessionState.status !== "ready") {
    return sessionState.message;
  }

  if (!execution.marginExecutionEnabled || !execution.leverageEnabled) {
    return "Submitting records a real margin intent and execution attempt. Execution will stay blocked until core reports live contracts, vault liquidity, liquidation, and adapters.";
  }

  return (
    preview.referencePriceLabel + " is a reference only. A real wallet flow is still required."
  );
}

function buildSubmittedMessage(executionAttempt: ExecutionAttempt) {
  if (executionAttempt.status === "BLOCKED") {
    return (
      "Margin intent recorded. Execution attempt blocked: " +
      (executionAttempt.failureMessage ?? "adapter or contracts are not active.")
    );
  }

  return "Margin intent recorded. Execution attempt status: " + executionAttempt.status + ".";
}

function getPriceSnapshot(market: Market) {
  const rawPrice = market.lastTradePrice ?? market.bestAsk ?? market.bestBid;
  const source = market.lastTradePrice
    ? "Last trade"
    : market.bestAsk
      ? "Best ask"
      : market.bestBid
        ? "Best bid"
        : null;
  const probability = parseProbability(rawPrice);

  if (probability === null || !source) {
    return null;
  }

  return { probability, source };
}

function parseProbability(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (parsed <= 1) {
    return parsed;
  }

  if (parsed <= 100) {
    return parsed / 100;
  }

  return null;
}

function getSideReferencePrice(yesProbability: number, side: Side) {
  return side === "YES" ? yesProbability : Math.max(1 - yesProbability, 0.0001);
}

function parsePositiveNumber(value: string) {
  const trimmed = value.trim();

  if (!/^(?=.*[1-9])(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getDescriptionPreview(description: string | null) {
  if (!description) {
    return "No market description returned by core API.";
  }

  const normalized = description.replace(/\s+/g, " ").trim();

  return normalized.length > 260 ? normalized.slice(0, 257).trimEnd() + "..." : normalized;
}

function formatStoredMarketPrice(value: string | null | undefined) {
  const parsed = parseProbability(value);

  return parsed === null ? "No price" : formatProbability(parsed);
}

function getForcedCloseLabel(market: Market) {
  if (!market.resolutionDate) {
    return "Needs resolution date";
  }

  return "Before " + formatDate(market.resolutionDate);
}

function formatProbability(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    style: "percent",
  }).format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function getBrowserEthereumProvider(): EthereumProvider | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

function normalizeAccounts(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && evmAddressPattern.test(entry),
  );
}

function normalizeChainId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = value.startsWith("0x") ? Number.parseInt(value, 16) : Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function buildWalletMessage(address: string, chainId: number | null) {
  return truncateAddress(address) + (chainId ? " on chain " + chainId : " connected");
}

function alignSelectedChain(
  chainId: number | null,
  chains: ExecutionCapabilities["chains"],
  setChainId: (chainId: string) => void,
) {
  if (!chainId) {
    return;
  }

  if (chains.some((chain) => chain.chainId === chainId)) {
    setChainId(String(chainId));
  }
}

function formatCompactId(id: string) {
  return id.length > 12 ? id.slice(0, 6) + "..." + id.slice(-4) : id;
}

function truncateAddress(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function encodeVaultCall(prepared: PreparedMarginIntent) {
  const args = prepared.contractCall.namedArgs;
  const abi = parseAbi(prepared.contractCall.abi);

  return encodeFunctionData({
    abi,
    functionName: prepared.contractCall.functionName,
    args: [
      args.collateralToken as `0x${string}`,
      args.marketId as `0x${string}`,
      args.side,
      BigInt(args.collateralAmount),
      BigInt(args.leverageBps),
      BigInt(args.maxSlippageBps),
      BigInt(args.deadline),
      args.offchainPositionId as `0x${string}`,
    ],
  });
}

function getVaultStateLabel(state: VaultTransactionState) {
  if (state.status === "idle") return "Not prepared";
  if (state.status === "preparing") return "Preparing";
  if (state.status === "prepared") return "Ready";
  if (state.status === "sending") return "Wallet open";
  if (state.status === "submitted") return "Submitted";
  return "Needs attention";
}

function getVaultStateMessage(state: VaultTransactionState) {
  if (state.message) return state.message;

  return "Prepare a vault call after recording a margin intent.";
}

function normalizeTransactionHash(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value) ? value : null;
}

function truncateHash(value: string) {
  return value.slice(0, 10) + "..." + value.slice(-8);
}
