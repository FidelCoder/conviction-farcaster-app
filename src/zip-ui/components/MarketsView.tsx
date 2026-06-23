import { useEffect, useMemo, useState } from 'react';
import { PredictionMarket } from '../types';
import { ArrowRight, ArrowUpDown, BookOpen, Filter, Flame, Globe2, Search, Sparkles } from 'lucide-react';

interface MarketsViewProps {
  markets: PredictionMarket[];
  onOpenMargin: (market: PredictionMarket) => void;
  onRequireWallet?: () => void;
  walletConnected?: boolean;
}

type SortOrder = 'trending' | 'relevance' | 'conviction' | 'odds' | 'volume';

const FEATURED_TOPICS = ['All', 'Trending', 'World Cup', 'Breaking', 'Politics', 'Sports', 'Crypto', 'Esports', 'Iran', 'Finance', 'Geopolitics', 'Tech', 'Culture', 'Economy', 'Weather', 'Mentions', 'Elections'];
const FEATURED_REGIONS = ['All', 'Global', 'Africa', 'Asia', 'Europe', 'Latin America', 'Middle East', 'United States', 'Crypto-native'];
const GUEST_MARKET_LIMIT = 12;

export default function MarketsView({ markets, onOpenMargin, onRequireWallet, walletConnected = false }: MarketsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTopic, setSelectedTopic] = useState<string>('All');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(GUEST_MARKET_LIMIT);

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

    return markets
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
      })
      .sort((a, b) => compareMarkets(a, b, sortOrder, searchQuery));
  }, [markets, searchQuery, selectedCategory, selectedRegion, selectedTopic, sortOrder]);

  const visibleMarkets = walletConnected ? filteredMarkets : filteredMarkets.slice(0, visibleLimit);
  const hiddenMarketCount = Math.max(0, filteredMarkets.length - visibleMarkets.length);

  function handleLoadMore() {
    if (!walletConnected) {
      onRequireWallet?.();
      return;
    }

    setVisibleLimit((current) => current + 18);
  }

  return (
    <main className="flex-1 bg-grid-tech min-h-[calc(100vh-64px)] pb-32">
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-8">
        <header className="mb-6 border-b border-[#262626] pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded border border-deep-orange/30 bg-deep-orange/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">
                <Sparkles size={12} />
                Market discovery
              </p>
              <h1 className="text-3xl md:text-4xl font-sans font-bold text-white mb-2">Active Markets</h1>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto] xl:max-w-5xl">
              <label className="relative flex min-w-0 items-center rounded border border-[#262626] bg-[#201f1f] px-3 py-1.5 transition-colors focus-within:border-deep-orange">
                <Search size={14} className="mr-2 text-[#ccc3d8]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search World Cup, Iran, crypto, elections..."
                  className="min-w-0 flex-1 border-none bg-transparent font-mono text-xs font-bold text-white placeholder:text-[#ccc3d8]/50 focus:outline-none"
                />
              </label>

              <MarketSelect icon="filter" label="Category" value={selectedCategory} onChange={setSelectedCategory} options={categories} />
              <MarketSelect icon="topic" label="Topic" value={selectedTopic} onChange={setSelectedTopic} options={topics} />
              <MarketSelect icon="region" label="Region" value={selectedRegion} onChange={setSelectedRegion} options={regions} />

              <button
                onClick={() => setSortOrder((current) => getNextSortOrder(current))}
                className="flex items-center justify-center gap-2 rounded border border-[#262626] bg-[#201f1f] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#ccc3d8] transition-all duration-200 hover:text-white"
              >
                <ArrowUpDown size={14} />
                <span>{getSortLabel(sortOrder)}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/70">
            <span className="rounded border border-[#262626] bg-[#111111] px-2 py-1">{visibleMarkets.length} shown</span>
            {selectedTopic !== 'All' ? <span className="rounded border border-deep-orange/30 bg-deep-orange/10 px-2 py-1 text-deep-orange">{selectedTopic}</span> : null}
            {selectedRegion !== 'All' ? <span className="rounded border border-electric-purple/40 bg-electric-purple/10 px-2 py-1 text-[#d2bbff]">{selectedRegion}</span> : null}
          </div>
        </header>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {curatedTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                aria-pressed={selectedTopic === topic}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  selectedTopic === topic
                    ? 'border-deep-orange bg-deep-orange text-black'
                    : 'border-[#262626] bg-[#111111] text-[#ccc3d8] hover:border-white/40 hover:text-white'
                }`}
              >
                {topic === 'Trending' ? <Flame size={12} /> : null}
                <span>{topic}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px]">{topicCounts.get(topic)}</span>
              </button>
            ))}
          </div>

        {filteredMarkets.length === 0 ? (
          <section className="rounded-lg border border-[#262626] bg-[#161616] p-8 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">No matching markets</p>
            <h2 className="mt-2 text-xl font-bold text-white">Try another topic, region, or keyword.</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[#ccc3d8]">
              No synced core markets match this filter set.
            </p>
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleMarkets.map((market) => {
              const isHalted = market.status === 'HALTED';
              const topic = getPrimaryMarketTopic(market);
              const region = market.discoveryRegion ?? inferMarketRegion(market);

              return (
                <article
                  key={market.id}
                  className={`bg-surface-card border border-[#262626] rounded-lg p-6 relative overflow-hidden border-t-2 border-t-deep-orange hover:bg-[#201f1f] transition-all duration-300 group ${
                    isHalted ? 'opacity-80' : ''
                  }`}
                >
                  <div className="absolute inset-0 bg-[#161616]/60 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />

                  <div className="relative z-10">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded border border-[#262626] bg-[#0e0e0e] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#ccc3d8]">
                        {topic}
                      </span>
                      <span className="rounded border border-[#262626] bg-[#0e0e0e] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#ccc3d8]">
                        {region}
                      </span>
                      <span className="rounded border border-[#262626] bg-[#0e0e0e] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#ccc3d8]">
                        Conviction
                      </span>
                    </div>

                    <div className="flex justify-between items-start mb-4 gap-3">
                      <h3 className="font-sans font-semibold text-lg text-white leading-tight w-3/4 group-hover:text-deep-orange transition-colors">
                        {market.title}
                      </h3>
                      <span className={`font-mono text-[9px] font-bold px-2 py-1 rounded border tracking-wider flex-shrink-0 ${
                        isHalted
                          ? 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20'
                          : 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20'
                      }`}>
                        {market.status}
                      </span>
                    </div>

                    <p className="text-xs text-[#ccc3d8]/80 mb-5 min-h-[32px] line-clamp-2">
                      {market.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#ccc3d8] mb-1">24h Vol</span>
                        <span className="block font-sans font-semibold text-lg text-white">{market.vol24h}</span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#ccc3d8] mb-1">Min Order</span>
                        <span className="block font-sans font-semibold text-lg text-white" title={market.liquidityLabel}>
                          {market.liquidity}
                        </span>
                      </div>
                    </div>

                    <div className="mb-6 p-3.5 bg-[#0e0e0e]/90 border border-[#262626] rounded flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#ccc3d8]/80 uppercase tracking-widest">
                        Implied chance <span className="text-deep-orange">(YES)</span>
                      </span>
                      <span className={`font-mono text-xl font-bold ${isHalted ? 'text-[#958da1]' : 'text-electric-purple'}`}>
                        {market.currentOdds.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mb-6">
                      <div className="flex justify-between items-end mb-2">
                        <span className="font-mono text-[10px] text-[#ccc3d8]/80 uppercase tracking-widest">Conviction Index</span>
                        <span className={`font-mono text-xs font-bold ${
                          market.convictionIndex === 'High' ? 'text-deep-orange' :
                          market.convictionIndex === 'Moderate' ? 'text-electric-purple' :
                          market.convictionIndex === 'Low' ? 'text-primary' : 'text-[#958da1]'
                        }`}>
                          {market.convictionIndex}
                        </span>
                      </div>

                      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 shadow-md ${
                            market.convictionIndex === 'High' ? 'meter-gradient shadow-[0_0_8px_rgba(249,115,22,0.18)]' :
                            market.convictionIndex === 'Moderate' ? 'bg-electric-purple shadow-[0_0_10px_rgba(124,58,237,0.4)]' :
                            market.convictionIndex === 'Low' ? 'bg-primary shadow-[0_0_10px_rgba(210,187,255,0.4)]' : 'bg-outline-variant'
                          }`}
                          style={{ width: `${market.convictionValue}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      {isHalted ? (
                        <button
                          disabled
                          className="w-full bg-[#2a2a2a] text-[#4a4455] font-mono text-xs font-bold py-3 rounded flex justify-center items-center gap-1.5 cursor-not-allowed"
                        >
                          Market Halted
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenMargin(market)}
                          className="w-full bg-deep-orange text-black font-sans font-bold text-xs py-3 rounded hover:bg-white transition-all flex justify-center items-center gap-2 glow-orange cursor-pointer"
                        >
                          <span>Review Market</span>
                          <ArrowRight size={14} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenMargin(market)}
                        className="inline-flex items-center justify-center rounded border border-[#262626] bg-[#0e0e0e] px-3 text-[#ccc3d8] transition-colors hover:border-white/40 hover:text-white"
                        aria-label="Review market rules"
                        title="Review market rules"
                      >
                        <BookOpen size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

          {hiddenMarketCount > 0 ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="rounded border border-deep-orange/60 bg-deep-orange px-6 py-3 font-sans text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-white"
              >
                {walletConnected ? 'Load more markets' : 'Sign in to load more markets'}
              </button>
            </div>
          ) : null}
      </div>
    </main>
  );
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

function compareMarkets(a: PredictionMarket, b: PredictionMarket, sortOrder: SortOrder, query: string) {
  if (sortOrder === 'volume') return parseVolume(b.vol24h) - parseVolume(a.vol24h);
  if (sortOrder === 'trending') return getTrendingScore(b) - getTrendingScore(a);
  if (sortOrder === 'conviction') return b.convictionValue - a.convictionValue;
  if (sortOrder === 'odds') return b.currentOdds - a.currentOdds;

  return getMarketRelevanceScore(b, query) - getMarketRelevanceScore(a, query);
}

function getNextSortOrder(current: SortOrder): SortOrder {
  if (current === 'trending') return 'relevance';
  if (current === 'relevance') return 'conviction';
  if (current === 'conviction') return 'odds';
  if (current === 'odds') return 'volume';
  return 'trending';
}

function getSortLabel(sortOrder: SortOrder) {
  if (sortOrder === 'conviction') return 'Conviction';
  if (sortOrder === 'odds') return 'YES Chance';
  if (sortOrder === 'volume') return 'Volume';
  if (sortOrder === 'relevance') return 'Relevance';
  return 'Trending';
}

function getTrendingScore(market: PredictionMarket) {
  const liveBonus = market.status === 'LIVE' ? 35 : 0;
  const urgencyBonus = isBreakingMarket(market) ? 20 : 0;
  const sportBonus = getMarketTopics(market).includes('Sports') || getMarketTopics(market).includes('World Cup') ? 12 : 0;

  return market.convictionValue + liveBonus + urgencyBonus + sportBonus + Math.min(parseVolume(market.vol24h) / 75000, 30);
}

function getMarketRelevanceScore(market: PredictionMarket, query: string) {
  const searchable = `${market.title} ${market.description} ${market.category} ${getMarketTopics(market).join(' ')} ${market.discoveryRegion ?? ''} ${market.source ?? ''}`.toLowerCase();
  const queryTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const queryScore = queryTokens.reduce((score, token) => score + (searchable.includes(token) ? 20 : 0), 0);
  const liveBonus = market.status === 'LIVE' ? 10 : 0;

  return market.convictionValue + liveBonus + queryScore + Math.min(parseVolume(market.vol24h) / 100000, 25);
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
  if (isBreakingMarket(market)) topics.add('Breaking');
  if (matches(text, ['world cup', 'fifa'])) {
    topics.add('World Cup');
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

  if (topics.includes('World Cup')) return 'World Cup';
  if (topics.includes('Esports')) return 'Esports';
  if (topics.includes('Iran')) return 'Iran';
  if (market.discoveryTopic) return market.discoveryTopic;

  return inferMarketTopic(market);
}

function inferMarketTopic(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();

  if (matches(text, ['world cup', 'fifa'])) return 'World Cup';
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
  if (matches(text, ['nigeria', 'kenya', 'ghana', 'south africa', 'ethiopia', 'egypt', 'morocco', 'africa'])) return 'Africa';
  if (matches(text, ['china', 'india', 'japan', 'korea', 'singapore', 'taiwan', 'asia', 'indonesia'])) return 'Asia';
  if (matches(text, ['uk', 'britain', 'london', 'europe', 'eu ', 'france', 'germany', 'spain', 'italy', 'russia', 'ukraine'])) return 'Europe';
  if (matches(text, ['brazil', 'argentina', 'mexico', 'colombia', 'chile', 'latin america', 'latam'])) return 'Latin America';
  if (matches(text, ['israel', 'iran', 'saudi', 'uae', 'qatar', 'gaza', 'middle east', 'palestine'])) return 'Middle East';
  if (matches(text, ['nba', 'nfl', 'mlb', 'new york', 'san antonio', 'oklahoma', 'vegas', 'u.s.', 'usa', 'america', 'united states', 'new york court'])) return 'United States';

  return 'Global';
}

function isBreakingMarket(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();
  return matches(text, ['breaking', 'by end of', 'today', 'tomorrow', 'this week', 'ceasefire', 'attack', 'traffic', 'returns to normal']);
}

function matches(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}
