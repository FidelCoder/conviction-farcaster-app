"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import type { SocialTimelineEvent, UserSession } from "../../lib/core-api";

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
};

type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type MiniTab = "Markets" | "Pulse" | "Margin" | "Vaults" | "Wallet";
type Side = "YES" | "NO";

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
const tabs: MiniTab[] = ["Markets", "Pulse", "Margin", "Vaults", "Wallet"];
const tonAssets = ["TON", "USDT", "STON"];
const evmChains = [
  { id: 84532, label: "Base Sepolia" },
  { id: 11155111, label: "Ethereum Sepolia" },
  { id: 421614, label: "Arbitrum Sepolia" },
];

export function TelegramMiniApp({ marketCount, markets }: TelegramMiniAppProps) {
  const [activeTab, setActiveTab] = useState<MiniTab>("Markets");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All");
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [tonSession, setTonSession] = useState<UserSession | null>(null);
  const [tonUi, setTonUi] = useState<TonConnectUI | null>(null);
  const [tonWallet, setTonWallet] = useState<TonWalletInfo | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState(markets[0]?.id ?? "");
  const [pulseEvents, setPulseEvents] = useState<SocialTimelineEvent[]>([]);
  const [pulseBody, setPulseBody] = useState("");
  const [signalMode, setSignalMode] = useState(false);
  const [side, setSide] = useState<Side>("YES");
  const [convictionLevel, setConvictionLevel] = useState(70);
  const [marginAmount, setMarginAmount] = useState("10");
  const [marginLeverage, setMarginLeverage] = useState("3");
  const [evmWallet, setEvmWallet] = useState("");
  const [chainId, setChainId] = useState("84532");
  const [vaultAmount, setVaultAmount] = useState("5");
  const [vaultAsset, setVaultAsset] = useState("TON");
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [claimHandle, setClaimHandle] = useState("");

  useEffect(() => {
    const telegram = getTelegramWebApp();
    telegram?.ready?.();
    telegram?.expand?.();
    const user = telegram?.initDataUnsafe?.user ?? null;
    setTelegramUser(user);
    if (user?.username) setClaimHandle(cleanHandle(user.username));
  }, []);

  useEffect(() => {
    if (!telegramUser?.id) return;
    void createTelegramSessionFromUser(telegramUser);
  }, [telegramUser]);

  useEffect(() => {
    void loadPulse();
  }, []);

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

      patchTelegramWalletLinkOpening();

      const ui = new constructor({
        manifestUrl: window.location.origin + "/tonconnect-manifest.json",
        buttonRootId: null,
        actionsConfiguration: getTonConnectActionsConfiguration(),
        enableAndroidBackHandler: false,
      });
      setTonUi(ui);
      setTonWallet(ui.wallet ?? null);
      if (ui.wallet?.account?.address) void createTonSession(ui.wallet.account.address);

      unsubscribe = ui.onStatusChange((wallet) => {
        setTonWallet(wallet);
        if (wallet?.account?.address) {
          void createTonSession(wallet.account.address);
        } else {
          setTonSession(null);
        }
      });
    }

    boot();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, [tonUi]);

  const tonAddress = tonWallet?.account?.address ?? null;
  const activeSession = tonSession;
  const activeProfile = activeSession?.traderProfile ?? null;
  const activeUserId = activeSession?.user.id ?? null;
  const telegramLabel = telegramName(telegramUser) ?? "Telegram trader";
  const displayName = activeProfile?.handle ?? telegramLabel;
  const selectedMarket = markets.find((market) => market.id === selectedMarketId) ?? markets[0] ?? null;

  const topics = useMemo(() => {
    const values = new Map<string, number>();
    markets.forEach((market) => values.set(market.topic, (values.get(market.topic) ?? 0) + 1));
    return ["All", ...[...values.entries()].sort((left, right) => right[1] - left[1]).map(([label]) => label)].slice(0, 12);
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return markets
      .filter((market) => {
        const text = [market.title, market.category, market.topic, market.region].join(" ").toLowerCase();
        if (topic !== "All" && market.topic !== topic) return false;
        if (normalizedQuery && !text.includes(normalizedQuery)) return false;
        return true;
      })
      .slice(0, 24);
  }, [markets, query, topic]);

  async function createTelegramSessionFromUser(user: TelegramUser) {
    if (!user.id) return;
    try {
      const response = await fetch("/api/telegram-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: String(user.id),
          username: user.username ?? null,
          displayName: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || null,
          profileUrl: user.photo_url ?? null,
        }),
      });
      const body = (await response.json()) as { ok: true; data: { session: UserSession } } | { ok: false; error: { message: string } };
      if (!response.ok || !body.ok) throw new Error(body.ok ? "Telegram session failed." : body.error.message);
    } catch {
      setStatus({ tone: "error", text: "Telegram session could not be created. You can still browse markets." });
    }
  }

  async function createTonSession(address: string) {
    try {
      const response = await fetch("/api/ton-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tonAddress: address, displayName: "TON " + shortAddress(address) }),
      });
      const body = (await response.json()) as { ok: true; data: { session: UserSession } } | { ok: false; error: { message: string } };
      if (response.ok && body.ok) setTonSession(body.data.session);
    } catch {
      setStatus({ tone: "error", text: "TON session could not be linked." });
    }
  }

  async function connectTonWallet() {
    if (!tonUi) {
      setStatus({ tone: "error", text: "TON Connect is still loading. Try again in a moment." });
      return;
    }
    try {
      setStatus({ tone: "info", text: "Choose a TON wallet, approve the connection, then return to Conviction in Telegram." });
      if (tonUi.openModal) {
        await tonUi.openModal();
        return;
      }
      await tonUi.connectWallet();
    } catch {
      setStatus({ tone: "error", text: "TON wallet connection was cancelled or failed." });
    }
  }

  async function disconnectTonWallet() {
    try {
      await tonUi?.disconnect();
      setTonWallet(null);
      setTonSession(null);
    } catch {
      setStatus({ tone: "error", text: "TON wallet disconnect failed." });
    }
  }

  async function claimProfile() {
    if (!tonAddress) {
      setStatus({ tone: "error", text: "Connect a TON wallet before claiming your .viction identity." });
      return;
    }
    if (!activeUserId) {
      setStatus({ tone: "error", text: "TON session is still syncing. Try again in a moment." });
      return;
    }
    const handle = cleanHandle(claimHandle);
    if (!handle || handle.length < 2) {
      setStatus({ tone: "error", text: "Choose a readable .viction name." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/trader-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeUserId,
          handle: handle + ".viction",
          bio: "Trading from Telegram",
          avatarUrl: "/api/viction-avatar?seed=" + encodeURIComponent(handle),
        }),
      });
      const body = (await response.json()) as { ok: true; data: { traderProfile: UserSession["traderProfile"] } } | { ok: false; error: { message: string } };
      if (!response.ok || !body.ok) {
        setStatus({ tone: "error", text: body.ok ? "Profile claim failed." : body.error.message });
        return;
      }
      setTonSession((current) => (current && current.user.id === activeUserId ? { ...current, traderProfile: body.data.traderProfile } : current));
      setStatus({ tone: "success", text: "Claimed " + handle + ".viction" });
    } catch {
      setStatus({ tone: "error", text: "Profile claim failed. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function loadPulse() {
    setLoadingPulse(true);
    try {
      const response = await fetch("/api/social/timeline?limit=30", { cache: "no-store" });
      const body = (await response.json()) as { ok: true; data: { events: SocialTimelineEvent[] } } | { ok: false; error: { message: string } };
      if (response.ok && body.ok) setPulseEvents(body.data.events);
    } finally {
      setLoadingPulse(false);
    }
  }

  async function publishPulse() {
    if (!tonAddress || !activeUserId) {
      setStatus({ tone: "error", text: "Connect a TON wallet before posting." });
      return;
    }
    if (!activeProfile) {
      setStatus({ tone: "error", text: "Claim a .viction profile before posting." });
      return;
    }
    if (!pulseBody.trim()) {
      setStatus({ tone: "error", text: "Write something before publishing." });
      return;
    }
    setSaving(true);
    try {
      const endpoint = signalMode ? "/api/signals" : "/api/social/posts";
      const payload = signalMode
        ? {
            traderProfileId: activeProfile.id,
            marketId: selectedMarket?.id,
            side,
            thesis: pulseBody.trim(),
            convictionLevel,
            source: "TELEGRAM",
          }
        : { authorUserId: activeUserId, body: pulseBody.trim(), mediaUrl: null, mediaType: null };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!response.ok || !body.ok) {
        setStatus({ tone: "error", text: body.error?.message ?? "Post was not accepted." });
        return;
      }
      setPulseBody("");
      setStatus({ tone: "success", text: signalMode ? "Signal posted to Pulse." : "Post published to Pulse." });
      await loadPulse();
    } catch {
      setStatus({ tone: "error", text: "Pulse publish failed. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function requestMargin() {
    if (!tonAddress || !activeUserId || !selectedMarket) {
      setStatus({ tone: "error", text: "Connect a TON wallet and select a market first." });
      return;
    }
    if (!activeProfile) {
      setStatus({ tone: "error", text: "Claim your .viction profile before requesting margin." });
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(evmWallet.trim())) {
      setStatus({ tone: "error", text: "Use an EVM wallet address for today’s on-chain margin rails. TON margin comes after the TON vault contract is deployed." });
      return;
    }
    setSaving(true);
    try {
      const collateral = Number(marginAmount);
      const leverage = Number(marginLeverage);
      const response = await fetch("/api/margin-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeUserId,
          marketId: selectedMarket.id,
          side,
          quantity: String(Math.max(collateral * leverage, 1)),
          marginCollateral: marginAmount,
          leverageMultiplier: marginLeverage,
          walletAddress: evmWallet.trim(),
          chainId,
          visibility: "PUBLIC",
        }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!response.ok || !body.ok) {
        setStatus({ tone: "error", text: body.error?.message ?? "Margin request failed." });
        return;
      }
      setStatus({ tone: "success", text: "Margin request recorded. Complete the wallet transaction from the full desk when ready." });
    } catch {
      setStatus({ tone: "error", text: "Margin request failed. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function requestTonVault() {
    if (!tonAddress) {
      setStatus({ tone: "error", text: "Connect a TON wallet before preparing vault liquidity." });
      return;
    }
    if (!activeUserId) {
      setStatus({ tone: "error", text: "TON session is not ready yet. Try again in a moment." });
      return;
    }
    if (!activeProfile) {
      setStatus({ tone: "error", text: "Claim your .viction profile before preparing vault liquidity." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/ton-vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeUserId,
          telegramUserId: telegramUser?.id ? String(telegramUser.id) : null,
          tonAddress,
          asset: vaultAsset,
          amount: vaultAmount,
          note: "Telegram Mini App TON vault liquidity intent",
        }),
      });
      const body = (await response.json()) as { ok: true; data: { intent: { id: string } } } | { ok: false; error: { message: string } };
      if (!response.ok || !body.ok) {
        setStatus({ tone: "error", text: body.ok ? "Vault intent failed." : body.error.message });
        return;
      }
      setStatus({ tone: "success", text: "TON vault intent recorded. Contract transfer opens after TON vault deployment." });
    } catch {
      setStatus({ tone: "error", text: "TON vault intent failed. Try again." });
    } finally {
      setSaving(false);
    }
  }

  function openTelegramCommunity() {
    const telegram = getTelegramWebApp();
    const url = "https://t.me/+KYjXR2Tz2P4xMGY0";
    if (telegram?.openTelegramLink) telegram.openTelegramLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="telegram-mini-shell">
      <section className="telegram-mini-hero telegram-mini-product-hero">
        <div className="telegram-mini-brand">
          <Image src="/logo/conviction-markets-icon.png" alt="Conviction Markets" width={42} height={42} priority />
          <div>
            <span>Conviction Mini App</span>
            <strong>{displayName}</strong>
          </div>
        </div>
        <div className="telegram-mini-status" data-ready={activeProfile ? "true" : "false"}>
          <span>{activeProfile ? "Profile ready" : tonAddress ? "Claim profile" : "Connect TON"}</span>
          <strong>{marketCount} markets</strong>
        </div>
        <div className="telegram-mini-copy">
          <h1>Markets, Pulse, margin, and TON liquidity inside Telegram.</h1>
          <p>Find events, post market calls, request margin, and prepare TON vault liquidity from the mobile Mini App.</p>
          <small className="telegram-mini-telegram-user">Detected {telegramLabel}</small>
        </div>
        <div className="telegram-mini-actions">
          <button type="button" onClick={() => setActiveTab("Markets")}>Find markets <ArrowRight size={15} /></button>
          <button type="button" onClick={() => setActiveTab("Vaults")}>TON vault <Wallet size={15} /></button>
        </div>
        {status ? <div className={"telegram-mini-alert " + status.tone}>{status.text}</div> : null}
      </section>

      {!activeProfile ? (
        <section className="telegram-mini-panel telegram-mini-claim-card">
          <div className="telegram-mini-section-title">
            <Sparkles size={18} />
            <div>
              <span>.viction profile required</span>
              <strong>{tonAddress ? "Claim your trading identity" : "Connect TON wallet first"}</strong>
            </div>
          </div>
          <p className="telegram-mini-muted-copy">
            Detected {telegramLabel}. Connect a TON wallet, then claim the .viction name attached to that wallet before posting, margin, or vault actions.
          </p>
          {tonAddress ? (
            <>
              <div className="telegram-mini-handle-row">
                <input value={claimHandle} onChange={(event) => setClaimHandle(cleanHandle(event.target.value))} placeholder="griffins" />
                <span>.viction</span>
              </div>
              <button className="telegram-mini-primary" type="button" disabled={saving || !activeUserId} onClick={claimProfile}>
                {saving ? "Claiming..." : "Claim profile"}
              </button>
            </>
          ) : (
            <button className="telegram-mini-primary" type="button" onClick={connectTonWallet}>Connect TON wallet</button>
          )}
        </section>
      ) : null}

      <nav className="telegram-mini-tabs" aria-label="Mini app tabs">
        {tabs.map((tab) => (
          <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </nav>

      {activeTab === "Markets" ? (
        <section className="telegram-mini-panel">
          <div className="telegram-mini-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Africa, crypto, football, politics..." />
          </div>
          <div className="telegram-mini-chip-row" aria-label="Market topics">
            {topics.map((item) => <button key={item} type="button" aria-pressed={topic === item} onClick={() => setTopic(item)}>{item}</button>)}
          </div>
          <div className="telegram-mini-market-list">
            {filteredMarkets.map((market) => (
              <button key={market.id} className="telegram-mini-market-card" type="button" aria-pressed={selectedMarketId === market.id} onClick={() => { setSelectedMarketId(market.id); setActiveTab("Margin"); }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={market.imageUrl} alt="" loading="lazy" />
                <div>
                  <span>{market.topic} · {market.region}</span>
                  <strong>{market.title}</strong>
                  <small>YES {market.yesPercent}</small>
                </div>
              </button>
            ))}
          </div>
          <Link className="telegram-mini-wide-link" href="/markets" target="_blank">Open full market board <ExternalLink size={15} /></Link>
        </section>
      ) : null}

      {activeTab === "Pulse" ? (
        <section className="telegram-mini-panel telegram-mini-stack">
          <div className="telegram-mini-composer">
            <textarea value={pulseBody} onChange={(event) => setPulseBody(event.target.value)} placeholder="Post a market take, question, chart note, or community update..." />
            <div className="telegram-mini-toggle-row">
              <button type="button" aria-pressed={!signalMode} onClick={() => setSignalMode(false)}>Post</button>
              <button type="button" aria-pressed={signalMode} onClick={() => setSignalMode(true)}>Market signal</button>
            </div>
            {signalMode ? (
              <div className="telegram-mini-signal-tools">
                <select value={selectedMarketId} onChange={(event) => setSelectedMarketId(event.target.value)}>
                  {markets.slice(0, 96).map((market) => <option key={market.id} value={market.id}>{market.title}</option>)}
                </select>
                <div className="telegram-mini-toggle-row">
                  <button type="button" aria-pressed={side === "YES"} onClick={() => setSide("YES")}>YES</button>
                  <button type="button" aria-pressed={side === "NO"} onClick={() => setSide("NO")}>NO</button>
                </div>
                <label>Conviction {convictionLevel}%<input type="range" min="1" max="100" value={convictionLevel} onChange={(event) => setConvictionLevel(Number(event.target.value))} /></label>
              </div>
            ) : null}
            <button className="telegram-mini-primary" type="button" disabled={saving || !pulseBody.trim() || !activeProfile} onClick={publishPulse}>Publish <Send size={15} /></button>
          </div>
          <div className="telegram-mini-section-title">
            <MessageCircle size={18} />
            <div><span>Live Pulse</span><strong>{loadingPulse ? "Loading..." : pulseEvents.length + " updates"}</strong></div>
          </div>
          <div className="telegram-mini-pulse-list">
            {pulseEvents.slice(0, 12).map((event) => <PulseEventCard key={event.id} event={event} />)}
          </div>
          <button className="telegram-mini-wide-link" type="button" onClick={openTelegramCommunity}>Join Telegram community <ExternalLink size={15} /></button>
        </section>
      ) : null}

      {activeTab === "Margin" ? (
        <section className="telegram-mini-panel telegram-mini-stack">
          <div className="telegram-mini-selected-market">
            <span>Selected market</span>
            <strong>{selectedMarket?.title ?? "Pick a market"}</strong>
            <small>YES {selectedMarket?.yesPercent ?? "--"}</small>
          </div>
          <div className="telegram-mini-toggle-row">
            <button type="button" aria-pressed={side === "YES"} onClick={() => setSide("YES")}>YES</button>
            <button type="button" aria-pressed={side === "NO"} onClick={() => setSide("NO")}>NO</button>
          </div>
          <div className="telegram-mini-form-grid">
            <label>Collateral<input value={marginAmount} onChange={(event) => setMarginAmount(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" /></label>
            <label>Leverage<select value={marginLeverage} onChange={(event) => setMarginLeverage(event.target.value)}><option>2</option><option>3</option><option>5</option><option>10</option></select></label>
          </div>
          <label className="telegram-mini-amount">EVM wallet for current vault rails<input value={evmWallet} onChange={(event) => setEvmWallet(event.target.value)} placeholder="0x..." /></label>
          <label className="telegram-mini-amount">Chain<select value={chainId} onChange={(event) => setChainId(event.target.value)}>{evmChains.map((chain) => <option key={chain.id} value={chain.id}>{chain.label}</option>)}</select></label>
          <button className="telegram-mini-primary" type="button" disabled={saving || !selectedMarket || !activeProfile} onClick={requestMargin}>Request margin <BarChart3 size={15} /></button>
          <div className="telegram-mini-note">Today’s executable vault rails are EVM. TON margin is tracked separately until the TON vault contract is deployed.</div>
        </section>
      ) : null}

      {activeTab === "Vaults" ? (
        <section className="telegram-mini-panel telegram-mini-stack">
          <div className="telegram-mini-section-title">
            <Wallet size={18} />
            <div><span>TON vault</span><strong>{tonAddress ? shortAddress(tonAddress) : "Connect wallet"}</strong></div>
          </div>
          <div className="telegram-mini-wallet-card">
            <p>LPs can register TON liquidity from Telegram now. On-chain transfer opens once the Conviction TON vault contract is deployed and configured.</p>
            {tonAddress ? <button type="button" onClick={disconnectTonWallet}>Disconnect TON</button> : <button type="button" onClick={connectTonWallet}>Connect TON wallet</button>}
          </div>
          <div className="telegram-mini-form-grid">
            <label>Asset<select value={vaultAsset} onChange={(event) => setVaultAsset(event.target.value)}>{tonAssets.map((asset) => <option key={asset}>{asset}</option>)}</select></label>
            <label>Amount<input value={vaultAmount} onChange={(event) => setVaultAmount(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" /></label>
          </div>
          <button className="telegram-mini-primary" type="button" disabled={saving || !tonAddress || !activeProfile} onClick={requestTonVault}>Record liquidity intent <ShieldCheck size={15} /></button>
          <MiniFeature icon={<CheckCircle2 size={19} />} title="EVM vaults remain active" body="Use the full app for Base, Ethereum, and Arbitrum Sepolia vault deposits while TON vault custody is prepared." href="/vaults" cta="Open full vaults" />
        </section>
      ) : null}

      {activeTab === "Wallet" ? (
        <section className="telegram-mini-panel telegram-mini-stack">
          <MiniFeature icon={<Wallet size={19} />} title="TON wallet" body={tonAddress ? shortAddress(tonAddress) : "Connect Tonkeeper, MyTonWallet, Telegram Wallet, or another TON Connect wallet."} href="/portfolio" cta="Open portfolio" />
          <button className="telegram-mini-primary" type="button" onClick={tonAddress ? disconnectTonWallet : connectTonWallet}>{tonAddress ? "Disconnect TON" : "Connect TON wallet"}</button>
          <MiniFeature icon={<BellRing size={19} />} title="Support" body="Use /ai in the community group or open a support ticket if you need human help." href="/support" cta="Open support" />
        </section>
      ) : null}
    </main>
  );
}

function PulseEventCard({ event }: { event: SocialTimelineEvent }) {
  const title = event.post?.body ?? event.signal?.signal.thesis ?? event.position?.market?.title ?? event.follow?.following.handle ?? "Pulse update";
  const actor = event.actor.handle ?? event.actor.displayName ?? event.actor.username ?? "trader.viction";
  const market = event.signal?.market?.title ?? event.position?.market?.title ?? null;
  return (
    <article className="telegram-mini-pulse-card">
      <div><strong>{actor}</strong><span>{event.type.toLowerCase().replace("_", " ")}</span></div>
      <p>{title}</p>
      {market ? <small>{market}</small> : null}
    </article>
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

function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  initDataUnsafe?: { user?: TelegramUser };
};

function telegramName(user: TelegramUser | null) {
  if (!user) return null;
  if (user.username) return "@" + user.username;
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
}

function cleanHandle(value: string) {
  return value.toLowerCase().replace(/\.viction$/i, "").replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

function patchTelegramWalletLinkOpening() {
  if (typeof window === "undefined") return;

  const windowWithPatch = window as Window & {
    __convictionTonWindowOpenPatched?: boolean;
    __convictionOriginalWindowOpen?: typeof window.open;
  };

  if (windowWithPatch.__convictionTonWindowOpenPatched) return;

  const telegram = getTelegramWebApp();
  if (!telegram?.openLink && !telegram?.openTelegramLink) return;

  const originalOpen = window.open.bind(window);
  windowWithPatch.__convictionOriginalWindowOpen = originalOpen;
  windowWithPatch.__convictionTonWindowOpenPatched = true;

  window.open = function patchedTelegramWindowOpen(url?: string | URL, target?: string, features?: string): WindowProxy | null {
    if (url) {
      try {
        const href = new URL(url.toString(), window.location.href);
        if (href.protocol === "https:" && href.hostname === "t.me" && telegram.openTelegramLink) {
          telegram.openTelegramLink(href.toString());
          return null;
        }
        if (href.protocol === "https:" && href.hostname !== window.location.hostname && telegram.openLink) {
          telegram.openLink(href.toString(), { try_instant_view: false });
          return null;
        }
      } catch {
        // Fall back to the browser implementation for non-URL inputs.
      }
    }

    return originalOpen(url, target, features);
  };
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
