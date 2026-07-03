import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PredictionMarket } from '../types';
import { ArrowRight, ArrowUpDown, BookOpen, Filter, Flame, Globe2, Search, Sparkles } from 'lucide-react';

interface MarketsViewProps {
  markets: PredictionMarket[];
  onOpenMargin: (market: PredictionMarket) => void;
  onRequireWallet?: () => void;
  walletConnected?: boolean;
}

type SortOrder = 'balanced' | 'trending' | 'relevance' | 'conviction' | 'odds' | 'volume';

const FEATURED_TOPICS = ['All', 'Trending', 'African Football', 'World Cup', 'Football', 'Sports', 'Cricket', 'Rugby', 'Breaking', 'Politics', 'Crypto', 'Esports', 'Iran', 'Finance', 'Geopolitics', 'Tech', 'Culture', 'Economy', 'Weather', 'Mentions', 'Elections'];
const FEATURED_REGIONS = ['All', 'Global', 'Africa', 'Asia', 'Europe', 'Latin America', 'Middle East', 'United States', 'Crypto-native'];
const AUTO_LOAD_BATCH_SIZE = 18;
const CONNECTED_INITIAL_LIMIT = 36;
const GUEST_MARKET_LIMIT = 12;

export default function MarketsView({ markets, onOpenMargin, onRequireWallet, walletConnected = false }: MarketsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTopic, setSelectedTopic] = useState<string>('All');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('balanced');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(walletConnected ? CONNECTED_INITIAL_LIMIT : GUEST_MARKET_LIMIT);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const categories = useMemo(() => buildOptions(markets.map((market) => market.category)), [markets]);
  const topicCounts = useMemo(() => buildTopicCounts(markets), [markets]);
  const regionCounts = useMemo(() => buildRegionCounts(markets), [markets]);
  const topics = useMemo(
    () => mergeFeaturedOptions(FEATURED_TOPICS, Array.from(topicCounts.keys())),
    [topicCounts],
  );
  const regions = useMemo(
    () => mergeFeaturedOptions(FEATURED_REGIONS, Array.from(regionCounts.keys())),
    [regionCounts],
  );

  const curatedTopics = useMemo(
    () => FEATURED_TOPICS.filter((topic) => topic !== 'All' && (topicCounts.get(topic) ?? 0) > 0),
    [topicCounts],
  );
  const curatedRegions = useMemo(
    () => FEATURED_REGIONS.filter((region) => region !== 'All' && (regionCounts.get(region) ?? 0) > 0),
    [regionCounts],
  );

  useEffect(() => {
    if (selectedTopic !== 'All' && !topics.includes(selectedTopic)) {
      setSelectedTopic('All');
    }
  }, [selectedTopic, topics]);

  useEffect(() => {
    if (selectedRegion !== 'All' && !regions.includes(selectedRegion)) {
      setSelectedRegion('All');
    }
  }, [selectedRegion, regions]);

  const filteredMarkets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const baseMarkets = markets
      .filter((market) => selectedCategory === 'All' || market.category === selectedCategory)
      .filter((market) => {
        const topics = getMarketTopics(market);
        return selectedTopic === 'All' || topics.includes(selectedTopic);
      })
      .filter((market) => {
        const region = market.discoveryRegion ?? inferMarketRegion(market);
        return selectedRegion === 'All' || region === selectedRegion;
      })
      .filter((market) => {
        if (!query) return true;

        return [
          market.title,
          market.description,
          market.category,
          getMarketTopics(market).join(' '),
          market.discoveryRegion ?? inferMarketRegion(market),
          market.source,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });

    if (sortOrder === 'balanced' && query.length === 0) {
      return balanceMarketMix(baseMarkets);
    }

    return [...baseMarkets].sort((a, b) => compareMarkets(a, b, sortOrder, searchQuery, selectedTopic, selectedRegion));
  }, [markets, searchQuery, selectedCategory, selectedRegion, selectedTopic, sortOrder]);

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
          setVisibleLimit((current) => Math.min(current + AUTO_LOAD_BATCH_SIZE, filteredMarkets.length));
        }
      },
      { rootMargin: '900px 0px 900px 0px' },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [filteredMarkets.length, hiddenMarketCount, walletConnected]);

  function handleLoadMore() {
    if (!walletConnected) {
      onRequireWallet?.();
      return;
    }

    setVisibleLimit((current) => current + 18);
  }

  const topicPills = useMemo(
    () => ['All', ...curatedTopics].slice(0, 14),
    [curatedTopics],
  );
  const regionPills = useMemo(
    () => ['All', ...curatedRegions].slice(0, 10),
    [curatedRegions],
  );

  return (
    <main className="min-h-[calc(100vh-64px)] flex-1 bg-[#080808] bg-grid-tech pb-32">
      <div className="mx-auto max-w-[1440px] px-4 py-7 md:px-8 lg:px-10">
        <header className="mb-7 border-b border-[#262626] pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded border border-deep-orange/25 bg-deep-orange/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">
                <Sparkles size={12} />
                Market discovery
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">Active Markets</h1>
            </div>

            <div className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-[minmax(16rem,1fr)_auto_auto]">
              <label className="relative flex min-w-0 items-center rounded border border-[#2b2b2b] bg-[#111111] px-4 py-3 transition-colors focus-within:border-deep-orange">
                <Search size={16} className="mr-3 text-[#c9b8ad]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search markets, teams, countries..."
                  className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold text-white placeholder:text-[#8f8798] focus:outline-none"
                />
              </label>

              <button
                onClick={() => setSortOrder((current) => getNextSortOrder(current))}
                className="flex items-center justify-center gap-2 rounded border border-[#2b2b2b] bg-[#111111] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#f2d5c8] transition-all duration-200 hover:border-deep-orange/60 hover:text-white"
              >
                <ArrowUpDown size={14} />
                <span>Sort: {getSortLabel(sortOrder)}</span>
              </button>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:w-[25rem]">
                <MarketSelect icon="filter" label="Category" value={selectedCategory} onChange={setSelectedCategory} options={categories} />
                <MarketSelect icon="topic" label="Topic" value={selectedTopic} onChange={setSelectedTopic} options={topics} />
                <MarketSelect icon="region" label="Region" value={selectedRegion} onChange={setSelectedRegion} options={regions} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {topicPills.map((topic) => {
              const count = topic === 'All' ? markets.length : topicCounts.get(topic) ?? 0;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  aria-pressed={selectedTopic === topic}
                  className={`flex flex-shrink-0 items-center gap-2 border-b-2 px-1.5 pb-2 font-sans text-sm font-semibold transition-colors ${
                    selectedTopic === topic
                      ? 'border-deep-orange text-deep-orange'
                      : 'border-transparent text-[#f2d5c8]/80 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {topic === 'Trending' ? <Flame size={14} /> : null}
                  <span>{topic === 'All' ? 'All Markets' : topic}</span>
                  <span className="font-mono text-[10px] text-[#8f8798]">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {regionPills.map((region) => {
              const count = region === 'All' ? markets.length : regionCounts.get(region) ?? 0;
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegion(region)}
                  aria-pressed={selectedRegion === region}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    selectedRegion === region
                      ? 'border-electric-purple bg-electric-purple text-white'
                      : 'border-[#262626] bg-[#101010] text-[#ccc3d8] hover:border-white/40 hover:text-white'
                  }`}
                >
                  <Globe2 size={12} />
                  <span>{region}</span>
                  <span className="text-[9px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/70">
            <span className="rounded border border-[#262626] bg-[#111111] px-2 py-1">{visibleMarkets.length} shown</span>
            <span className="rounded border border-[#262626] bg-[#111111] px-2 py-1">{filteredMarkets.length} matching</span>
            {selectedTopic !== 'All' ? <span className="rounded border border-deep-orange/30 bg-deep-orange/10 px-2 py-1 text-deep-orange">{selectedTopic}</span> : null}
            {selectedRegion !== 'All' ? <span className="rounded border border-electric-purple/40 bg-electric-purple/10 px-2 py-1 text-[#d2bbff]">{selectedRegion}</span> : null}
          </div>
        </header>

        {filteredMarkets.length === 0 ? (
          <section className="rounded-lg border border-[#262626] bg-[#161616] p-8 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">No matching markets</p>
            <h2 className="mt-2 text-xl font-bold text-white">Try another topic, region, or keyword.</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[#ccc3d8]">
              No synced core markets match this filter set.
            </p>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleMarkets.map((market, index) => {
              const isHalted = market.status === 'HALTED';
              const topic = getPrimaryMarketTopic(market);
              const region = market.discoveryRegion ?? inferMarketRegion(market);
              const imageUrl = getMarketImageUrl(market);
              const prioritizeImage = index < 3;
              const yesCents = getYesCents(market);
              const noCents = 100 - yesCents;
              const momentumBars = getMomentumBars(market);

              return (
                <article
                  key={market.id}
                  className={`group overflow-hidden rounded border border-[#2a2a2a] bg-[#151515] shadow-[0_20px_60px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-deep-orange/55 hover:bg-[#191919] ${
                    isHalted ? 'opacity-80' : ''
                  }`}
                >
                  <div className="relative h-40 overflow-hidden bg-[#080808] sm:h-44">
                    {imageUrl ? (
                      <Image
                        alt=""
                        className="object-cover opacity-90 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
                        fill
                        loading={prioritizeImage ? 'eager' : 'lazy'}
                        priority={prioritizeImage}
                        quality={52}
                        sizes="(max-width: 768px) 92vw, (max-width: 1280px) 45vw, 31vw"
                        src={imageUrl}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(255,98,24,0.22),transparent_34%),linear-gradient(135deg,rgba(28,15,12,0.96),rgba(14,14,14,0.98)_52%,rgba(54,27,96,0.55))]">
                        <span className="font-mono text-5xl font-black uppercase tracking-widest text-white/12">{getMarketGlyph(topic)}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-[#151515]/30 to-black/5" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                      <div className="grid gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#f6dfd4]">Momentum</span>
                        <div className="flex h-4 items-end gap-1">
                          {momentumBars.map((bar, barIndex) => (
                            <span
                              key={barIndex}
                              className={barIndex > 2 ? 'w-1.5 bg-deep-orange' : 'w-1.5 bg-[#00e0c6]'}
                              style={{ height: bar + 'px' }}
                            />
                          ))}
                        </div>
                      </div>
                      <span className={`rounded border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest ${
                        isHalted
                          ? 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]'
                          : 'border-[#00e0c6]/25 bg-[#00e0c6]/10 text-[#00e0c6]'
                      }`}>{market.status}</span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="rounded border border-[#5b3b30] bg-[#3a2924] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#f6dfd4]">
                        {topic}
                      </span>
                      <span className="rounded border border-[#262626] bg-[#0d0d0d] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#958da1]">
                        {region}
                      </span>
                    </div>

                    <h3 className="min-h-[3.2rem] text-lg font-semibold leading-tight text-white transition-colors group-hover:text-deep-orange">
                      {market.title}
                    </h3>

                    <p className="mt-3 min-h-[2.5rem] text-sm leading-relaxed text-[#b9b2c4]/80 line-clamp-2">
                      {market.description}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-widest text-[#c9b8ad]">Vol</span>
                        <strong className="mt-1 block text-lg text-white">{market.vol24h}</strong>
                      </div>
                      <div className="text-right">
                        <span className="block font-mono text-[10px] uppercase tracking-widest text-[#c9b8ad]">YES chance</span>
                        <strong className={`mt-1 block font-mono text-2xl ${isHalted ? 'text-[#958da1]' : 'text-deep-orange'}`}>
                          {market.currentOdds.toFixed(1)}%
                        </strong>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#c9b8ad]">Conviction</span>
                        <span className={`font-mono text-xs font-bold ${
                          market.convictionIndex === 'High' ? 'text-deep-orange' :
                          market.convictionIndex === 'Moderate' ? 'text-electric-purple' :
                          market.convictionIndex === 'Low' ? 'text-primary' : 'text-[#958da1]'
                        }`}>{market.convictionIndex}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#2b2b2b]">
                        <div
                          className="h-full rounded-full bg-deep-orange transition-all duration-500"
                          style={{ width: `${Math.max(4, Math.min(100, market.convictionValue))}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isHalted}
                        onClick={() => onOpenMargin(market)}
                        className="rounded border border-[#4b342d] bg-[#3a2924] px-3 py-3 text-sm font-semibold text-[#f6dfd4] transition-colors hover:border-deep-orange hover:bg-deep-orange hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Yes {yesCents}¢
                      </button>
                      <button
                        type="button"
                        disabled={isHalted}
                        onClick={() => onOpenMargin(market)}
                        className="rounded border border-[#4b342d] bg-[#3a2924] px-3 py-3 text-sm font-semibold text-[#f6dfd4] transition-colors hover:border-white/60 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        No {noCents}¢
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#262626] pt-4">
                      <span className="truncate font-mono text-[10px] uppercase tracking-widest text-[#8f8798]" title={market.liquidityLabel}>
                        Min {market.liquidity}
                      </span>
                      <button
                        type="button"
                        disabled={isHalted}
                        onClick={() => onOpenMargin(market)}
                        className="inline-flex items-center gap-2 rounded border border-[#2f2f2f] bg-[#0d0d0d] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#f2d5c8] transition-colors hover:border-deep-orange hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <BookOpen size={13} />
                        Review
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {hiddenMarketCount > 0 ? (
          <div className="mt-10 flex justify-center">
            <div ref={loadMoreRef} className="flex min-h-14 items-center justify-center">
              {walletConnected ? (
                <span className="rounded border border-[#262626] bg-[#111111] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]">
                  Loading more markets...
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="rounded border border-deep-orange/60 bg-deep-orange px-6 py-3 font-sans text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-white"
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

function getYesCents(market: PredictionMarket) {
  const explicitAsk = parseProbabilityLikeValue(market.bestAsk);
  const explicitTrade = parseProbabilityLikeValue(market.lastTradePrice);
  const fallback = Math.round(market.currentOdds);

  return clampCents(explicitAsk ?? explicitTrade ?? fallback);
}

function parseProbabilityLikeValue(value?: string | null) {
  if (!value) return null;

  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(parsed)) return null;

  return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
}

function clampCents(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getMomentumBars(market: PredictionMarket) {
  const base = Math.max(8, Math.min(30, Math.round(market.convictionValue / 4)));
  const odds = Math.max(4, Math.min(28, Math.round(market.currentOdds / 4)));
  const volume = Math.max(5, Math.min(30, Math.round(Math.log10(Math.max(10, getVolumeScore(market))) * 4)));

  return [8, 12, Math.max(10, odds), Math.max(12, base - 4), Math.max(14, base), Math.max(10, volume)];
}

function getMarketGlyph(topic: string) {
  if (topic.includes('World Cup') || topic.includes('Football')) return 'FC';
  if (topic.includes('Crypto')) return '₿';
  if (topic.includes('Politics')) return 'GV';
  if (topic.includes('Finance') || topic.includes('Economy')) return '$';
  if (topic.includes('Tech') || topic.includes('AI')) return 'AI';
  if (topic.includes('Weather')) return 'WX';
  if (topic.includes('Esports')) return 'XP';

  return topic.slice(0, 2).toUpperCase();
}

function MarketSelect({
  icon,
  label,
  onChange,
  options,
  value,
}: {
  icon: 'filter' | 'region' | 'topic';
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  const Icon = icon === 'region' ? Globe2 : Filter;

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
  return ['All', ...Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))];
}

function mergeFeaturedOptions(featured: string[], values: string[]) {
  const available = new Set(values.filter(Boolean));
  const featuredValues = featured.filter((value) => value !== 'All' && available.has(value));
  const remainingValues = Array.from(available)
    .filter((value) => value !== 'All' && !featuredValues.includes(value))
    .sort((a, b) => a.localeCompare(b));

  return ['All', ...featuredValues, ...remainingValues];
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

function compareMarkets(
  a: PredictionMarket,
  b: PredictionMarket,
  sortOrder: SortOrder,
  query: string,
  selectedTopic: string,
  selectedRegion: string,
) {
  if (sortOrder === 'volume') return getVolumeScore(b) - getVolumeScore(a);
  if (sortOrder === 'trending') {
    return (
      getTrendingScore(b, selectedTopic, selectedRegion) -
      getTrendingScore(a, selectedTopic, selectedRegion)
    );
  }
  if (sortOrder === 'conviction') return b.convictionValue - a.convictionValue;
  if (sortOrder === 'odds') return b.currentOdds - a.currentOdds;

  return (
    getMarketRelevanceScore(b, query, selectedTopic, selectedRegion) -
    getMarketRelevanceScore(a, query, selectedTopic, selectedRegion)
  );
}

function getNextSortOrder(current: SortOrder): SortOrder {
  if (current === 'balanced') return 'trending';
  if (current === 'trending') return 'relevance';
  if (current === 'relevance') return 'conviction';
  if (current === 'conviction') return 'odds';
  if (current === 'odds') return 'volume';
  return 'balanced';
}

function getSortLabel(sortOrder: SortOrder) {
  if (sortOrder === 'balanced') return 'No Sort';
  if (sortOrder === 'conviction') return 'Conviction';
  if (sortOrder === 'odds') return 'YES Chance';
  if (sortOrder === 'volume') return 'Volume';
  if (sortOrder === 'relevance') return 'Relevance';
  return 'Trending';
}

function balanceMarketMix(markets: PredictionMarket[]) {
  if (markets.length <= 1) return markets;

  const buckets = new Map<string, PredictionMarket[]>();

  markets.forEach((market) => {
    const bucket = getMarketBalanceBucket(market);
    const items = buckets.get(bucket) ?? [];
    items.push(market);
    buckets.set(bucket, items);
  });

  const orderedBuckets = Array.from(buckets.entries()).sort((a, b) => {
    const priorityDelta = getBalanceBucketPriority(a[0]) - getBalanceBucketPriority(b[0]);
    if (priorityDelta !== 0) return priorityDelta;
    return a[0].localeCompare(b[0]);
  });
  const balanced: PredictionMarket[] = [];
  let cursor = 0;

  while (balanced.length < markets.length) {
    let added = false;

    for (const [, bucketMarkets] of orderedBuckets) {
      const next = bucketMarkets[cursor];
      if (!next) continue;

      balanced.push(next);
      added = true;
    }

    if (!added) break;
    cursor += 1;
  }

  return balanced;
}

function getMarketBalanceBucket(market: PredictionMarket) {
  const topics = getMarketTopics(market);

  if (topics.includes('Politics')) return 'Politics';
  if (topics.includes('Crypto')) return 'Crypto';
  if (topics.includes('Tech')) return 'Tech';
  if (topics.includes('Finance') || topics.includes('Economy')) return 'Finance';
  if (topics.includes('Geopolitics') || topics.includes('Iran')) return 'Geopolitics';
  if (topics.includes('Esports')) return 'Esports';
  if (topics.includes('Culture')) return 'Culture';
  if (topics.includes('Weather')) return 'Weather';
  if (topics.includes('African Football')) return 'African Football';
  if (topics.includes('World Cup')) return 'World Cup';
  if (topics.includes('Football')) return 'Football';
  if (topics.includes('Sports')) return 'Sports';

  return market.discoveryTopic ?? inferMarketTopic(market);
}

function getBalanceBucketPriority(bucket: string) {
  const priorities = [
    'Politics',
    'Crypto',
    'Tech',
    'Finance',
    'Geopolitics',
    'Esports',
    'Culture',
    'Weather',
    'African Football',
    'World Cup',
    'Football',
    'Sports',
  ];
  const index = priorities.indexOf(bucket);

  return index === -1 ? priorities.length : index;
}

function getTrendingScore(market: PredictionMarket, selectedTopic = 'All', selectedRegion = 'All') {
  const liveBonus = market.status === 'LIVE' ? 35 : 0;
  const urgencyBonus = isBreakingMarket(market) ? 20 : 0;
  const topics = getMarketTopics(market);
  const sportBonus = topics.includes('Sports') || topics.includes('World Cup') ? 10 : 0;
  const contextBonus = getContextScore(market, selectedTopic, selectedRegion);
  const mediaBonus = getMarketImageUrl(market) ? 5 : 0;
  const freshnessBonus = getFreshnessScore(market);
  const topicDepthBonus = Math.min(topics.length * 2, 10);

  return (
    market.convictionValue +
    liveBonus +
    urgencyBonus +
    sportBonus +
    contextBonus +
    mediaBonus +
    freshnessBonus +
    topicDepthBonus +
    Math.min(getVolumeScore(market) / 85000, 28)
  );
}

function getMarketRelevanceScore(market: PredictionMarket, query: string, selectedTopic = 'All', selectedRegion = 'All') {
  const searchable = `${market.title} ${market.description} ${market.category} ${getMarketTopics(market).join(' ')} ${market.discoveryRegion ?? ''} ${market.source ?? ''}`.toLowerCase();
  const queryTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const queryScore = queryTokens.reduce((score, token) => score + (searchable.includes(token) ? 24 : 0), 0);
  const liveBonus = market.status === 'LIVE' ? 10 : 0;

  return (
    market.convictionValue +
    liveBonus +
    queryScore +
    getContextScore(market, selectedTopic, selectedRegion) +
    getFreshnessScore(market) +
    Math.min(getVolumeScore(market) / 120000, 22)
  );
}

function getContextScore(market: PredictionMarket, selectedTopic: string, selectedRegion: string) {
  const topics = getMarketTopics(market);
  const region = market.discoveryRegion ?? inferMarketRegion(market);
  let score = 0;

  if (selectedTopic !== 'All' && topics.includes(selectedTopic)) score += 42;
  if (selectedRegion !== 'All' && region === selectedRegion) score += 46;
  if (selectedRegion === 'All') score += getRegionDiversityScore(region);
  if (selectedTopic === 'All') score += getTopicDiversityScore(topics);

  return score;
}

function getRegionDiversityScore(region: string) {
  if (region === 'Africa') return 22;
  if (region === 'Asia') return 16;
  if (region === 'Latin America') return 15;
  if (region === 'Middle East') return 14;
  if (region === 'Crypto-native') return 12;
  if (region === 'Europe') return 9;
  if (region === 'Global') return 7;
  if (region === 'United States') return 2;
  return 0;
}

function getTopicDiversityScore(topics: string[]) {
  if (topics.includes('African Football')) return 24;
  if (topics.includes('World Cup')) return 16;
  if (topics.includes('Esports')) return 15;
  if (topics.includes('Crypto')) return 13;
  if (topics.includes('Geopolitics')) return 11;
  if (topics.includes('Finance')) return 9;
  return 0;
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
  const num = parseFloat(volume.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num)) return 0;
  if (volume.includes('M')) return num * 1000000;
  if (volume.includes('K')) return num * 1000;
  return num;
}

function getMarketTopics(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();
  const topics = new Set<string>();

  topics.add(market.discoveryTopic ?? inferMarketTopic(market));
  if (matches(text, ['afcon', 'caf ', 'caf-', 'africa cup of nations', 'cup of nations'])) {
    topics.add('African Football');
    topics.add('Football');
    topics.add('Sports');
  }
  if (isBreakingMarket(market)) topics.add('Breaking');
  if (matches(text, ['world cup', 'fifa'])) {
    topics.add('World Cup');
    topics.add('Football');
    topics.add('Sports');
  }
  if (matches(text, ['football', 'soccer', 'champions league', 'premier league', 'la liga', 'serie a', 'bundesliga', 'uefa'])) {
    topics.add('Football');
    topics.add('Sports');
  }
  if (matches(text, ['cricket'])) {
    topics.add('Cricket');
    topics.add('Sports');
  }
  if (matches(text, ['rugby'])) {
    topics.add('Rugby');
    topics.add('Sports');
  }
  if (matches(text, ['esports', 'league of legends', 'valorant', 'cs2', 'counter-strike', 'dota'])) topics.add('Esports');
  if (matches(text, ['iran', 'hormuz', 'tehran'])) topics.add('Iran');
  if (matches(text, ['finance', 'stock', 'stocks', 'nasdaq', 's&p', 'dow', 'yield', 'bond'])) topics.add('Finance');
  if (matches(text, ['economy', 'inflation', 'gdp', 'recession', 'cpi', 'fed rates'])) topics.add('Economy');
  if (matches(text, ['weather', 'hurricane', 'temperature', 'rain', 'flood', 'wildfire'])) topics.add('Weather');
  if (matches(text, ['mentions', 'mentioned', 'tweet', 'post', 'social media'])) topics.add('Mentions');
  if (matches(text, ['election', 'ballot', 'vote', 'voting'])) topics.add('Elections');

  return Array.from(topics);
}

function getPrimaryMarketTopic(market: PredictionMarket) {
  const topics = getMarketTopics(market);

  if (topics.includes('African Football')) return 'African Football';
  if (topics.includes('World Cup')) return 'World Cup';
  if (topics.includes('Football')) return 'Football';
  if (topics.includes('Esports')) return 'Esports';
  if (topics.includes('Iran')) return 'Iran';
  if (market.discoveryTopic) return market.discoveryTopic;

  return inferMarketTopic(market);
}

function inferMarketTopic(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();

  if (matches(text, ['afcon', 'caf ', 'caf-', 'africa cup of nations', 'cup of nations'])) return 'African Football';
  if (matches(text, ['world cup', 'fifa'])) return 'World Cup';
  if (matches(text, ['football', 'soccer', 'champions league', 'premier league', 'la liga', 'serie a', 'bundesliga', 'uefa'])) return 'Football';
  if (matches(text, ['esports', 'league of legends', 'valorant', 'cs2', 'counter-strike', 'dota'])) return 'Esports';
  if (matches(text, ['war', 'ceasefire', 'nato', 'taiwan', 'gaza', 'israel', 'iran', 'russia', 'ukraine', 'sanction', 'hormuz'])) return 'Geopolitics';
  if (matches(text, ['nba', 'nfl', 'nhl', 'mlb', 'champion', 'finals', 'stanley cup', 'league', 'ufc', 'soccer', 'football', 'cricket', 'formula 1'])) return 'Sports';
  if (matches(text, ['election', 'president', 'senate', 'congress', 'minister', 'policy', 'government', 'parliament'])) return 'Politics';
  if (matches(text, ['court', 'trial', 'sentenced', 'sentence', 'prison', 'retrial', 'lawsuit'])) return 'Social';
  if (matches(text, ['bitcoin', 'btc', 'ethereum', 'megaeth', 'airdrop', 'token', 'crypto', 'defi', 'chain', 'solana'])) return 'Crypto';
  if (matches(text, ['trend', 'tiktok', 'twitter', 'meme', 'protest', 'strike', 'mentions'])) return 'Social';
  if (matches(text, ['fed', 'rates', 'inflation', 'gdp', 'recession', 'oil', 'stocks', 'market', 'tariff', 'finance'])) return 'Economy';
  if (matches(text, ['climate', 'weather', 'hurricane', 'temperature', 'rain', 'flood', 'wildfire'])) return 'Weather';
  if (matches(text, ['album', 'movie', 'music', 'gta', 'celebrity', 'award', 'streaming', 'art', 'pop culture'])) return 'Culture';
  if (matches(text, ['ai', 'openai', 'nvidia', 'apple', 'tesla', 'spacex', 'startup', 'tech'])) return 'Tech';

  return 'Trending';
}

function inferMarketRegion(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();

  if (matches(text, ['crypto', 'bitcoin', 'ethereum', 'airdrop', 'token', 'defi', 'solana', 'onchain', 'on-chain'])) return 'Crypto-native';
  if (matches(text, ['israel', 'hamas', 'iran', 'saudi', 'uae', 'qatar', 'gaza', 'middle east', 'palestine', 'abraham accords'])) return 'Middle East';
  if (matches(text, ['nigeria', 'kenya', 'ghana', 'south africa', 'ethiopia', 'egypt', 'morocco', 'algeria', 'tunisia', 'senegal', 'ivory coast', 'cote d\'ivoire', 'cameroon', 'uganda', 'tanzania', 'rwanda', 'zambia', 'angola', 'mali', 'dr congo', 'lagos', 'nairobi', 'johannesburg', 'cairo', 'casablanca', 'afcon', 'caf ', 'caf-', 'africa'])) return 'Africa';
  if (matches(text, ['china', 'india', 'japan', 'korea', 'singapore', 'taiwan', 'asia', 'indonesia'])) return 'Asia';
  if (matches(text, ['uk', 'britain', 'london', 'europe', 'eu ', 'france', 'germany', 'spain', 'italy', 'russia', 'ukraine'])) return 'Europe';
  if (matches(text, ['brazil', 'argentina', 'mexico', 'colombia', 'chile', 'latin america', 'latam'])) return 'Latin America';
  if (matches(text, ['nba', 'nfl', 'mlb', 'new york', 'san antonio', 'oklahoma', 'vegas', 'u.s.', 'usa', 'america', 'united states', 'new york court'])) return 'United States';

  return 'Global';
}

function getMarketImageUrl(market: PredictionMarket) {
  const imageUrl = market.imageUrl?.trim();

  return imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null;
}

function isBreakingMarket(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();
  return matches(text, ['breaking', 'by end of', 'today', 'tomorrow', 'this week', 'ceasefire', 'attack', 'traffic', 'returns to normal']);
}

function matches(text: string, terms: string[]) {
  return terms.some((term) => {
    const normalizedTerm = term.trim().toLowerCase();

    if (!normalizedTerm) return false;

    if (/^[a-z0-9]+$/i.test(normalizedTerm)) {
      return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, 'i').test(text);
    }

    return text.includes(normalizedTerm);
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
