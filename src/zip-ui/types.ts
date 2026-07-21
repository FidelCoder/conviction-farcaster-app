export interface PredictionMarket {
  id: string;
  title: string;
  status: "LIVE" | "HALTED";
  vol24h: string;
  liquidity: string;
  liquidityLabel?: string;
  currentOdds: number; // e.g. 64.2
  convictionIndex: "High" | "Moderate" | "Low" | "N/A";
  convictionValue: number; // percentage value for bar width (e.g. 85)
  category: string;
  description: string;
  bestAsk?: string | null;
  bestBid?: string | null;
  discoveryRegion?: string;
  discoveryTopic?: string;
  externalUrl?: string | null;
  imageUrl?: string | null;
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
  asset: "USDC" | "WETH" | "pUSD";
  chainId?: number;
  chainName?: string;
  depositHash: string;
  status: "confirmed" | "pending" | "failed";
  timestamp: string;
  vaultId: string;
  vaultName: string;
  type?: "DEPOSIT" | "WITHDRAWAL" | "REDEMPTION_REQUEST";
}

export interface Vault {
  id: string;
  name: string;
  riskTag: "Low Risk" | "High Risk";
  apy: number; // e.g. 8.5
  apyType: "Base Yield" | "Variable Yield";
  tvl: string;
  utilization: number; // percentage
  healthRatio: number; // e.g. 1.8
  maxLeverage: number; // e.g. 5
  asset: "USDC" | "WETH" | "pUSD";
  accentColor: "orange" | "purple";
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
  postId?: string;
  username: string;
  name: string;
  avatarUrl?: string;
  time: string;
  text: string;
  type: "request" | "system";
  kind?: "signal" | "news" | "trade" | "post" | "repost" | "follow";
  likes: number;
  commentsCount: number;
  repeats: number;
  likedByUser?: boolean;
  marketId?: string;
  marketTitle?: string;
  marketPrice?: string;
  signalSide?: "YES" | "NO";
  convictionLevel?: number | null;
  replies?: ActivityReplyItem[];
  repostedByUser?: boolean;
  topic?: string;
  actorUserId?: string;
  traderProfileId?: string;
  eventType?: "SIGNAL" | "REPOST" | "PUBLIC_TRADE" | "FOLLOW" | "POST";
  followTarget?: {
    userId: string;
    username: string;
    displayName: string;
  };
  position?: {
    id: string;
    side: "YES" | "NO";
    quantity: string;
    executionMode: string;
    leverageMultiplier?: string | null;
    marginCollateral?: string | null;
    status: string;
  };
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
  status: "Active" | "Pending Vote";
}

export type WalletBalanceStatus = "idle" | "loading" | "ready" | "error";

export interface PortfolioWalletBalance {
  amount: number;
  chainId: number;
  chainName: string;
  decimals: number;
  error?: string;
  formatted: string;
  raw: string;
  status: Exclude<WalletBalanceStatus, "idle" | "loading">;
  symbol: string;
  tokenAddress: string;
  updatedAt: string;
}

export interface VaultOnchainMetrics {
  accruedProtocolFees: number;
  availableLiquidity: number;
  borrowedAssets: number;
  protocolReserves: number;
  queuedAssets: number;
  reservedAssets: number;
  shareValue: number;
  status: "ready" | "error";
  totalAssets: number;
  uncoveredBadDebt: number;
  utilization: number;
  withdrawableAssets: number;
}

export interface UserPortfolio {
  connected: boolean;
  address: string | null;
  usdcBalance: number;
  wethBalance: number;
  vaultBalances: { [vaultId: string]: number };
  vaultLockedBalances: { [vaultId: string]: number };
  vaultTotalBalances: { [vaultId: string]: number };
  walletBalances: { [vaultId: string]: PortfolioWalletBalance };
  vaultMetrics: { [vaultId: string]: VaultOnchainMetrics };
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
