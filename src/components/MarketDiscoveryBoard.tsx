"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import type { Market } from "../lib/core-api";
import {
  type DiscoveryRegion,
  type DiscoveryScope,
  type DiscoveryTopic,
  getMarketDiscoveryLabel,
  getRegionLabel,
  getTopicLabel,
  marketMatchesDiscoveryFilters,
} from "../lib/market-discovery";
import {
  formatMarketPrice,
  getMarketBoardStats,
  getMarketDisplayCase,
  getMarketPrice,
  sortMarketsForConvictionBoard,
} from "../lib/market-display";
import { EmptyState } from "./EmptyState";
import { SharePredictionActions } from "./SharePredictionActions";

const REGION_OPTIONS: DiscoveryRegion[] = [
  "ALL",
  "GLOBAL",
  "US",
  "AFRICA",
  "ASIA",
  "EUROPE",
  "LATAM",
  "MIDDLE_EAST",
  "CRYPTO_NATIVE",
];
const TOPIC_OPTIONS: DiscoveryTopic[] = [
  "ALL",
  "CRYPTO",
  "SPORTS",
  "POLITICS",
  "CULTURE",
  "TECH",
  "ECONOMICS",
  "WORLD",
];
const SCOPE_OPTIONS: Array<{ label: string; value: DiscoveryScope }> = [
  { label: "All markets", value: "ALL" },
  { label: "Global", value: "GLOBAL" },
  { label: "Local", value: "LOCAL" },
];

type MarketDiscoveryBoardProps = {
  markets: Market[];
};

export function MarketDiscoveryBoard({ markets }: MarketDiscoveryBoardProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<DiscoveryScope>("ALL");
  const [region, setRegion] = useState<DiscoveryRegion>("ALL");
  const [topic, setTopic] = useState<DiscoveryTopic>("ALL");
  const rankedMarkets = useMemo(() => sortMarketsForConvictionBoard(markets), [markets]);
  const boardStats = useMemo(() => getMarketBoardStats(markets), [markets]);
  const categories = useMemo(() => getMarketCategories(rankedMarkets), [rankedMarkets]);
  const filteredMarkets = useMemo(
    () =>
      rankedMarkets.filter((market) =>
        marketMatchesDiscoveryFilters(market, {
          query,
          region,
          scope,
          topic,
        }),
      ),
    [query, rankedMarkets, region, scope, topic],
  );
  const spotlightMarkets = filteredMarkets.slice(0, 4);
  const visibleMarkets = filteredMarkets.slice(0, 24);

  return (
    <main className="markets-browse-shell">
      <section className="markets-browse-toolbar" aria-label="Market navigation">
        <div className="browse-brand-lockup">
          <Link className="browse-brand" href="/">
            Conviction
          </Link>
          <nav aria-label="Primary market navigation">
            <Link aria-current="page" href="/markets">
              Markets
            </Link>
            <Link href="/margin">Margin</Link>
            <Link href="/social">Social</Link>
            <Link href="/me">Portfolio</Link>
          </nav>
        </div>

        <label className="browse-search" htmlFor="market-search">
          <span aria-hidden="true" className="search-icon" />
          <input
            id="market-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search markets, regions, themes"
            type="search"
            value={query}
          />
        </label>

        <Link className="browse-open-margin" href="/margin">
          Open margin
        </Link>
      </section>

      <nav className="browse-category-strip" aria-label="Market categories">
        <button className="category-all" onClick={() => setTopic("ALL")} type="button">
          Trending
        </button>
        {categories.slice(0, 9).map((category) => (
          <button key={category} onClick={() => setQuery(category)} type="button">
            {category}
          </button>
        ))}
      </nav>

      <section className="markets-browse-header" aria-labelledby="markets-title">
        <div>
          <p className="eyebrow">Browse markets</p>
          <h1 id="markets-title">Prediction markets with a point of view.</h1>
        </div>
        <dl className="browse-stat-strip" aria-label="Market board composition">
          <div>
            <dt>Shown</dt>
            <dd>{filteredMarkets.length}</dd>
          </div>
          <div>
            <dt>Priced</dt>
            <dd>{boardStats.priced}</dd>
          </div>
          <div>
            <dt>YES/NO</dt>
            <dd>{boardStats.mapped}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{boardStats.total}</dd>
          </div>
        </dl>
      </section>

      <section className="discovery-preferences-panel" aria-label="Discovery preferences">
        <div className="discovery-preferences-copy">
          <span>Market lens</span>
          <strong>Choose what feels close, global, or worth debating.</strong>
        </div>
        <div className="preference-grid">
          <label className="preference-field">
            <span>Scope</span>
            <select onChange={(event) => setScope(event.target.value as DiscoveryScope)} value={scope}>
              {SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="preference-field">
            <span>Region</span>
            <select
              onChange={(event) => setRegion(event.target.value as DiscoveryRegion)}
              value={region}
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getRegionLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="preference-field">
            <span>Topic</span>
            <select onChange={(event) => setTopic(event.target.value as DiscoveryTopic)} value={topic}>
              {TOPIC_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getTopicLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {spotlightMarkets.length > 0 ? (
        <section className="market-spotlight-row" aria-label="Market spotlight">
          {spotlightMarkets.map((market) => (
            <SpotlightMarket key={market.id} market={market} />
          ))}
        </section>
      ) : null}

      {visibleMarkets.length > 0 ? (
        <section className="prediction-card-grid" aria-label="Prediction markets">
          {visibleMarkets.map((market) => (
            <PredictionMarketCard key={market.id} market={market} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No markets match"
          body="Adjust the region, topic, or search term. The app only filters real markets returned by core."
        />
      )}
    </main>
  );
}

function SpotlightMarket({ market }: { market: Market }) {
  const probability = getMarketProbability(market);
  const noProbability = probability === null ? null : Math.max(0, 1 - probability);

  return (
    <Link className="spotlight-market" href={"/markets/" + market.id}>
      <span>{getMarketDiscoveryLabel(market)}</span>
      <strong>{market.title}</strong>
      <div className="spotlight-outcomes">
        <OutcomePill label="YES" probability={probability} />
        <OutcomePill label="NO" probability={noProbability} />
      </div>
    </Link>
  );
}

function PredictionMarketCard({ market }: { market: Market }) {
  const displayCase = getMarketDisplayCase(market);
  const yesPrice = displayCase.price ?? "--";
  const noPrice = getNoPrice(market) ?? "--";
  const probability = getMarketProbability(market);
  const noProbability = probability === null ? null : Math.max(0, 1 - probability);
  const category = market.category?.trim() || market.source;
  const resolution = displayCase.resolutionLabel ?? "Close date pending";

  return (
    <article className="prediction-market-card">
      <Link className="prediction-card-link" href={"/markets/" + market.id}>
        <div className="prediction-card-topline">
          <span className="market-avatar" aria-hidden="true">
            {getCategoryInitial(category)}
          </span>
          <span className="market-card-category">{category}</span>
          <span className="market-card-status">{displayCase.label}</span>
        </div>

        <h2>{market.title}</h2>
        <p className="market-card-resolution">{resolution}</p>

        <div className="outcome-stack" aria-label="Outcome prices">
          <OutcomeRow
            color="yes"
            label="YES"
            name={getOutcomeLabel(market, "YES")}
            probability={probability}
            price={yesPrice}
          />
          <OutcomeRow
            color="no"
            label="NO"
            name={getOutcomeLabel(market, "NO")}
            probability={noProbability}
            price={noPrice}
          />
        </div>

        <footer className="prediction-card-footer">
          <span>{getMarketDiscoveryLabel(market)}</span>
          <span>{market.yesTokenId && market.noTokenId ? "YES/NO mapped" : "Mapping pending"}</span>
        </footer>
      </Link>
      <SharePredictionActions
        className="prediction-card-social"
        context={getMarketDiscoveryLabel(market)}
        path={"/markets/" + market.id}
        title={market.title}
      />
    </article>
  );
}

function OutcomeRow({
  color,
  label,
  name,
  price,
  probability,
}: {
  color: "yes" | "no";
  label: string;
  name: string;
  price: string;
  probability: number | null;
}) {
  return (
    <div className={"outcome-row " + color}>
      <div className="outcome-identity">
        <span>{label}</span>
        <strong>{name}</strong>
      </div>
      <span className="outcome-line" style={getOutcomeLineStyle(probability)} />
      <strong className="outcome-price">{price}</strong>
    </div>
  );
}

function OutcomePill({ label, probability }: { label: "YES" | "NO"; probability: number | null }) {
  return (
    <span className={"spotlight-outcome " + label.toLowerCase()}>
      {label} {probability === null ? "--" : Math.round(probability * 100) + "%"}
    </span>
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

  return Array.from(categories).sort((left, right) => left.localeCompare(right));
}

function getMarketProbability(market: Market) {
  const price = getMarketPrice(market);
  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > 1) {
    return null;
  }

  return numericPrice;
}

function getNoPrice(market: Market) {
  const probability = getMarketProbability(market);

  if (probability === null) {
    return null;
  }

  return formatMarketPrice(String(1 - probability));
}

function getOutcomeLineStyle(probability: number | null) {
  const width = probability === null ? "18%" : Math.max(8, Math.min(92, probability * 100)) + "%";

  return { "--outcome-width": width } as CSSProperties;
}

function getOutcomeLabel(market: Market, side: "YES" | "NO") {
  if (side === "YES") {
    return trimMarketTitle(market.title);
  }

  return "Not " + trimMarketTitle(market.title);
}

function trimMarketTitle(title: string) {
  const compact = title
    .replace(/^Will\s+/i, "")
    .replace(/\?$/, "")
    .trim();

  return compact.length > 34 ? compact.slice(0, 31).trimEnd() + "..." : compact;
}

function getCategoryInitial(category: string) {
  return (
    category
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 1)
      .toUpperCase() || "C"
  );
}
