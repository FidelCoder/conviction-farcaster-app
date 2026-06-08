"use client";

import Link from "next/link";
import { encodeFunctionData, parseAbi } from "viem";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  ExecutionAttempt,
  ExecutionCapabilities,
  Market,
  Position,
  PreparedContractTransaction,
  ContractTransaction,
} from "../lib/core-api";
import { executionStatusLabel, formatDate } from "../lib/display";
import { type FarcasterSessionState, useFarcasterSession } from "../hooks/useFarcasterSession";
import { FarcasterSessionPanel } from "./FarcasterSessionPanel";

const leverageOptions = [1, 2, 3, 5, 10] as const;
const marginHealthThreshold = 45;
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const contractStepDefinitions = [
  {
    key: "approval",
    label: "Approve USDC",
    endpoint: "/api/contracts/collateral-approvals/prepare",
    prepareLabel: "Prepare approval",
    sendingLabel: "Sending approval...",
    submitLabel: "Send approval",
    submittedMessage: "Approval submitted. Wait for wallet confirmation before depositing.",
  },
  {
    key: "deposit",
    label: "Deposit collateral",
    endpoint: "/api/contracts/deposits/prepare",
    prepareLabel: "Prepare deposit",
    sendingLabel: "Sending deposit...",
    submitLabel: "Send deposit",
    submittedMessage:
      "Deposit submitted. Wait for wallet confirmation before creating the margin intent.",
  },
  {
    key: "marginIntent",
    label: "Create margin intent",
    endpoint: "/api/contracts/margin-intents/prepare",
    prepareLabel: "Prepare intent",
    sendingLabel: "Sending intent...",
    submitLabel: "Send intent",
    submittedMessage:
      "Onchain margin intent submitted. It still does not mean a market order executed.",
  },
] as const;

type Side = "YES" | "NO";

type MarginSubmitState =
  | { status: "idle"; message: string }
  | { status: "submitting"; message: string }
  | { status: "submitted"; message: string; position: Position; executionAttempt: ExecutionAttempt }
  | { status: "error"; message: string };

type ContractStepKey = "approval" | "deposit" | "marginIntent";

type ContractStepState =
  | { status: "idle"; message: string }
  | { status: "preparing"; message: string }
  | { status: "prepared"; message: string; prepared: PreparedContractTransaction }
  | { status: "sending"; message: string; prepared: PreparedContractTransaction }
  | {
      status: "submitted";
      message: string;
      prepared: PreparedContractTransaction;
      transaction: ContractTransaction;
      transactionHash: string;
    }
  | { status: "error"; message: string; prepared?: PreparedContractTransaction };

type VaultPrepareResponse =
  | { ok: true; data: PreparedContractTransaction }
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
  const [contractSteps, setContractSteps] = useState<Record<ContractStepKey, ContractStepState>>(
    createInitialContractStepState,
  );
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
    selectedChain,
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
      setContractSteps(createInitialContractStepState());
    } catch {
      setSubmitState({
        status: "error",
        message: "Core API did not accept the margin intent.",
      });
    }
  }

  function updateContractStep(step: ContractStepKey, nextState: ContractStepState) {
    setContractSteps((current) => ({ ...current, [step]: nextState }));
  }

  async function handlePrepareContractStep(step: ContractStepKey) {
    if (submitState.status !== "submitted") {
      return;
    }

    const definition = getContractStepDefinition(step);

    updateContractStep(step, {
      status: "preparing",
      message: "Preparing " + definition.label.toLowerCase() + "...",
    });

    try {
      const response = await fetch(definition.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          step === "marginIntent"
            ? { positionId: submitState.position.id, maxSlippageBps: 100 }
            : { positionId: submitState.position.id },
        ),
      });
      const body = (await response.json()) as VaultPrepareResponse;

      if (!response.ok || !body.ok) {
        updateContractStep(step, {
          status: "error",
          message: body.ok ? definition.label + " was not prepared." : body.error.message,
        });
        return;
      }

      updateContractStep(step, {
        status: "prepared",
        message: body.data.executionNote,
        prepared: body.data,
      });
    } catch {
      updateContractStep(step, {
        status: "error",
        message: "Unable to prepare " + definition.label.toLowerCase() + " from core.",
      });
    }
  }

  async function handleSubmitContractStep(step: ContractStepKey) {
    const state = contractSteps[step];

    if (state.status !== "prepared" || walletState.status !== "ready") {
      return;
    }

    const definition = getContractStepDefinition(step);

    updateContractStep(step, {
      status: "sending",
      message: definition.sendingLabel,
      prepared: state.prepared,
    });

    try {
      const data = encodeContractCall(state.prepared);
      const transactionHash = normalizeTransactionHash(
        await walletState.provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: walletState.address,
              to: state.prepared.contractCall.contractAddress,
              data,
            },
          ],
        }),
      );

      if (!transactionHash) {
        updateContractStep(step, {
          status: "error",
          message: "Wallet did not return a transaction hash.",
          prepared: state.prepared,
        });
        return;
      }

      const submittedTransaction = await recordContractTransactionStatus(
        state.prepared.transaction.id,
        { transactionHash, status: "SUBMITTED" },
      );

      updateContractStep(step, {
        status: "submitted",
        message: "Transaction submitted. Waiting for chain confirmation...",
        prepared: state.prepared,
        transaction: submittedTransaction,
        transactionHash,
      });

      const receipt = await waitForTransactionReceipt(walletState.provider, transactionHash);
      const confirmedStatus =
        receipt?.status === "0x1" ? "CONFIRMED" : receipt ? "FAILED" : "SUBMITTED";
      const finalTransaction =
        confirmedStatus === "SUBMITTED"
          ? submittedTransaction
          : await recordContractTransactionStatus(state.prepared.transaction.id, {
              transactionHash,
              status: confirmedStatus,
              responsePayload: receipt,
            });

      updateContractStep(step, {
        status: "submitted",
        message:
          confirmedStatus === "CONFIRMED"
            ? definition.submittedMessage
            : confirmedStatus === "FAILED"
              ? "Wallet transaction failed onchain. Prepare and send this step again."
              : "Transaction submitted. Wait for confirmation before continuing.",
        prepared: state.prepared,
        transaction: finalTransaction,
        transactionHash,
      });
    } catch {
      updateContractStep(step, {
        status: "error",
        message: "Wallet transaction was not submitted.",
        prepared: state.prepared,
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
                      <span>Vault workflow</span>
                      <strong>{getContractWorkflowLabel(contractSteps)}</strong>
                    </div>
                    <p>{getContractWorkflowMessage(contractSteps)}</p>
                    <div className="vault-step-list">
                      {contractStepDefinitions.map((definition, index) => {
                        const step = definition.key;
                        const stepState = contractSteps[step];
                        const isUnlocked = isContractStepUnlocked(step, contractSteps);
                        const canPrepare =
                          isUnlocked &&
                          (stepState.status === "idle" ||
                            stepState.status === "error" ||
                            (stepState.status === "submitted" &&
                              stepState.transaction.status === "FAILED"));
                        const canSend =
                          stepState.status === "prepared" &&
                          walletState.status === "ready" &&
                          isUnlocked;

                        return (
                          <div
                            className={
                              isUnlocked
                                ? "vault-step-card " + stepState.status
                                : "vault-step-card locked"
                            }
                            key={step}
                          >
                            <div className="vault-step-heading">
                              <span>{index + 1}</span>
                              <div>
                                <strong>{definition.label}</strong>
                                <small>{getContractStepStatusLabel(stepState, isUnlocked)}</small>
                              </div>
                            </div>
                            <p>{getContractStepMessage(definition, stepState, isUnlocked)}</p>
                            {stepState.status === "prepared" || stepState.status === "sending" ? (
                              <dl>
                                <div>
                                  <dt>Contract</dt>
                                  <dd>
                                    {truncateAddress(
                                      stepState.prepared.contractCall.contractAddress,
                                    )}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Amount</dt>
                                  <dd>{getPreparedContractAmount(stepState.prepared)}</dd>
                                </div>
                              </dl>
                            ) : null}
                            {stepState.status === "submitted" ? (
                              <dl>
                                <div>
                                  <dt>Hash</dt>
                                  <dd>{truncateHash(stepState.transactionHash)}</dd>
                                </div>
                                <div>
                                  <dt>Status</dt>
                                  <dd>{stepState.transaction.status}</dd>
                                </div>
                              </dl>
                            ) : null}
                            <div className="vault-action-row">
                              <button
                                disabled={!canPrepare}
                                onClick={() => handlePrepareContractStep(step)}
                                type="button"
                              >
                                {stepState.status === "preparing"
                                  ? "Preparing..."
                                  : definition.prepareLabel}
                              </button>
                              <button
                                disabled={!canSend}
                                onClick={() => handleSubmitContractStep(step)}
                                type="button"
                              >
                                {stepState.status === "sending"
                                  ? definition.sendingLabel
                                  : definition.submitLabel}
                              </button>
                            </div>
                          </div>
                        );
                      })}
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
  selectedChain,
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
  selectedChain: ExecutionCapabilities["chains"][number] | undefined;
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

  if (
    !selectedChain?.walletFlowEnabled ||
    !selectedChain.vaultAddress ||
    !selectedChain.collateralTokenAddress
  ) {
    return "Select a chain with a connected testnet vault and collateral token.";
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

function createInitialContractStepState(): Record<ContractStepKey, ContractStepState> {
  return {
    approval: { status: "idle", message: "Approve testnet USDC for the vault." },
    deposit: { status: "idle", message: "Deposit approved USDC into the vault." },
    marginIntent: { status: "idle", message: "Create the onchain margin intent." },
  };
}

function getContractStepDefinition(step: ContractStepKey) {
  return contractStepDefinitions.find((definition) => definition.key === step)!;
}

function isContractStepUnlocked(
  step: ContractStepKey,
  state: Record<ContractStepKey, ContractStepState>,
) {
  if (step === "approval") return true;
  if (step === "deposit") return isContractStepConfirmed(state.approval);

  return isContractStepConfirmed(state.deposit);
}

function isContractStepConfirmed(state: ContractStepState) {
  return state.status === "submitted" && state.transaction.status === "CONFIRMED";
}

function getContractWorkflowLabel(state: Record<ContractStepKey, ContractStepState>) {
  if (isContractStepConfirmed(state.marginIntent)) return "Intent confirmed";
  if (isContractStepConfirmed(state.deposit)) return "Ready for intent";
  if (isContractStepConfirmed(state.approval)) return "Ready to deposit";

  return "Ready to approve";
}

function getContractWorkflowMessage(state: Record<ContractStepKey, ContractStepState>) {
  if (isContractStepConfirmed(state.marginIntent)) {
    return "The vault intent is confirmed onchain. Execution still needs a real adapter confirmation before core can mark anything executed.";
  }

  if (isContractStepConfirmed(state.deposit)) {
    return "The vault deposit is confirmed. Create the onchain margin intent next; do not treat this as a market fill.";
  }

  if (isContractStepConfirmed(state.approval)) {
    return "The approval is confirmed. Deposit collateral into the vault next.";
  }

  return "Run the wallet flow in order: approve USDC, deposit collateral, then create the margin intent.";
}

function getContractStepStatusLabel(state: ContractStepState, isUnlocked: boolean) {
  if (!isUnlocked) return "Waiting";
  if (state.status === "idle") return "Ready";
  if (state.status === "preparing") return "Preparing";
  if (state.status === "prepared") return "Prepared";
  if (state.status === "sending") return "Wallet";
  if (state.status === "submitted") {
    if (state.transaction.status === "CONFIRMED") return "Confirmed";
    if (state.transaction.status === "FAILED") return "Failed";

    return "Submitted";
  }

  return "Error";
}

function getContractStepMessage(
  definition: (typeof contractStepDefinitions)[number],
  state: ContractStepState,
  isUnlocked: boolean,
) {
  if (!isUnlocked) {
    return definition.key === "deposit"
      ? "Confirm approval before this step."
      : "Confirm deposit before this step.";
  }

  if (state.message) return state.message;

  return "Prepare the wallet transaction from core.";
}

function getPreparedContractAmount(prepared: PreparedContractTransaction) {
  const { namedArgs } = prepared.contractCall;
  const value = namedArgs.amount ?? namedArgs.collateralAmount;

  return typeof value === "undefined" ? "n/a" : String(value);
}

function encodeContractCall(prepared: PreparedContractTransaction) {
  const args = prepared.contractCall.namedArgs;
  const abi = parseAbi(prepared.contractCall.abi);

  if (prepared.contractCall.functionName === "approve") {
    return encodeFunctionData({
      abi,
      functionName: "approve",
      args: [args.spender as `0x${string}`, BigInt(String(args.amount))],
    });
  }

  if (prepared.contractCall.functionName === "deposit") {
    return encodeFunctionData({
      abi,
      functionName: "deposit",
      args: [args.collateralToken as `0x${string}`, BigInt(String(args.amount))],
    });
  }

  return encodeFunctionData({
    abi,
    functionName: "createMarginIntent",
    args: [
      args.collateralToken as `0x${string}`,
      args.marketId as `0x${string}`,
      Number(args.side),
      BigInt(String(args.collateralAmount)),
      BigInt(String(args.leverageBps)),
      BigInt(String(args.maxSlippageBps)),
      BigInt(String(args.deadline)),
      args.offchainPositionId as `0x${string}`,
    ],
  });
}

async function recordContractTransactionStatus(
  transactionId: string,
  input: {
    responsePayload?: unknown;
    status?: ContractTransaction["status"];
    transactionHash?: string;
  },
) {
  const response = await fetch("/api/contracts/transactions/" + transactionId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as VaultTransactionResponse;

  if (!response.ok || !body.ok) {
    throw new Error(body.ok ? "Transaction hash was not recorded." : body.error.message);
  }

  return body.data.transaction;
}

async function waitForTransactionReceipt(provider: EthereumProvider, transactionHash: string) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    });

    if (isTransactionReceipt(receipt)) {
      return receipt;
    }

    await delay(2500);
  }

  return null;
}

function isTransactionReceipt(
  value: unknown,
): value is Record<string, unknown> & { status: string } {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return false;
  }

  const status = (value as { status?: unknown }).status;

  return status === "0x1" || status === "0x0";
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeTransactionHash(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value) ? value : null;
}

function truncateHash(value: string) {
  return value.slice(0, 10) + "..." + value.slice(-8);
}
