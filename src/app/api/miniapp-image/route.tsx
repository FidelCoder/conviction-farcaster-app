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
        accent: "#d95b13",
        imageUrl: normalizeImageUrl(market.providerMetadata?.imageUrl ?? market.providerMetadata?.iconUrl),
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
        imageUrl: normalizeImageUrl(market?.providerMetadata?.imageUrl ?? market?.providerMetadata?.iconUrl),
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
  imageUrl?: string | null;
  stats?: Array<{ label: string; value: string }>;
}) {
  const accent = options.accent ?? "#d95b13";
  const cacheSeconds = options.cacheSeconds ?? 300;
  const stats = options.stats ?? [
    { label: "MARKET", value: "LIVE" },
    { label: "MODE", value: "MARGIN" },
    { label: "NETWORK", value: "PULSE" },
  ];
  const imageUrl = normalizeImageUrl(options.imageUrl);

  return new ImageResponse(
    (
      <div
        style={{
          background: "#070707",
          color: "#ffffff",
          display: "flex",
          fontFamily: "Inter, Arial, sans-serif",
          height: "100%",
          overflow: "hidden",
          padding: 42,
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 78% 12%, rgba(217,91,19,0.22), transparent 32%), radial-gradient(circle at 8% 96%, rgba(124,58,237,0.20), transparent 34%), linear-gradient(135deg, #090909 0%, #111111 54%, #080808 100%)",
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
              "linear-gradient(rgba(255,255,255,0.052) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.052) 1px, transparent 1px)",
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
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 28,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            position: "relative",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "rgba(9,9,9,0.88)",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              justifyContent: "space-between",
              padding: "22px 28px",
              width: "100%",
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
              <img alt="Conviction Markets" height="36" src={LOGO_URL} style={{ objectFit: "contain" }} width="248" />
            </div>
            <div
              style={{
                border: "1px solid rgba(217,91,19,0.55)",
                borderRadius: 999,
                color: accent,
                display: "flex",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 1.5,
                padding: "11px 16px",
                textTransform: "uppercase",
              }}
            >
              {truncate(options.eyebrow, 34)}
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, minHeight: 0, width: "100%" }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "34px 34px 28px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    color: "#ffffff",
                    display: "flex",
                    fontSize: titleFontSize(options.title, Boolean(imageUrl)),
                    fontWeight: 900,
                    lineHeight: 1.02,
                    maxWidth: imageUrl ? 660 : 1030,
                  }}
                >
                  {truncate(options.title, imageUrl ? 94 : 112)}
                </div>
                <div
                  style={{
                    color: "#d8d1e2",
                    display: "flex",
                    fontSize: imageUrl ? 23 : 27,
                    lineHeight: 1.28,
                    marginTop: 20,
                    maxWidth: imageUrl ? 640 : 980,
                  }}
                >
                  {truncate(options.body, imageUrl ? 118 : 132)}
                </div>
              </div>

              <div style={{ alignItems: "stretch", display: "flex", gap: 14, width: "100%" }}>
                {stats.slice(0, 3).map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: "rgba(5,5,5,0.88)",
                      border: "1px solid rgba(255,255,255,0.13)",
                      borderRadius: 15,
                      display: "flex",
                      flex: 1,
                      flexDirection: "column",
                      minWidth: 0,
                      padding: "15px 17px",
                    }}
                  >
                    <span style={{ color: "#9a8fa9", fontSize: 15, fontWeight: 900, letterSpacing: 1.4 }}>{stat.label}</span>
                    <span style={{ color: stat.label === "NO" ? "#ff4d4d" : accent, fontSize: 30, fontWeight: 900, marginTop: 7 }}>{truncate(stat.value, 16)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                borderLeft: "1px solid rgba(255,255,255,0.12)",
                display: "flex",
                flexDirection: "column",
                padding: 20,
                width: imageUrl ? 384 : 280,
              }}
            >
              <div
                style={{
                  background: "rgba(5,5,5,0.7)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 22,
                  display: "flex",
                  flex: 1,
                  overflow: "hidden",
                  position: "relative",
                  width: "100%",
                }}
              >
                {imageUrl ? (
                  <img
                    alt="Market listing"
                    src={imageUrl}
                    style={{
                      height: "100%",
                      objectFit: "cover",
                      width: "100%",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      alignItems: "center",
                      background: "linear-gradient(145deg, rgba(217,91,19,0.30), rgba(124,58,237,0.22))",
                      display: "flex",
                      flex: 1,
                      fontSize: 92,
                      fontWeight: 900,
                      justifyContent: "center",
                    }}
                  >
                    CM
                  </div>
                )}
                <div
                  style={{
                    background: "linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.76))",
                    bottom: 0,
                    display: "flex",
                    height: "100%",
                    left: 0,
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: "100%",
                  }}
                />
                <div
                  style={{
                    bottom: 18,
                    color: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    left: 18,
                    position: "absolute",
                    right: 18,
                  }}
                >
                  <span style={{ color: accent, fontSize: 17, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase" }}>Market card</span>
                  <span style={{ color: "#d8d1e2", fontSize: 18, fontWeight: 700, marginTop: 5 }}>Open the event, read rules, then trade conviction.</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              alignItems: "center",
              background: "rgba(9,9,9,0.88)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              color: "#b8aec7",
              display: "flex",
              fontSize: 20,
              fontWeight: 800,
              justifyContent: "space-between",
              padding: "18px 28px",
              width: "100%",
            }}
          >
            <span>convictionmarkets.xyz</span>
            <span>{truncate(options.muted, 78)}</span>
          </div>
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

function normalizeImageUrl(value: string | null | undefined) {
  const clean = value?.trim();

  return clean && /^https?:\/\//i.test(clean) ? clean : null;
}

function titleFontSize(value: string, hasImage = false) {
  if (hasImage) {
    if (value.length > 92) return 43;
    if (value.length > 74) return 48;
    if (value.length > 58) return 54;
    return 62;
  }

  if (value.length > 100) return 50;
  if (value.length > 80) return 58;
  if (value.length > 62) return 66;
  return 78;
}
