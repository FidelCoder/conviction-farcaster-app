import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getVaultAvailableBalance } from '../../lib/wallet-balances';
import { PredictionMarket, Vault, MarketTapeItem, UserPortfolio } from '../types';
import { Info, Bolt, BookOpen, RefreshCw, TrendingUp, X } from 'lucide-react';


type MarketCandle = {
  close: number;
  high: number;
  low: number;
  open: number;
  timestamp: string;
  volume?: number | null;
};

type ChartHitTarget = {
  candle: MarketCandle;
  index: number;
  plotBottom: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  x: number;
  y: number;
};

type MarketHistoryRange = '1h' | '1w' | '1m' | '1y';

type MarketHistoryState =
  | { status: 'loading'; candles: MarketCandle[]; range: MarketHistoryRange; source: string }
  | { status: 'ready'; candles: MarketCandle[]; range: MarketHistoryRange; source: string }
  | { status: 'snapshot_only'; candles: MarketCandle[]; range: MarketHistoryRange; source: string }
  | { status: 'empty'; candles: MarketCandle[]; range: MarketHistoryRange; source: string };

const HISTORY_RANGES: Array<{ label: string; value: MarketHistoryRange }> = [
  { label: '1H', value: '1h' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '1Y', value: '1y' },
];

interface MarginDeskViewProps {
  markets: PredictionMarket[];
  vaults: Vault[];
  tape: MarketTapeItem[];
  activeMarket: PredictionMarket;
  setActiveMarket: (market: PredictionMarket) => void;
  portfolio: UserPortfolio;
  onRequestMargin: (vaultId: string, marginAmt: number, leverage: number, estPosition: number, liqPrice: number, outcomeType?: 'YES' | 'NO', visibility?: 'PUBLIC' | 'PRIVATE') => Promise<void> | void;
}

export default function MarginDeskView({
  markets,
  vaults,
  tape,
  activeMarket,
  setActiveMarket,
  portfolio,
  onRequestMargin
}: MarginDeskViewProps) {
  const [selectedVaultId, setSelectedVaultId] = useState<string>(vaults[0]?.id || 'usdc-core-vault');
  const [leverage, setLeverage] = useState<number>(5);
  const [marginAmount, setMarginAmount] = useState<string>('');
  const [outcomeType, setOutcomeType] = useState<'YES' | 'NO'>('YES');
  const [tradeVisibility, setTradeVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [historyRange, setHistoryRange] = useState<MarketHistoryRange>('1w');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartTargetsRef = useRef<ChartHitTarget[]>([]);
  const [hoveredCandle, setHoveredCandle] = useState<ChartHitTarget | null>(null);
  const [historyState, setHistoryState] = useState<MarketHistoryState>({
    status: 'loading',
    candles: [],
    range: '1w',
    source: 'CONVICTION_LOADING',
  });

  const selectedVault = vaults.find(v => v.id === selectedVaultId) || vaults[0];

  useEffect(() => {
    if (selectedVault && leverage > selectedVault.maxLeverage) {
      setLeverage(selectedVault.maxLeverage);
    }
  }, [leverage, selectedVault]);

  useEffect(() => {
    let isCurrent = true;

    setHistoryState({ status: 'loading', candles: [], range: historyRange, source: 'CONVICTION_LOADING' });
    setHoveredCandle(null);

    fetch('/api/markets/' + encodeURIComponent(activeMarket.id) + '/history?range=' + historyRange)
      .then((response) => response.json())
      .then((body: unknown) => {
        if (!isCurrent) return;

        const history = parseHistoryResponse(body);
        setHistoryState(history);
      })
      .catch(() => {
        if (!isCurrent) return;

        const fallback = buildSnapshotCandles(activeMarket);
        setHistoryState({
          status: fallback.length > 0 ? 'snapshot_only' : 'empty',
          candles: fallback,
          range: historyRange,
          source: 'CONVICTION_SNAPSHOT',
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [activeMarket, historyRange]);

  useEffect(() => {
    const hoveredIndex = hoveredCandle?.index ?? null;
    chartTargetsRef.current = drawCandlestickChart(canvasRef.current, historyState.candles, hoveredIndex);

    const handleResize = () => {
      chartTargetsRef.current = drawCandlestickChart(canvasRef.current, historyState.candles, hoveredIndex);
    };
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [historyState, hoveredCandle?.index]);

  const maxCollateral = selectedVault
    ? getVaultAvailableBalance({ portfolio, vault: selectedVault })
    : 0;

  const currentOutcomeOdds = outcomeType === 'YES' ? activeMarket.currentOdds : (100 - activeMarket.currentOdds);
  const numericAmount = parseFloat(marginAmount) || 0;
  const pricePerShare = Math.max(0.01, currentOutcomeOdds / 100);
  const tradingPower = numericAmount * leverage;
  const borrowedLiquidity = Math.max(0, tradingPower - numericAmount);
  const contractShares = Math.floor(tradingPower / pricePerShare);
  const estimatedPosition = contractShares * pricePerShare;
  const liquidationOdds = activeMarket.status === 'HALTED'
    ? 0
    : currentOutcomeOdds * (1 - 0.70 / Math.max(leverage, 1));
  const reviewRows = useMemo(() => buildMarketReviewRows(activeMarket), [activeMarket]);

  const handleMaxCollateral = () => {
    setMarginAmount(maxCollateral.toFixed(2));
  };

  const handleChartPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const targets = chartTargetsRef.current;
    const firstTarget = targets[0];

    if (!firstTarget) {
      if (hoveredCandle) setHoveredCandle(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < firstTarget.plotLeft || x > firstTarget.plotRight || y < firstTarget.plotTop || y > firstTarget.plotBottom) {
      if (hoveredCandle) setHoveredCandle(null);
      return;
    }

    const nearest = targets.reduce((closest, target) => (
      Math.abs(target.x - x) < Math.abs(closest.x - x) ? target : closest
    ));

    if (hoveredCandle?.index !== nearest.index) {
      setHoveredCandle(nearest);
    }
  };

  const handleChartPointerLeave = () => {
    setHoveredCandle(null);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!portfolio.connected) {
      alert('Connect your wallet before requesting margin. Your request is tied to the connected wallet address.');
      return;
    }

    if (numericAmount <= 0) {
      alert('Enter a positive collateral amount.');
      return;
    }

    if (numericAmount > maxCollateral) {
      alert(`Insufficient vault balance. You can use up to ${maxCollateral.toFixed(2)} ${selectedVault.asset}.`);
      return;
    }

    setIsRequesting(true);

    try {
      await onRequestMargin(
        selectedVault.id,
        numericAmount,
        leverage,
        estimatedPosition,
        liquidationOdds,
        outcomeType,
        tradeVisibility
      );
      setMarginAmount('');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col lg:flex-row mt-16 md:ml-64 p-4 md:p-6 gap-6 min-h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] overflow-y-auto lg:overflow-hidden pb-28 lg:pb-6">
      <section className="w-full lg:w-64 bg-[#161616] border border-[#262626] rounded flex flex-col overflow-hidden max-h-72 lg:max-h-full">
        <div className="px-4 py-3 border-b border-[#262626] bg-[#0e0e0e] flex justify-between items-center">
          <h3 className="font-mono text-[10px] text-[#ccc3d8] font-bold uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp size={12} className="text-deep-orange" />
            <span>Market Tape</span>
          </h3>
          <span className="font-mono text-[9px] text-[#ccc3d8]/60 bg-[#262626] px-1.5 py-0.5 rounded uppercase">LIVE</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-[#ccc3d8]/60 sticky top-0 bg-[#161616] border-b border-[#262626] text-[10px] uppercase">
              <tr>
                <th className="py-2 px-3 font-normal">Market</th>
                <th className="py-2 px-3 font-normal text-right">YES</th>
                <th className="py-2 px-3 font-normal text-right">Min</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {tape.map((item) => {
                const matchedMarket = markets.find(m => m.id === item.id);
                const isSelected = item.id === activeMarket.id;

                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      if (matchedMarket) setActiveMarket(matchedMarket);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-deep-orange/15 text-white border-l-2 border-l-deep-orange'
                        : 'hover:bg-[#1A1A1A] text-[#ccc3d8]'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-white">{item.market}</td>
                    <td className={`py-2.5 px-3 text-right font-medium ${item.isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {formatPercent(item.price * 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#ccc3d8]/80">{item.size}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex-1 bg-[#161616] border border-[#262626] rounded flex flex-col overflow-hidden relative min-h-[420px]">
        <div className="px-4 sm:px-6 py-4 border-b border-[#262626] flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 bg-[#0e0e0e] z-10 relative">
          <div>
            <div className="mb-2 flex flex-wrap gap-2 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]">
              <span className="rounded border border-[#262626] bg-[#161616] px-2 py-1">Conviction market</span>
              <span className="rounded border border-[#262626] bg-[#161616] px-2 py-1">{activeMarket.discoveryTopic ?? 'World'}</span>
              <span className="rounded border border-[#262626] bg-[#161616] px-2 py-1">{activeMarket.discoveryRegion ?? 'Global'}</span>
            </div>
            <h2 className="font-sans font-bold text-lg text-white leading-tight">
              {activeMarket.title}
            </h2>
            <p className="font-mono text-[11px] text-[#ccc3d8] mt-1 uppercase tracking-wider">
              Review the event and pricing before requesting margin
            </p>
          </div>

          <div className="text-left sm:text-right">
            <div className="font-mono text-xl font-extrabold text-[#10B981]">
              {formatPercent(activeMarket.currentOdds)} YES
            </div>
            <div className="font-mono text-xs text-[#EF4444]">
              {formatPercent(100 - activeMarket.currentOdds)} NO
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0A0A0A]">
          <div className="grid gap-4 min-[1500px]:grid-cols-[minmax(720px,1fr)_20rem]">
            <article className="min-w-0 rounded border border-[#262626] bg-[#161616] p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Market Flow</p>
                  <h3 className="mt-1 text-lg font-bold text-white">YES price candles</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {HISTORY_RANGES.map((range) => (
                    <button
                      key={range.value}
                      type="button"
                      onClick={() => setHistoryRange(range.value)}
                      aria-pressed={historyRange === range.value}
                      className={`rounded border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        historyRange === range.value
                          ? 'border-deep-orange bg-deep-orange text-black'
                          : 'border-[#262626] bg-[#0e0e0e] text-[#ccc3d8] hover:border-white/40 hover:text-white'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                  <span className="rounded border border-[#262626] bg-[#0e0e0e] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]">
                    {getHistoryStatusLabel(historyState)}
                  </span>
                </div>
              </div>

              <div
                className="relative h-[560px] min-h-[420px] overflow-hidden rounded border border-[#262626] bg-[#050505]"
                onPointerLeave={handleChartPointerLeave}
                onPointerMove={handleChartPointerMove}
              >
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                {hoveredCandle ? (
                  <div
                    className="pointer-events-none absolute z-10 w-52 rounded border border-[#3a3a3a] bg-[#101010]/95 p-3 font-mono text-[10px] text-[#ccc3d8] shadow-2xl"
                    style={{
                      left: `min(calc(100% - 13.5rem), ${Math.max(12, hoveredCandle.x + 14)}px)`,
                      top: `max(12px, ${Math.min(hoveredCandle.y - 48, hoveredCandle.plotBottom - 124)}px)`,
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-bold uppercase tracking-widest text-deep-orange">Candle</span>
                      <span className="text-[#ccc3d8]/70">{formatChartTime(hoveredCandle.candle.timestamp)}</span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <TooltipRow label="Open" value={formatPercent(hoveredCandle.candle.open)} />
                      <TooltipRow label="Close" value={formatPercent(hoveredCandle.candle.close)} />
                      <TooltipRow label="High" value={formatPercent(hoveredCandle.candle.high)} />
                      <TooltipRow label="Low" value={formatPercent(hoveredCandle.candle.low)} />
                      <TooltipRow label="Move" value={formatSignedPercent(hoveredCandle.candle.close - hoveredCandle.candle.open)} />
                      <TooltipRow label="Volume" value={formatVolume(hoveredCandle.candle.volume)} />
                    </dl>
                  </div>
                ) : null}
                {historyState.status === 'loading' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#050505]/70 font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]">
                    Loading candles...
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PriceTile label="YES chance" value={formatPercent(activeMarket.currentOdds)} tone="yes" />
                <PriceTile label="NO chance" value={formatPercent(100 - activeMarket.currentOdds)} tone="no" />
                <PriceTile label="Last trade" value={formatRawProbability(activeMarket.lastTradePrice)} />
                <PriceTile label="Best bid" value={formatRawProbability(activeMarket.bestBid)} />
                <PriceTile label="Best ask" value={formatRawProbability(activeMarket.bestAsk)} />
                <PriceTile label="Min order" value={activeMarket.orderMinSize ? activeMarket.orderMinSize + ' contracts' : 'Pending'} />
              </div>
            </article>

            <article className="rounded border border-[#262626] bg-[#161616] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Event Details</p>
                  <h3 className="mt-1 text-xl font-bold text-white">Resolution summary</h3>
                </div>
                <span className={`rounded border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest ${
                  activeMarket.status === 'LIVE'
                    ? 'border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]'
                    : 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]'
                }`}>
                  {activeMarket.status}
                </span>
              </div>

              <p className="line-clamp-6 text-sm leading-relaxed text-[#ccc3d8]">{activeMarket.description}</p>

              <dl className="mt-5 grid gap-3">
                {reviewRows.slice(1, 5).map((row) => (
                  <div key={row.label} className="rounded border border-[#262626] bg-[#0e0e0e] p-3">
                    <dt className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/60">{row.label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-white">{row.value}</dd>
                  </div>
                ))}
              </dl>

              <button
                type="button"
                onClick={() => setIsRulesOpen(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded border border-deep-orange/50 bg-deep-orange/10 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange transition-colors hover:bg-deep-orange hover:text-black"
              >
                <BookOpen size={14} />
                <span>View rules</span>
              </button>
            </article>
          </div>
        </div>
      </section>


      {isRulesOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Market rules">
          <section className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded border border-[#262626] bg-[#161616] shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-[#262626] bg-[#0e0e0e] p-5">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Market rules</p>
                <h3 className="mt-1 text-xl font-bold text-white">{activeMarket.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRulesOpen(false)}
                className="grid h-9 w-9 flex-shrink-0 place-items-center rounded border border-[#262626] bg-[#161616] text-[#ccc3d8] hover:border-white/40 hover:text-white"
                aria-label="Close market rules"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm leading-relaxed text-[#ccc3d8]">{activeMarket.description}</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {reviewRows.map((row) => (
                  <div key={row.label} className="rounded border border-[#262626] bg-[#0e0e0e] p-3">
                    <dt className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/60">{row.label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-white">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
      ) : null}

      <section className="w-full lg:w-[340px] flex flex-col gap-4 overflow-visible lg:overflow-y-auto lg:max-h-full">
        <form
          onSubmit={handleOrderSubmit}
          className="bg-[#161616] border-t-2 border-t-deep-orange border-x border-b border-[#262626] rounded p-6 glow-orange transition-all duration-300"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-sans font-bold text-lg text-white">Margin Request</h3>
            <Bolt size={18} className="text-deep-orange" />
          </div>

          <div className="mb-6">
            <label className="block font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">Pick Outcome</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOutcomeType('YES')}
                className={`py-3 px-4 rounded text-center transition-all cursor-pointer font-sans font-bold text-xs ${
                  outcomeType === 'YES'
                    ? 'bg-deep-orange text-black font-extrabold shadow-md'
                    : 'bg-[#0e0e0e] text-[#ccc3d8] border border-[#262626] hover:border-white/25'
                }`}
              >
                YES ({formatPercent(activeMarket.currentOdds)})
              </button>
              <button
                type="button"
                onClick={() => setOutcomeType('NO')}
                className={`py-3 px-4 rounded text-center transition-all cursor-pointer font-sans font-bold text-xs ${
                  outcomeType === 'NO'
                    ? 'bg-[#EF4444] text-white font-extrabold shadow-md'
                    : 'bg-[#0e0e0e] text-[#ccc3d8] border border-[#262626] hover:border-white/25'
                }`}
              >
                NO ({formatPercent(100 - activeMarket.currentOdds)})
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">Select Vault</label>
            <div className="relative">
              <select
                value={selectedVaultId}
                onChange={(e) => setSelectedVaultId(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 font-mono text-xs focus:outline-none focus:border-deep-orange transition-colors cursor-pointer appearance-none"
              >
                {vaults.map((vault) => (
                  <option key={vault.id} value={vault.id}>
                    {vault.name} ({vault.riskTag})
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-3.5 pointer-events-none">
                <span className="text-[#ccc3d8] text-xs">▼</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <label className="font-mono text-[10px] text-[#ccc3d8] uppercase tracking-widest font-bold">Leverage</label>
              <span className="font-mono text-xs text-deep-orange font-extrabold">{leverage}X</span>
            </div>
            <input
              type="range"
              min="1"
              max={selectedVault.maxLeverage}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full accent-deep-orange bg-[#262626] h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
            />
            <div className="flex justify-between text-[9px] text-[#ccc3d8]/60 font-mono mt-1 font-bold">
              <span>1X</span>
              <span>{Math.floor(selectedVault.maxLeverage / 2)}X</span>
              <span>{selectedVault.maxLeverage}X Max</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">Trade Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              {(['PRIVATE', 'PUBLIC'] as const).map((visibility) => (
                <button
                  key={visibility}
                  type="button"
                  onClick={() => setTradeVisibility(visibility)}
                  aria-pressed={tradeVisibility === visibility}
                  className={`rounded border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    tradeVisibility === visibility
                      ? 'border-deep-orange bg-deep-orange text-black'
                      : 'border-[#262626] bg-[#0e0e0e] text-[#ccc3d8] hover:border-white/30'
                  }`}
                >
                  {visibility === 'PUBLIC' ? 'Public' : 'Private'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#ccc3d8]/75">
              Public trades appear in Market Pulse for followers. Private trades stay in your portfolio.
            </p>
          </div>

          <div className="mb-6">
            <label className="block font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">
              Collateral From Vault ({selectedVault.asset})
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={marginAmount}
                onChange={(e) => setMarginAmount(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 font-mono text-lg text-right focus:outline-none focus:border-deep-orange focus:ring-1 focus:ring-deep-orange/50 transition-colors"
                disabled={activeMarket.status === 'HALTED'}
              />
              <span className="absolute left-3 top-4 text-xs font-mono font-extrabold text-[#ccc3d8]/60 italic">
                {selectedVault.asset}
              </span>
            </div>

            <div className="flex justify-between mt-2 font-mono text-[11px]">
              <span className="text-[#ccc3d8]/80">Vault balance: {maxCollateral.toFixed(2)} {selectedVault.asset}</span>
              <button
                type="button"
                onClick={handleMaxCollateral}
                className="text-deep-orange hover:text-white font-extrabold transition-colors uppercase tracking-wider text-[10px]"
                disabled={activeMarket.status === 'HALTED'}
              >
                Max
              </button>
            </div>
          </div>

          {activeMarket.status === 'HALTED' ? (
            <button
              type="button"
              disabled
              className="w-full bg-[#2a2a2a] text-[#4a4455] font-mono font-bold text-xs py-4 rounded tracking-wider uppercase cursor-not-allowed text-center"
            >
              Market Halted
            </button>
          ) : (
            <button
              type="submit"
              disabled={isRequesting}
              className={`w-full bg-deep-orange text-black font-sans font-bold text-xs py-4 rounded tracking-wider transition-all duration-300 shadow-lg hover:shadow-deep-orange/20 hover:scale-[1.01] uppercase flex items-center justify-center gap-2 cursor-pointer ${
                isRequesting ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {isRequesting ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  <span>Submitting request...</span>
                </>
              ) : (
                <>
                  <Bolt size={14} />
                  <span>Request Margin</span>
                </>
              )}
            </button>
          )}

          <div className="mt-5 pt-4 border-t border-[#262626] flex flex-col gap-2">
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Outcome:</span>
              <span className={`font-bold ${outcomeType === 'YES' ? 'text-deep-orange' : 'text-[#EF4444]'}`}>
                {outcomeType}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Your collateral:</span>
              <span className="text-white font-semibold">${numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Vault liquidity used:</span>
              <span className="text-white font-semibold">${borrowedLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Total position size:</span>
              <span className="text-white font-semibold">${tradingPower.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Estimated shares:</span>
              <span className="text-white font-semibold">{contractShares > 0 ? contractShares.toLocaleString() : '--'}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Visibility:</span>
              <span className="text-white font-semibold">{tradeVisibility}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Liquidation trigger:</span>
              <span className={`font-semibold ${liquidationOdds > 0 ? 'text-[#EF4444]' : 'text-white'}`}>
                {liquidationOdds > 0 ? formatPercent(liquidationOdds) : '--'}
              </span>
            </div>
          </div>
        </form>

        <div className="bg-[#1c1b1b] border border-[#262626] rounded p-4 text-[11px] font-mono text-[#ccc3d8] flex gap-3 items-start">
          <Info size={16} className="text-electric-purple flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Vault deposits form the liquidity pool. Traders use their deposited balance as collateral, then borrow extra pool liquidity for leverage. Vault depositors earn yield from fees and risk premiums as the system matures.
          </p>
        </div>
      </section>
    </main>
  );
}

function parseHistoryResponse(body: unknown): MarketHistoryState {
  if (!isRecord(body) || body.ok !== true || !isRecord(body.data)) {
    return { status: 'empty', candles: [], range: '1w', source: 'CONVICTION_EMPTY' };
  }

  const candlesValue = body.data.candles;
  const candles = Array.isArray(candlesValue)
    ? candlesValue.filter(isMarketCandle)
    : [];
  const statusValue = typeof body.data.status === 'string' ? body.data.status : 'empty';
  const source = typeof body.data.source === 'string' ? body.data.source : 'CONVICTION_HISTORY';
  const range = isMarketHistoryRange(body.data.range) ? body.data.range : '1w';

  if (candles.length === 0) {
    return { status: 'empty', candles: [], range, source };
  }

  if (statusValue === 'snapshot_only') {
    return { status: 'snapshot_only', candles, range, source };
  }

  return { status: 'ready', candles, range, source };
}

function isMarketHistoryRange(value: unknown): value is MarketHistoryRange {
  return value === '1h' || value === '1w' || value === '1m' || value === '1y';
}

function drawCandlestickChart(
  canvas: HTMLCanvasElement | null,
  candles: MarketCandle[],
  hoveredIndex: number | null = null,
): ChartHitTarget[] {
  if (!canvas) return [];

  const parent = canvas.parentElement;
  const width = Math.max(360, parent?.clientWidth ?? 760);
  const height = Math.max(420, parent?.clientHeight ?? 520);
  const pixelRatio = window.devicePixelRatio || 1;
  const context = canvas.getContext('2d');

  if (!context) return [];

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  drawChartBackground(context, width, height);

  if (candles.length === 0) {
    drawChartEmptyState(context, width, height, 'Awaiting market price history');
    return [];
  }

  const displayCandles = getReadableCandles(candles, width);
  const plot = { left: 58, right: 78, top: 30, bottom: 56 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const values = displayCandles.flatMap((candle) => [candle.high, candle.low, candle.open, candle.close]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(1.5, (rawMax - rawMin) * 0.16);
  const min = Math.max(0, rawMin - padding);
  const max = Math.min(100, rawMax + padding);
  const range = Math.max(1, max - min);
  const yFor = (value: number) => plot.top + ((max - value) / range) * plotHeight;

  drawChartAxis(context, width, height, plot, min, max);

  const candleGap = displayCandles.length > 1 ? plotWidth / displayCandles.length : plotWidth;
  const candleWidth = Math.max(8, Math.min(18, candleGap * 0.66));
  const targets: ChartHitTarget[] = [];

  displayCandles.forEach((candle, index) => {
    const x = plot.left + candleGap * index + candleGap / 2;
    const openY = yFor(candle.open);
    const closeY = yFor(candle.close);
    const highY = yFor(candle.high);
    const lowY = yFor(candle.low);
    const isUp = candle.close >= candle.open;
    const isHovered = hoveredIndex === index;
    const color = isUp ? '#00d69f' : '#ff4545';
    const fill = isUp ? 'rgba(0, 214, 159, 0.32)' : 'rgba(255, 69, 69, 0.28)';
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(3, Math.abs(closeY - openY));

    if (isHovered) {
      context.fillStyle = 'rgba(249, 115, 22, 0.09)';
      context.fillRect(x - candleGap / 2, plot.top, candleGap, plotHeight);
      context.strokeStyle = 'rgba(249, 115, 22, 0.72)';
      context.setLineDash([4, 5]);
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, height - plot.bottom);
      context.stroke();
      context.setLineDash([]);
    }

    context.strokeStyle = color;
    context.lineWidth = isHovered ? 2.3 : 1.6;
    context.beginPath();
    context.moveTo(x, highY);
    context.lineTo(x, lowY);
    context.stroke();

    context.fillStyle = isHovered ? color : fill;
    context.strokeStyle = color;
    context.lineWidth = isHovered ? 2 : 1.4;
    context.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    context.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

    targets.push({
      candle,
      index,
      plotBottom: height - plot.bottom,
      plotLeft: plot.left,
      plotRight: width - plot.right,
      plotTop: plot.top,
      x,
      y: closeY,
    });
  });

  const lastCandle = displayCandles[displayCandles.length - 1];
  const lastY = yFor(lastCandle.close);
  context.strokeStyle = '#F97316';
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(plot.left, lastY);
  context.lineTo(width - plot.right, lastY);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = '#F97316';
  context.font = '800 11px JetBrains Mono, monospace';
  context.textAlign = 'right';
  context.fillText(formatPercent(lastCandle.close), width - 10, Math.max(18, Math.min(height - plot.bottom - 8, lastY - 6)));
  context.textAlign = 'start';

  context.fillStyle = 'rgba(204, 195, 216, 0.58)';
  context.font = '800 10px JetBrains Mono, monospace';
  context.fillText('CONVICTION YES FLOW', plot.left, height - 16);

  return targets;
}
function getReadableCandles(candles: MarketCandle[], width: number) {
  const maxCandles = Math.max(26, Math.floor(width / 13));

  if (candles.length <= maxCandles) return candles;

  return candles.slice(candles.length - maxCandles);
}

function drawChartBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = '#050505';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(255, 255, 255, 0.032)';
  context.lineWidth = 1;

  for (let x = 0; x < width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y < height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawChartAxis(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  plot: { left: number; right: number; top: number; bottom: number },
  min: number,
  max: number,
) {
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;

  context.strokeStyle = 'rgba(204, 195, 216, 0.2)';
  context.lineWidth = 1;
  context.strokeRect(plot.left, plot.top, plotWidth, plotHeight);
  context.fillStyle = 'rgba(204, 195, 216, 0.68)';
  context.font = '800 9px JetBrains Mono, monospace';

  [max, max - (max - min) * 0.25, (max + min) / 2, min + (max - min) * 0.25, min].forEach((value) => {
    const y = plot.top + ((max - value) / Math.max(1, max - min)) * plotHeight;

    context.strokeStyle = 'rgba(204, 195, 216, 0.075)';
    context.beginPath();
    context.moveTo(plot.left, y);
    context.lineTo(width - plot.right, y);
    context.stroke();

    context.fillStyle = 'rgba(204, 195, 216, 0.68)';
    context.fillText(formatPercent(value), 8, Math.max(plot.top + 10, Math.min(height - plot.bottom - 4, y + 3)));
  });
}

function drawChartEmptyState(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  message: string,
) {
  context.fillStyle = 'rgba(204, 195, 216, 0.7)';
  context.font = '700 11px JetBrains Mono, monospace';
  context.textAlign = 'center';
  context.fillText(message, width / 2, height / 2);
  context.textAlign = 'start';
}

function buildSnapshotCandles(market: PredictionMarket): MarketCandle[] {
  const bestBid = parseProbabilityValue(market.bestBid);
  const bestAsk = parseProbabilityValue(market.bestAsk);
  const lastTrade = parseProbabilityValue(market.lastTradePrice);
  const close = lastTrade ?? market.currentOdds;

  if (!Number.isFinite(close) || close <= 0) return [];

  const midpoint = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : close;
  const high = Math.max(close, midpoint, bestAsk ?? close);
  const low = Math.min(close, midpoint, bestBid ?? close);

  return [
    {
      close: clampProbability(close),
      high: clampProbability(high),
      low: clampProbability(low),
      open: clampProbability(midpoint),
      timestamp: market.syncedAt ?? new Date().toISOString(),
      volume: null,
    },
  ];
}

function getHistoryStatusLabel(history: MarketHistoryState) {
  if (history.status === 'loading') return 'Loading';
  if (history.status === 'ready') return 'Synced history';
  if (history.status === 'snapshot_only') return 'Latest snapshot';
  return 'Awaiting data';
}

function isMarketCandle(value: unknown): value is MarketCandle {
  return isRecord(value) &&
    typeof value.timestamp === 'string' &&
    Number.isFinite(value.open) &&
    Number.isFinite(value.high) &&
    Number.isFinite(value.low) &&
    Number.isFinite(value.close);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseProbabilityValue(value: string | null | undefined) {
  if (!value) return null;
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return null;

  return numericValue <= 1 ? numericValue * 100 : numericValue;
}

function clampProbability(value: number) {
  return Math.max(0.1, Math.min(99.9, value));
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-widest text-[#ccc3d8]/55">{label}</dt>
      <dd className="mt-0.5 font-bold text-white">{value}</dd>
    </div>
  );
}

function PriceTile({ label, value, tone }: { label: string; value: string; tone?: 'yes' | 'no' }) {
  return (
    <div className="rounded border border-[#262626] bg-[#0e0e0e] p-3">
      <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/60">{label}</span>
      <strong className={`mt-1 block font-mono text-base ${tone === 'yes' ? 'text-[#10B981]' : tone === 'no' ? 'text-[#EF4444]' : 'text-white'}`}>
        {value}
      </strong>
    </div>
  );
}

function buildMarketReviewRows(market: PredictionMarket) {
  return [
    { label: 'Market feed', value: 'Conviction synced' },
    { label: 'Category', value: market.category },
    { label: 'Region', value: market.discoveryRegion ?? 'Global' },
    { label: 'Topic', value: market.discoveryTopic ?? 'World' },
    { label: 'Resolution', value: formatDate(market.resolutionDate) },
    { label: 'Last synced', value: formatDateTime(market.syncedAt) },
    { label: 'YES token', value: market.yesTokenId ? 'Mapped' : 'Pending' },
    { label: 'NO token', value: market.noTokenId ? 'Mapped' : 'Pending' },
  ];
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return '--';
  const prefix = value > 0 ? '+' : '';
  return prefix + value.toFixed(1) + ' pts';
}

function formatVolume(value: number | null | undefined) {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatChartTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Latest';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(1) + '%';
}

function formatRawProbability(value: string | null | undefined) {
  if (!value) return 'Pending';
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 1) {
    return formatPercent(numericValue * 100);
  }

  return value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Pending';
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Pending';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Pending';
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Pending';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
