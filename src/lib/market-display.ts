import type { Market } from "./core-api";
import { formatDate } from "./display";

export type MarketDisplayCase = {
  boardFitScore: number;
  label: string;
  price: string | null;
  reasons: string[];
  resolutionLabel: string | null;
};

export type MarketBoardStats = {
  total: number;
  active: number;
  qualified: number;
  priced: number;
  mapped: number;
};

export function getMarketDisplayCase(market: Market): MarketDisplayCase {
  const active = isActiveMarket(market);
  const mapped = Boolean(market.yesTokenId && market.noTokenId);
  const price = getMarketPrice(market);
  const hasResolution = Boolean(market.resolutionDate);
  const hasSource = Boolean(market.externalUrl);
  const reasons = [
    active ? "Active" : market.status,
    mapped ? "YES/NO mapped" : "Mapping pending",
    price ? "Live price stored" : "No price snapshot",
    hasResolution ? "Resolution dated" : "Resolution pending",
  ];
  const score =
    (active ? 34 : 0) +
    (mapped ? 26 : 0) +
    (price ? 24 : 0) +
    (hasResolution ? 10 : 0) +
    (hasSource ? 6 : 0);

  return {
    boardFitScore: score,
    label: getBoardFitLabel(score, active),
    price: price ? formatMarketPrice(price) : null,
    reasons,
    resolutionLabel: market.resolutionDate ? formatDate(market.resolutionDate) : null,
  };
}

export function sortMarketsForConvictionBoard(markets: Market[]) {
  return [...markets].sort((left, right) => {
    const leftCase = getMarketDisplayCase(left);
    const rightCase = getMarketDisplayCase(right);

    if (leftCase.boardFitScore !== rightCase.boardFitScore) {
      return rightCase.boardFitScore - leftCase.boardFitScore;
    }

    const leftDate = left.resolutionDate ? new Date(left.resolutionDate).getTime() : Infinity;
    const rightDate = right.resolutionDate ? new Date(right.resolutionDate).getTime() : Infinity;

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return left.title.localeCompare(right.title);
  });
}

export function getMarketBoardStats(markets: Market[]): MarketBoardStats {
  return markets.reduce(
    (stats, market) => {
      const displayCase = getMarketDisplayCase(market);

      stats.total += 1;
      stats.active += isActiveMarket(market) ? 1 : 0;
      stats.qualified += displayCase.boardFitScore >= 70 ? 1 : 0;
      stats.priced += displayCase.price ? 1 : 0;
      stats.mapped += market.yesTokenId && market.noTokenId ? 1 : 0;

      return stats;
    },
    { total: 0, active: 0, qualified: 0, priced: 0, mapped: 0 },
  );
}

export function getMarketPrice(market: Market) {
  return market.lastTradePrice ?? market.bestAsk ?? market.bestBid ?? null;
}

export function formatMarketPrice(value: string) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 1) {
    return Math.round(numericValue * 100) + "c";
  }

  return value;
}

export function getSourceInitials(source: string) {
  const compact = source.replace(/[^a-z0-9]/gi, "").toUpperCase();

  return compact.slice(0, 2) || "CM";
}

function isActiveMarket(market: Market) {
  return market.status.toLowerCase() === "active";
}

function getBoardFitLabel(score: number, active: boolean) {
  if (!active) {
    return "Watching";
  }

  if (score >= 90) {
    return "Prime board";
  }

  if (score >= 70) {
    return "Qualified";
  }

  return "Needs data";
}
