import React, { useState, useEffect, useRef } from 'react';
import { getVaultAvailableBalance } from '../../lib/wallet-balances';
import { PredictionMarket, Vault, MarketTapeItem, UserPortfolio } from '../types';
import { TrendingUp, Info, Bolt, RefreshCw } from 'lucide-react';

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
  // Local interface controllers
  const [selectedVaultId, setSelectedVaultId] = useState<string>(vaults[0]?.id || 'usdc-core-vault');
  const [leverage, setLeverage] = useState<number>(5);
  const [marginAmount, setMarginAmount] = useState<string>('');
  const [outcomeType, setOutcomeType] = useState<'YES' | 'NO'>('YES');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedVault = vaults.find(v => v.id === selectedVaultId) || vaults[0];

  // Random price ticker effect
  const [livePriceMultiplier, setLivePriceMultiplier] = useState<number>(0.6220);
  const [priceChangePct, setPriceChangePct] = useState<number>(2.4);

  // Ticks simulated prices every 3 seconds to represent real live feed
  useEffect(() => {
    // Sync price starting point based on active market odds
    const odds = outcomeType === 'YES' ? activeMarket.currentOdds : (100 - activeMarket.currentOdds);
    setLivePriceMultiplier(odds / 100);

    const interval = setInterval(() => {
      setLivePriceMultiplier(prev => {
        const delta = (Math.random() - 0.5) * 0.008;
        const nextPrice = Math.max(0.01, prev + delta);
        const prevBase = odds / 100;
        const change = ((nextPrice - prevBase) / prevBase) * 100;
        setPriceChangePct(change);
        return nextPrice;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [activeMarket, outcomeType]);

  // Canvas Candlestick Rendering logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = canvas.width = canvas.parentElement?.clientWidth || 600;
    let height = canvas.height = canvas.parentElement?.clientHeight || 400;

    // Generate pseudo trading history
    const candlesCount = 28;
    const paddingLeft = 40;
    const paddingRight = 40;
    const plotWidth = width - paddingLeft - paddingRight;
    const candleWidth = Math.floor(plotWidth / candlesCount) - 4;

    const candles: Array<{
      high: number;
      low: number;
      open: number;
      close: number;
      volume: number;
    }> = [];

    // Seed pseudo-random walk candles
    let currVal = height * 0.55;
    for (let i = 0; i < candlesCount; i++) {
      const variation = (Math.random() - 0.48) * 45;
      const open = currVal;
      const close = currVal + variation;
      const high = Math.max(open, close) + Math.random() * 20;
      const low = Math.min(open, close) - Math.random() * 20;
      candles.push({ high, low, open, close, volume: Math.random() * currVal });
      currVal = close;
    }

    const draw = () => {
      // Clear with radial gradient terminal fill
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, width, height);

      // Draw technical grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      const step = 32;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Live oscillating line
      const pulseTime = Date.now() * 0.003;
      const activeY = height * 0.48 + Math.sin(pulseTime) * 15;

      // Draw candlesticks
      for (let i = 0; i < candlesCount; i++) {
        const candle = candles[i];
        const x = paddingLeft + i * (candleWidth + 4);
        
        // Update the last candle toward the current dynamic oscillating value
        if (i === candlesCount - 1) {
          candle.close = activeY;
          candle.high = Math.max(candle.open, activeY) + 5;
          candle.low = Math.min(candle.open, activeY) - 5;
        }

        const isGreen = candle.close < candle.open;
        ctx.strokeStyle = isGreen ? '#10B981' : '#EF4444';
        ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 1.5;

        // Draw shadow line
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, candle.low);
        ctx.lineTo(x + candleWidth / 2, candle.high);
        ctx.stroke();

        // Draw solid candle body
        ctx.fillRect(x, Math.min(candle.open, candle.close), candleWidth, Math.abs(candle.open - candle.close));
        ctx.strokeRect(x, Math.min(candle.open, candle.close), candleWidth, Math.abs(candle.open - candle.close));

        // Let some glowing nodes show for selected ones
        if (i % 6 === 0) {
          ctx.beginPath();
          ctx.arc(x + candleWidth / 2, candle.high, 2, 0, Math.PI * 2);
          ctx.fillStyle = isGreen ? '#10B981' : '#EF4444';
          ctx.fill();
        }
      }

      // Floating live ticket indicator text & glowing dashed line
      ctx.strokeStyle = '#F97316';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, activeY);
      ctx.lineTo(width, activeY);
      ctx.stroke();
      ctx.setLineDash([]); // clear dash

      // Glow pulse around current ticker pointer
      const tickerX = paddingLeft + (candlesCount - 1) * (candleWidth + 4) + candleWidth / 2;
      ctx.beginPath();
      ctx.arc(tickerX, activeY, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tickerX, activeY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#F97316';
      ctx.fill();

      // UI watermark overlay for institutional style
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('CONVICTION ENGINE V1.3', 20, height - 20);
      ctx.fillText('SECURE BROKERAGE ENVIRONMENT', width - 210, height - 20);

      animId = requestAnimationFrame(draw);
    };

    draw();

    // Resize listener
    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedVaultId]);

  // Vault/Collateral settings helper
  const maxCollateral = selectedVault
    ? getVaultAvailableBalance({ portfolio, vault: selectedVault })
    : 0;
  
  // Dynamic trade output computations
  const currentPriceOdds = livePriceMultiplier * 100;
  const numericAmount = parseFloat(marginAmount) || 0;
  const currentOutcomeOdds = outcomeType === 'YES' ? activeMarket.currentOdds : (100 - activeMarket.currentOdds);
  const tradingPower = numericAmount * leverage;
  const contractShares = Math.floor(tradingPower / (currentOutcomeOdds / 100));
  const estimatedPosition = contractShares * (currentOutcomeOdds / 100);
  
  // Liquidation calculation based on odds and leverage
  // Halted assets don't have active standard liquidations
  const liquidationOdds = activeMarket.status === 'HALTED' 
    ? 0 
    : currentPriceOdds * (1 - 0.70 / leverage);

  const handleMaxCollateral = () => {
    setMarginAmount(maxCollateral.toFixed(2));
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!portfolio.connected) {
      alert('Wallet Connection Required: Please connect your primary Web3 wallet in the top header action to sign trades.');
      return;
    }

    if (numericAmount <= 0) {
      alert('Collateral Constraint: Please declare a positive margin collateral amount.');
      return;
    }

    if (numericAmount > maxCollateral) {
      alert(`Insufficient Funds: Your current account balance is ${maxCollateral.toFixed(2)} ${selectedVault.asset}.`);
      return;
    }

    setIsRequesting(true);
    // Simulate smart contract delay
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
    }, 1200);
  };

  return (
    <main className="flex-1 flex flex-col lg:flex-row mt-16 md:ml-64 p-4 md:p-6 gap-6 min-h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] overflow-y-auto lg:overflow-hidden pb-28 lg:pb-6">
      
      {/* 1. LEFT COLUMN: Market Tape list */}
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
                <th className="py-2 px-3 font-normal text-right">Price</th>
                <th className="py-2 px-3 font-normal text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {tape.map((item, idx) => {
                // Find matching loaded market to show highlighted focus state
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
                      {item.price.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#ccc3d8]/80">{item.size}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. CENTER COLUMN: Interactive Candlestick Chart Canvas */}
      <section className="flex-1 bg-[#161616] border border-[#262626] rounded flex flex-col overflow-hidden relative min-h-[300px]">
        {/* Market Title Details Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#262626] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-[#0e0e0e] z-10 relative">
          <div>
            <h2 className="font-sans font-bold text-lg text-white leading-tight flex items-center gap-2">
              YES / NO - {activeMarket.title}
            </h2>
            <p className="font-mono text-[11px] text-[#ccc3d8] mt-1 uppercase tracking-wider flex items-center gap-1.5">
              <span>Prediction Market</span>
              <span>•</span>
              <span className="text-[#ccc3d8]">{activeMarket.category}</span>
            </p>
          </div>

          <div className="text-right">
            <div className={`font-mono text-xl font-extrabold flex items-center justify-end gap-1 ${priceChangePct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {livePriceMultiplier.toFixed(4)}
              <TrendingUp size={16} />
            </div>
            <div className={`font-mono text-xs ${priceChangePct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}% (24H)
            </div>
          </div>
        </div>

        {/* Live Canvas Area */}
        <div className="flex-1 relative w-full h-full bg-[#0A0A0A] overflow-hidden">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
          
          {/* Ticking Status Badge */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#161616]/90 backdrop-blur border border-[#262626] px-3 py-1 rounded text-[10px] font-mono font-bold uppercase text-[#ccc3d8]">
            <span className="w-1.5 h-1.5 rounded-full bg-deep-orange animate-pulse" />
            <span>Telemetry Stream Engine</span>
          </div>
          
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="text-[#ccc3d8]/40 font-mono text-xs border border-[#262626]/40 bg-[#161616]/50 backdrop-blur px-4 py-2 rounded">
              Chart visualization rendering...
            </div>
          </div>
        </div>
      </section>

      {/* 3. RIGHT COLUMN: Margin request control form */}
      <section className="w-full lg:w-[340px] flex flex-col gap-4 overflow-visible lg:overflow-y-auto lg:max-h-full">
        <form 
          onSubmit={handleOrderSubmit}
          className="bg-[#161616] border-t-2 border-t-deep-orange border-x border-b border-[#262626] rounded p-6 glow-orange transition-all duration-300"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-sans font-bold text-lg text-white">Margin Request</h3>
            <Bolt size={18} className="text-deep-orange animate-spin-slow" />
          </div>

          {/* Outcome YES / NO Toggle Selection */}
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
                YES (¢{activeMarket.currentOdds.toFixed(0)})
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
                NO (¢{(100 - activeMarket.currentOdds).toFixed(0)})
              </button>
            </div>
          </div>

          {/* Select Vault */}
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

          {/* Leverage Slider */}
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <label className="font-mono text-[10px] text-[#ccc3d8] uppercase tracking-widest font-bold">Leverage Limit</label>
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

          {/* Margin Amount collateral */}
          <div className="mb-6">
            <label className="block font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">
              Margin Amount ({selectedVault.asset})
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
            
            {/* Quick-action portfolio stats indicator */}
            <div className="flex justify-between mt-2 font-mono text-[11px]">
              <span className="text-[#ccc3d8]/80">Available: {maxCollateral.toFixed(2)} {selectedVault.asset}</span>
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

          {/* Trigger Request button */}
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
                  <span>TRANSACTION MINING...</span>
                </>
              ) : (
                <>
                  <Bolt size={14} />
                  <span>REQUEST MARGIN</span>
                </>
              )}
            </button>
          )}

          {/* Position projections */}
          <div className="mt-5 pt-4 border-t border-[#262626] flex flex-col gap-2">
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Purchased Outcome:</span>
              <span className={`font-bold ${outcomeType === 'YES' ? 'text-deep-orange' : 'text-[#EF4444]'}`}>
                {outcomeType} Contracts
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Buying Power Built:</span>
              <span className="text-white font-semibold">
                ${tradingPower.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Contract Shares Held:</span>
              <span className="text-white font-semibold">
                {contractShares > 0 ? `${contractShares.toLocaleString()} shares` : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-[#ccc3d8]">
              <span>Liquidation Price Limit:</span>
              <span className={`font-semibold ${liquidationOdds > 0 ? 'text-[#EF4444]' : 'text-white'}`}>
                {liquidationOdds > 0 ? `¢${liquidationOdds.toFixed(1)}` : '--'}
              </span>
            </div>
            {contractShares > 0 && (
              <div className="flex justify-between items-center text-[11px] font-mono border-t border-[#262626]/40 pt-2 text-emerald-400">
                <span className="font-semibold">Max Net Profit on 100%:</span>
                <span className="font-bold">
                  +${((contractShares) - (tradingPower)).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({(((contractShares - (tradingPower - numericAmount) - numericAmount) / numericAmount) * 100).toFixed(0)}%)
                </span>
              </div>
            )}
          </div>
        </form>

        {/* Sidebar Info disclaimer card */}
        <div className="bg-[#1c1b1b] border border-[#262626] rounded p-4 text-[11px] font-mono text-[#ccc3d8] flex gap-3 items-start">
          <Info size={16} className="text-electric-purple flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Margin requests are subject to vault liquidity and real-time market slippage parameters. Leveraged operations encompass high volatility liquidations risk.
          </p>
        </div>
      </section>
      
    </main>
  );
}
