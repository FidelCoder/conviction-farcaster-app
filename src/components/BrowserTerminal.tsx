"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  ExecutionCapabilities,
  LeaderboardEntry,
  Market,
  PreparedContractTransaction,
  SocialFeedItem,
  UserSession,
} from "../lib/core-api";
import { formatMarketPrice, getMarketDisplayCase, getMarketPrice } from "../lib/market-display";

type BrowserTerminalProps = {
  execution: ExecutionCapabilities;
  leaderboard: LeaderboardEntry[];
  markets: Market[];
  socialFeed: SocialFeedItem[];
};

type ActiveTab = "markets" | "margin" | "vaults" | "activity";
type Side = "YES" | "NO";
type WalletState =
  | { status: "idle"; address: null; chainId: null; message: string }
  | { status: "ready"; address: string; chainId: number | null; message: string };

type BrowserSessionResponse =
  | { ok: true; data: { session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

type MarginIntentResponse =
  | {
      ok: true;
      data: {
        position: { id: string; status: string; marketId: string; side: Side };
        executionAttempt?: { status: string; failureMessage?: string | null };
      };
    }
  | { ok: false; error: { code: string; message: string } };

type PrepareResponse =
  | { ok: true; data: PreparedContractTransaction }
  | { ok: false; error: { code: string; message: string } };

type PreparedStep = { key: "approval" | "deposit" | "intent"; prepared: PreparedContractTransaction };

const defaultWalletState: WalletState = {
  status: "idle",
  address: null,
  chainId: null,
  message: "Connect an EVM wallet to create real core-backed margin intents.",
};

export function BrowserTerminal({ execution, leaderboard, markets, socialFeed }: BrowserTerminalProps) {
  const liveMarkets = useMemo(() => markets.filter((market) => market.status === "ACTIVE"), [markets]);
  const sortedMarkets = useMemo(() => [...liveMarkets].sort(sortMarketPriority), [liveMarkets]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("markets");
  const [selectedMarketId, setSelectedMarketId] = useState(sortedMarkets[0]?.id ?? markets[0]?.id ?? "");
  const [side, setSide] = useState<Side>("YES");
  const [marginCollateral, setMarginCollateral] = useState("10");
  const [leverage, setLeverage] = useState("2");
  const [walletState, setWalletState] = useState<WalletState>(defaultWalletState);
  const [session, setSession] = useState<UserSession | null>(null);
  const [selectedChainId, setSelectedChainId] = useState(String(getDefaultChainId(execution)));
  const [statusMessage, setStatusMessage] = useState("Browser terminal is reading live core API state.");
  const [pendingPositionId, setPendingPositionId] = useState<string | null>(null);
  const [preparedSteps, setPreparedSteps] = useState<PreparedStep[]>([]);
  const selectedMarket = markets.find((market) => market.id === selectedMarketId) ?? sortedMarkets[0] ?? markets[0] ?? null;
  const selectedChain = execution.chains.find((chain) => String(chain.chainId) === selectedChainId) ?? execution.chains[0] ?? null;
  const metrics = getTerminalMetrics(markets, socialFeed);

  async function connectWallet() {
    const provider = getEthereumProvider();

    if (!provider) {
      setStatusMessage("No browser EVM wallet was detected.");
      return;
    }

    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
      const address = accounts[0];
      const chainId = Number.parseInt(chainHex, 16);

      if (!address) {
        setStatusMessage("Wallet did not return an account.");
        return;
      }

      const response = await fetch("/api/browser-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const body = (await response.json()) as BrowserSessionResponse;

      if (!response.ok || !body.ok) {
        setStatusMessage(body.ok ? "Browser session failed." : body.error.message);
        return;
      }

      setWalletState({
        status: "ready",
        address,
        chainId,
        message: "Connected " + truncateAddress(address) + " on chain " + chainId + ".",
      });
      setSession(body.data.session);
      setSelectedChainId(String(chainId));
      setStatusMessage("Browser wallet registered as a real WEB account in core.");
    } catch {
      setStatusMessage("Wallet connection was cancelled or failed.");
    }
  }

  async function submitMarginIntent() {
    if (!selectedMarket || !selectedChain) {
      setStatusMessage("Select a real market and supported chain first.");
      return;
    }

    if (walletState.status !== "ready" || !session) {
      setStatusMessage("Connect a browser wallet before creating a margin intent.");
      return;
    }

    const collateral = Number(marginCollateral);
    const leverageValue = Number(leverage);

    if (!Number.isFinite(collateral) || collateral <= 0) {
      setStatusMessage("Enter a positive collateral amount.");
      return;
    }

    if (!Number.isFinite(leverageValue) || leverageValue <= 1) {
      setStatusMessage("Leverage must be greater than 1x for a margin intent.");
      return;
    }

    setStatusMessage("Recording margin intent in core...");
    setPreparedSteps([]);

    try {
      const response = await fetch("/api/margin-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          marketId: selectedMarket.id,
          side,
          quantity: String(collateral * leverageValue),
          marginCollateral: String(collateral),
          leverageMultiplier: String(leverageValue),
          chainId: selectedChain.chainId,
          walletAddress: walletState.address,
        }),
      });
      const body = (await response.json()) as MarginIntentResponse;

      if (!response.ok || !body.ok) {
        setStatusMessage(body.ok ? "Margin intent failed." : body.error.message);
        return;
      }

      setPendingPositionId(body.data.position.id);
      setStatusMessage(
        "Core recorded a " +
          body.data.position.status.replace(/_/g, " ").toLowerCase() +
          " margin intent. Prepare the vault calls below.",
      );
      setActiveTab("margin");
    } catch {
      setStatusMessage("Core API did not accept the margin intent.");
    }
  }

  async function prepareContractStep(step: PreparedStep["key"]) {
    if (!pendingPositionId) {
      setStatusMessage("Create a margin intent before preparing contract calls.");
      return;
    }

    const route =
      step === "approval"
        ? "/api/contracts/collateral-approvals/prepare"
        : step === "deposit"
          ? "/api/contracts/deposits/prepare"
          : "/api/contracts/margin-intents/prepare";

    setStatusMessage("Preparing " + step + " contract call from core...");

    try {
      const response = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: pendingPositionId }),
      });
      const body = (await response.json()) as PrepareResponse;

      if (!response.ok || !body.ok) {
        setStatusMessage(body.ok ? "Contract preparation failed." : body.error.message);
        return;
      }

      setPreparedSteps((current) => [
        ...current.filter((item) => item.key !== step),
        { key: step, prepared: body.data },
      ]);
      setStatusMessage("Prepared " + body.data.contractCall.functionName + " for " + truncateAddress(body.data.contractCall.contractAddress) + ".");
    } catch {
      setStatusMessage("Contract preparation failed.");
    }
  }

  return (
    <main className="browser-terminal-shell">
      <div className="browser-terminal-grid" aria-hidden="true" />
      <section className="terminal-hero">
        <div>
          <p className="terminal-kicker">Conviction Markets</p>
          <h1>Prediction markets, wired for conviction.</h1>
          <p>
            A browser terminal for real market probabilities, social theses, WEB wallet sessions,
            and vault-ready margin intents. No demo fills or invented balances.
          </p>
        </div>
        <div className="terminal-wallet-card">
          <span>Wallet</span>
          <strong>{walletState.status === "ready" ? truncateAddress(walletState.address) : "Not connected"}</strong>
          <p>{walletState.message}</p>
          <button onClick={connectWallet} type="button">
            {walletState.status === "ready" ? "Reconnect" : "Connect wallet"}
          </button>
        </div>
      </section>

      <section className="terminal-layout">
        <aside className="terminal-sidebar" aria-label="Browser navigation">
          <button className="terminal-logo" onClick={() => setActiveTab("markets")} type="button">CM</button>
          <nav>
            <TerminalNavButton activeTab={activeTab} id="markets" label="Markets" setActiveTab={setActiveTab} />
            <TerminalNavButton activeTab={activeTab} id="margin" label="Margin Desk" setActiveTab={setActiveTab} />
            <TerminalNavButton activeTab={activeTab} id="vaults" label="Vaults" setActiveTab={setActiveTab} />
            <TerminalNavButton activeTab={activeTab} id="activity" label="Activity" setActiveTab={setActiveTab} />
          </nav>
        </aside>

        <section className="terminal-main-panel">
          <header className="terminal-panel-header">
            <div>
              <span>{activeTab.replace("-", " ")}</span>
              <h2>{getActiveTitle(activeTab)}</h2>
            </div>
            <p>{statusMessage}</p>
          </header>

          {activeTab === "markets" ? (
            <MarketsTerminalView markets={sortedMarkets} onOpenMargin={(market) => { setSelectedMarketId(market.id); setActiveTab("margin"); }} />
          ) : null}

          {activeTab === "margin" ? (
            <MarginTerminalView
              execution={execution}
              leverage={leverage}
              marginCollateral={marginCollateral}
              markets={sortedMarkets}
              onPrepareContractStep={prepareContractStep}
              onSubmitMarginIntent={submitMarginIntent}
              pendingPositionId={pendingPositionId}
              preparedSteps={preparedSteps}
              selectedChainId={selectedChainId}
              selectedMarket={selectedMarket}
              setLeverage={setLeverage}
              setMarginCollateral={setMarginCollateral}
              setSelectedChainId={setSelectedChainId}
              setSelectedMarketId={setSelectedMarketId}
              setSide={setSide}
              side={side}
              walletReady={walletState.status === "ready"}
            />
          ) : null}

          {activeTab === "vaults" ? <VaultTerminalView execution={execution} setActiveTab={setActiveTab} setSelectedChainId={setSelectedChainId} /> : null}

          {activeTab === "activity" ? <ActivityTerminalView leaderboard={leaderboard} socialFeed={socialFeed} /> : null}
        </section>
      </section>

      <StatusTelemetry metrics={metrics} execution={execution} />
    </main>
  );
}

function TerminalNavButton({
  activeTab,
  id,
  label,
  setActiveTab,
}: {
  activeTab: ActiveTab;
  id: ActiveTab;
  label: string;
  setActiveTab: (tab: ActiveTab) => void;
}) {
  return (
    <button className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)} type="button">
      <span>{label.slice(0, 1)}</span>
      {label}
    </button>
  );
}

function MarketsTerminalView({ markets, onOpenMargin }: { markets: Market[]; onOpenMargin: (market: Market) => void }) {
  const categories = Array.from(new Set(markets.map((market) => market.category ?? market.source))).slice(0, 8);
  const [category, setCategory] = useState("All");
  const filteredMarkets = category === "All" ? markets : markets.filter((market) => (market.category ?? market.source) === category);

  return (
    <div className="terminal-view-stack">
      <div className="terminal-filter-row">
        <button className={category === "All" ? "active" : ""} onClick={() => setCategory("All")} type="button">All</button>
        {categories.map((item) => (
          <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      <div className="terminal-market-grid">
        {filteredMarkets.slice(0, 18).map((market) => (
          <TerminalMarketCard key={market.id} market={market} onOpenMargin={onOpenMargin} />
        ))}
      </div>
      {filteredMarkets.length === 0 ? <p className="terminal-empty">No markets match this filter.</p> : null}
    </div>
  );
}

function TerminalMarketCard({ market, onOpenMargin }: { market: Market; onOpenMargin: (market: Market) => void }) {
  const displayCase = getMarketDisplayCase(market);
  const yesPrice = getMarketPrice(market);
  const probability = yesPrice ? Number(yesPrice) : Number.NaN;
  const yesLabel = Number.isFinite(probability) ? formatMarketPrice(String(probability)) : "--";
  const noLabel = Number.isFinite(probability) ? formatMarketPrice(String(Math.max(0, 1 - probability))) : "--";
  const fit = Math.max(12, Math.min(displayCase.boardFitScore, 100));
  const isLive = market.status === "ACTIVE";

  return (
    <article className="terminal-market-card">
      <div className="terminal-card-top">
        <span className="terminal-market-avatar">{getInitials(market.category ?? market.source)}</span>
        <span>{market.category ?? market.source}</span>
        <strong className={isLive ? "live" : "halted"}>{market.status}</strong>
      </div>
      <h3>{market.title}</h3>
      <p>{market.description ?? "Provider description unavailable."}</p>
      <div className="terminal-outcome-grid">
        <div className="yes"><span>YES</span><strong>{yesLabel}</strong></div>
        <div className="no"><span>NO</span><strong>{noLabel}</strong></div>
      </div>
      <div className="terminal-meter-label">
        <span>Readiness</span>
        <strong>{displayCase.label}</strong>
      </div>
      <div className="terminal-meter"><i style={{ width: fit + "%" }} /></div>
      <button disabled={!isLive} onClick={() => onOpenMargin(market)} type="button">
        {isLive ? "Open margin" : "Monitoring"}
      </button>
    </article>
  );
}

function MarginTerminalView({
  execution,
  leverage,
  marginCollateral,
  markets,
  onPrepareContractStep,
  onSubmitMarginIntent,
  pendingPositionId,
  preparedSteps,
  selectedChainId,
  selectedMarket,
  setLeverage,
  setMarginCollateral,
  setSelectedChainId,
  setSelectedMarketId,
  setSide,
  side,
  walletReady,
}: {
  execution: ExecutionCapabilities;
  leverage: string;
  marginCollateral: string;
  markets: Market[];
  onPrepareContractStep: (step: PreparedStep["key"]) => void;
  onSubmitMarginIntent: () => void;
  pendingPositionId: string | null;
  preparedSteps: PreparedStep[];
  selectedChainId: string;
  selectedMarket: Market | null;
  setLeverage: (value: string) => void;
  setMarginCollateral: (value: string) => void;
  setSelectedChainId: (value: string) => void;
  setSelectedMarketId: (value: string) => void;
  setSide: (value: Side) => void;
  side: Side;
  walletReady: boolean;
}) {
  const price = selectedMarket ? getMarketPrice(selectedMarket) : null;
  const yesPrice = price ? Number(price) : Number.NaN;
  const referencePrice = Number.isFinite(yesPrice) ? (side === "YES" ? yesPrice : 1 - yesPrice) : null;
  const collateral = Number(marginCollateral);
  const leverageValue = Number(leverage);
  const notional = Number.isFinite(collateral) && Number.isFinite(leverageValue) ? collateral * leverageValue : 0;

  return (
    <div className="terminal-margin-layout">
      <aside className="terminal-market-tape">
        <span>Market tape</span>
        {markets.slice(0, 10).map((market) => (
          <button className={market.id === selectedMarket?.id ? "active" : ""} key={market.id} onClick={() => setSelectedMarketId(market.id)} type="button">
            <span>{market.title}</span>
            <strong>{getMarketPrice(market) ? formatMarketPrice(getMarketPrice(market) as string) : "--"}</strong>
          </button>
        ))}
      </aside>
      <section className="terminal-ticket">
        <div className="terminal-ticket-market">
          <span>{selectedMarket?.category ?? selectedMarket?.source ?? "Market"}</span>
          <h3>{selectedMarket?.title ?? "Select a market"}</h3>
          <p>{selectedMarket?.description ?? "Real market context appears here after core sync."}</p>
        </div>
        <div className="terminal-candle-panel" aria-label="Reference price panel">
          <div className="terminal-candle-line yes" />
          <div className="terminal-candle-line no" />
          <strong>{referencePrice === null ? "--" : formatMarketPrice(String(referencePrice))}</strong>
          <span>{side} reference probability</span>
        </div>
        <div className="terminal-ticket-controls">
          <label><span>Market</span><select value={selectedMarket?.id ?? ""} onChange={(event) => setSelectedMarketId(event.target.value)}>{markets.map((market) => <option key={market.id} value={market.id}>{market.title}</option>)}</select></label>
          <label><span>Chain</span><select value={selectedChainId} onChange={(event) => setSelectedChainId(event.target.value)}>{execution.chains.filter((chain) => chain.walletFlowEnabled).map((chain) => <option key={chain.chainId} value={chain.chainId}>{chain.chainName} - {chain.collateralTokenSymbol ?? "Collateral"}</option>)}</select></label>
          <div className="terminal-side-toggle"><button className={side === "YES" ? "active yes" : "yes"} onClick={() => setSide("YES")} type="button">YES</button><button className={side === "NO" ? "active no" : "no"} onClick={() => setSide("NO")} type="button">NO</button></div>
          <label><span>Collateral</span><input inputMode="decimal" value={marginCollateral} onChange={(event) => setMarginCollateral(event.target.value)} /></label>
          <label><span>Leverage</span><select value={leverage} onChange={(event) => setLeverage(event.target.value)}>{["2", "3", "5", "10"].map((item) => <option key={item} value={item}>{item}x</option>)}</select></label>
        </div>
        <dl className="terminal-preview-grid">
          <div><dt>Notional</dt><dd>{notional > 0 ? "$" + notional.toLocaleString() : "--"}</dd></div>
          <div><dt>Status</dt><dd>{walletReady ? "Wallet ready" : "Connect wallet"}</dd></div>
          <div><dt>Position</dt><dd>{pendingPositionId ? truncateAddress(pendingPositionId) : "Not recorded"}</dd></div>
        </dl>
        <button className="terminal-primary-action" onClick={onSubmitMarginIntent} type="button">Record margin intent</button>
      </section>
      <aside className="terminal-contract-flow">
        <span>Vault workflow</span>
        <p>Prepare real contract calls after core records the position. Wallet submission can continue through the existing margin signer.</p>
        {(["approval", "deposit", "intent"] as const).map((step) => {
          const prepared = preparedSteps.find((item) => item.key === step);
          return (
            <div className="terminal-contract-step" key={step}>
              <strong>{step === "intent" ? "Margin intent" : step}</strong>
              <small>{prepared ? prepared.prepared.contractCall.functionName + " prepared" : "Waiting"}</small>
              {prepared ? <code>{truncateAddress(prepared.prepared.contractCall.contractAddress)}</code> : null}
              <button onClick={() => onPrepareContractStep(step)} type="button">Prepare</button>
            </div>
          );
        })}
        <Link className="terminal-secondary-link" href="/margin">Open full wallet signer</Link>
      </aside>
    </div>
  );
}


function VaultTerminalView({
  execution,
  setActiveTab,
  setSelectedChainId,
}: {
  execution: ExecutionCapabilities;
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedChainId: (value: string) => void;
}) {
  const walletChains = execution.chains.filter((chain) => chain.walletFlowEnabled);

  return (
    <div className="terminal-vault-grid">
      <section className="terminal-vault-copy">
        <span>Vaults</span>
        <h3>Collateral rails for margin, not fake balances.</h3>
        <p>
          The browser app reads deployed vault metadata from core. Deposits and margin calls are
          prepared against real contract addresses only when a supported chain is active.
        </p>
        <button
          onClick={() => {
            const firstChain = walletChains[0];

            if (firstChain) {
              setSelectedChainId(String(firstChain.chainId));
            }

            setActiveTab("margin");
          }}
          type="button"
        >
          Open margin workflow
        </button>
      </section>

      <div className="terminal-vault-list">
        {walletChains.map((chain) => (
          <article className="terminal-vault-card" key={chain.chainId}>
            <div>
              <span>{chain.network}</span>
              <strong>{chain.chainName}</strong>
            </div>
            <dl>
              <div>
                <dt>Vault</dt>
                <dd>{chain.vaultAddress ? truncateAddress(chain.vaultAddress) : "Not deployed"}</dd>
              </div>
              <div>
                <dt>Collateral</dt>
                <dd>{chain.collateralTokenSymbol ?? "Token pending"}</dd>
              </div>
              <div>
                <dt>Margin</dt>
                <dd>{chain.marginExecutionEnabled ? "Live" : "Intent only"}</dd>
              </div>
            </dl>
          </article>
        ))}
        {walletChains.length === 0 ? (
          <p className="terminal-empty">No wallet-enabled vaults are configured in core yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function ActivityTerminalView({
  leaderboard,
  socialFeed,
}: {
  leaderboard: LeaderboardEntry[];
  socialFeed: SocialFeedItem[];
}) {
  return (
    <div className="terminal-activity-grid">
      <section className="terminal-feed">
        <div className="terminal-section-title">
          <span>Social layer</span>
          <h3>Signals people can debate and copy.</h3>
        </div>
        {socialFeed.slice(0, 12).map((item) => (
          <article className="terminal-feed-card" key={item.signal.id}>
            <div className="terminal-feed-avatar">{getInitials(item.author.handle ?? item.author.username ?? "CM")}</div>
            <div>
              <header>
                <strong>{item.author.handle ?? item.author.username ?? item.author.displayName ?? "Conviction trader"}</strong>
                <span>{item.signal.side}</span>
              </header>
              <p>{item.signal.thesis}</p>
              <small>{item.market?.title ?? "Market unavailable"}</small>
              <footer>
                <span>{item.counts.replies} replies</span>
                <span>{item.counts.bookmarks} saves</span>
                <span>{item.counts.copyIntents} copy intents</span>
              </footer>
            </div>
          </article>
        ))}
        {socialFeed.length === 0 ? (
          <p className="terminal-empty">No social signals yet. Create a real signal from a market page.</p>
        ) : null}
      </section>

      <aside className="terminal-leaderboard">
        <div className="terminal-section-title">
          <span>Leaderboard</span>
          <h3>Based on real records.</h3>
        </div>
        {leaderboard.slice(0, 8).map((entry) => (
          <div className="terminal-leader-row" key={entry.traderProfileId}>
            <span>#{entry.rank}</span>
            <strong>{entry.handle}</strong>
            <small>{entry.numberOfSignals} signals - {entry.numberOfCopyIntents} copies</small>
          </div>
        ))}
        {leaderboard.length === 0 ? (
          <p className="terminal-empty">Leaderboard appears after real signals and copy intents exist.</p>
        ) : null}
      </aside>
    </div>
  );
}

function StatusTelemetry({
  execution,
  metrics,
}: {
  execution: ExecutionCapabilities;
  metrics: { totalMarkets: number; pricedMarkets: number; mappedMarkets: number; socialItems: number };
}) {
  return (
    <section className="terminal-telemetry" aria-label="Core API telemetry">
      <div><span>Markets</span><strong>{metrics.totalMarkets}</strong></div>
      <div><span>Priced</span><strong>{metrics.pricedMarkets}</strong></div>
      <div><span>Mapped</span><strong>{metrics.mappedMarkets}</strong></div>
      <div><span>Social</span><strong>{metrics.socialItems}</strong></div>
      <div><span>Margin</span><strong>{execution.marginExecutionEnabled ? "Live" : "Intent"}</strong></div>
    </section>
  );
}

function getTerminalMetrics(markets: Market[], socialFeed: SocialFeedItem[]) {
  return markets.reduce(
    (metrics, market) => {
      metrics.totalMarkets += 1;
      metrics.pricedMarkets += getMarketPrice(market) ? 1 : 0;
      metrics.mappedMarkets += market.yesTokenId && market.noTokenId ? 1 : 0;

      return metrics;
    },
    { totalMarkets: 0, pricedMarkets: 0, mappedMarkets: 0, socialItems: socialFeed.length },
  );
}

function getDefaultChainId(execution: ExecutionCapabilities) {
  return execution.chains.find((chain) => chain.walletFlowEnabled)?.chainId ?? execution.chains[0]?.chainId ?? 84532;
}

function getEthereumProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as Window & { ethereum?: { request: (input: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum ?? null;
}

function truncateAddress(value: string | null) {
  if (!value) {
    return "--";
  }

  if (value.length <= 12) {
    return value;
  }

  return value.slice(0, 6) + "..." + value.slice(-4);
}

function sortMarketPriority(left: Market, right: Market) {
  const leftPrice = getMarketPrice(left);
  const rightPrice = getMarketPrice(right);
  const leftScore =
    (left.status === "ACTIVE" ? 20 : 0) +
    (leftPrice ? 12 : 0) +
    (left.yesTokenId && left.noTokenId ? 8 : 0) +
    (left.resolutionDate ? 4 : 0);
  const rightScore =
    (right.status === "ACTIVE" ? 20 : 0) +
    (rightPrice ? 12 : 0) +
    (right.yesTokenId && right.noTokenId ? 8 : 0) +
    (right.resolutionDate ? 4 : 0);

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return left.title.localeCompare(right.title);
}

function getActiveTitle(activeTab: ActiveTab) {
  if (activeTab === "margin") {
    return "Margin desk";
  }

  if (activeTab === "vaults") {
    return "Vault rails";
  }

  if (activeTab === "activity") {
    return "Social pulse";
  }

  return "Market board";
}

function getInitials(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CM";
}
