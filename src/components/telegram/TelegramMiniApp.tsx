"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import type { OmnistonQuoteSummary, OmnistonStatus } from "../../lib/core-api";

export type TelegramMiniMarket = {
  id: string;
  title: string;
  category: string;
  topic: string;
  region: string;
  yesPercent: string;
  imageUrl: string;
};

type TelegramMiniAppProps = {
  marketCount: number;
  markets: TelegramMiniMarket[];
  omniston: OmnistonStatus;
  summary: OmnistonQuoteSummary;
};

type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type QuoteState =
  | { status: "idle"; message: string | null }
  | { status: "loading"; message: string | null }
  | { status: "quoted"; message: string; outputAmount: string; resolverName: string; routeCount: number | null }
  | { status: "error"; message: string };

const amountPresets = [
  { label: "1 TON", from: "TON", to: "USDT", units: "1000000000" },
  { label: "10 USDT", from: "USDT", to: "TON", units: "10000000" },
  { label: "25 USDT", from: "USDT", to: "STON", units: "25000000" },
];

const tabs = ["Markets", "Quote", "Vaults", "Pulse", "Support"] as const;
type MiniTab = (typeof tabs)[number];

export function TelegramMiniApp({ marketCount, markets, omniston, summary }: TelegramMiniAppProps) {
  const [activeTab, setActiveTab] = useState<MiniTab>("Markets");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All");
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [quoteInput, setQuoteInput] = useState({ fromAsset: "TON", toAsset: "USDT", amountUnits: "1000000000" });
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle", message: null });

  useEffect(() => {
    const telegram = getTelegramWebApp();
    telegram?.ready?.();
    telegram?.expand?.();
    setTelegramUser(telegram?.initDataUnsafe?.user ?? null);
  }, []);

  const topics = useMemo(() => {
    const values = new Map<string, number>();
    markets.forEach((market) => {
      values.set(market.topic, (values.get(market.topic) ?? 0) + 1);
    });

    return ["All", ...[...values.entries()].sort((left, right) => right[1] - left[1]).map(([label]) => label)].slice(0, 10);
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return markets
      .filter((market) => {
        const text = [market.title, market.category, market.topic, market.region]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (topic !== "All" && market.topic !== topic) return false;
        if (normalizedQuery && !text.includes(normalizedQuery)) return false;
        return true;
      })
      .slice(0, 18);
  }, [markets, query, topic]);

  const featuredMarkets = filteredMarkets.slice(0, 5);
  const displayName = telegramUser?.username
    ? "@" + telegramUser.username
    : telegramUser?.first_name
      ? telegramUser.first_name
      : "Telegram trader";

  async function requestQuote() {
    setQuoteState({ status: "loading", message: "Requesting quote-only route..." });

    try {
      const response = await fetch("/api/omniston/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quoteInput,
          platformUserId: telegramUser?.id ? String(telegramUser.id) : null,
          username: telegramUser?.username ?? null,
        }),
      });
      const body = (await response.json()) as
        | { ok: true; data: { quote: { outputAmount: string; resolverName: string; routeCount: number | null } } }
        | { ok: false; error: { message: string } };

      if (!response.ok || !body.ok) {
        setQuoteState({ status: "error", message: body.ok ? "Quote failed." : body.error.message });
        return;
      }

      setQuoteState({
        status: "quoted",
        message: "Quote-only route ready. No wallet transaction was submitted.",
        outputAmount: body.data.quote.outputAmount,
        resolverName: body.data.quote.resolverName,
        routeCount: body.data.quote.routeCount,
      });
    } catch {
      setQuoteState({ status: "error", message: "Quote request failed. Try again in a moment." });
    }
  }

  function openTelegramCommunity() {
    const telegram = getTelegramWebApp();
    const url = "https://t.me/+KYjXR2Tz2P4xMGY0";
    if (telegram?.openTelegramLink) {
      telegram.openTelegramLink(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="telegram-mini-shell">
      <section className="telegram-mini-hero">
        <div className="telegram-mini-brand">
          <Image src="/logo/conviction-markets-icon.png" alt="Conviction Markets" width={42} height={42} priority />
          <div>
            <span>Conviction Mini App</span>
            <strong>{displayName}</strong>
          </div>
        </div>
        <div className="telegram-mini-status" data-ready={omniston.quoteReady ? "true" : "false"}>
          <span>{omniston.quoteReady ? "Omniston ready" : "Quotes offline"}</span>
          <strong>{marketCount} markets</strong>
        </div>
        <div className="telegram-mini-copy">
          <h1>Trade the market pulse from Telegram.</h1>
          <p>Explore prediction markets, check TON routes, follow Pulse, and jump into margin or vault workflows when you need the full desk.</p>
        </div>
        <div className="telegram-mini-actions">
          <Link href="/markets" target="_blank">
            Open markets <ArrowRight size={15} />
          </Link>
          <button type="button" onClick={() => setActiveTab("Quote")}>
            TON quote <RefreshCw size={15} />
          </button>
        </div>
      </section>

      <nav className="telegram-mini-tabs" aria-label="Mini app tabs">
        {tabs.map((tab) => (
          <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Markets" ? (
        <section className="telegram-mini-panel">
          <div className="telegram-mini-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search World Cup, TON, Africa, crypto..." />
          </div>
          <div className="telegram-mini-chip-row" aria-label="Market topics">
            {topics.map((item) => (
              <button key={item} type="button" aria-pressed={topic === item} onClick={() => setTopic(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="telegram-mini-market-list">
            {featuredMarkets.map((market) => (
              <MiniMarketCard key={market.id} market={market} />
            ))}
          </div>
          <Link className="telegram-mini-wide-link" href="/markets" target="_blank">
            Browse all market categories <ExternalLink size={15} />
          </Link>
        </section>
      ) : null}

      {activeTab === "Quote" ? (
        <section className="telegram-mini-panel telegram-mini-quote-panel">
          <div className="telegram-mini-section-title">
            <RefreshCw size={18} />
            <div>
              <span>Omniston quote-only</span>
              <strong>TON routing preview</strong>
            </div>
          </div>
          <div className="telegram-mini-quote-grid">
            <label>
              From
              <select value={quoteInput.fromAsset} onChange={(event) => setQuoteInput((current) => ({ ...current, fromAsset: event.target.value }))}>
                <option>TON</option>
                <option>USDT</option>
                <option>STON</option>
              </select>
            </label>
            <label>
              To
              <select value={quoteInput.toAsset} onChange={(event) => setQuoteInput((current) => ({ ...current, toAsset: event.target.value }))}>
                <option>USDT</option>
                <option>TON</option>
                <option>STON</option>
              </select>
            </label>
          </div>
          <label className="telegram-mini-amount">
            Amount units
            <input value={quoteInput.amountUnits} onChange={(event) => setQuoteInput((current) => ({ ...current, amountUnits: event.target.value.replace(/\D/g, "") }))} inputMode="numeric" />
          </label>
          <div className="telegram-mini-chip-row">
            {amountPresets.map((preset) => (
              <button key={preset.label} type="button" onClick={() => setQuoteInput({ fromAsset: preset.from, toAsset: preset.to, amountUnits: preset.units })}>
                {preset.label}
              </button>
            ))}
          </div>
          <button className="telegram-mini-primary" type="button" disabled={quoteState.status === "loading" || !omniston.quoteReady} onClick={requestQuote}>
            {quoteState.status === "loading" ? "Requesting quote..." : "Get quote"}
          </button>
          <QuoteResult state={quoteState} />
          <div className="telegram-mini-stats-grid">
            <Stat label="Quote attempts" value={String(summary.total)} />
            <Stat label="Telegram users" value={String(summary.uniqueTelegramUsers)} />
            <Stat label="Mode" value={omniston.routingMode.replace("_", " ")} />
          </div>
        </section>
      ) : null}

      {activeTab === "Vaults" ? (
        <section className="telegram-mini-panel telegram-mini-stack">
          <MiniFeature icon={<Wallet size={19} />} title="Vault liquidity" body="Vaults are the capital layer behind margin requests. Use the full app to deposit, track collateral, and review risk." href="/vaults" cta="Open vaults" />
          <MiniFeature icon={<ShieldCheck size={19} />} title="Margin readiness" body="Wallet approvals, deposits, and margin intent calls are available. Real venue fill settlement remains gated until adapters are enabled." href="/beta-readiness" cta="View readiness" />
          <MiniFeature icon={<BarChart3 size={19} />} title="Trading desk" body="Open larger YES/NO exposure from the full desk after reviewing market rules and liquidity." href="/margin-desk" cta="Open margin desk" />
        </section>
      ) : null}

      {activeTab === "Pulse" ? (
        <section className="telegram-mini-panel telegram-mini-stack">
          <MiniFeature icon={<MessageCircle size={19} />} title="Market Pulse" body="Prediction-market conversation, public calls, reposts, and market media live in Pulse." href="/activity" cta="Open Pulse" />
          <MiniFeature icon={<Sparkles size={19} />} title="Highlights" body="AI-assisted market cards and media should be treated as discovery, not financial advice." href="/activity?tab=highlights" cta="View highlights" />
          <button className="telegram-mini-wide-link" type="button" onClick={openTelegramCommunity}>
            Join Telegram community <ExternalLink size={15} />
          </button>
        </section>
      ) : null}

      {activeTab === "Support" ? (
        <section className="telegram-mini-panel telegram-mini-stack">
          <MiniFeature icon={<Bot size={19} />} title="Ask Conviction AI" body="Use /ai in this Telegram group for product, market, vault, and margin questions." href="/support" cta="Open support" />
          <MiniFeature icon={<BellRing size={19} />} title="Human support" body="If you need account-specific help, include your email and issue summary in the support page." href="/support" cta="Create ticket" />
          <div className="telegram-mini-note">Support email: convictionsmarket@gmail.com</div>
        </section>
      ) : null}
    </main>
  );
}

function MiniMarketCard({ market }: { market: TelegramMiniMarket }) {
  return (
    <Link className="telegram-mini-market-card" href={"/markets/" + market.id} target="_blank">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={market.imageUrl} alt="" loading="lazy" />
      <div>
        <span>{market.topic} · {market.region}</span>
        <strong>{market.title}</strong>
        <small>YES {market.yesPercent}</small>
      </div>
    </Link>
  );
}

function MiniFeature({ icon, title, body, href, cta }: { icon: React.ReactNode; title: string; body: string; href: string; cta: string }) {
  return (
    <div className="telegram-mini-feature">
      <div className="telegram-mini-feature-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
        <Link href={href} target="_blank">{cta} <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="telegram-mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuoteResult({ state }: { state: QuoteState }) {
  if (state.status === "idle") {
    return <div className="telegram-mini-note">Quote-only mode never submits a swap. It previews an Omniston route.</div>;
  }

  if (state.status === "loading") {
    return <div className="telegram-mini-note">{state.message}</div>;
  }

  if (state.status === "error") {
    return <div className="telegram-mini-note error">{state.message}</div>;
  }

  return (
    <div className="telegram-mini-quote-result">
      <span>{state.message}</span>
      <strong>{state.outputAmount}</strong>
      <small>Resolver {state.resolverName}{state.routeCount !== null ? " · " + state.routeCount + " routes" : ""}</small>
    </div>
  );
}

function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  openTelegramLink?: (url: string) => void;
  initDataUnsafe?: { user?: TelegramUser };
};
