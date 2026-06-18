"use client";

import Link from "next/link";
import { encodeFunctionData, parseAbi } from "viem";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type {
  ExecutionAttempt,
  ExecutionCapabilities,
  Market,
  Position,
  PreparedContractTransaction,
  ContractTransaction,
} from "../lib/core-api";
import { executionStatusLabel, formatDate } from "../lib/display";
import {
  getNoWalletDetectedMessage,
  resolveEvmWalletProvider,
  type EthereumProvider,
} from "../lib/evm-wallet-provider";
import { type FarcasterSessionState, useFarcasterSession } from "../hooks/useFarcasterSession";

const leverageOptions = [1, 2, 3, 5, 10] as const;
const collateralTokenOptions = ["USDC", "USDT"] as const;
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const contractStepDefinitions = [
  {
    key: "approval",
    label: "Approve collateral",
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
    submittedMessage: "Deposit submitted. Wait for wallet confirmation before opening margin.",
  },
  {
    key: "marginIntent",
    label: "Open margin",
    endpoint: "/api/contracts/margin-intents/prepare",
    prepareLabel: "Prepare request",
    sendingLabel: "Sending request...",
    submitLabel: "Open margin",
    submittedMessage:
      "Margin request submitted onchain. A market position opens only after real execution confirms.",
  },
] as const;

type Side = "YES" | "NO";
type CollateralToken = (typeof collateralTokenOptions)[number];
type PriceSnapshot = { probability: number; source: string } | null;

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
  const [collateralToken, setCollateralToken] = useState<CollateralToken>("USDC");
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
  const [selectedCategory, setSelectedCategory] = useState("All");
  const marketCategories = useMemo(() => getMarketCategories(markets), [markets]);
  const marketRailItems = useMemo(
    () => filterMarketsByCategory(markets, selectedCategory).slice(0, 18),
    [markets, selectedCategory],
  );
  const preview = useMemo(
    () => buildMarginPreview(selectedMarket, side, marginAmount, leverage),
    [leverage, marginAmount, selectedMarket, side],
  );
  const submitBlockReason = getSubmitBlockReason({
    chainId,
    collateralToken,
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
        const provider = await resolveEvmWalletProvider();

        if (!isMounted) {
          return;
        }

        if (!provider) {
          setWalletState({
            status: "unavailable",
            message: getNoWalletDetectedMessage(),
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
          message: "Connect an EVM wallet to open margin.",
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
      message: "Preparing margin request...",
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
          message: body.ok ? "Margin request failed." : body.error.message,
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
        message: "Core API did not accept the margin request.",
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
    <section className="margin-browse-shell" aria-label="Browser margin trading desk">
      <div className="markets-browse-toolbar margin-toolbar" aria-label="Margin navigation">
        <div className="browse-brand-lockup">
          <Link className="browse-brand" href="/">
            Conviction
          </Link>
          <nav aria-label="Primary margin navigation">
            <Link href="/markets">Markets</Link>
            <Link aria-current="page" href="/margin">
              Margin
            </Link>
            <Link href="/social">Social</Link>
            <Link href="/me">Portfolio</Link>
          </nav>
        </div>

        <label className="browse-search" htmlFor="margin-search-preview">
          <span aria-hidden="true" className="search-icon" />
          <input
            disabled
            id="margin-search-preview"
            placeholder="Pick a market to open margin"
            type="search"
          />
        </label>

        <Link className="browse-open-margin secondary" href="/markets">
          Browse markets
        </Link>
      </div>

      <nav className="browse-category-strip margin-category-strip" aria-label="Margin categories">
        <button
          aria-pressed={selectedCategory === "All"}
          onClick={() => setSelectedCategory("All")}
          type="button"
        >
          Trending
        </button>
        {marketCategories.slice(1, 9).map((category) => (
          <button
            aria-pressed={selectedCategory === category}
            key={category}
            onClick={() => setSelectedCategory(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </nav>

      <div className="margin-browse-header">
        <div>
          <p className="eyebrow">Margin desk</p>
          <h1>Open margin from real market prices.</h1>
        </div>
        <dl className="browse-stat-strip margin-route-strip" aria-label="Current margin route">
          <div>
            <dt>Vault</dt>
            <dd>{selectedChain ? selectedChain.chainName : "--"}</dd>
          </div>
          <div>
            <dt>Collateral</dt>
            <dd>{getCollateralRouteLabel(selectedChain, collateralToken)}</dd>
          </div>
          <div>
            <dt>Markets</dt>
            <dd>{markets.length}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd>{walletState.status === "ready" ? "Ready" : "--"}</dd>
          </div>
        </dl>
      </div>

      <div className="margin-terminal-grid">
        <aside className="margin-market-column" aria-label="Market tape">
          <div className="terminal-column-heading">
            <div>
              <span>Market tape</span>
              <strong>{selectedCategory === "All" ? "Trending" : selectedCategory}</strong>
            </div>
            <small>{marketRailItems.length}</small>
          </div>

          {marketRailItems.length > 0 ? (
            <div className="margin-market-list">
              {marketRailItems.map((market) => {
                const snapshot = getPriceSnapshot(market);
                const isSelected = market.id === selectedMarket?.id;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={isSelected ? "margin-market-card active" : "margin-market-card"}
                    key={market.id}
                    onClick={() => setSelectedMarketId(market.id)}
                    type="button"
                  >
                    <span className="margin-market-topline">
                      <span>{market.category ?? market.source}</span>
                      <strong>{snapshot ? formatProbability(snapshot.probability) : "--"}</strong>
                    </span>
                    <span className="margin-market-title">{market.title}</span>
                    <span className="mini-outcome-stack">
                      <span className="mini-outcome yes">
                        <b>YES</b>
                        <i style={getPriceStripStyle(snapshot)} />
                      </span>
                      <span className="mini-outcome no">
                        <b>NO</b>
                        <i style={getPriceStripStyle(invertSnapshot(snapshot))} />
                      </span>
                    </span>
                    <span className="margin-market-footer">
                      <span>{getForcedCloseLabel(market)}</span>
                      <span>
                        {market.yesTokenId && market.noTokenId ? "Mapped" : "Mapping pending"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="desk-empty compact light-empty">
              <strong>No markets in this category</strong>
              <span>Switch category or sync provider markets through core.</span>
            </div>
          )}
        </aside>

        <form className="margin-order-card" aria-label="Open margin ticket" onSubmit={handleSubmit}>
          {selectedMarket ? (
            <>
              <div className="order-card-heading">
                <div>
                  <p className="eyebrow">Open margin</p>
                  <h2>{selectedMarket.title}</h2>
                  <span>{selectedMarket.category ?? selectedMarket.source}</span>
                </div>
                <Link href={"/markets/" + selectedMarket.id}>Details</Link>
              </div>

              <div className="order-outcome-board" aria-label="Selected market outcomes">
                <button
                  className={
                    side === "YES" ? "order-outcome-row yes active" : "order-outcome-row yes"
                  }
                  onClick={() => setSide("YES")}
                  type="button"
                >
                  <span>
                    <b>YES</b>
                    <strong>{getOutcomeName(selectedMarket, "YES")}</strong>
                  </span>
                  <i style={getPriceStripStyle(selectedSnapshot)} />
                  <em>
                    {selectedSnapshot ? formatProbability(selectedSnapshot.probability) : "--"}
                  </em>
                </button>
                <button
                  className={side === "NO" ? "order-outcome-row no active" : "order-outcome-row no"}
                  onClick={() => setSide("NO")}
                  type="button"
                >
                  <span>
                    <b>NO</b>
                    <strong>{getOutcomeName(selectedMarket, "NO")}</strong>
                  </span>
                  <i style={getPriceStripStyle(invertSnapshot(selectedSnapshot))} />
                  <em>
                    {selectedSnapshot ? formatProbability(1 - selectedSnapshot.probability) : "--"}
                  </em>
                </button>
              </div>

              <div className="order-input-grid">
                <label className="ticket-field">
                  <span>Outcome shares</span>
                  <input
                    inputMode="decimal"
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Shares"
                    type="text"
                    value={quantity}
                  />
                </label>

                <label className="ticket-field">
                  <span>Collateral</span>
                  <div className="token-input-row">
                    <select
                      aria-label="Collateral token"
                      onChange={(event) =>
                        setCollateralToken(event.target.value as CollateralToken)
                      }
                      value={collateralToken}
                    >
                      {collateralTokenOptions.map((token) => (
                        <option key={token} value={token}>
                          {token}
                        </option>
                      ))}
                    </select>
                    <input
                      inputMode="decimal"
                      onChange={(event) => setMarginAmount(event.target.value)}
                      placeholder="0.00"
                      type="text"
                      value={marginAmount}
                    />
                  </div>
                </label>

                <label className="ticket-field compact-select">
                  <span>Leverage</span>
                  <select
                    aria-label="Leverage multiplier"
                    onChange={(event) =>
                      setLeverage(Number(event.target.value) as (typeof leverageOptions)[number])
                    }
                    value={leverage}
                  >
                    {leverageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}x
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ticket-field compact-select">
                  <span>Chain</span>
                  <select onChange={(event) => setChainId(event.target.value)} value={chainId}>
                    {execution.chains.length > 0 ? (
                      execution.chains.map((chain) => (
                        <option key={chain.chainId} value={chain.chainId}>
                          {chain.chainName}
                        </option>
                      ))
                    ) : (
                      <option value="">No vault route</option>
                    )}
                  </select>
                </label>
              </div>

              <dl className="order-preview-grid">
                <div>
                  <dt>Reference</dt>
                  <dd>{preview.referencePriceLabel}</dd>
                </div>
                <div>
                  <dt>Exposure</dt>
                  <dd>{preview.notionalLabel}</dd>
                </div>
                <div>
                  <dt>Borrowed</dt>
                  <dd>{preview.borrowedLabel}</dd>
                </div>
                <div>
                  <dt>Guard</dt>
                  <dd>{preview.liquidationLabel}</dd>
                </div>
              </dl>

              <button
                className="ticket-submit margin-submit"
                disabled={isSubmitting || Boolean(submitBlockReason)}
                type="submit"
              >
                {isSubmitting ? "Preparing..." : "Open margin"}
              </button>
              <p
                className={
                  submitState.status === "error" ? "ticket-message error" : "ticket-message"
                }
              >
                {ticketMessage}
              </p>

              {submitState.status === "submitted" ? (
                <div className="intent-confirmation margin-confirmation" aria-live="polite">
                  <div className="intent-confirmation-topline">
                    <span>Margin request</span>
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
                      <dt>Request</dt>
                      <dd>{formatCompactId(submitState.executionAttempt.id)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{executionStatusLabel(submitState.executionAttempt.status)}</dd>
                    </div>
                  </dl>
                  <p>
                    {submitState.executionAttempt.failureMessage ??
                      "Request recorded. A market position opens only after real execution confirms."}
                  </p>
                  <VaultWorkflow
                    contractSteps={contractSteps}
                    handlePrepareContractStep={handlePrepareContractStep}
                    handleSubmitContractStep={handleSubmitContractStep}
                    walletState={walletState}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="desk-empty light-empty">
              <strong>No market selected</strong>
              <span>Select a real core market before opening margin.</span>
            </div>
          )}
        </form>

        <aside className="portfolio-console margin-portfolio" aria-label="Wallet and portfolio">
          <section
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
          </section>

          <section className="portfolio-card">
            <div className="portfolio-heading">
              <span>Portfolio</span>
              <strong>Browser wallet</strong>
            </div>
            <dl className="portfolio-grid primary">
              <div>
                <dt>Account Value</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Available to Trade</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Total Traded Volume</dt>
                <dd>--</dd>
              </div>
            </dl>
          </section>

          <section className="portfolio-card compact">
            <div className="portfolio-heading muted-heading">
              <span>Balance breakdown</span>
              <strong>USDC / USDT</strong>
            </div>
            <dl className="portfolio-grid">
              <div>
                <dt>Available Balance</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Locked Margin</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Total Predictions</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Total Rewards</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Current Borrowed</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Total Borrowed</dt>
                <dd>--</dd>
              </div>
            </dl>
          </section>

          <section className="portfolio-card compact">
            <div className="portfolio-heading muted-heading">
              <span>Realized profit / loss</span>
              <strong>--</strong>
            </div>
            <p className="portfolio-empty">Trend history comes from real closed positions only.</p>
          </section>

          <section className="portfolio-card activity-card">
            <div className="activity-tabs" aria-label="Portfolio activity tabs">
              <button aria-pressed="true" type="button">
                Positions
              </button>
              <button type="button">Open Orders</button>
              <button type="button">History</button>
            </div>
            <div className="activity-empty">
              <span>All activities</span>
              <strong>No history found</strong>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function VaultWorkflow({
  contractSteps,
  handlePrepareContractStep,
  handleSubmitContractStep,
  walletState,
}: {
  contractSteps: Record<ContractStepKey, ContractStepState>;
  handlePrepareContractStep: (step: ContractStepKey) => void;
  handleSubmitContractStep: (step: ContractStepKey) => void;
  walletState: WalletState;
}) {
  return (
    <div className="vault-action-panel margin-vault-panel">
      <div>
        <span>Vault flow</span>
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
              (stepState.status === "submitted" && stepState.transaction.status === "FAILED"));
          const canSend =
            stepState.status === "prepared" && walletState.status === "ready" && isUnlocked;

          return (
            <div
              className={
                isUnlocked ? "vault-step-card " + stepState.status : "vault-step-card locked"
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
                    <dd>{truncateAddress(stepState.prepared.contractCall.contractAddress)}</dd>
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
                  {stepState.status === "preparing" ? "Preparing..." : definition.prepareLabel}
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
  );
}

function getMarketCategories(markets: Market[]) {
  const categories = new Set<string>();

  markets.forEach((market) => {
    const category = market.category?.trim();

    if (category) {
      categories.add(category);
    }
  });

  return ["All", ...Array.from(categories).sort((left, right) => left.localeCompare(right))];
}

function filterMarketsByCategory(markets: Market[], category: string) {
  if (category === "All") {
    return markets;
  }

  return markets.filter((market) => (market.category?.trim() || "General") === category);
}

function getPriceStripStyle(snapshot: PriceSnapshot) {
  const probability = snapshot ? Math.min(Math.max(snapshot.probability, 0), 1) : 0.5;

  return { "--yes-probability": Math.round(probability * 100) + "%" } as CSSProperties;
}

function invertSnapshot(snapshot: PriceSnapshot): PriceSnapshot {
  if (!snapshot) {
    return null;
  }

  return {
    probability: Math.max(0, 1 - snapshot.probability),
    source: snapshot.source,
  };
}

function getOutcomeName(market: Market, side: Side) {
  const title = market.title
    .replace(/^Will\s+/i, "")
    .replace(/\?$/, "")
    .trim();
  const compactTitle = title.length > 44 ? title.slice(0, 41).trimEnd() + "..." : title;

  return side === "YES" ? compactTitle : "Not " + compactTitle;
}

function getCollateralRouteLabel(
  selectedChain: ExecutionCapabilities["chains"][number] | undefined,
  selectedToken: CollateralToken,
) {
  return selectedChain?.collateralTokenSymbol ?? selectedToken;
}

function getAccountSubmissionMessage(sessionState: FarcasterSessionState) {
  if (sessionState.status === "unavailable") {
    return "Account submission is not connected in the browser yet. Wallet preview is available now.";
  }

  return sessionState.message;
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
  collateralToken,
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
  collateralToken: CollateralToken;
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

  if (!parsePositiveNumber(quantity)) {
    return "Enter outcome shares greater than zero.";
  }

  if (parsePositiveNumber(marginAmount) === null) {
    return "Enter a real " + collateralToken + " collateral amount.";
  }

  if (leverage <= 1) {
    return "Choose leverage above 1x to open margin.";
  }

  if (!chainId) {
    return "Select an execution chain.";
  }

  if (
    !selectedChain?.walletFlowEnabled ||
    !selectedChain.vaultAddress ||
    !selectedChain.collateralTokenAddress
  ) {
    return "Select a chain with a connected vault route.";
  }

  const routeToken = selectedChain.collateralTokenSymbol?.toUpperCase();

  if (routeToken && routeToken !== collateralToken) {
    return collateralToken + " is not configured on this vault yet. Select " + routeToken + ".";
  }

  if (walletState.status !== "ready") {
    return walletState.message;
  }

  if (!evmAddressPattern.test(walletAddress.trim())) {
    return "Connect a valid EVM wallet.";
  }

  if (walletAddress.trim().toLowerCase() !== walletState.address.toLowerCase()) {
    return "Connected wallet changed. Reconnect before opening margin.";
  }

  if (sessionState.status !== "ready") {
    return getAccountSubmissionMessage(sessionState);
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
    return getAccountSubmissionMessage(sessionState);
  }

  if (!execution.marginExecutionEnabled || !execution.leverageEnabled) {
    return "Open margin records a real vault-backed request. A position opens only after real execution confirms.";
  }

  return (
    preview.referencePriceLabel + " is a reference only. A real wallet flow is still required."
  );
}

function buildSubmittedMessage(executionAttempt: ExecutionAttempt) {
  if (executionAttempt.status === "BLOCKED") {
    return (
      "Margin request recorded. Execution blocked: " +
      (executionAttempt.failureMessage ?? "the route is not active yet.")
    );
  }

  return "Margin request recorded. Status: " + executionAttempt.status + ".";
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
    approval: { status: "idle", message: "Approve collateral for the vault." },
    deposit: { status: "idle", message: "Deposit approved collateral into the vault." },
    marginIntent: { status: "idle", message: "Send the vault-backed margin request." },
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
  if (isContractStepConfirmed(state.marginIntent)) return "Request confirmed";
  if (isContractStepConfirmed(state.deposit)) return "Ready to open";
  if (isContractStepConfirmed(state.approval)) return "Ready to deposit";

  return "Ready to approve";
}

function getContractWorkflowMessage(state: Record<ContractStepKey, ContractStepState>) {
  if (isContractStepConfirmed(state.marginIntent)) {
    return "The vault request is confirmed onchain. A market position opens only after real execution confirms.";
  }

  if (isContractStepConfirmed(state.deposit)) {
    return "The vault deposit is confirmed. Send the margin request next; do not treat this as a market fill.";
  }

  if (isContractStepConfirmed(state.approval)) {
    return "The approval is confirmed. Deposit collateral into the vault next.";
  }

  return "Run the wallet flow in order: approve collateral, deposit it, then open margin.";
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
