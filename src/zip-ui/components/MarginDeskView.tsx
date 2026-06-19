import React, { useEffect, useMemo, useState } from 'react';
import { getVaultAvailableBalance } from '../../lib/wallet-balances';
import { PredictionMarket, Vault, MarketTapeItem, UserPortfolio } from '../types';
import { ExternalLink, Info, Bolt, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';

interface MarginDeskViewProps {
  markets: PredictionMarket[];
  vaults: Vault[];
  tape: MarketTapeItem[];
  activeMarket: PredictionMarket;
  setActiveMarket: (market: PredictionMarket) => void;
  portfolio: UserPortfolio;
  onRequestMargin: (vaultId: string, marginAmt: number, leverage: number, estPosition: number, liqPrice: number, outcomeType?: 'YES' | 'NO') => void;
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
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  const selectedVault = vaults.find(v => v.id === selectedVaultId) || vaults[0];

  useEffect(() => {
    if (selectedVault && leverage > selectedVault.maxLeverage) {
      setLeverage(selectedVault.maxLeverage);
    }
  }, [leverage, selectedVault]);

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

  const handleOrderSubmit = (e: React.FormEvent) => {
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
    setTimeout(() => {
      onRequestMargin(
        selectedVault.id,
        numericAmount,
        leverage,
        estimatedPosition,
        liquidationOdds,
        outcomeType
      );
      setIsRequesting(false);
      setMarginAmount('');
    }, 900);
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
              {tape.map((item, idx) => {
                const matchedMarket = markets.find(m => m.title.toLowerCase().includes(item.market.split('-')[0].toLowerCase()));
                const isSelected = matchedMarket ? matchedMarket.id === activeMarket.id : false;

                return (
                  <tr
                    key={idx}
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
              <span className="rounded border border-[#262626] bg-[#161616] px-2 py-1">{activeMarket.source ?? 'Provider'}</span>
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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
            <article className="rounded border border-[#262626] bg-[#161616] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Event Details</p>
                  <h3 className="mt-1 text-xl font-bold text-white">What this market resolves on</h3>
                </div>
                <span className={`rounded border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest ${
                  activeMarket.status === 'LIVE'
                    ? 'border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]'
                    : 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]'
                }`}>
                  {activeMarket.status}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-[#ccc3d8]">{activeMarket.description}</p>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {reviewRows.map((row) => (
                  <div key={row.label} className="rounded border border-[#262626] bg-[#0e0e0e] p-3">
                    <dt className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/60">{row.label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-white">{row.value}</dd>
                  </div>
                ))}
              </dl>

              {activeMarket.externalUrl ? (
                <a
                  href={activeMarket.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded border border-[#262626] bg-[#0e0e0e] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] transition-colors hover:border-white/40 hover:text-white"
                >
                  Source market
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </article>

            <article className="rounded border border-[#262626] bg-[#161616] p-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Price Snapshot</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <PriceTile label="YES chance" value={formatPercent(activeMarket.currentOdds)} tone="yes" />
                <PriceTile label="NO chance" value={formatPercent(100 - activeMarket.currentOdds)} tone="no" />
                <PriceTile label="Last trade" value={formatRawProbability(activeMarket.lastTradePrice)} />
                <PriceTile label="Best ask" value={formatRawProbability(activeMarket.bestAsk)} />
                <PriceTile label="Best bid" value={formatRawProbability(activeMarket.bestBid)} />
                <PriceTile label="Min order" value={activeMarket.orderMinSize ? activeMarket.orderMinSize + ' contracts' : 'Pending'} />
              </div>

              <div className="mt-5 rounded border border-electric-purple/30 bg-electric-purple/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-electric-purple" />
                  <p className="text-xs leading-relaxed text-[#ccc3d8]">
                    The chart has been replaced with provider-backed market facts. Candles should only return once the app has real historical price candles from the provider or an indexed core feed.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

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
                  <span>Recording request...</span>
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
    { label: 'Provider', value: market.source ?? 'Core provider' },
    { label: 'Category', value: market.category },
    { label: 'Region', value: market.discoveryRegion ?? 'Global' },
    { label: 'Topic', value: market.discoveryTopic ?? 'World' },
    { label: 'Resolution', value: formatDate(market.resolutionDate) },
    { label: 'Last synced', value: formatDateTime(market.syncedAt) },
    { label: 'YES token', value: market.yesTokenId ? 'Mapped' : 'Pending' },
    { label: 'NO token', value: market.noTokenId ? 'Mapped' : 'Pending' },
  ];
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
