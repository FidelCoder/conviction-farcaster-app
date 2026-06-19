import { useMemo, useState } from 'react';
import { PredictionMarket } from '../types';
import { ArrowRight, ArrowUpDown, BookOpen, Filter, Globe2, Search, Sparkles } from 'lucide-react';

interface MarketsViewProps {
  markets: PredictionMarket[];
  onOpenMargin: (market: PredictionMarket) => void;
}

type SortOrder = 'relevance' | 'conviction' | 'odds' | 'volume';

const FEATURED_TOPICS = ['All', 'Crypto', 'Sports', 'Geopolitics', 'Politics', 'Social', 'Culture', 'Economics', 'Tech', 'Climate'];
const FEATURED_REGIONS = ['All', 'Global', 'Africa', 'Asia', 'Europe', 'Latin America', 'Middle East', 'United States', 'Crypto-native'];

export default function MarketsView({ markets, onOpenMargin }: MarketsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTopic, setSelectedTopic] = useState<string>('All');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('relevance');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => buildOptions(markets.map((market) => market.category)), [markets]);
  const topics = useMemo(
    () => mergeFeaturedOptions(FEATURED_TOPICS, markets.map((market) => market.discoveryTopic ?? inferMarketTopic(market))),
    [markets],
  );
  const regions = useMemo(
    () => mergeFeaturedOptions(FEATURED_REGIONS, markets.map((market) => market.discoveryRegion ?? inferMarketRegion(market))),
    [markets],
  );

  const filteredMarkets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return markets
      .filter((market) => selectedCategory === 'All' || market.category === selectedCategory)
      .filter((market) => {
        const topic = market.discoveryTopic ?? inferMarketTopic(market);
        return selectedTopic === 'All' || topic === selectedTopic;
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
          market.discoveryTopic ?? inferMarketTopic(market),
          market.discoveryRegion ?? inferMarketRegion(market),
          market.source,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => compareMarkets(a, b, sortOrder, searchQuery));
  }, [markets, searchQuery, selectedCategory, selectedRegion, selectedTopic, sortOrder]);

  return (
    <main className="flex-1 md:ml-64 bg-grid-tech min-h-[calc(100vh-64px)] pb-32">
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-8">
        <header className="mb-6 border-b border-[#262626] pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded border border-deep-orange/30 bg-deep-orange/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">
                <Sparkles size={12} />
                Market discovery
              </p>
              <h1 className="text-3xl md:text-4xl font-sans font-bold text-white mb-2">Active Markets</h1>
              <p className="max-w-2xl text-sm text-[#ccc3d8]">
                Find real synced prediction markets by topic, region, and resolution context before opening a margin request.
              </p>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto] xl:max-w-5xl">
              <label className="relative flex min-w-0 items-center rounded border border-[#262626] bg-[#201f1f] px-3 py-1.5 transition-colors focus-within:border-deep-orange">
                <Search size={14} className="mr-2 text-[#ccc3d8]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search sports, geopolitics, crypto..."
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
            <span className="rounded border border-[#262626] bg-[#111111] px-2 py-1">{filteredMarkets.length} shown</span>
            {selectedTopic !== 'All' ? <span className="rounded border border-deep-orange/30 bg-deep-orange/10 px-2 py-1 text-deep-orange">{selectedTopic}</span> : null}
            {selectedRegion !== 'All' ? <span className="rounded border border-electric-purple/40 bg-electric-purple/10 px-2 py-1 text-[#d2bbff]">{selectedRegion}</span> : null}
          </div>
        </header>

        {filteredMarkets.length === 0 ? (
          <section className="rounded-lg border border-[#262626] bg-[#161616] p-8 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">No matching markets</p>
            <h2 className="mt-2 text-xl font-bold text-white">Try another topic, region, or keyword.</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[#ccc3d8]">
              The board filters markets returned by core. As more feeds are synced, this engine can surface more local and global markets.
            </p>
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMarkets.map((market) => {
              const isHalted = market.status === 'HALTED';
              const topic = market.discoveryTopic ?? inferMarketTopic(market);
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
                            market.convictionIndex === 'High' ? 'meter-gradient shadow-[0_0_10px_rgba(249,115,22,0.4)]' :
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
  const allValues = Array.from(new Set([...featured, ...values.filter(Boolean)]));
  return ['All', ...allValues.filter((value) => value !== 'All').sort((a, b) => {
    const leftFeatured = featured.indexOf(a);
    const rightFeatured = featured.indexOf(b);

    if (leftFeatured !== -1 || rightFeatured !== -1) {
      return (leftFeatured === -1 ? 999 : leftFeatured) - (rightFeatured === -1 ? 999 : rightFeatured);
    }

    return a.localeCompare(b);
  })];
}

function compareMarkets(a: PredictionMarket, b: PredictionMarket, sortOrder: SortOrder, query: string) {
  if (sortOrder === 'volume') return parseVolume(b.vol24h) - parseVolume(a.vol24h);
  if (sortOrder === 'conviction') return b.convictionValue - a.convictionValue;
  if (sortOrder === 'odds') return b.currentOdds - a.currentOdds;

  return getMarketRelevanceScore(b, query) - getMarketRelevanceScore(a, query);
}

function getNextSortOrder(current: SortOrder): SortOrder {
  if (current === 'relevance') return 'conviction';
  if (current === 'conviction') return 'odds';
  if (current === 'odds') return 'volume';
  return 'relevance';
}

function getSortLabel(sortOrder: SortOrder) {
  if (sortOrder === 'conviction') return 'Conviction';
  if (sortOrder === 'odds') return 'YES Chance';
  if (sortOrder === 'volume') return 'Volume';
  return 'Relevance';
}

function getMarketRelevanceScore(market: PredictionMarket, query: string) {
  const searchable = `${market.title} ${market.description} ${market.category} ${market.discoveryTopic ?? ''} ${market.discoveryRegion ?? ''} ${market.source ?? ''}`.toLowerCase();
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

function inferMarketTopic(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();

  if (matches(text, ['war', 'ceasefire', 'nato', 'taiwan', 'gaza', 'israel', 'iran', 'russia', 'ukraine', 'sanction'])) return 'Geopolitics';
  if (matches(text, ['nba', 'nfl', 'nhl', 'mlb', 'champion', 'finals', 'cup', 'league', 'ufc', 'soccer', 'football', 'cricket', 'formula 1'])) return 'Sports';
  if (matches(text, ['bitcoin', 'btc', 'ethereum', 'eth', 'airdrop', 'token', 'crypto', 'defi', 'chain', 'solana'])) return 'Crypto';
  if (matches(text, ['election', 'president', 'senate', 'congress', 'minister', 'policy', 'government', 'parliament'])) return 'Politics';
  if (matches(text, ['trend', 'tiktok', 'twitter', 'meme', 'protest', 'strike', 'trial'])) return 'Social';
  if (matches(text, ['fed', 'rates', 'inflation', 'gdp', 'recession', 'oil', 'stocks', 'market', 'tariff'])) return 'Economics';
  if (matches(text, ['climate', 'weather', 'hurricane', 'temperature', 'rain', 'flood', 'wildfire'])) return 'Climate';
  if (matches(text, ['album', 'movie', 'music', 'gta', 'celebrity', 'award', 'streaming'])) return 'Culture';
  if (matches(text, ['ai', 'openai', 'nvidia', 'apple', 'tesla', 'spacex', 'startup', 'tech'])) return 'Tech';

  return 'World';
}

function inferMarketRegion(market: PredictionMarket) {
  const text = `${market.title} ${market.description} ${market.category}`.toLowerCase();

  if (matches(text, ['crypto', 'bitcoin', 'ethereum', 'airdrop', 'token', 'defi', 'solana', 'onchain', 'on-chain'])) return 'Crypto-native';
  if (matches(text, ['nigeria', 'kenya', 'ghana', 'south africa', 'ethiopia', 'egypt', 'morocco', 'africa'])) return 'Africa';
  if (matches(text, ['china', 'india', 'japan', 'korea', 'singapore', 'taiwan', 'asia', 'indonesia'])) return 'Asia';
  if (matches(text, ['uk', 'britain', 'london', 'europe', 'eu ', 'france', 'germany', 'spain', 'italy', 'russia', 'ukraine'])) return 'Europe';
  if (matches(text, ['brazil', 'argentina', 'mexico', 'colombia', 'chile', 'latin america', 'latam'])) return 'Latin America';
  if (matches(text, ['israel', 'iran', 'saudi', 'uae', 'qatar', 'gaza', 'middle east', 'palestine'])) return 'Middle East';
  if (matches(text, ['nba', 'nfl', 'mlb', 'new york', 'san antonio', 'oklahoma', 'vegas', 'u.s.', 'usa', 'america', 'united states'])) return 'United States';

  return 'Global';
}

function matches(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}
