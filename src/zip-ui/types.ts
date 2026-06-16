export interface PredictionMarket {
  id: string;
  title: string;
  status: 'LIVE' | 'HALTED';
  vol24h: string;
  liquidity: string;
  currentOdds: number; // e.g. 64.2
  convictionIndex: 'High' | 'Moderate' | 'Low' | 'N/A';
  convictionValue: number; // percentage value for bar width (e.g. 85)
  category: string;
  description: string;
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
}

export interface MarketTapeItem {
  market: string;
  price: number;
  size: string;
  isPositive: boolean;
}

export interface ActivityItem {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string;
  time: string;
  text: string;
  type: 'request' | 'system';
  likes: number;
  commentsCount: number;
  repeats: number;
  likedByUser?: boolean;
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

export interface UserPortfolio {
  connected: boolean;
  address: string | null;
  usdcBalance: number;
  wethBalance: number;
  vaultBalances: { [vaultId: string]: number };
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
}
