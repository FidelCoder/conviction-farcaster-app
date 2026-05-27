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
  height: 800,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  try {
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

      return renderCard({
        eyebrow: signalStatusLabel(),
        title: signal.side + " signal",
        body: signal.thesis,
        muted: [
          market?.title ?? "Market " + signal.marketId,
          trader?.handle ? "Trader " + trader.handle : "Trader " + signal.traderProfileId,
          "Created " + formatDate(signal.createdAt),
        ].join(" | "),
        accent: signal.side === "YES" ? "#126149" : "#7b4d12",
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
      title: "Real prediction-market signals",
      body: "Share signals and copy intents backed by core API records.",
      muted: "No fake markets, positions, PnL, or execution claims.",
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
}) {
  const accent = options.accent ?? "#126149";
  const cacheSeconds = options.cacheSeconds ?? 300;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#f7f7f2",
          color: "#20201d",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, Arial, sans-serif",
          height: "100%",
          justifyContent: "space-between",
          padding: 72,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          <div
            style={{
              color: accent,
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 0,
              textTransform: "uppercase",
            }}
          >
            {options.eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 82,
              fontWeight: 800,
              lineHeight: 1.02,
              maxWidth: 980,
            }}
          >
            {options.title}
          </div>
          <div
            style={{
              color: "#48483f",
              display: "flex",
              fontSize: 42,
              lineHeight: 1.25,
              maxWidth: 980,
            }}
          >
            {truncate(options.body, 170)}
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            borderTop: "3px solid #deded4",
            color: "#5d5d52",
            display: "flex",
            fontSize: 30,
            gap: 20,
            justifyContent: "space-between",
            paddingTop: 30,
            width: "100%",
          }}
        >
          <span>Conviction Markets</span>
          <span>{truncate(options.muted, 118)}</span>
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
