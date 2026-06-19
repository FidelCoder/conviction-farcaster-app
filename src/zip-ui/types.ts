export interface PredictionMarket {
  id: string;
  title: string;
  status: 'LIVE' | 'HALTED';
  vol24h: string;
  liquidity: string;
  liquidityLabel?: string;
  currentOdds: number; // e.g. 64.2
  convictionIndex: 'High' | 'Moderate' | 'Low' | 'N/A';
  convictionValue: number; // percentage value for bar width (e.g. 85)
  category: string;
  description: string;
  bestAsk?: string | null;
  bestBid?: string | null;
  discoveryRegion?: string;
  discoveryTopic?: string;
  externalUrl?: string | null;
  lastTradePrice?: string | null;
  noTokenId?: string | null;
  orderMinSize?: string | null;
  resolutionDate?: string | null;
  source?: string;
  syncedAt?: string | null;
  yesTokenId?: string | null;
}

export interface VaultDepositTransaction {
  id: string;
  amount: number;
  approvalHash?: string | null;
  asset: 'USDC' | 'WETH';
  chainId?: number;
  chainName?: string;
  depositHash: string;
  status: 'confirmed' | 'pending' | 'failed';
  timestamp: string;
  vaultId: string;
  vaultName: string;
}

export interface Vault {
  id: string;
  name: string;
  riskTag: 'Low Risk' | 'High Risk';
  apy: number; // e.g. 8.5
  apyType: 'Base Yield' | 'Variable Yield';
  tvl: string;
  utilization: number; // percentage
  healthRatio: number; // e.g. 1.8
  maxLeverage: number; // e.g. 5
  asset: 'USDC' | 'WETH';
  accentColor: 'orange' | 'purple';
  userDeposited: number; // tracking user deposits locally
  chainId?: number;
  chainName?: string;
  collateralTokenAddress?: string | null;
  collateralTokenDecimals?: number | null;
}

export interface MarketTapeItem {
  id: string;
  market: string;
  price: number;
  size: string;
  isPositive: boolean;
}

export interface ActivityReplyItem {
  id: string;
  author: string;
  text: string;
  time: string;
}

export interface ActivityItem {
  id: string;
  signalId?: string;
  username: string;
  name: string;
  avatarUrl?: string;
  time: string;
  text: string;
  type: 'request' | 'system';
  kind?: 'signal' | 'news' | 'trade' | 'post';
  likes: number;
  commentsCount: number;
  repeats: number;
  likedByUser?: boolean;
  marketId?: string;
  marketTitle?: string;
  marketPrice?: string;
  replies?: ActivityReplyItem[];
  repostedByUser?: boolean;
  topic?: string;
}

export interface LeaderboardItem {
  rank: number;
  name: string;
  pnl: number;
  avatarUrl?: string;
  letter?: string;
}

export interface GlobalRiskParameter {
  parameter: string;
  currentValue: string;
  proposed: string;
  status: 'Active' | 'Pending Vote';
}

export type WalletBalanceStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PortfolioWalletBalance {
  amount: number;
  chainId: number;
  chainName: string;
  decimals: number;
  error?: string;
  formatted: string;
  raw: string;
  status: Exclude<WalletBalanceStatus, 'idle' | 'loading'>;
  symbol: string;
  tokenAddress: string;
  updatedAt: string;
}

export interface UserPortfolio {
  connected: boolean;
  address: string | null;
  usdcBalance: number;
  wethBalance: number;
  vaultBalances: { [vaultId: string]: number };
  walletBalances: { [vaultId: string]: PortfolioWalletBalance };
  vaultTransactions: VaultDepositTransaction[];
  walletBalancesMessage?: string;
  walletBalancesStatus: WalletBalanceStatus;
  activeRequestsCount: number;
  activePositions: ActivePosition[];
}

export interface ActivePosition {
  id: string;
  marketTitle: string;
  vaultName: string;
  leverage: number;
  marginAmount: number;
  estimatedPosition: number;
  liquidationPrice: number;
  timestamp: string;
  chainId?: number;
  transactionHash?: string;
}
