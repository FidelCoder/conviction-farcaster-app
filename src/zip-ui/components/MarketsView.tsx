import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  Bitcoin,
  Building2,
  Cpu,
  Filter,
  Flame,
  Gamepad2,
  Globe2,
  Grid2X2,
  Landmark,
  Search,
  Sparkles,
  Trophy,
  TrendingUp,
  X,
} from "lucide-react";

import type { PredictionMarket } from "../types";

interface MarketsViewProps {
  markets: PredictionMarket[];
  onOpenMargin: (market: PredictionMarket) => void;
  onRequireWallet?: () => void;
  walletConnected?: boolean;
}

type SortOrder =
  | "balanced"
  | "trending"
  | "relevance"
  | "conviction"
  | "odds"
  | "volume"
  | "latest";

type TopicTab = {
  icon: ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string;
};

const TOPIC_TABS: TopicTab[] = [
  { icon: Grid2X2, label: "All", value: "All" },
  { icon: Landmark, label: "Politics", value: "Politics" },
  { icon: Bitcoin, label: "Crypto", value: "Crypto" },
  { icon: Trophy, label: "Sports", value: "Sports" },
  { icon: TrendingUp, label: "Finance", value: "Finance" },
  { icon: Cpu, label: "Tech", value: "Tech" },
  { icon: Gamepad2, label: "Esports", value: "Esports" },
  { icon: Globe2, label: "Geo", value: "Geopolitics" },
];

const FEATURED_TOPICS = [
  "All",
  "Trending",
  "African Football",
  "World Cup",
  "Football",
  "Sports",
  "Cricket",
  "Rugby",
  "Breaking",
  "Politics",
  "Crypto",
  "Esports",
  "Iran",
  "Finance",
  "Geopolitics",
  "Tech",
  "Culture",
  "Economy",
  "Weather",
  "Mentions",
  "Elections",
];

const FEATURED_REGIONS = [
  "All",
  "Global",
  "Africa",
  "Asia",
  "Europe",
  "Latin America",
  "Middle East",
  "United States",
  "Crypto-native",
];

const AUTO_LOAD_BATCH_SIZE = 18;
const CONNECTED_INITIAL_LIMIT = 36;
const GUEST_MARKET_LIMIT = 12;
const ROTATION_WINDOW_MS = 10 * 60 * 1000;

export default function MarketsView({
  markets,
  onOpenMargin,
  onRequireWallet,
  walletConnected = false,
}: MarketsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [rankingWindow, setRankingWindow] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(
    walletConnected ? CONNECTED_INITIAL_LIMIT : GUEST_MARKET_LIMIT,
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const activeMarkets = useMemo(
    () => markets.filter((market) => market.status === "LIVE"),
    [markets],
  );
  const categories = useMemo(
    () => buildOptions(activeMarkets.map((market) => market.category)),
    [activeMarkets],
  );
  const topicCounts = useMemo(() => buildTopicCounts(activeMarkets), [activeMarkets]);
  const regionCounts = useMemo(() => buildRegionCounts(activeMarkets), [activeMarkets]);
  const topics = useMemo(
    () => mergeFeaturedOptions(FEATURED_TOPICS, Array.from(topicCounts.keys())),
    [topicCounts],
  );
  const regions = useMemo(
    () => mergeFeaturedOptions(FEATURED_REGIONS, Array.from(regionCounts.keys())),
    [regionCounts],
  );

  useEffect(() => {
    const update = () => setRankingWindow(Math.floor(Date.now() / ROTATION_WINDOW_MS));

    update();
    const interval = window.setInterval(update, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTopic !== "All" && !topics.includes(selectedTopic)) {
      setSelectedTopic("All");
    }
  }, [selectedTopic, topics]);

  useEffect(() => {
    if (selectedRegion !== "All" && !regions.includes(selectedRegion)) {
      setSelectedRegion("All");
    }
  }, [selectedRegion, regions]);

  useEffect(() => {
    if (selectedCategory !== "All" && !categories.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [categories, selectedCategory]);

  const filteredMarkets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matching = activeMarkets
      .filter((market) => selectedCategory === "All" || market.category === selectedCategory)
      .filter((market) => marketMatchesTopic(market, selectedTopic))
      .filter((market) => {
        const region = market.discoveryRegion ?? inferMarketRegion(market);
        return selectedRegion === "All" || region === selectedRegion;
      })
      .filter((market) => {
        if (!query) return true;

        return [
          market.title,
          market.description,
          market.category,
          getMarketTopics(market).join(" "),
          market.discoveryRegion ?? inferMarketRegion(market),
          market.source,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });

    if (sortOrder === "trending") {
      return rankDynamicMarkets(matching, rankingWindow, selectedTopic, selectedRegion);
    }

    return [...matching].sort((left, right) => compareDynamicMarkets(left, right, sortOrder));
  }, [
    activeMarkets,
    rankingWindow,
    searchQuery,
    selectedCategory,
    selectedRegion,
    selectedTopic,
    sortOrder,
  ]);

  const featuredMarkets = useMemo(
    () => selectRotatingFeatured(filteredMarkets, rankingWindow),
    [filteredMarkets, rankingWindow],
  );
  const visibleMarkets = filteredMarkets.slice(0, visibleLimit);
  const hiddenMarketCount = Math.max(0, filteredMarkets.length - visibleMarkets.length);

  useEffect(() => {
    setVisibleLimit(walletConnected ? CONNECTED_INITIAL_LIMIT : GUEST_MARKET_LIMIT);
  }, [searchQuery, selectedCategory, selectedRegion, selectedTopic, sortOrder, walletConnected]);

  useEffect(() => {
    if (!walletConnected || hiddenMarketCount <= 0) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleLimit((current) =>
            Math.min(current + AUTO_LOAD_BATCH_SIZE, filteredMarkets.length),
          );
        }
      },
      { rootMargin: "900px 0px 900px 0px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [filteredMarkets.length, hiddenMarketCount, walletConnected]);

  function clearFilters() {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedRegion("All");
    setSelectedTopic("All");
    setSortOrder("trending");
  }

  function handleLoadMore() {
    if (!walletConnected) {
      onRequireWallet?.();
      return;
    }

    setVisibleLimit((current) => current + AUTO_LOAD_BATCH_SIZE);
  }

  return (
    <main className="min-h-[calc(100vh-64px)] flex-1 bg-[#080808] pb-32 text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7 lg:px-10">
        <nav
          aria-label="Market topics"
          className="flex gap-1 overflow-x-auto border-b border-[#232323] pb-5"
        >
          {TOPIC_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = selectedTopic === tab.value;
            const count = countTopicMatches(activeMarkets, tab.value);

            return (
              <button
                aria-pressed={active}
                className={cx(
                  "flex flex-shrink-0 items-center gap-2 rounded px-4 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-[#252525] text-white"
                    : "text-[#a9a3ae] hover:bg-[#151515] hover:text-white",
                )}
                key={tab.value}
                onClick={() => setSelectedTopic(tab.value)}
                type="button"
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                <span className="font-mono text-[10px] text-[#77717e]">{count}</span>
              </button>
            );
          })}
        </nav>

        {filteredMarkets.length === 0 ? (
          <EmptyMarkets onClear={clearFilters} />
        ) : (
          <>
            <section aria-labelledby="top-trades-title" className="py-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Flame className="text-deep-orange" size={16} />
                  <h1
                    className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#d7d0db]"
                    id="top-trades-title"
                  >
                    Top trades
                  </h1>
                </div>
                <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#827b88]">
                  <span className="h-1.5 w-1.5 rounded-full bg-market-green" />
                  Live ranking
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
                {featuredMarkets[0] ? (
                  <FeaturedMarketCard
                    market={featuredMarkets[0]}
                    onOpen={onOpenMargin}
                    priority
                    size="large"
                  />
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {featuredMarkets.slice(1, 3).map((market, index) => (
                    <FeaturedMarketCard
                      key={market.id}
                      market={market}
                      onOpen={onOpenMargin}
                      priority={index === 0}
                      size="compact"
                    />
                  ))}
                </div>
              </div>
            </section>

            <section aria-label="Market controls" className="border-b border-[#232323] pb-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 gap-1 overflow-x-auto rounded bg-[#111111] p-1">
                  {["All", ...FEATURED_REGIONS.slice(1, 8)].map((region) => {
                    const active = selectedRegion === region;
                    const count =
                      region === "All" ? activeMarkets.length : (regionCounts.get(region) ?? 0);

                    if (region !== "All" && count === 0) return null;

                    return (
                      <button
                        aria-pressed={active}
                        className={cx(
                          "flex flex-shrink-0 items-center gap-2 rounded px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors",
                          active
                            ? "bg-deep-orange text-black"
                            : "text-[#aaa3ae] hover:bg-[#1c1c1c] hover:text-white",
                        )}
                        key={region}
                        onClick={() => setSelectedRegion(region)}
                        type="button"
                      >
                        {region}
                        <span className={active ? "text-black/65" : "text-[#706a75]"}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_9rem_auto] xl:w-[38rem]">
                  <label className="flex items-center rounded border border-[#2b2b2b] bg-[#111111] px-4 py-2.5 focus-within:border-deep-orange">
                    <Search className="mr-3 text-[#938c98]" size={16} />
                    <input
                      className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-[#706a75]"
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search markets..."
                      value={searchQuery}
                    />
                  </label>

                  <label className="relative">
                    <span className="sr-only">Sort markets</span>
                    <select
                      className="h-full w-full appearance-none rounded border border-[#2b2b2b] bg-[#111111] px-3 py-2.5 text-sm font-semibold text-[#d8d2dc] outline-none hover:border-deep-orange"
                      onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                      value={sortOrder}
                    >
                      <option value="trending">Trending</option>
                      <option value="volume">Volume</option>
                      <option value="conviction">Conviction</option>
                      <option value="odds">YES chance</option>
                      <option value="latest">Latest</option>
                    </select>
                  </label>

                  <button
                    aria-expanded={showFilters}
                    className={cx(
                      "inline-flex items-center justify-center gap-2 rounded border px-4 py-2.5 text-sm font-semibold transition-colors",
                      showFilters
                        ? "border-deep-orange bg-deep-orange/10 text-deep-orange"
                        : "border-[#2b2b2b] bg-[#111111] text-[#d8d2dc] hover:border-deep-orange",
                    )}
                    onClick={() => setShowFilters((current) => !current)}
                    type="button"
                  >
                    <Filter size={15} />
                    Filter
                  </button>
                </div>
              </div>

              {showFilters ? (
                <div className="mt-3 grid gap-3 rounded border border-[#262626] bg-[#101010] p-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                  <MarketSelect
                    icon="filter"
                    label="Category"
                    onChange={setSelectedCategory}
                    options={categories}
                    value={selectedCategory}
                  />
                  <MarketSelect
                    icon="topic"
                    label="Topic"
                    onChange={setSelectedTopic}
                    options={topics}
                    value={selectedTopic}
                  />
                  <MarketSelect
                    icon="region"
                    label="Region"
                    onChange={setSelectedRegion}
                    options={regions}
                    value={selectedRegion}
                  />
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded border border-[#343434] px-4 py-2 text-xs font-bold uppercase text-[#b9b2bf] hover:border-white/50 hover:text-white"
                    onClick={clearFilters}
                    type="button"
                  >
                    <X size={14} />
                    Reset
                  </button>
                </div>
              ) : null}
            </section>

            <section aria-labelledby="market-list-title" className="pt-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2
                  className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#aaa3ae]"
                  id="market-list-title"
                >
                  {filteredMarkets.length} live markets
                </h2>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#6f6875]">
                  {visibleMarkets.length} shown
                </span>
              </div>

              <div
                aria-hidden="true"
                className="hidden grid-cols-[minmax(0,2.3fr)_minmax(8rem,.9fr)_minmax(8rem,.9fr)_minmax(7rem,.55fr)_10rem] gap-5 border-b border-[#272727] px-4 py-3 font-mono text-[9px] font-bold uppercase tracking-widest text-[#817a86] md:grid"
              >
                <span>Market</span>
                <span>Volume</span>
                <span>Conviction</span>
                <span className="text-right">Chance</span>
                <span className="text-center">Trade</span>
              </div>

              <div>
                {visibleMarkets.map((market) => (
                  <MarketTradeRow key={market.id} market={market} onOpen={onOpenMargin} />
                ))}
              </div>
            </section>
          </>
        )}

        {hiddenMarketCount > 0 ? (
          <div className="mt-9 flex justify-center">
            <div className="flex min-h-14 items-center justify-center" ref={loadMoreRef}>
              {walletConnected ? (
                <span className="rounded border border-[#262626] bg-[#111111] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#aaa3ae]">
                  Loading more markets...
                </span>
              ) : (
                <button
                  className="rounded border border-deep-orange/60 bg-deep-orange px-6 py-3 text-xs font-bold uppercase tracking-widest text-black hover:bg-white"
                  onClick={handleLoadMore}
                  type="button"
                >
                  Sign in to load more markets
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function FeaturedMarketCard({
  market,
  onOpen,
  priority,
  size,
}: {
  market: PredictionMarket;
  onOpen: (market: PredictionMarket) => void;
  priority: boolean;
  size: "large" | "compact";
}) {
  const topic = getPrimaryMarketTopic(market);
  const imageUrl = getMarketImageUrl(market);
  const chance = getYesCents(market);
  const large = size === "large";

  return (
    <article
      className={cx(
        "group relative overflow-hidden rounded border border-[#303030] bg-[#121212]",
        large ? "min-h-[21rem] sm:min-h-[24rem]" : "min-h-[10.5rem]",
      )}
    >
      {imageUrl ? (
        <Image
          alt=""
          className="object-cover opacity-80 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-90"
          fill
          priority={priority}
          quality={large ? 62 : 52}
          sizes={
            large
              ? "(max-width: 1024px) 100vw, 66vw"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 32vw"
          }
          src={imageUrl}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#151515]">
          <MarketTopicIcon className="text-white/10" size={large ? 112 : 72} topic={topic} />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
      <button
        aria-label={"Open " + market.title}
        className="absolute inset-0 z-10 cursor-pointer text-left"
        onClick={() => onOpen(market)}
        type="button"
      />

      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 bottom-0 z-20",
          large ? "p-5 sm:p-7" : "p-4",
        )}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-black/70 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-white">
            {topic}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-market-green/30 bg-market-green/10 px-2 py-1 font-mono text-[9px] font-bold uppercase text-market-green">
            <span className="h-1.5 w-1.5 rounded-full bg-market-green" />
            Live
          </span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2
              className={cx(
                "max-w-3xl font-bold leading-tight text-white",
                large ? "line-clamp-4 text-2xl sm:text-4xl" : "line-clamp-2 text-base",
              )}
            >
              {market.title}
            </h2>

            {large ? (
              <div className="mt-4">
                <span className="font-mono text-[9px] uppercase tracking-widest text-white/65">
                  YES probability
                </span>
                <strong className={cx("mt-1 block font-mono text-5xl", "text-deep-orange")}>
                  {formatChance(chance)}
                </strong>
              </div>
            ) : null}
          </div>

          <div className="flex-shrink-0 text-right">
            {!large ? (
              <strong className={cx("block font-mono text-3xl", "text-deep-orange")}>
                {formatChance(chance)}
              </strong>
            ) : (
              <span className="rounded border border-deep-orange/35 bg-black/65 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">
                {market.convictionIndex} conviction
              </span>
            )}
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-white/60">
              {large ? market.vol24h + " 24h" : "YES"}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function MarketTradeRow({
  market,
  onOpen,
}: {
  market: PredictionMarket;
  onOpen: (market: PredictionMarket) => void;
}) {
  const topic = getPrimaryMarketTopic(market);
  const region = market.discoveryRegion ?? inferMarketRegion(market);
  const chance = getYesCents(market);
  const noChance = 100 - chance;
  const change = formatPriceChange(market.oneDayPriceChange);
  const totalVolume = formatBoardCurrency(
    market.totalVolumeValue ?? market.volume24hValue ?? getVolumeScore(market),
  );
  const imageUrl = getMarketImageUrl(market);

  return (
    <article className="border-b border-[#202020] px-1 py-5 transition-colors hover:bg-[#0f0f0f] md:grid md:grid-cols-[minmax(0,2.3fr)_minmax(8rem,.9fr)_minmax(8rem,.9fr)_minmax(7rem,.55fr)_10rem] md:items-center md:gap-5 md:px-4 md:py-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-[#2a2a2a] bg-surface-container-low">
          {imageUrl ? (
            <Image alt="" className="object-cover" fill quality={45} sizes="40px" src={imageUrl} />
          ) : (
            <MarketTopicIcon className="text-deep-orange" size={18} topic={topic} />
          )}
        </span>

        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-widest text-[#827b87]">
            <span>{topic}</span>
            <span className="text-[#423d45]">/</span>
            <span>{region}</span>
            {isBreakingMarket(market) ? (
              <span className="inline-flex items-center gap-1 rounded bg-[#341408] px-1.5 py-0.5 text-deep-orange">
                <Flame size={9} />
                Hot
              </span>
            ) : null}
          </div>

          <button
            className="line-clamp-2 text-left text-sm font-semibold leading-snug text-white hover:text-deep-orange md:text-[15px]"
            onClick={() => onOpen(market)}
            type="button"
          >
            {market.title}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 md:mt-0 md:block">
        <div>
          <span className="block font-mono text-[8px] uppercase tracking-widest text-[#746e79] md:hidden">
            Volume
          </span>
          <strong className="mt-1 block text-sm text-white">{totalVolume}</strong>
          <span
            className={cx(
              "mt-0.5 block font-mono text-[9px]",
              change.tone === "positive"
                ? "text-market-green"
                : change.tone === "negative"
                  ? "text-market-red"
                  : "text-[#77717d]",
            )}
          >
            {change.label}
          </span>
        </div>

        <div>
          <span className="block font-mono text-[8px] uppercase tracking-widest text-[#746e79] md:hidden">
            Conviction
          </span>
          <ConvictionMeter market={market} />
        </div>

        <div className="text-right md:hidden">
          <span className="block font-mono text-[8px] uppercase tracking-widest text-[#746e79]">
            YES chance
          </span>
          <strong className={cx("mt-1 block font-mono text-xl", "text-deep-orange")}>
            {formatChance(chance)}
          </strong>
        </div>
      </div>

      <div className="hidden md:block">
        <ConvictionMeter market={market} />
      </div>

      <div className="hidden text-right md:block">
        <strong className={cx("font-mono text-2xl", "text-deep-orange")}>
          {formatChance(chance)}
        </strong>
        <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#77717d]">
          YES chance
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:mt-0">
        <button
          className="rounded border border-market-green/50 bg-market-green/10 px-3 py-2 text-center font-mono text-[10px] font-bold uppercase text-market-green transition-colors hover:bg-market-green hover:text-black"
          onClick={() => onOpen(market)}
          type="button"
        >
          YES {chance}
          {"\u00a2"}
        </button>
        <button
          className="rounded border border-market-red/40 bg-market-red/10 px-3 py-2 text-center font-mono text-[10px] font-bold uppercase text-market-red transition-colors hover:bg-market-red hover:text-white"
          onClick={() => onOpen(market)}
          type="button"
        >
          NO {noChance}
          {"\u00a2"}
        </button>
      </div>
    </article>
  );
}

function ConvictionMeter({ market }: { market: PredictionMarket }) {
  const filled = Math.max(1, Math.min(5, Math.ceil(market.convictionValue / 20)));
  const tone =
    market.convictionIndex === "High"
      ? "bg-deep-orange"
      : market.convictionIndex === "Moderate"
        ? "bg-electric-purple"
        : "bg-[#69636e]";

  return (
    <div className="mt-1">
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            className={cx("h-3 w-3 rounded-sm", index < filled ? tone : "bg-[#2a282b]")}
            key={index}
          />
        ))}
      </div>
      <span
        className={cx(
          "mt-1 block font-mono text-[8px] font-bold uppercase",
          market.convictionIndex === "High"
            ? "text-deep-orange"
            : market.convictionIndex === "Moderate"
              ? "text-primary"
              : "text-[#807985]",
        )}
      >
        {market.convictionIndex}
      </span>
    </div>
  );
}

function EmptyMarkets({ onClear }: { onClear: () => void }) {
  return (
    <section className="mx-auto my-20 max-w-xl border-y border-[#282828] py-12 text-center">
      <Sparkles className="mx-auto text-deep-orange" size={22} />
      <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">
        No live matches
      </p>
      <h1 className="mt-2 text-2xl font-bold text-white">Try another market filter.</h1>
      <button
        className="mt-6 rounded border border-[#3a3a3a] px-5 py-2.5 text-xs font-bold uppercase text-white hover:border-deep-orange"
        onClick={onClear}
        type="button"
      >
        Reset filters
      </button>
    </section>
  );
}

function rankDynamicMarkets(
  markets: PredictionMarket[],
  rankingWindow: number,
  selectedTopic: string,
  selectedRegion: string,
) {
  if (markets.length <= 1) return markets;

  if (selectedTopic !== "All" || selectedRegion !== "All") {
    return [...markets].sort(
      (left, right) =>
        getDynamicScore(right, rankingWindow, selectedTopic, selectedRegion) -
        getDynamicScore(left, rankingWindow, selectedTopic, selectedRegion),
    );
  }

  const buckets = new Map<string, PredictionMarket[]>();

  markets.forEach((market) => {
    const key = getMarketBalanceBucket(market);
    const bucket = buckets.get(key) ?? [];
    bucket.push(market);
    buckets.set(key, bucket);
  });

  const entries = Array.from(buckets.entries()).map(([key, bucket]) => {
    const sorted = [...bucket].sort(
      (left, right) =>
        getDynamicScore(right, rankingWindow, selectedTopic, selectedRegion) -
        getDynamicScore(left, rankingWindow, selectedTopic, selectedRegion),
    );

    return [key, sorted] as const;
  });

  entries.sort(
    (left, right) =>
      getDynamicScore(right[1][0], rankingWindow, selectedTopic, selectedRegion) -
      getDynamicScore(left[1][0], rankingWindow, selectedTopic, selectedRegion),
  );

  const offset = entries.length > 0 ? Math.abs(rankingWindow) % entries.length : 0;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)];
  const ranked: PredictionMarket[] = [];
  let depth = 0;

  while (ranked.length < markets.length) {
    let added = false;

    rotated.forEach(([, bucket]) => {
      const market = bucket[depth];
      if (!market) return;

      ranked.push(market);
      added = true;
    });

    if (!added) break;
    depth += 1;
  }

  return ranked;
}

function selectRotatingFeatured(markets: PredictionMarket[], rankingWindow: number) {
  if (markets.length <= 3) return markets;

  const candidates = markets.slice(0, Math.min(18, markets.length));
  const withImages = candidates.filter((market) => getMarketImageUrl(market));
  const pool = withImages.length >= 3 ? withImages : candidates;
  const result: PredictionMarket[] = [];
  const usedBuckets = new Set<string>();
  const start = Math.abs(rankingWindow) % pool.length;

  for (let pass = 0; pass < 2 && result.length < 3; pass += 1) {
    for (let index = 0; index < pool.length && result.length < 3; index += 1) {
      const market = pool[(start + index) % pool.length];

      if (result.some((entry) => entry.id === market.id)) continue;

      const bucket = getMarketBalanceBucket(market);
      if (pass === 0 && usedBuckets.has(bucket)) continue;

      result.push(market);
      usedBuckets.add(bucket);
    }
  }

  return result;
}

function compareDynamicMarkets(
  left: PredictionMarket,
  right: PredictionMarket,
  sortOrder: SortOrder,
) {
  if (sortOrder === "volume") {
    return getVolumeScore(right) - getVolumeScore(left);
  }
  if (sortOrder === "conviction") {
    return right.convictionValue - left.convictionValue;
  }
  if (sortOrder === "odds") {
    return right.currentOdds - left.currentOdds;
  }
  if (sortOrder === "latest") {
    return getSyncedAt(right) - getSyncedAt(left);
  }

  return getVolumeScore(right) - getVolumeScore(left);
}

function getDynamicScore(
  market: PredictionMarket,
  rankingWindow: number,
  selectedTopic: string,
  selectedRegion: string,
) {
  const changeBonus = Math.min(Math.abs(getPriceChangePoints(market.oneDayPriceChange)) * 2, 20);
  const volumeBonus = Math.min(Math.log10(1 + getVolumeScore(market)) * 5, 36);
  const liquidityBonus = Math.min(Math.log10(1 + (market.liquidityValue ?? 0)) * 3, 18);
  const contextBonus =
    (selectedTopic !== "All" && marketMatchesTopic(market, selectedTopic) ? 36 : 0) +
    (selectedRegion !== "All" &&
    (market.discoveryRegion ?? inferMarketRegion(market)) === selectedRegion
      ? 40
      : 0);

  return (
    market.convictionValue * 0.42 +
    32 +
    (isBreakingMarket(market) ? 14 : 0) +
    changeBonus +
    volumeBonus +
    liquidityBonus +
    contextBonus +
    (getMarketImageUrl(market) ? 6 : 0) +
    getFreshnessScore(market) +
    getHashFraction(market.id + ":" + rankingWindow) * 14
  );
}

function getHashFraction(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4_294_967_295;
}

function getSyncedAt(market: PredictionMarket) {
  const timestamp = market.syncedAt ? new Date(market.syncedAt).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function countTopicMatches(markets: PredictionMarket[], topic: string) {
  return topic === "All"
    ? markets.length
    : markets.filter((market) => marketMatchesTopic(market, topic)).length;
}

function marketMatchesTopic(market: PredictionMarket, topic: string) {
  if (topic === "All") return true;

  const topics = getMarketTopics(market);

  if (topic === "Finance") {
    return topics.includes("Finance") || topics.includes("Economy");
  }
  if (topic === "Geopolitics") {
    return topics.includes("Geopolitics") || topics.includes("Iran");
  }

  return topics.includes(topic);
}

function formatPriceChange(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return {
      label: "Change unavailable",
      tone: "neutral" as const,
    };
  }

  const points = getPriceChangePoints(value);

  return {
    label: (points > 0 ? "+" : "") + points.toFixed(1) + " pts 24h",
    tone:
      points > 0
        ? ("positive" as const)
        : points < 0
          ? ("negative" as const)
          : ("neutral" as const),
  };
}

function getPriceChangePoints(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.abs(value) <= 1 ? value * 100 : value;
}

function formatBoardCurrency(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "--";
  }

  if (value >= 1_000_000_000) {
    return "$" + (value / 1_000_000_000).toFixed(1) + "B";
  }
  if (value >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(1) + "M";
  }
  if (value >= 1_000) {
    return "$" + (value / 1_000).toFixed(1) + "K";
  }

  return "$" + value.toFixed(0);
}

function formatChance(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 1) + "%";
}

function MarketTopicIcon({
  className,
  size,
  topic,
}: {
  className?: string;
  size: number;
  topic: string;
}) {
  const Icon = getTopicIcon(topic);

  return <Icon className={className} size={size} />;
}

function getTopicIcon(topic: string) {
  if (topic.includes("Crypto")) return Bitcoin;
  if (topic.includes("Politics")) return Landmark;
  if (topic.includes("Finance") || topic.includes("Economy")) {
    return TrendingUp;
  }
  if (topic.includes("Tech")) return Cpu;
  if (topic.includes("Esports")) return Gamepad2;
  if (topic.includes("Sports") || topic.includes("Football") || topic.includes("World Cup")) {
    return Trophy;
  }
  if (topic.includes("Geo") || topic.includes("Iran")) {
    return Globe2;
  }

  return Building2;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getYesCents(market: PredictionMarket) {
  const explicitAsk = parseProbabilityLikeValue(market.bestAsk);
  const explicitTrade = parseProbabilityLikeValue(market.lastTradePrice);
  const fallback = Math.round(market.currentOdds);

  return clampCents(explicitAsk ?? explicitTrade ?? fallback);
}

function parseProbabilityLikeValue(value?: string | null) {
  if (!value) return null;

  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed)) return null;

  return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
}

function clampCents(value: number) {
  return Math.max(0, Math.min(100, value));
}

function MarketSelect({
  icon,
  label,
  onChange,
  options,
  value,
}: {
  icon: "filter" | "region" | "topic";
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  const Icon = icon === "region" ? Globe2 : Filter;

  return (
    <label className="relative flex items-center rounded border border-[#262626] bg-[#201f1f] px-3 py-1.5 transition-colors hover:border-deep-orange">
      <Icon size={14} className="mr-2 text-[#ccc3d8]" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 bg-transparent border-none text-xs font-mono font-bold uppercase tracking-wider text-[#ccc3d8] focus:ring-0 cursor-pointer pr-4"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-[#201f1f] text-white py-1">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildOptions(values: string[]) {
  return ["All", ...Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))];
}

function mergeFeaturedOptions(featured: string[], values: string[]) {
  const available = new Set(values.filter(Boolean));
  const featuredValues = featured.filter((value) => value !== "All" && available.has(value));
  const remainingValues = Array.from(available)
    .filter((value) => value !== "All" && !featuredValues.includes(value))
    .sort((a, b) => a.localeCompare(b));

  return ["All", ...featuredValues, ...remainingValues];
}

function buildTopicCounts(markets: PredictionMarket[]) {
  const counts = new Map<string, number>();

  markets.forEach((market) => {
    getMarketTopics(market).forEach((topic) => {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    });
  });

  return counts;
}

function buildRegionCounts(markets: PredictionMarket[]) {
  const counts = new Map<string, number>();

  markets.forEach((market) => {
    const region = market.discoveryRegion ?? inferMarketRegion(market);
    counts.set(region, (counts.get(region) ?? 0) + 1);
  });

  return counts;
}

function getMarketBalanceBucket(market: PredictionMarket) {
  const topics = getMarketTopics(market);

  if (topics.includes("Politics")) return "Politics";
  if (topics.includes("Crypto")) return "Crypto";
  if (topics.includes("Tech")) return "Tech";
  if (topics.includes("Finance") || topics.includes("Economy")) return "Finance";
  if (topics.includes("Geopolitics") || topics.includes("Iran")) return "Geopolitics";
  if (topics.includes("Esports")) return "Esports";
  if (topics.includes("Culture")) return "Culture";
  if (topics.includes("Weather")) return "Weather";
  if (topics.includes("African Football")) return "African Football";
  if (topics.includes("World Cup")) return "World Cup";
  if (topics.includes("Football")) return "Football";
  if (topics.includes("Sports")) return "Sports";

  return market.discoveryTopic ?? inferMarketTopic(market);
}

function getFreshnessScore(market: PredictionMarket) {
  if (!market.syncedAt) return 0;

  const syncedAt = new Date(market.syncedAt).getTime();
  if (!Number.isFinite(syncedAt)) return 0;

  const ageHours = Math.max(0, (Date.now() - syncedAt) / (1000 * 60 * 60));

  return Math.max(0, 12 - ageHours / 6);
}

function getVolumeScore(market: PredictionMarket) {
  return parseVolume(market.vol24h);
}

function parseVolume(volume: string) {
  const num = parseFloat(volume.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num)) return 0;
  if (volume.includes("M")) return num * 1000000;
  if (volume.includes("K")) return num * 1000;
  return num;
}

function getMarketTopics(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();
  const topics = new Set<string>();

  topics.add(market.discoveryTopic ?? inferMarketTopic(market));
  if (matches(text, ["afcon", "caf ", "caf-", "africa cup of nations", "cup of nations"])) {
    topics.add("African Football");
    topics.add("Football");
    topics.add("Sports");
  }
  if (isBreakingMarket(market)) topics.add("Breaking");
  if (matches(text, ["world cup", "fifa"])) {
    topics.add("World Cup");
    topics.add("Football");
    topics.add("Sports");
  }
  if (
    matches(text, [
      "football",
      "soccer",
      "champions league",
      "premier league",
      "la liga",
      "serie a",
      "bundesliga",
      "uefa",
    ])
  ) {
    topics.add("Football");
    topics.add("Sports");
  }
  if (matches(text, ["cricket"])) {
    topics.add("Cricket");
    topics.add("Sports");
  }
  if (matches(text, ["rugby"])) {
    topics.add("Rugby");
    topics.add("Sports");
  }
  if (matches(text, ["esports", "league of legends", "valorant", "cs2", "counter-strike", "dota"]))
    topics.add("Esports");
  if (matches(text, ["iran", "hormuz", "tehran"])) topics.add("Iran");
  if (matches(text, ["finance", "stock", "stocks", "nasdaq", "s&p", "dow", "yield", "bond"]))
    topics.add("Finance");
  if (matches(text, ["economy", "inflation", "gdp", "recession", "cpi", "fed rates"]))
    topics.add("Economy");
  if (matches(text, ["weather", "hurricane", "temperature", "rain", "flood", "wildfire"]))
    topics.add("Weather");
  if (matches(text, ["mentions", "mentioned", "tweet", "post", "social media"]))
    topics.add("Mentions");
  if (matches(text, ["election", "ballot", "vote", "voting"])) topics.add("Elections");

  return Array.from(topics);
}

function getPrimaryMarketTopic(market: PredictionMarket) {
  const topics = getMarketTopics(market);

  if (topics.includes("African Football")) return "African Football";
  if (topics.includes("World Cup")) return "World Cup";
  if (topics.includes("Football")) return "Football";
  if (topics.includes("Esports")) return "Esports";
  if (topics.includes("Iran")) return "Iran";
  if (market.discoveryTopic) return market.discoveryTopic;

  return inferMarketTopic(market);
}

function inferMarketTopic(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();

  if (matches(text, ["afcon", "caf ", "caf-", "africa cup of nations", "cup of nations"]))
    return "African Football";
  if (matches(text, ["world cup", "fifa"])) return "World Cup";
  if (
    matches(text, [
      "football",
      "soccer",
      "champions league",
      "premier league",
      "la liga",
      "serie a",
      "bundesliga",
      "uefa",
    ])
  )
    return "Football";
  if (matches(text, ["esports", "league of legends", "valorant", "cs2", "counter-strike", "dota"]))
    return "Esports";
  if (
    matches(text, [
      "war",
      "ceasefire",
      "nato",
      "taiwan",
      "gaza",
      "israel",
      "iran",
      "russia",
      "ukraine",
      "sanction",
      "hormuz",
    ])
  )
    return "Geopolitics";
  if (
    matches(text, [
      "nba",
      "nfl",
      "nhl",
      "mlb",
      "champion",
      "finals",
      "stanley cup",
      "league",
      "ufc",
      "soccer",
      "football",
      "cricket",
      "formula 1",
    ])
  )
    return "Sports";
  if (
    matches(text, [
      "election",
      "president",
      "senate",
      "congress",
      "minister",
      "policy",
      "government",
      "parliament",
    ])
  )
    return "Politics";
  if (matches(text, ["court", "trial", "sentenced", "sentence", "prison", "retrial", "lawsuit"]))
    return "Social";
  if (
    matches(text, [
      "bitcoin",
      "btc",
      "ethereum",
      "megaeth",
      "airdrop",
      "token",
      "crypto",
      "defi",
      "chain",
      "solana",
    ])
  )
    return "Crypto";
  if (matches(text, ["trend", "tiktok", "twitter", "meme", "protest", "strike", "mentions"]))
    return "Social";
  if (
    matches(text, [
      "fed",
      "rates",
      "inflation",
      "gdp",
      "recession",
      "oil",
      "stocks",
      "market",
      "tariff",
      "finance",
    ])
  )
    return "Economy";
  if (
    matches(text, ["climate", "weather", "hurricane", "temperature", "rain", "flood", "wildfire"])
  )
    return "Weather";
  if (
    matches(text, [
      "album",
      "movie",
      "music",
      "gta",
      "celebrity",
      "award",
      "streaming",
      "art",
      "pop culture",
    ])
  )
    return "Culture";
  if (matches(text, ["ai", "openai", "nvidia", "apple", "tesla", "spacex", "startup", "tech"]))
    return "Tech";

  return "Trending";
}

function inferMarketRegion(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();

  if (
    matches(text, [
      "crypto",
      "bitcoin",
      "ethereum",
      "airdrop",
      "token",
      "defi",
      "solana",
      "onchain",
      "on-chain",
    ])
  )
    return "Crypto-native";
  if (
    matches(text, [
      "israel",
      "hamas",
      "iran",
      "saudi",
      "uae",
      "qatar",
      "gaza",
      "middle east",
      "palestine",
      "abraham accords",
    ])
  )
    return "Middle East";
  if (
    matches(text, [
      "nigeria",
      "kenya",
      "ghana",
      "south africa",
      "ethiopia",
      "egypt",
      "morocco",
      "algeria",
      "tunisia",
      "senegal",
      "ivory coast",
      "cote d'ivoire",
      "cameroon",
      "uganda",
      "tanzania",
      "rwanda",
      "zambia",
      "angola",
      "mali",
      "dr congo",
      "lagos",
      "nairobi",
      "johannesburg",
      "cairo",
      "casablanca",
      "afcon",
      "caf ",
      "caf-",
      "africa",
    ])
  )
    return "Africa";
  if (
    matches(text, ["china", "india", "japan", "korea", "singapore", "taiwan", "asia", "indonesia"])
  )
    return "Asia";
  if (
    matches(text, [
      "uk",
      "britain",
      "london",
      "europe",
      "eu ",
      "france",
      "germany",
      "spain",
      "italy",
      "russia",
      "ukraine",
    ])
  )
    return "Europe";
  if (
    matches(text, ["brazil", "argentina", "mexico", "colombia", "chile", "latin america", "latam"])
  )
    return "Latin America";
  if (
    matches(text, [
      "nba",
      "nfl",
      "mlb",
      "new york",
      "san antonio",
      "oklahoma",
      "vegas",
      "u.s.",
      "usa",
      "america",
      "united states",
      "new york court",
    ])
  )
    return "United States";

  return "Global";
}

function getMarketImageUrl(market: PredictionMarket) {
  const imageUrl = market.imageUrl?.trim();

  return imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null;
}

function isBreakingMarket(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();
  return matches(text, [
    "breaking",
    "by end of",
    "today",
    "tomorrow",
    "this week",
    "ceasefire",
    "attack",
    "traffic",
    "returns to normal",
  ]);
}

function matches(text: string, terms: string[]) {
  return terms.some((term) => {
    const normalizedTerm = term.trim().toLowerCase();

    if (!normalizedTerm) return false;

    if (/^[a-z0-9]+$/i.test(normalizedTerm)) {
      return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "i").test(text);
    }

    return text.includes(normalizedTerm);
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
