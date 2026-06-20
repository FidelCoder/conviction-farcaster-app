import { ImageResponse } from "next/og";

import {
  getMarket,
  getPosition,
  getSignal,
  getTraderProfile,
  listPositionCopyIntents,
} from "../../../lib/core-api";
import { executionStatusLabel, formatDate, signalStatusLabel } from "../../../lib/display";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const CARD_SIZE = {
  width: 1200,
  height: 630,
};

const LOGO_URL = "https://convictionmarkets.xyz/logo/conviction-markets-header.png";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  try {
    if (type === "market" && id) {
      const market = await getMarket(id);

      if (!market) {
        return renderCard({
          eyebrow: "Market",
          title: "Market not found",
          body: "The core API did not return a market for this share URL.",
          muted: id,
          cacheSeconds: 0,
        });
      }

      const yes = formatProbability(market.lastTradePrice ?? market.bestBid ?? market.bestAsk);
      const no = yes ? formatPercent(100 - yes) : "--";
      const volume = formatCurrencyLike(
        market.volume24hr ?? market.providerMetadata?.volume24hr ?? market.providerMetadata?.totalVolume,
      );
      const tags = [
        market.providerMetadata?.primaryTag ?? market.category ?? "Prediction Market",
        market.providerMetadata?.tagLabels?.[0] ?? null,
        market.resolutionDate ? "Resolves " + formatDate(market.resolutionDate) : null,
      ].filter(Boolean).join(" | ");

      return renderCard({
        eyebrow: market.category ?? "Prediction Market",
        title: market.title,
        body: summarizeMarketBody(market.description),
        muted: tags,
        accent: "#ff6b12",
        stats: [
          { label: "YES", value: yes ? formatPercent(yes) : "--" },
          { label: "NO", value: no },
          { label: "24H VOL", value: volume },
        ],
      });
    }

    if (type === "signal" && id) {
      const signal = await getSignal(id);

      if (!signal) {
        return renderCard({
          eyebrow: signalStatusLabel(),
          title: "Signal not found",
          body: "The core API did not return a signal for this share URL.",
          muted: id,
          cacheSeconds: 0,
        });
      }

      const [market, trader] = await Promise.all([
        getMarket(signal.marketId),
        getTraderProfile(signal.traderProfileId),
      ]);

      const yes = market ? formatProbability(market.lastTradePrice ?? market.bestBid ?? market.bestAsk) : null;
      const marketTitle = market?.title ?? "Market " + signal.marketId;
      const category = market?.providerMetadata?.primaryTag ?? market?.category ?? "Prediction Market";

      return renderCard({
        eyebrow: "Market call",
        title: marketTitle,
        body: [
          trader?.handle ? "Posted by " + trader.handle : "Public Conviction post",
          signal.side + " call",
          "Review live odds and event rules before opening margin.",
        ].join(" | "),
        muted: [
          category,
          market?.resolutionDate ? "Resolves " + formatDate(market.resolutionDate) : null,
          "Created " + formatDate(signal.createdAt),
        ].filter(Boolean).join(" | "),
        accent: signal.side === "YES" ? "#10b981" : "#ef4444",
        stats: [
          { label: "CALL", value: signal.side },
          { label: "MARKET YES", value: yes ? formatPercent(yes) : "--" },
          { label: "CATEGORY", value: category },
        ],
      });
    }

    if (type === "leaderboard") {
      return renderCard({
        eyebrow: "Leaderboard",
        title: "Real trader activity",
        body: "Ranks come from signals and copy intents stored by the core API.",
        muted: "No fake win rate, PnL, balances, or execution claims.",
        accent: "#276f86",
      });
    }

    if (type === "position" && id) {
      const position = await getPosition(id);

      if (!position) {
        return renderCard({
          eyebrow: "Position",
          title: "Position not found",
          body: "The core API did not return a position for this share URL.",
          muted: id,
          cacheSeconds: 0,
        });
      }

      const [copyIntents, market] = await Promise.all([
        listPositionCopyIntents(position.id),
        getMarket(position.marketId),
      ]);

      return renderCard({
        eyebrow: executionStatusLabel(position.status),
        title: position.side + " position intent",
        body: market?.title ?? "Market " + position.marketId,
        muted: [
          position.quantity + " shares",
          copyIntents.length + " real copy " + (copyIntents.length === 1 ? "intent" : "intents"),
          "Created " + formatDate(position.createdAt),
        ].join(" | "),
        accent: position.status === "EXECUTED" ? "#126149" : "#7b4d12",
      });
    }

    return renderCard({
      eyebrow: "Conviction Markets",
      title: "Leveraged prediction markets",
      body: "Trade event markets with vault-backed margin and share market theses with the Conviction network.",
      muted: "Prediction markets | Margin | Vault liquidity",
    });
  } catch {
    return renderCard({
      eyebrow: "Conviction Markets",
      title: "Core API unavailable",
      body: "This card only renders real records returned by the core API.",
      muted: "Try again after the API is reachable.",
      cacheSeconds: 0,
    });
  }
}

function renderCard(options: {
  eyebrow: string;
  title: string;
  body: string;
  muted: string;
  accent?: string;
  cacheSeconds?: number;
  stats?: Array<{ label: string; value: string }>;
}) {
  const accent = options.accent ?? "#ff6b12";
  const cacheSeconds = options.cacheSeconds ?? 300;
  const stats = options.stats ?? [
    { label: "MARKET", value: "LIVE" },
    { label: "MODE", value: "MARGIN" },
    { label: "NETWORK", value: "PULSE" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          background: "#090909",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, Arial, sans-serif",
          height: "100%",
          overflow: "hidden",
          padding: 54,
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(255,107,18,0.28), rgba(124,58,237,0.18) 55%, rgba(16,185,129,0.12))",
            display: "flex",
            height: "100%",
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
            width: "100%",
          }}
        />
        <div
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            display: "flex",
            height: "100%",
            bottom: 0,
            left: 0,
            opacity: 0.7,
            position: "absolute",
            right: 0,
            top: 0,
            width: "100%",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", width: "100%" }}>
          <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
            <div
              style={{
                alignItems: "center",
                background: "rgba(9,9,9,0.72)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 18,
                display: "flex",
                height: 68,
                justifyContent: "center",
                padding: "10px 14px",
                width: 330,
              }}
            >
              <img alt="Conviction Markets" height="48" src={LOGO_URL} style={{ objectFit: "contain", width: "100%" }} width="300" />
            </div>
          </div>
          <div
            style={{
              border: "2px solid rgba(255,107,18,0.55)",
              borderRadius: 999,
              color: accent,
              display: "flex",
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 1.5,
              padding: "14px 20px",
              textTransform: "uppercase",
            }}
          >
            {truncate(options.eyebrow, 34)}
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", position: "relative" }}>
          <div
            style={{
              color: "#ffffff",
              display: "flex",
              fontSize: titleFontSize(options.title),
              fontWeight: 900,
              lineHeight: 1.02,
              maxWidth: 1010,
            }}
          >
            {truncate(options.title, 112)}
          </div>
          <div
            style={{
              color: "#d8d1e2",
              display: "flex",
              fontSize: 27,
              lineHeight: 1.28,
              marginTop: 24,
              maxWidth: 980,
            }}
          >
            {truncate(options.body, 132)}
          </div>
        </div>
        <div style={{ alignItems: "stretch", display: "flex", gap: 16, position: "relative", width: "100%" }}>
          {stats.slice(0, 3).map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "rgba(9,9,9,0.82)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 16,
                display: "flex",
                flex: 1,
                flexDirection: "column",
                padding: "18px 20px",
              }}
            >
              <span style={{ color: "#9a8fa9", fontSize: 17, fontWeight: 900, letterSpacing: 1.6 }}>{stat.label}</span>
              <span style={{ color: stat.label === "NO" ? "#ff4d4d" : accent, fontSize: 32, fontWeight: 900, marginTop: 8 }}>{truncate(stat.value, 18)}</span>
            </div>
          ))}
        </div>
        <div
          style={{
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.14)",
            color: "#b8aec7",
            display: "flex",
            fontSize: 21,
            fontWeight: 700,
            justifyContent: "space-between",
            marginTop: 26,
            paddingTop: 20,
            position: "relative",
            width: "100%",
          }}
        >
          <span>convictionmarkets.xyz</span>
          <span>{truncate(options.muted, 86)}</span>
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      headers: {
        "Cache-Control":
          cacheSeconds > 0
            ? "public, no-transform, max-age=" + cacheSeconds + ", stale-while-revalidate=300"
            : "no-store",
      },
    },
  );
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 1) + "...";
}

function summarizeMarketBody(value: string | null) {
  if (!value) return "Review the event rules, odds, and social signals before opening a margin request.";

  return value.replace(/\s+/g, " ").trim();
}

function formatProbability(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return parsed <= 1 ? parsed * 100 : parsed;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(value < 10 ? 1 : 0) + "%";
}

function formatCurrencyLike(value: string | null | undefined) {
  if (!value) return "--";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "--";
  if (parsed >= 1_000_000) return "$" + (parsed / 1_000_000).toFixed(1) + "M";
  if (parsed >= 1_000) return "$" + (parsed / 1_000).toFixed(1) + "K";
  return "$" + parsed.toFixed(0);
}

function titleFontSize(value: string) {
  if (value.length > 100) return 50;
  if (value.length > 80) return 58;
  if (value.length > 62) return 66;
  return 78;
}
