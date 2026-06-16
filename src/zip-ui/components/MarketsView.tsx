import { useState } from 'react';
import { PredictionMarket } from '../types';
import { Filter, ArrowUpDown, ArrowRight } from 'lucide-react';

interface MarketsViewProps {
  markets: PredictionMarket[];
  onOpenMargin: (market: PredictionMarket) => void;
}

export default function MarketsView({ markets, onOpenMargin }: MarketsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'default' | 'volume'>('default');

  // Categories extraction
  const categories = ['All', ...new Set(markets.map(m => m.category))];

  // Process sorting / filtering
  let filteredMarkets = markets.filter(m => 
    selectedCategory === 'All' ? true : m.category === selectedCategory
  );

  if (sortOrder === 'volume') {
    // Basic sorting from millions/thousands string down to number
    const parseVol = (vol: string) => {
      const num = parseFloat(vol.replace(/[^0-9.]/g, ''));
      if (vol.includes('M')) return num * 1000000;
      if (vol.includes('K')) return num * 1000;
      return num;
    };
    filteredMarkets = [...filteredMarkets].sort((a, b) => parseVol(b.vol24h) - parseVol(a.vol24h));
  }

  return (
    <main className="flex-1 ml-20 md:ml-64 bg-grid-tech min-h-[calc(100vh-64px)] pb-32">
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-8">
      {/* Title Header with telemetry intro */}
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-[#262626] pb-4 gap-4">
        <div>
          <h1 className="text-4xl font-sans font-bold text-white mb-2">Active Markets</h1>
          <p className="text-sm text-[#ccc3d8]">Real-time prediction market telemetry.</p>
        </div>
        
        {/* Dynamic Navigation Toolset */}
        <div className="flex flex-wrap gap-2">
          {/* Category Dropdown/Filter */}
          <div className="relative flex items-center bg-[#201f1f] border border-[#262626] rounded px-3 py-1.5 hover:border-deep-orange transition-colors">
            <Filter size={14} className="text-[#ccc3d8] mr-2" />
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent border-none text-xs font-mono font-bold uppercase tracking-wider text-[#ccc3d8] focus:ring-0 cursor-pointer pr-4"
            >
              {categories.map(cat => (
                <option key={cat} value={cat} className="bg-[#201f1f] text-white py-1">{cat}</option>
              ))}
            </select>
          </div>

          {/* Volume sorting toggle */}
          <button 
            onClick={() => setSortOrder(prev => prev === 'default' ? 'volume' : 'default')}
            className={`px-3 py-1.5 rounded border flex items-center gap-2 transition-all duration-200 cursor-pointer text-xs font-mono font-bold uppercase tracking-wider ${
              sortOrder === 'volume' 
                ? 'bg-deep-orange/15 border-deep-orange text-deep-orange shadow-[0_0_10px_rgba(249,115,22,0.1)]' 
                : 'bg-[#201f1f] border-[#262626] text-[#ccc3d8] hover:text-white'
            }`}
          >
            <ArrowUpDown size={14} />
            <span>Sort Vol</span>
          </button>
        </div>
      </header>

      {/* Grid of Prediction Market Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMarkets.map((market) => {
          const isHalted = market.status === 'HALTED';

          return (
            <article 
              key={market.id} 
              className={`bg-surface-card border border-[#262626] rounded-lg p-6 relative overflow-hidden border-t-2 border-t-deep-orange hover:bg-[#201f1f] transition-all duration-300 group ${
                isHalted ? 'opacity-80' : ''
              }`}
            >
              {/* Glassmorphism subtle overlay */}
              <div className="absolute inset-0 bg-[#161616]/60 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />

              <div className="relative z-10">
                {/* Header title & status badge */}
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

                {/* Subtitle description */}
                <p className="text-xs text-[#ccc3d8]/80 mb-5 min-h-[32px] line-clamp-2">
                  {market.description}
                </p>

                {/* 24h Vol & Liquidity Row */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-[#ccc3d8] mb-1">24h Vol</span>
                    <span className="block font-sans font-semibold text-lg text-white">{market.vol24h}</span>
                  </div>
                  <div>
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-[#ccc3d8] mb-1">Liquidity</span>
                    <span className="block font-sans font-semibold text-lg text-white">{market.liquidity}</span>
                  </div>
                </div>

                {/* Current odds section */}
                <div className="mb-6 p-3.5 bg-[#0e0e0e]/90 border border-[#262626] rounded flex justify-between items-center">
                  <span className="font-mono text-[10px] text-[#ccc3d8]/80 uppercase tracking-widest">
                    Current Odds <span className="text-deep-orange">(YES)</span>
                  </span>
                  <span className={`font-mono text-xl font-bold ${isHalted ? 'text-[#958da1]' : 'text-electric-purple'}`}>
                    ¢{market.currentOdds.toFixed(1)}
                  </span>
                </div>

                {/* Conviction index meter progress */}
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

                {/* Submission CTA */}
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
                    <span>Open Margin</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      </div>
    </main>
  );
}
