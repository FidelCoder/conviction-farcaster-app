import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getVaultAvailableBalance } from '../../lib/wallet-balances';
import { Vault, GlobalRiskParameter, UserPortfolio } from '../types';
import { Check, Copy, Plus, QrCode, RefreshCw, ShieldCheck, Sliders, Wallet } from 'lucide-react';

function formatWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenAmount(amount: number, symbol: string) {
  const formatted = amount.toLocaleString(undefined, {
    maximumFractionDigits: amount >= 1 ? 2 : 6,
    minimumFractionDigits: amount >= 1 ? 2 : 0,
  });

  return `${formatted} ${symbol}`;
}

interface VaultsViewProps {
  vaults: Vault[];
  riskParameters: GlobalRiskParameter[];
  portfolio: UserPortfolio;
  onDeposit: (vaultId: string, amount: number) => Promise<boolean> | boolean | void;
  onWithdraw: (vaultId: string, amount: number) => void;
  onCreateVault: (vaultData: Omit<Vault, 'id' | 'userDeposited'>) => void;
  onModifyRisk: (index: number, vote: 'FOR' | 'AGAINST') => void;
  onRefreshWalletBalances?: () => void;
}

export default function VaultsView({
  vaults,
  riskParameters,
  portfolio,
  onDeposit,
  onWithdraw,
  onCreateVault,
  onModifyRisk,
  onRefreshWalletBalances
}: VaultsViewProps) {
  // Modal configurations
  const [activeModal, setActiveModal] = useState<'none' | 'deposit' | 'withdraw' | 'create'>('none');
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [transactionAmount, setTransactionAmount] = useState<string>('');
  const [fundingCopyState, setFundingCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [isDepositing, setIsDepositing] = useState(false);

  // Create vault states
  const [newVaultName, setNewVaultName] = useState<string>('');
  const [newVaultRisk, setNewVaultRisk] = useState<'Low Risk' | 'High Risk'>('Low Risk');
  const [newVaultApy, setNewVaultApy] = useState<string>('');
  const [newVaultAsset, setNewVaultAsset] = useState<'USDC' | 'WETH'>('USDC');
  const [newVaultLeverage, setNewVaultLeverage] = useState<string>('5');

  // Trigger deposit process
  const openDeposit = (vaultId: string) => {
    setSelectedVaultId(vaultId);
    setTransactionAmount('');
    setFundingCopyState('idle');
    setActiveModal('deposit');
  };

  // Trigger withdraw process
  const openWithdraw = (vaultId: string) => {
    setSelectedVaultId(vaultId);
    setTransactionAmount('');
    setActiveModal('withdraw');
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDepositing) return;
    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a positive numeric collateral amount.');
      return;
    }
    const currentVault = vaults.find(v => v.id === selectedVaultId);
    if (!currentVault) return;

    if (!portfolio.connected || !portfolio.address) {
      alert('Connect your wallet from the top-right action before funding or depositing into a vault.');
      return;
    }

    const available = getVaultAvailableBalance({ portfolio, vault: currentVault });
    if (amount > available) {
      alert(`Insufficient Funds: You only have ${available.toFixed(2)} ${currentVault.asset} available. Add funds to your connected wallet using the QR code or copy address, then try again.`);
      return;
    }

    setIsDepositing(true);

    try {
      const result = await onDeposit(selectedVaultId, amount);

      if (result !== false) {
        setActiveModal('none');
      }
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a positive numeric collateral amount.');
      return;
    }
    const currentVault = vaults.find(v => v.id === selectedVaultId);
    if (!currentVault) return;

    if (amount > (portfolio.vaultBalances[selectedVaultId] || 0)) {
      alert(`Insufficient Deposits: You only have ${(portfolio.vaultBalances[selectedVaultId] || 0).toFixed(2)} locked in this vault.`);
      return;
    }

    onWithdraw(selectedVaultId, amount);
    setActiveModal('none');
  };

  const handleCreateVaultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const apyVal = parseFloat(newVaultApy);
    const leverageVal = parseInt(newVaultLeverage);

    if (!newVaultName.trim()) {
      alert('Vault Label Constraint: Please supply a distinct vault name.');
      return;
    }
    if (isNaN(apyVal) || apyVal <= 0) {
      alert('Please provide a positive yield percentage.');
      return;
    }
    if (isNaN(leverageVal) || leverageVal < 1) {
      alert('Leverage must be at least 1x.');
      return;
    }

    onCreateVault({
      name: newVaultName,
      riskTag: newVaultRisk,
      apy: apyVal,
      apyType: newVaultRisk === 'Low Risk' ? 'Base Yield' : 'Variable Yield',
      tvl: newVaultAsset === 'USDC' ? '$0' : '0 WETH',
      utilization: 0,
      healthRatio: 2.0,
      maxLeverage: leverageVal,
      asset: newVaultAsset,
      accentColor: newVaultRisk === 'Low Risk' ? 'orange' : 'purple'
    });

    // Reset fields
    setNewVaultName('');
    setNewVaultApy('');
    setActiveModal('none');
  };

  // State stats summary calculations
  const totalValueLockedValue = Object.entries(portfolio.vaultBalances).reduce((acc, [vid, bal]) => {
    const isWeth = vaults.find(v => v.id === vid)?.asset === 'WETH';
    return acc + bal * (isWeth ? 3450 : 1);
  }, 0);

  const activeVault = vaults.find(v => v.id === selectedVaultId);
  const fundingAddress = portfolio.address;
  const fundingQrValue = fundingAddress ? `ethereum:${fundingAddress}` : '';
  const activeVaultLiveBalance = activeVault ? portfolio.walletBalances[activeVault.id] : undefined;
  const activeVaultAvailable = activeVault
    ? getVaultAvailableBalance({ portfolio, vault: activeVault })
    : 0;
  const activeVaultBalanceLabel = activeVault
    ? activeVaultLiveBalance?.status === 'ready'
      ? formatTokenAmount(activeVaultLiveBalance.amount, activeVault.asset)
      : `${activeVaultAvailable.toFixed(2)} ${activeVault.asset}`
    : '--';
  const activeVaultBalanceSource = activeVaultLiveBalance?.status === 'ready'
    ? `${activeVaultLiveBalance.chainName} wallet balance`
    : portfolio.walletBalancesStatus === 'loading'
      ? 'Reading wallet balance...'
      : activeVaultLiveBalance?.status === 'error'
        ? 'Balance read failed'
        : 'Wallet balance unavailable';

  const copyFundingAddress = async () => {
    if (!fundingAddress) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fundingAddress);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fundingAddress;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setFundingCopyState('copied');
      window.setTimeout(() => setFundingCopyState('idle'), 1800);
    } catch {
      setFundingCopyState('failed');
    }
  };

  return (
    <main className="flex-1 md:ml-64 bg-grid-tech pt-8 px-4 md:px-10 pb-32 max-w-[1280px] mx-auto w-full">

      {/* 1. PROTOCOL HEADER METRICS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface-card border border-[#262626] rounded-lg p-6 hover:border-deep-orange transition-colors">
          <div className="font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">Total Value Locked (TVL)</div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {totalValueLockedValue > 0 ? '$' + totalValueLockedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
          </div>
        </div>
        <div className="bg-surface-card border border-[#262626] rounded-lg p-6 hover:border-electric-purple transition-colors">
          <div className="font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">Weighted Protocol APY</div>
          <div className="font-mono text-2xl font-extrabold text-[#10B981]">--</div>
        </div>
        <div className="bg-surface-card border border-[#262626] rounded-lg p-6 hover:border-deep-orange transition-colors">
          <div className="font-mono text-[10px] text-[#ccc3d8] mb-2 uppercase tracking-widest font-bold">Active Margin Requests</div>
          <div className="font-mono text-2xl font-extrabold text-[#F97316]">
            {portfolio.activeRequestsCount}
          </div>
        </div>
      </section>

      {/* 2. ACTIVE VAULTS TITLE & GRID */}
      <section className="mb-12">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-sans font-bold text-white">Active Liquidity Vaults</h1>
            <p className="text-xs text-[#ccc3d8]/80 mt-1">Provide liquidity to back prediction contracts and claim institutional yields.</p>
          </div>
          <button
            onClick={() => setActiveModal('create')}
            className="border border-[#F97316] text-[#F97316] hover:bg-[#F97316]/10 px-4 py-2 rounded text-xs font-mono font-bold tracking-wider uppercase transition-colors duration-200 cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Create Vault</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {vaults.map((vault) => {
            const isPurple = vault.accentColor === 'purple';
            const userBalance = portfolio.vaultBalances[vault.id] || 0;

            return (
              <div
                key={vault.id}
                className={`bg-surface-card border border-[#262626] rounded-lg flex flex-col relative overflow-hidden transition-all duration-300 ${
                  isPurple
                    ? 'border-t-2 border-t-electric-purple glow-purple'
                    : 'border-t-2 border-t-deep-orange glow-orange'
                }`}
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-1">{vault.name}</h2>
                      <span className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                        isPurple ? 'text-[#EF4444] bg-[#EF4444]/10' : 'text-primary bg-[#7c3aed]/10'
                      }`}>
                        {vault.riskTag}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl font-extrabold text-[#10B981] mb-1">{vault.apy.toFixed(1)}% APY</div>
                      <div className="font-mono text-[9px] text-[#ccc3d8] uppercase tracking-wider font-semibold">{vault.apyType}</div>
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-6 border-t border-b border-[#262626]/40 py-4 font-mono text-xs text-[#ccc3d8]">
                    <div>
                      <div className="text-[10px] text-[#ccc3d8]/60 mb-1 uppercase tracking-wider">Total Value Locked</div>
                      <div className="font-semibold text-white text-sm">{vault.tvl}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#ccc3d8]/60 mb-1 uppercase tracking-wider">Utilization</div>
                      <div className="font-semibold text-white text-sm">{vault.utilization}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#ccc3d8]/60 mb-1 uppercase tracking-wider">Health Ratio</div>
                      <div className="font-semibold text-[#10B981] text-sm">{vault.healthRatio.toFixed(2)}x</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#ccc3d8]/60 mb-1 uppercase tracking-wider">Max Leverage Allowed</div>
                      <div className="font-semibold text-white text-sm">{vault.maxLeverage}x</div>
                    </div>
                  </div>

                  {/* Personal stats inside vault */}
                  <div className="p-3 bg-[#0a0a0a] rounded border border-[#262626] flex justify-between items-center text-xs font-mono">
                    <span className="text-[#ccc3d8]/85">Your Active Deposited Balance:</span>
                    <span className="text-white font-bold text-sm">
                      {userBalance.toFixed(2)} {vault.asset}
                    </span>
                  </div>
                </div>

                {/* Operations buttons */}
                <div className="bg-[#201f1f] p-4 border-t border-[#262626] flex gap-4">
                  <button
                    onClick={() => openDeposit(vault.id)}
                    className={`flex-1 text-black py-2.5 rounded font-sans font-bold text-xs tracking-wider uppercase opacity-95 hover:opacity-100 transition-opacity cursor-pointer ${
                      isPurple ? 'bg-electric-purple text-white' : 'bg-deep-orange text-black'
                    }`}
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => openWithdraw(vault.id)}
                    className="flex-1 border border-[#ccc3d8]/40 hover:border-white text-white py-2.5 rounded font-sans font-bold text-xs tracking-wider uppercase hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Withdraw
                  </button>
                  <button
                    onClick={() => alert(`Metrics console for ${vault.name} is not connected yet.`)}
                    className="p-2 border border-[#ccc3d8]/40 hover:border-white rounded text-white hover:bg-white/5 transition-all flex items-center justify-center cursor-pointer"
                    title="Tune settings"
                  >
                    <Sliders size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. GLOBAL PROTOCOL RISK PARAMETERS & VOTING */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-xl font-sans font-bold text-white">Global Governance Risk Parameters</h2>
          <p className="text-xs text-[#ccc3d8]/80 mt-1">Staking pools determine risk barriers. Vote on pending parameters proposed by protocol core teams.</p>
        </div>

        <div className="bg-[#161616] border border-[#262626] rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1c1b1b] border-b border-[#262626]">
                <th className="p-4 font-mono text-[10px] text-[#ccc3d8]/60 uppercase tracking-widest font-bold">Parameter</th>
                <th className="p-4 font-mono text-[10px] text-[#ccc3d8]/60 uppercase tracking-widest font-bold">Current Value</th>
                <th className="p-4 font-mono text-[10px] text-[#ccc3d8]/60 uppercase tracking-widest font-bold">Proposed Value</th>
                <th className="p-4 font-mono text-[10px] text-[#ccc3d8]/60 uppercase tracking-widest font-bold">Status / Vote</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs divide-y divide-[#262626]/40">
              {riskParameters.map((param, index) => {
                const isPending = param.status === 'Pending Vote';

                return (
                  <tr key={index} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="p-4 py-3 font-semibold text-white">{param.parameter}</td>
                    <td className="p-4 py-3 text-[#ccc3d8]">{param.currentValue}</td>
                    <td className={`p-4 py-3 font-bold ${isPending ? 'text-deep-orange' : 'text-[#ccc3d8]'}`}>
                      {param.proposed}
                    </td>
                    <td className="p-4 py-3">
                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onModifyRisk(index, 'FOR')}
                            className="bg-deep-orange/15 text-deep-orange border border-deep-orange/20 hover:bg-deep-orange hover:text-black font-extrabold text-[9px] px-2.5 py-1 rounded cursor-pointer transition-colors uppercase leading-none"
                            title="Vote FOR"
                          >
                            Vote Yes
                          </button>
                          <span className="text-xs text-[#ccc3d8]/50">or</span>
                          <button
                            onClick={() => onModifyRisk(index, 'AGAINST')}
                            className="border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/15 font-extrabold text-[9px] px-2.5 py-1 rounded cursor-pointer transition-colors uppercase leading-none"
                            title="Vote AGAINST"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#10B981] font-semibold flex items-center gap-1">
                          <ShieldCheck size={14} />
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================== COLLATERAL/DEPOSIT DIALOG MODAL ==================== */}
      {activeModal === 'deposit' && activeVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleDepositSubmit}
            className="bg-[#161616] border border-[#262626] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 relative glow-orange animate-scale-up"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-deep-orange mb-2">
                  <Wallet size={16} />
                  <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Vault Funding</span>
                </div>
                <h3 className="text-lg font-sans font-bold text-white">Deposit Collateral</h3>
                <p className="text-xs text-[#ccc3d8] mt-2 max-w-xl leading-relaxed">
                  Add {activeVault.asset} to your connected wallet, then deposit into <span className="font-bold text-white">{activeVault.name}</span>. Available: {activeVaultBalanceLabel}
                </p>
              </div>
              <div className="rounded border border-[#262626] bg-[#0A0A0A] px-3 py-2 text-left sm:text-right">
                <div className="font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/60">Asset</div>
                <div className="font-mono text-sm font-bold text-white">{activeVault.asset}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-5">
              <section className="rounded-lg border border-[#262626] bg-[#0A0A0A] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <QrCode size={15} className="text-deep-orange" />
                  <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-white">Add Funds To Wallet</h4>
                </div>

                {portfolio.connected && fundingAddress ? (
                  <>
                    <div className="mx-auto mb-4 flex aspect-square w-full max-w-[220px] items-center justify-center rounded-lg border border-[#262626] bg-white p-3">
                      <QRCodeSVG
                        value={fundingQrValue}
                        size={196}
                        bgColor="#ffffff"
                        fgColor="#0A0A0A"
                        level="M"
                        className="h-full w-full"
                        title="Funding wallet QR code"
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#ccc3d8]/80">
                      Scan to send funds to the connected wallet. Use the copy button if you are funding from an exchange or another wallet.
                    </p>
                    <button
                      type="button"
                      onClick={onRefreshWalletBalances}
                      disabled={!onRefreshWalletBalances || portfolio.walletBalancesStatus === 'loading'}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-[#262626] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] transition-colors hover:border-deep-orange hover:text-deep-orange disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={portfolio.walletBalancesStatus === 'loading' ? 'animate-spin' : ''} />
                      Refresh Balance
                    </button>
                    <div className="mt-3 rounded border border-[#262626] bg-[#111111] p-3">
                      <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/60">Wallet Address</div>
                      <div className="flex min-w-0 items-center gap-2">
                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-white">{fundingAddress}</code>
                        <button
                          type="button"
                          onClick={copyFundingAddress}
                          className="shrink-0 rounded border border-deep-orange/50 p-2 text-deep-orange transition-colors hover:bg-deep-orange hover:text-black"
                          title="Copy wallet address"
                          aria-label="Copy wallet address"
                        >
                          {fundingCopyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="mt-2 min-h-4 font-mono text-[10px] text-[#ccc3d8]/70" aria-live="polite">
                        {fundingCopyState === 'copied' && 'Address copied.'}
                        {fundingCopyState === 'failed' && 'Copy failed. Select the address manually.'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-deep-orange/30 bg-deep-orange/10 p-4">
                    <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Wallet Required</div>
                    <p className="text-xs leading-relaxed text-[#ccc3d8]">
                      Connect a browser wallet from the top-right action to reveal your funding QR code and deposit controls.
                    </p>
                  </div>
                )}
              </section>

              <section className="flex flex-col rounded-lg border border-[#262626] bg-[#111111] p-4">
                <div className="mb-4 grid grid-cols-2 gap-3 font-mono">
                  <div className="rounded border border-[#262626] bg-[#0A0A0A] p-3">
                    <div className="text-[9px] uppercase tracking-widest text-[#ccc3d8]/60">Available</div>
                    <div className="mt-1 text-sm font-bold text-white">{activeVaultBalanceLabel}</div>
                    <div className="mt-1 truncate text-[9px] uppercase tracking-widest text-[#ccc3d8]/50">{activeVaultBalanceSource}</div>
                  </div>
                  <div className="rounded border border-[#262626] bg-[#0A0A0A] p-3">
                    <div className="text-[9px] uppercase tracking-widest text-[#ccc3d8]/60">Wallet</div>
                    <div className="mt-1 truncate text-sm font-bold text-white">
                      {fundingAddress ? formatWalletAddress(fundingAddress) : 'Not Connected'}
                    </div>
                    <div className="mt-1 truncate text-[9px] uppercase tracking-widest text-[#ccc3d8]/50">
                      {activeVault.chainName ?? 'Vault Chain'}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block font-mono text-[9px] text-[#ccc3d8]/80 uppercase tracking-widest font-bold mb-2">Deposit Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={transactionAmount}
                      onChange={(e) => setTransactionAmount(e.target.value)}
                      disabled={!portfolio.connected || !fundingAddress}
                      className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 font-mono text-lg text-right focus:outline-none focus:border-deep-orange focus:ring-1 focus:ring-deep-orange/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className="absolute left-3 top-4 text-xs font-mono font-bold text-[#ccc3d8] italic">
                      {activeVault.asset}
                    </span>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={!portfolio.connected || !fundingAddress || isDepositing}
                    className="flex-1 bg-deep-orange text-black font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isDepositing ? 'Deposit Pending' : 'Confirm Deposit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="flex-1 border border-[#ccc3d8]/40 hover:border-white text-white font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            </div>
          </form>
        </div>
      )}

      {/* ==================== WITHDRAW COMPONENT DIALOG MODAL ==================== */}
      {activeModal === 'withdraw' && activeVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleWithdrawSubmit}
            className="bg-[#161616] border border-[#262626] rounded-xl w-full max-w-md p-6 relative glow-orange"
          >
            <h3 className="text-lg font-sans font-bold text-white mb-2">Withdraw Liquidity</h3>
            <p className="text-xs text-[#ccc3d8] mb-5">
              Pull capital out of the <span className="font-bold text-white">{activeVault.name}</span>. Maximum withdrawable limits: {(portfolio.vaultBalances[activeVault.id] || 0).toFixed(2)} {activeVault.asset}
            </p>

            <div className="mb-6">
              <label className="block font-mono text-[9px] text-[#ccc3d8]/80 uppercase tracking-widest font-bold mb-2">Withdraw Amount</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 font-mono text-lg text-right focus:outline-none focus:border-deep-orange focus:ring-1 focus:ring-deep-orange/50 transition-colors"
                />
                <span className="absolute left-3 top-4 text-xs font-mono font-bold text-[#ccc3d8] italic">
                  {activeVault.asset}
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 bg-deep-orange text-black font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:opacity-90 transition-opacity cursor-pointer"
              >
                Confirm Withdraw
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="flex-1 border border-[#ccc3d8]/40 hover:border-white text-white font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== CREATE VAULT POOL MODAL ==================== */}
      {activeModal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateVaultSubmit}
            className="bg-[#161616] border border-[#262626] rounded-xl w-full max-w-md p-6 relative glow-purple"
          >
            <h3 className="text-lg font-sans font-bold text-white mb-1">Deploy Custom Vault</h3>
            <p className="text-xs text-[#ccc3d8] mb-5">
              Establish a custom collateral staking vault backer with smart protocol index guidelines.
            </p>

            <div className="flex flex-col gap-4 mb-6 text-xs font-sans">
              <div>
                <label className="block text-[#ccc3d8] mb-1.5 font-bold uppercase tracking-wide text-[10px]">Vault Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BTC Arbitrage Vault"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 focus:outline-none focus:border-deep-orange focus:ring-1 focus:ring-deep-orange/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#ccc3d8] mb-1.5 font-bold uppercase tracking-wide text-[10px]">Backing Asset</label>
                  <select
                    value={newVaultAsset}
                    onChange={(e) => setNewVaultAsset(e.target.value as 'USDC' | 'WETH')}
                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 focus:outline-none focus:border-deep-orange focus:ring-1"
                  >
                    <option value="USDC">USDC</option>
                    <option value="WETH">WETH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#ccc3d8] mb-1.5 font-bold uppercase tracking-wide text-[10px]">Risk Tier</label>
                  <select
                    value={newVaultRisk}
                    onChange={(e) => setNewVaultRisk(e.target.value as 'Low Risk' | 'High Risk')}
                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 focus:outline-none focus:border-deep-orange focus:ring-1"
                  >
                    <option value="Low Risk">Low Risk</option>
                    <option value="High Risk">High Risk</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#ccc3d8] mb-1.5 font-bold uppercase tracking-wide text-[10px]">APY Yield Estimate (%)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 15.5"
                    value={newVaultApy}
                    onChange={(e) => setNewVaultApy(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#ccc3d8] mb-1.5 font-bold uppercase tracking-wide text-[10px]/80">Maximum Leverage Limit</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 5"
                    value={newVaultLeverage}
                    onChange={(e) => setNewVaultLeverage(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white rounded p-3 text-right focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 bg-electric-purple text-white font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:opacity-90 transition-opacity cursor-pointer"
              >
                PROPOSE VAULT
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="flex-1 border border-[#ccc3d8]/40 hover:border-white text-white font-sans font-bold text-xs py-3 rounded tracking-wider uppercase hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </main>
  );
}
