export type Market = {
  id: string;
  externalMarketId: string;
  source: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  resolutionDate: string | null;
  externalUrl: string | null;
  yesTokenId: string | null;
  noTokenId: string | null;
  lastTradePrice?: string | null;
  bestBid?: string | null;
  bestAsk?: string | null;
  liquidity?: string | null;
  orderMinSize?: string | null;
  providerMetadata?: {
    discoveryRegion?: string | null;
    discoveryTopics?: string[];
    eventSlug?: string | null;
    eventTitle?: string | null;
    groupItemTitle?: string | null;
    iconUrl?: string | null;
    imageUrl?: string | null;
    liquidity?: string | null;
    oneDayPriceChange?: string | null;
    primaryTag?: string | null;
    tagLabels?: string[];
    tagSlugs?: string[];
    totalVolume?: string | null;
    volume1mo?: string | null;
    volume1wk?: string | null;
    volume1yr?: string | null;
    volume24hr?: string | null;
  };
  syncedAt?: string | null;
  volume1mo?: string | null;
  volume1wk?: string | null;
  volume1yr?: string | null;
  volume24hr?: string | null;
};

export type UserPreference = {
  id: string;
  userId: string;
  topics: string[];
  regions: string[];
  sports: string[];
  mediaTypes: string[];
  newsIntervalMinutes: number;
  notifyInActivity: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActivityMediaItem = {
  id: string;
  userId: string | null;
  marketId: string | null;
  kind: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaBrief: unknown;
  source: string;
  status: string;
  market: Market | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportTicketReply = {
  id: string;
  ticketId: string;
  authorType: "USER" | "SUPPORT" | "AI" | string;
  authorUserId: string | null;
  authorName: string | null;
  subject: string | null;
  body: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminFallbackProfile = {
  userId: string;
  traderProfileId: string;
  handle: string;
  displayName: string | null;
  reason: string;
  wallets: Array<{ type: "EVM" | "TON" | string; address: string }>;
  createdAt: string;
  updatedAt: string;
};

export type AdminFallbackProfilesResult = {
  count: number;
  fallbackProfiles: AdminFallbackProfile[];
};

export type AuthProvider =
  | "EVM_EOA"
  | "THIRDWEB_SMART_WALLET"
  | "TON_WALLET"
  | "TELEGRAM"
  | "FARCASTER"
  | "UNKNOWN";

export type UsageEventType =
  | "PAGE_VIEW"
  | "HEARTBEAT"
  | "AUTH_CONNECT"
  | "AUTH_DISCONNECT"
  | "PROFILE_CLAIM"
  | "MARKET_VIEW"
  | "MARKET_OPEN_MARGIN"
  | "MARGIN_REQUEST"
  | "VAULT_DEPOSIT"
  | "PULSE_POST"
  | "PULSE_SIGNAL"
  | "PULSE_FOLLOW"
  | "SUPPORT_OPEN"
  | "MINIAPP_OPEN";

export type RecordUsageEventInput = {
  area?: string | null;
  authProvider?: AuthProvider | null;
  clientSessionId: string;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
  path?: string | null;
  referrer?: string | null;
  socialAccountId?: string | null;
  source?: string | null;
  type: UsageEventType;
  userId?: string | null;
  value?: number | null;
};

export type AdminUsageAnalyticsResult = {
  generatedAt: string;
  users: {
    rawAccounts: number;
    realUsers: number;
    walletLinked: number;
    evmWallets: number;
    tonWallets: number;
    claimedViction: number;
    fallbackProfiles: number;
    noProfile: number;
    emailConfigured: number;
    active24h: number;
    active7d: number;
    internalMarked: number;
  };
  acquisition: Record<string, number>;
  engagement: {
    sessions: number;
    trackedEvents: number;
    avgSessionSeconds: number;
    medianSessionSeconds: number;
    avgEventsPerSession: number;
    signals: number;
    positions: number;
    supportTickets: number;
  };
  productUsage: {
    topAreas: Array<{ label: string; count: number }>;
    topActions: Array<{ label: string; count: number }>;
    topPaths: Array<{ label: string; count: number }>;
  };
  recentSessions: Array<{
    id: string;
    authProvider: AuthProvider;
    currentPath: string | null;
    durationSeconds: number;
    eventCount: number;
    lastSeenAt: string;
    source: string;
    userId: string | null;
  }>;
};

export type SupportTicket = {
  id: string;
  userId: string | null;
  wallet: string | null;
  email: string;
  subject: string;
  summary: string;
  transcript: string | null;
  status: string;
  telegramSentAt: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  autoCloseAt?: string | null;
  replies?: SupportTicketReply[];
  createdAt: string;
  updatedAt: string;
};

export type ExecutionCapabilityChain = {
  chainId: number;
  chainName: string;
  ecosystem: "EVM";
  network: "mainnet" | "testnet";
  spotExecutionEnabled: boolean;
  marginExecutionEnabled: boolean;
  contractRequiredForMargin: boolean;
  vaultAddress?: string | null;
  collateralTokenAddress?: string | null;
  collateralTokenSymbol?: string | null;
  collateralTokenDecimals?: number | null;
  walletFlowEnabled?: boolean;
  plannedAdapters: string[];
};

export type ContractDeployment = {
  id: string;
  chainId: number;
  role: "MARGIN_VAULT" | "EXECUTION_ADAPTER" | "COLLATERAL_TOKEN";
  address: string;
  label: string | null;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContractTransactionStatus =
  | "PREPARED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

export type ContractTransaction = {
  id: string;
  userId: string | null;
  positionId: string | null;
  chainId: number;
  contractAddress: string;
  walletAddress: string;
  transactionHash: string | null;
  type: "COLLATERAL_APPROVAL" | "DEPOSIT" | "MARGIN_INTENT" | "CLOSE_INTENT" | "LIQUIDATION";
  status: ContractTransactionStatus;
  requestPayload: unknown;
  responsePayload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type PreparedContractTransaction = {
  transaction: ContractTransaction;
  contractCall: {
    chainId: number;
    contractAddress: string;
    walletAddress: string;
    functionName: "approve" | "deposit" | "createMarginIntent";
    abi: string[];
    args: readonly unknown[];
    namedArgs: Record<string, number | string>;
  };
  executionNote: string;
};

export type PreparedMarginIntent = PreparedContractTransaction & {
  contractCall: PreparedContractTransaction["contractCall"] & {
    functionName: "createMarginIntent";
    namedArgs: {
      collateralToken: string;
      marketId: string;
      side: number;
      collateralAmount: string;
      leverageBps: string;
      maxSlippageBps: number;
      deadline: number;
      offchainPositionId: string;
    };
  };
};

export type ExecutionCapabilities = {
  evmOnly: boolean;
  architecture: string;
  spotExecutionEnabled: boolean;
  marginExecutionEnabled: boolean;
  leverageEnabled: boolean;
  activeRepaymentEnabled?: boolean;
  marginIntentsEnabled?: boolean;
  leverageRequiresContracts: boolean;
  maxPendingMarginLeverage?: number;
  activeAdapters: string[];
  contractLayer?: {
    status: string;
    vaultAddress: string | null;
    executionAdapterAddress: string | null;
    activeContracts?: ContractDeployment[];
    notes?: string[];
  };
  recommendation: string;
  chains: ExecutionCapabilityChain[];
};

export type TraderProfile = {
  id: string;
  userId: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TraderStats = {
  traderProfileId: string;
  userId: string;
  handle: string;
  numberOfSignals: number;
  numberOfCopyIntents: number;
  copiedVolume: string;
  executedCopyIntentCount: number;
  executedCopiedVolume: string | null;
  realizedPnl: string | null;
};

export type LeaderboardEntry = TraderStats & {
  rank: number;
};

export type CoreUser = {
  id: string;
  displayName: string | null;
  email: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  sessionCount?: number;
  isInternal?: boolean;
  acquisitionSource?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialAccount = {
  id: string;
  userId: string;
  platform: "TELEGRAM" | "FARCASTER" | "WEB";
  platformUserId: string;
  username: string | null;
  profileUrl: string | null;
  authProvider?: AuthProvider;
  source?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  sessionCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type UserSession = {
  user: CoreUser;
  socialAccount: SocialAccount;
  traderProfile: TraderProfile | null;
};

export type PolymarketWalletType = "EOA" | "POLY_PROXY" | "GNOSIS_SAFE" | "POLY_1271";
export type PolymarketAccountStatus = "LINKED" | "READY" | "DISCONNECTED" | "ERROR";
export type PolymarketPositionState = "OPEN" | "CLOSED";

export type PolymarketPositionSnapshot = {
  id: string;
  assetId: string;
  conditionId: string | null;
  state: PolymarketPositionState;
  outcome: string | null;
  size: string | null;
  averagePrice: string | null;
  initialValue: string | null;
  currentValue: string | null;
  cashPnl: string | null;
  realizedPnl: string | null;
  currentPrice: string | null;
  title: string | null;
  slug: string | null;
  iconUrl: string | null;
  eventSlug: string | null;
  endDate: string | null;
  redeemable: boolean;
  mergeable: boolean;
  lastSyncedAt: string;
};

export type PolymarketAccount = {
  id: string;
  userId: string;
  ownerAddress: string;
  funderAddress: string;
  walletType: PolymarketWalletType;
  chainId: 137;
  status: PolymarketAccountStatus;
  credentialsConfigured: boolean;
  credentialsVerifiedAt: string | null;
  profileName: string | null;
  profileUrl: string | null;
  linkedAt: string;
  walletVerifiedAt: string | null;
  disconnectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  positions: PolymarketPositionSnapshot[];
  createdAt: string;
  updatedAt: string;
};

export type PolymarketAccountChallenge = {
  id: string;
  purpose: "LINK" | "UNLINK";
  message: string;
  expiresAt: string;
};

export type DiscoveredUser = {
  user: CoreUser;
  socialAccount: SocialAccount | null;
  traderProfile: TraderProfile | null;
  stats: {
    followers: number;
    following: number;
    publicSignals: number;
    publicPositions: number;
  };
  viewer: {
    isSelf: boolean;
    following: boolean;
  } | null;
};

export type CreateFarcasterSessionInput = {
  fid: number;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
};

export type UpsertTraderProfileInput = {
  userId: string;
  handle: string;
  bio?: string | null;
  avatarUrl?: string | null;
};

export type TradeSignal = {
  id: string;
  traderProfileId: string;
  marketId: string;
  side: "YES" | "NO";
  thesis: string;
  convictionLevel: number | null;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type Position = {
  id: string;
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  quantity: string;
  averageEntryPrice: string | null;
  observedMarketPrice?: string | null;
  observedMarketPriceSource?: string | null;
  observedMarketPriceAt?: string | null;
  chainId?: number | null;
  walletAddress?: string | null;
  executionMode?: "SPOT" | "MARGIN";
  leverageMultiplier?: string | null;
  marginCollateral?: string | null;
  notionalAmount?: string | null;
  borrowedAmount?: string | null;
  executionAdapterId?: string | null;
  chainTransactionHash?: string | null;
  idempotencyKey?: string | null;
  status: string;
  visibility?: "PUBLIC" | "PRIVATE" | string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CopyIntent = {
  id: string;
  followerId: string;
  sourcePositionId: string;
  sourceSignalId: string | null;
  requestedQuantity: string;
  executedQuantity: string | null;
  executionPrice: string | null;
  observedMarketPrice?: string | null;
  observedMarketPriceSource?: string | null;
  observedMarketPriceAt?: string | null;
  chainId?: number | null;
  walletAddress?: string | null;
  executionMode?: "SPOT" | "MARGIN";
  leverageMultiplier?: string | null;
  marginCollateral?: string | null;
  notionalAmount?: string | null;
  borrowedAmount?: string | null;
  executionAdapterId?: string | null;
  chainTransactionHash?: string | null;
  idempotencyKey?: string | null;
  resultingPositionId: string | null;
  status: string;
  externalOrderId?: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExecutionAttempt = {
  id: string;
  targetType: "POSITION" | "COPY_TRADE";
  positionId: string | null;
  copyTradeId: string | null;
  adapterId: string;
  executionMode: "SPOT" | "MARGIN";
  chainId: number | null;
  walletAddress: string | null;
  requestedQuantity: string | null;
  leverageMultiplier: string | null;
  marginCollateral: string | null;
  notionalAmount: string | null;
  borrowedAmount: string | null;
  observedMarketPrice: string | null;
  status: string;
  failureCode: string | null;
  failureMessage: string | null;
  externalOrderId: string | null;
  chainTransactionHash: string | null;
  requestPayload: unknown;
  responsePayload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type ExecutionWalletCall = {
  id?: string;
  chainId: number;
  to: string;
  value: string;
  data: string;
};

export type SerializedTypedData = {
  domain: Record<string, string | number>;
  primaryType: string;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, string | number>;
};

export type PolymarketMarginQuote = {
  borrowAssets: string;
  collateralAssets: string;
  conservativeMarkPrice: string;
  entryDepthAssets: string;
  estimatedOutcomeShares: string;
  feeAssets: string;
  leverageBps: number;
  leverageMultiplier: string;
  liquidationPrice: string;
  mandatoryCloseAt: string;
  notionalAssets: string;
  openingPrice: string;
  orderBookObservedAt: string;
  quoteExpiresAt: string;
  side: "YES" | "NO";
  spreadBps: number;
  tokenId: string;
  twapPrice: string;
};

export type PreparedPolymarketMarginExecution = {
  authorization: {
    quoteId: string;
    borrowAssets: string;
    minimumOutcomeShares: string;
    financingFeeAssets: string;
    priceLimit: string;
  };
  quote: PolymarketMarginQuote;
  typedData: SerializedTypedData;
  walletCalls: ExecutionWalletCall[];
  warning: string;
};

export type PolymarketExecutionState =
  | "AUTHORIZED"
  | "RESERVED"
  | "WALLET_DEPLOYING"
  | "WALLET_COMMIT_REQUIRED"
  | "WALLET_COMMITTED"
  | "FUNDED"
  | "ORDER_PREPARED"
  | "ORDER_SUBMITTED"
  | "FILL_CONFIRMED"
  | "SECURED"
  | "OPEN"
  | "CLOSING"
  | "CLOSED"
  | "FAILED"
  | "CANCELLED"
  | "RECONCILIATION_REQUIRED";

export type PolymarketMarginExecution = {
  id: string;
  positionId: string;
  state: PolymarketExecutionState;
  conditionId: string;
  tokenId: string;
  vaultAddress: string;
  adapterAddress: string;
  loanId: string | null;
  custodyAddress: string | null;
  depositWalletAddress: string | null;
  clobOrderId: string | null;
  clobTradeIds: unknown;
  settlementTxHashes: unknown;
  actualFillPrice: string | null;
  actualShares: string | null;
  actualSpentAssets: string | null;
  actualFeeAssets: string | null;
  authorizedTerms: Record<string, string | number>;
  stageInstruction: {
    stage: string;
    approvalCall?: ExecutionWalletCall;
    walletCall?: ExecutionWalletCall;
  } | null;
  fundingTxHash: string | null;
  custodyFundingTxHash: string | null;
  securityTransferTxHash: string | null;
  activationTxHash: string | null;
  activeCloseAttemptId: string | null;
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  reservedAt: string | null;
  orderSubmittedAt: string | null;
  fillConfirmedAt: string | null;
  securedAt: string | null;
  openedAt: string | null;
  closingAt: string | null;
  closedAt: string | null;
  lastReconciledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PreparedPolymarketClose = {
  quote: {
    amountShares: string;
    depthFloorPrice: string;
    estimatedGrossProceeds: string;
    maximumVenueFeeAssets: string;
    minimumProceeds: string;
    priceLimit: string;
    feeRateBps: number;
    observedAt: string;
  };
  typedData: SerializedTypedData;
  warning: string;
};

export type PolymarketCloseAttempt = {
  id: string;
  executionId: string;
  reason: "VOLUNTARY" | "MANDATORY" | "LIQUIDATION" | "RESOLUTION" | "STOP_LOSS" | "TAKE_PROFIT";
  stage: string;
  priceLimit: string;
  minimumProceeds: string;
  clobOrderId: string | null;
  clobTradeIds: unknown;
  settlementTxHashes: unknown;
  actualFillPrice: string | null;
  actualShares: string | null;
  actualProceeds: string | null;
  actualFeeAssets: string | null;
  vaultBeginTxHash: string | null;
  returnTxHash: string | null;
  vaultSettlementTxHash: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PolymarketPositionControls = {
  activeRepaymentEnabled: boolean;
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  currentBorrowAssets: string | null;
  health: {
    status: "HEALTHY" | "LIQUIDATION_REQUIRED" | "UNAVAILABLE";
    currentBorrowAssets: string;
    executableExitPrice: string | null;
    minimumExitProceeds: string | null;
    maintenanceMarginBps: number | null;
    debtCoverageBps: number | null;
    requiredExitProceeds: string | null;
    surplusAssets: string | null;
    shortfallAssets: string | null;
    observedAt: string | null;
    warning: string;
  } | null;
  warning: string;
  repayments: Array<{
    id: string;
    assets: string;
    transactionHash: string;
    confirmedAt: string;
    createdAt: string;
  }>;
};

export type PreparedPolymarketControls = {
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  typedData: SerializedTypedData;
  warning: string;
};

export type PreparedPolymarketRepayment = {
  assets: string;
  currentBorrowAssets: string;
  remainingBorrowAssets: string;
  walletCalls: ExecutionWalletCall[];
};

export type CreateMarginPositionInput = {
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  quantity: string;
  chainId: number;
  walletAddress: string;
  leverageMultiplier: string;
  marginCollateral: string;
  idempotencyKey?: string | null;
  visibility?: "PUBLIC" | "PRIVATE" | null;
};

export type CreateCopyIntentInput = {
  followerId: string;
  sourcePositionId: string;
  requestedQuantity: string;
  sourceSignalId?: string | null;
};

export type SocialActor = {
  userId: string;
  displayName: string | null;
  handle: string | null;
  traderProfileId?: string | null;
  avatarUrl?: string | null;
  platform: "TELEGRAM" | "FARCASTER" | "WEB" | null;
  platformUserId: string | null;
  username: string | null;
  profileUrl: string | null;
};

export type SignalReply = {
  id: string;
  signalId: string;
  authorUserId: string;
  body: string;
  status: string;
  author: SocialActor;
  createdAt: string;
  updatedAt: string;
};

export type SocialFeedCounts = {
  replies: number;
  reactions: number;
  bookmarks: number;
  copyIntents: number;
};

export type SocialViewerState = {
  reacted: boolean;
  bookmarked: boolean;
};

export type PulsePost = {
  id: string;
  authorUserId: string;
  body: string;
  mediaUrl: string | null;
  mediaType: string | null;
  status: string;
  author: SocialActor;
  counts: SocialFeedCounts;
  viewer: SocialViewerState | null;
  recentReplies?: SignalReply[];
  createdAt: string;
  updatedAt: string;
};

export type SocialFeedItem = {
  signal: TradeSignal;
  market: Market | null;
  trader: TraderProfile | null;
  author: SocialActor;
  counts: SocialFeedCounts;
  viewer: SocialViewerState | null;
  recentReplies: SignalReply[];
};

export type SignalSocialParticipants = {
  reactions: SocialActor[];
  bookmarks: SocialActor[];
  commenters: SocialActor[];
};

export type UserFollow = {
  id: string;
  followerId: string;
  followingId: string;
  follower: SocialActor;
  following: SocialActor;
  createdAt: string;
  updatedAt: string;
};

export type UserNotification = {
  id: string;
  userId: string;
  actorUserId: string | null;
  actor: SocialActor | null;
  type: string;
  entityType: string | null;
  entityId: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PositionReply = {
  id: string;
  positionId: string;
  authorUserId: string;
  body: string;
  status: string;
  author: SocialActor;
  createdAt: string;
  updatedAt: string;
};

export type PublicPosition = {
  id: string;
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  quantity: string;
  executionMode: "SPOT" | "MARGIN";
  leverageMultiplier: string | null;
  marginCollateral: string | null;
  notionalAmount: string | null;
  status: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  trader: SocialActor;
  market: Market | null;
  replies: PositionReply[];
};

export type SocialTimelineEvent = {
  id: string;
  type: "SIGNAL" | "REPOST" | "PUBLIC_TRADE" | "FOLLOW" | "POST";
  createdAt: string;
  actor: SocialActor;
  signal?: SocialFeedItem;
  post?: PulsePost;
  position?: PublicPosition;
  follow?: UserFollow;
};

export type RecentSignalFeedResult =
  | { status: "ready"; signals: TradeSignal[]; message: null }
  | { status: "unavailable"; signals: []; message: string };

export type RecentSocialFeedResult =
  | { status: "ready"; feed: SocialFeedItem[]; message: null }
  | { status: "unavailable"; feed: []; message: string };

export type SocialTimelineResult =
  | { status: "ready"; events: SocialTimelineEvent[]; message: null }
  | { status: "unavailable"; events: []; message: string };

export type CreateTradeSignalInput = {
  traderProfileId: string;
  marketId: string;
  side: "YES" | "NO";
  thesis: string;
  convictionLevel?: number | null;
  source: "TELEGRAM" | "FARCASTER" | "WEB";
};

export type OmnistonStatus = {
  enabled: boolean;
  network: "mainnet" | "testnet";
  routingMode: "disabled" | "quote_only" | "swap_intent";
  apiUrl: string;
  quoteTimeoutMs: number;
  quoteReady: boolean;
  swapSubmissionEnabled: boolean;
  status: string;
  notes: string[];
};

export type OmnistonQuoteSummary = {
  total: number;
  uniqueTelegramUsers: number;
  byStatus: Array<{ status: string; count: number }>;
  topPairs: Array<{ fromAsset: string; toAsset: string; count: number }>;
  recent: Array<{
    id: string;
    fromAsset: string;
    toAsset: string;
    amountUnits: string;
    status: string;
    inputUnits: string | null;
    outputUnits: string | null;
    resolverName: string | null;
    errorCode: string | null;
    createdAt: string;
  }>;
};

export type OmnistonQuoteResult = {
  quote: {
    fromAsset: string;
    toAsset: string;
    inputSymbol: string;
    outputSymbol: string;
    inputUnits: string;
    outputUnits: string;
    inputAmount: string;
    outputAmount: string;
    settlement: "swap" | "order";
    resolverName: string;
    quoteId: string;
    gasBudget: string | null;
    routeCount: number | null;
    recommendedMinOutputAmount: string | null;
  };
  event: unknown;
};

export type TonVaultIntent = {
  id: string;
  userId: string | null;
  telegramUserId: string | null;
  tonAddress: string;
  asset: string;
  amount: string;
  status: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TonVaultSummary = {
  total: number;
  byAsset: Array<{ asset: string; count: number }>;
  recent: TonVaultIntent[];
  custody: {
    status: string;
    message: string;
  };
};

export type RequestOmnistonQuoteInput = {
  fromAsset: string;
  toAsset: string;
  amountUnits: string;
  platformUserId?: string | null;
  username?: string | null;
};

type ApiSuccess<TData> = {
  ok: true;
  data: TData;
};

type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class CoreApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, options: { code: string; statusCode: number }) {
    super(message);
    this.name = "CoreApiError";
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

export async function listMarkets() {
  return readOrFallback(async () => {
    const response = await coreRequest<{ markets?: Market[] } | Market[]>(
      "/markets?limit=250&status=ACTIVE",
    );

    return Array.isArray(response) ? response : (response.markets ?? []);
  }, [] as Market[]);
}

export async function getOmnistonStatus() {
  return readOrFallback(
    async () => {
      const response = await coreRequest<{ omniston: OmnistonStatus }>("/omniston/quote-status");
      return response.omniston;
    },
    {
      enabled: false,
      network: "mainnet",
      routingMode: "disabled",
      apiUrl: "",
      quoteTimeoutMs: 8000,
      quoteReady: false,
      swapSubmissionEnabled: false,
      status: "UNAVAILABLE",
      notes: ["Omniston status is temporarily unavailable."],
    } satisfies OmnistonStatus,
  );
}

export async function getOmnistonSummary() {
  return readOrFallback(
    async () => {
      const response = await coreRequest<{ summary: OmnistonQuoteSummary }>(
        "/omniston/quote-summary",
      );
      return response.summary;
    },
    {
      total: 0,
      uniqueTelegramUsers: 0,
      byStatus: [],
      topPairs: [],
      recent: [],
    } satisfies OmnistonQuoteSummary,
  );
}

export async function requestOmnistonQuote(input: RequestOmnistonQuoteInput) {
  return coreRequest<OmnistonQuoteResult>("/omniston/quote", {
    method: "POST",
    body: input,
  });
}

export async function getMarket(id: string) {
  return readOrFallback(
    async () => {
      const response = await coreRequest<{ market?: Market } | Market>(
        "/markets/" + encodeURIComponent(id),
        {
          allowNotFound: true,
        },
      );

      if (!response) {
        return null;
      }

      return "market" in response && response.market ? response.market : (response as Market);
    },
    null as Market | null,
  );
}

export async function createTelegramSession(input: {
  telegramUserId: string;
  username?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
}) {
  return coreRequest<UserSession>("/social-accounts", {
    method: "POST",
    body: {
      platform: "TELEGRAM",
      platformUserId: input.telegramUserId,
      username: input.username ?? null,
      displayName: input.displayName ?? input.username ?? "Telegram " + input.telegramUserId,
      profileUrl: input.profileUrl ?? null,
      authProvider: "TELEGRAM",
      source: "TELEGRAM_MINI_APP",
    },
  });
}

export async function createTonWalletSession(input: {
  tonAddress: string;
  displayName?: string | null;
  source?: string | null;
}) {
  const normalizedAddress = input.tonAddress.trim();
  const shortAddress = normalizedAddress.slice(0, 6) + "..." + normalizedAddress.slice(-4);

  return coreRequest<UserSession>("/social-accounts", {
    method: "POST",
    body: {
      platform: "WEB",
      platformUserId: "ton:" + normalizedAddress,
      username: "ton-" + shortAddress,
      displayName: input.displayName ?? "TON " + shortAddress,
      profileUrl: null,
      authProvider: "TON_WALLET",
      source: input.source ?? "WEB_APP",
    },
  });
}

export async function createTonVaultIntent(input: {
  userId?: string | null;
  telegramUserId?: string | null;
  tonAddress: string;
  asset: string;
  amount: string;
  note?: string | null;
}) {
  const response = await coreRequest<{ intent?: TonVaultIntent } | TonVaultIntent>(
    "/ton/vault-intents",
    {
      method: "POST",
      body: input,
    },
  );

  return "intent" in response && response.intent ? response.intent : (response as TonVaultIntent);
}

export async function listTonVaultIntents(
  options: { userId?: string; tonAddress?: string; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (options.userId) params.set("userId", options.userId);
  if (options.tonAddress) params.set("tonAddress", options.tonAddress);
  if (options.limit) params.set("limit", String(options.limit));

  const response = await coreRequest<{ intents?: TonVaultIntent[] } | TonVaultIntent[]>(
    "/ton/vault-intents" + (params.size ? "?" + params.toString() : ""),
    { allowNotFound: true },
  );

  return Array.isArray(response) ? response : (response?.intents ?? []);
}

export async function getTonVaultSummary() {
  return readOrFallback(async () => {
    const response = await coreRequest<{ summary?: TonVaultSummary } | TonVaultSummary>(
      "/ton/vault-summary",
      { allowNotFound: true },
    );
    if (!response) {
      return fallbackTonVaultSummary;
    }
    return "summary" in response && response.summary
      ? response.summary
      : (response as TonVaultSummary);
  }, fallbackTonVaultSummary);
}

const fallbackTonVaultSummary: TonVaultSummary = {
  total: 0,
  byAsset: [],
  recent: [],
  custody: {
    status: "contract_pending",
    message: "TON vault intent tracking is unavailable right now.",
  },
};

export async function createFarcasterSession(input: CreateFarcasterSessionInput) {
  return coreRequest<UserSession>("/social-accounts", {
    method: "POST",
    body: {
      platform: "FARCASTER",
      platformUserId: String(input.fid),
      username: input.username ?? null,
      displayName: input.displayName ?? input.username ?? "Farcaster " + input.fid,
      profileUrl: input.username
        ? "https://warpcast.com/" + input.username
        : (input.pfpUrl ?? null),
      authProvider: "FARCASTER",
      source: "FARCASTER",
    },
  });
}

export async function createBrowserWalletSession(input: {
  walletAddress: string;
  authProvider?: AuthProvider | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const normalizedAddress = input.walletAddress.trim();

  return coreRequest<UserSession>("/social-accounts", {
    method: "POST",
    body: {
      platform: "WEB",
      platformUserId: normalizedAddress.toLowerCase(),
      username: normalizedAddress.slice(0, 6) + "..." + normalizedAddress.slice(-4),
      displayName: "Wallet " + normalizedAddress.slice(0, 6) + "..." + normalizedAddress.slice(-4),
      profileUrl: null,
      authProvider: input.authProvider ?? "EVM_EOA",
      source: input.source ?? "WEB_APP",
      metadata: input.metadata ?? null,
    },
  });
}

export async function listPolymarketAccounts(userId: string) {
  const response = await coreRequest<{ accounts: PolymarketAccount[] }>(
    "/users/" + encodeURIComponent(userId) + "/polymarket/accounts",
  );
  return response.accounts;
}

export async function createPolymarketLinkChallenge(input: {
  userId: string;
  convictionAddress: string;
  convictionChainId: number;
  polymarketOwnerAddress: string;
  polymarketFunderAddress: string;
  polymarketWalletType: PolymarketWalletType;
}) {
  const response = await coreRequest<{ challenge: PolymarketAccountChallenge }>(
    "/users/" + encodeURIComponent(input.userId) + "/polymarket/link-challenges",
    {
      method: "POST",
      body: {
        convictionAddress: input.convictionAddress,
        convictionChainId: input.convictionChainId,
        polymarketOwnerAddress: input.polymarketOwnerAddress,
        polymarketFunderAddress: input.polymarketFunderAddress,
        polymarketWalletType: input.polymarketWalletType,
      },
    },
  );
  return response.challenge;
}

export async function completePolymarketAccountLink(input: {
  userId: string;
  challengeId: string;
  convictionSignature: string;
  polymarketSignature?: string | null;
}) {
  const response = await coreRequest<{ account: PolymarketAccount }>(
    "/users/" + encodeURIComponent(input.userId) + "/polymarket/accounts",
    {
      method: "POST",
      body: {
        challengeId: input.challengeId,
        convictionSignature: input.convictionSignature,
        polymarketSignature: input.polymarketSignature ?? null,
      },
    },
  );
  return response.account;
}

export async function syncPolymarketAccount(userId: string, accountId: string) {
  const response = await coreRequest<{ account: PolymarketAccount }>(
    "/users/" +
      encodeURIComponent(userId) +
      "/polymarket/accounts/" +
      encodeURIComponent(accountId) +
      "/sync",
    { method: "POST" },
  );
  return response.account;
}

export async function createPolymarketUnlinkChallenge(input: {
  userId: string;
  accountId: string;
  convictionAddress: string;
  convictionChainId: number;
}) {
  const response = await coreRequest<{ challenge: PolymarketAccountChallenge }>(
    "/users/" +
      encodeURIComponent(input.userId) +
      "/polymarket/accounts/" +
      encodeURIComponent(input.accountId) +
      "/unlink-challenges",
    {
      method: "POST",
      body: {
        convictionAddress: input.convictionAddress,
        convictionChainId: input.convictionChainId,
      },
    },
  );
  return response.challenge;
}

export async function unlinkPolymarketAccount(input: {
  userId: string;
  accountId: string;
  challengeId: string;
  convictionSignature: string;
  polymarketSignature?: string | null;
}) {
  const response = await coreRequest<{ account: PolymarketAccount }>(
    "/users/" +
      encodeURIComponent(input.userId) +
      "/polymarket/accounts/" +
      encodeURIComponent(input.accountId),
    {
      method: "DELETE",
      body: {
        challengeId: input.challengeId,
        convictionSignature: input.convictionSignature,
        polymarketSignature: input.polymarketSignature ?? null,
      },
    },
  );
  return response.account;
}

export async function getExecutionCapabilities() {
  return readOrFallback(async () => {
    const response = await coreRequest<
      { execution?: ExecutionCapabilities } | ExecutionCapabilities
    >("/execution/capabilities", { allowNotFound: true });

    if (!response) {
      return unavailableExecutionCapabilities;
    }

    return "execution" in response && response.execution
      ? response.execution
      : (response as ExecutionCapabilities);
  }, unavailableExecutionCapabilities);
}

export async function upsertTraderProfile(input: UpsertTraderProfileInput) {
  const response = await coreRequest<{ traderProfile?: TraderProfile } | TraderProfile>(
    "/trader-profiles",
    {
      method: "POST",
      body: input,
    },
  );

  return "traderProfile" in response && response.traderProfile
    ? response.traderProfile
    : (response as TraderProfile);
}

export async function getTraderProfile(id: string) {
  return readOrFallback(
    async () => {
      const response = await coreRequest<
        { traderProfile?: TraderProfile; trader?: TraderProfile } | TraderProfile
      >("/trader-profiles/" + encodeURIComponent(id), { allowNotFound: true });

      if (!response) {
        return null;
      }

      if ("traderProfile" in response && response.traderProfile) {
        return response.traderProfile;
      }

      if ("trader" in response && response.trader) {
        return response.trader;
      }

      return response as TraderProfile;
    },
    null as TraderProfile | null,
  );
}

export async function discoverUsers(
  options: { limit?: number; query?: string; viewerUserId?: string; claimedOnly?: boolean } = {},
) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));
  if (options.query?.trim()) params.set("query", options.query.trim());
  if (options.viewerUserId) params.set("viewerUserId", options.viewerUserId);
  if (options.claimedOnly) params.set("claimedOnly", "true");

  return readOrFallback(async () => {
    const response = await coreRequest<{ users?: DiscoveredUser[] } | DiscoveredUser[]>(
      "/users?" + params.toString(),
      { allowNotFound: true },
    );

    if (!response) return [];
    return Array.isArray(response) ? response : (response.users ?? []);
  }, [] as DiscoveredUser[]);
}

export async function listLeaderboard(limit = 25) {
  return readOrFallback(async () => {
    const response = await coreRequest<{ leaderboard?: LeaderboardEntry[] } | LeaderboardEntry[]>(
      "/leaderboard?limit=" + encodeURIComponent(String(limit)),
      { allowNotFound: true },
    );

    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : (response.leaderboard ?? []);
  }, [] as LeaderboardEntry[]);
}

export async function getTraderStats(traderId: string) {
  return readOrFallback(
    async () => {
      const response = await coreRequest<{ stats?: TraderStats } | TraderStats>(
        "/trader-profiles/" + encodeURIComponent(traderId) + "/stats",
        { allowNotFound: true },
      );

      if (!response) {
        return null;
      }

      return "stats" in response && response.stats ? response.stats : (response as TraderStats);
    },
    null as TraderStats | null,
  );
}

export async function createTradeSignal(input: CreateTradeSignalInput) {
  const response = await coreRequest<{ signal?: TradeSignal } | TradeSignal>("/signals", {
    method: "POST",
    body: input,
  });

  return "signal" in response && response.signal ? response.signal : (response as TradeSignal);
}

export async function getRecentSignalFeed(limit = 50): Promise<RecentSignalFeedResult> {
  try {
    const response = await coreRequest<{ signals?: TradeSignal[] } | TradeSignal[]>(
      "/signals?limit=" + encodeURIComponent(String(limit)),
      { allowNotFound: true },
    );

    if (!response) {
      return { status: "ready", signals: [], message: null };
    }

    return {
      status: "ready",
      signals: Array.isArray(response) ? response : (response.signals ?? []),
      message: null,
    };
  } catch (error) {
    if (isRecoverableReadError(error)) {
      return {
        status: "unavailable",
        signals: [],
        message:
          error instanceof CoreApiError ? error.message : "Core API signal feed is unavailable.",
      };
    }

    throw error;
  }
}

export async function listRecentSignals(limit = 50) {
  const feed = await getRecentSignalFeed(limit);

  return feed.signals;
}

export async function getSocialFeed(
  options: { limit?: number; viewerUserId?: string } = {},
): Promise<RecentSocialFeedResult> {
  const params = new URLSearchParams();

  params.set("limit", String(options.limit ?? 50));

  if (options.viewerUserId) {
    params.set("viewerUserId", options.viewerUserId);
  }

  try {
    const response = await coreRequest<{ feed?: SocialFeedItem[] } | SocialFeedItem[]>(
      "/social/feed?" + params.toString(),
      { allowNotFound: true },
    );

    if (!response) {
      return { status: "ready", feed: [], message: null };
    }

    return {
      status: "ready",
      feed: Array.isArray(response) ? response : (response.feed ?? []),
      message: null,
    };
  } catch (error) {
    if (isRecoverableReadError(error)) {
      return {
        status: "unavailable",
        feed: [],
        message:
          error instanceof CoreApiError ? error.message : "Core API social feed is unavailable.",
      };
    }

    throw error;
  }
}

export async function getSignalSocialParticipants(signalId: string, limit = 20) {
  const response = await coreRequest<
    { participants?: SignalSocialParticipants } | SignalSocialParticipants
  >(
    "/signals/" +
      encodeURIComponent(signalId) +
      "/social/participants?limit=" +
      encodeURIComponent(String(limit)),
    { allowNotFound: true },
  );

  if (!response) {
    return { reactions: [], bookmarks: [], commenters: [] } satisfies SignalSocialParticipants;
  }

  return "participants" in response && response.participants
    ? response.participants
    : (response as SignalSocialParticipants);
}

export async function getSocialTimeline(
  options: { limit?: number; userId?: string; scope?: "all" | "following" } = {},
): Promise<SocialTimelineResult> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));

  if (options.userId) params.set("userId", options.userId);
  if (options.scope) params.set("scope", options.scope);

  try {
    const response = await coreRequest<{ events?: SocialTimelineEvent[] } | SocialTimelineEvent[]>(
      "/social/timeline?" + params.toString(),
      { allowNotFound: true },
    );

    if (!response) return { status: "ready", events: [], message: null };

    return {
      status: "ready",
      events: Array.isArray(response) ? response : (response.events ?? []),
      message: null,
    };
  } catch (error) {
    if (isRecoverableReadError(error)) {
      return {
        status: "unavailable",
        events: [],
        message:
          error instanceof CoreApiError
            ? error.message
            : "Core API social timeline is unavailable.",
      };
    }

    throw error;
  }
}

export async function createPulsePost(input: {
  authorUserId: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
}) {
  const response = await coreRequest<{ post?: PulsePost } | PulsePost>("/social/posts", {
    method: "POST",
    body: input,
  });

  return "post" in response && response.post ? response.post : (response as PulsePost);
}

export async function createPulsePostReply(input: {
  postId: string;
  authorUserId: string;
  body: string;
}) {
  const response = await coreRequest<{ reply?: SignalReply } | SignalReply>(
    "/social/posts/" + encodeURIComponent(input.postId) + "/replies",
    {
      method: "POST",
      body: {
        authorUserId: input.authorUserId,
        body: input.body,
      },
    },
  );

  return "reply" in response && response.reply ? response.reply : (response as SignalReply);
}

export async function addPulsePostReaction(input: { postId: string; userId: string }) {
  return coreRequest<{ counts: SocialFeedCounts }>(
    "/social/posts/" + encodeURIComponent(input.postId) + "/reactions",
    {
      method: "POST",
      body: { userId: input.userId },
    },
  );
}

export async function removePulsePostReaction(input: { postId: string; userId: string }) {
  return coreRequest<{ counts: SocialFeedCounts }>(
    "/social/posts/" +
      encodeURIComponent(input.postId) +
      "/reactions/" +
      encodeURIComponent(input.userId),
    { method: "DELETE" },
  );
}

export async function addPulsePostBookmark(input: { postId: string; userId: string }) {
  return coreRequest<{ counts: SocialFeedCounts }>(
    "/social/posts/" + encodeURIComponent(input.postId) + "/bookmarks",
    {
      method: "POST",
      body: { userId: input.userId },
    },
  );
}

export async function removePulsePostBookmark(input: { postId: string; userId: string }) {
  return coreRequest<{ counts: SocialFeedCounts }>(
    "/social/posts/" +
      encodeURIComponent(input.postId) +
      "/bookmarks/" +
      encodeURIComponent(input.userId),
    { method: "DELETE" },
  );
}

export async function followUser(input: { followerId: string; followingId: string }) {
  const response = await coreRequest<{ follow?: UserFollow } | UserFollow>("/social/follows", {
    method: "POST",
    body: input,
  });

  return "follow" in response && response.follow ? response.follow : (response as UserFollow);
}

export async function unfollowUser(input: { followerId: string; followingId: string }) {
  return coreRequest<{ ok: boolean }>("/social/follows", {
    method: "DELETE",
    body: input,
  });
}

export async function listUserFollowing(userId: string, limit = 100) {
  return readOrFallback(async () => {
    const response = await coreRequest<{ following?: UserFollow[] } | UserFollow[]>(
      "/users/" +
        encodeURIComponent(userId) +
        "/following?limit=" +
        encodeURIComponent(String(limit)),
      { allowNotFound: true },
    );

    if (!response) return [];
    return Array.isArray(response) ? response : (response.following ?? []);
  }, [] as UserFollow[]);
}

export async function listUserNotifications(userId: string, limit = 50) {
  return readOrFallback(async () => {
    const response = await coreRequest<{ notifications?: UserNotification[] } | UserNotification[]>(
      "/users/" +
        encodeURIComponent(userId) +
        "/notifications?limit=" +
        encodeURIComponent(String(limit)),
      { allowNotFound: true },
    );

    if (!response) return [];
    return Array.isArray(response) ? response : (response.notifications ?? []);
  }, [] as UserNotification[]);
}

export async function createPositionReply(input: {
  positionId: string;
  authorUserId: string;
  body: string;
}) {
  const response = await coreRequest<{ reply?: PositionReply } | PositionReply>(
    "/positions/" + encodeURIComponent(input.positionId) + "/replies",
    {
      method: "POST",
      body: {
        authorUserId: input.authorUserId,
        body: input.body,
      },
    },
  );

  return "reply" in response && response.reply ? response.reply : (response as PositionReply);
}

export async function createSignalReply(input: {
  signalId: string;
  authorUserId: string;
  body: string;
}) {
  const response = await coreRequest<{ reply?: SignalReply } | SignalReply>(
    "/signals/" + encodeURIComponent(input.signalId) + "/replies",
    {
      method: "POST",
      body: {
        authorUserId: input.authorUserId,
        body: input.body,
      },
    },
  );

  return "reply" in response && response.reply ? response.reply : (response as SignalReply);
}

export async function addSignalReaction(input: { signalId: string; userId: string }) {
  return coreRequest<{ counts: SocialFeedCounts }>(
    "/signals/" + encodeURIComponent(input.signalId) + "/reactions",
    {
      method: "POST",
      body: { userId: input.userId },
    },
  );
}

export async function removeSignalReaction(input: { signalId: string; userId: string }) {
  return coreRequest<{ counts: SocialFeedCounts }>(
    "/signals/" +
      encodeURIComponent(input.signalId) +
      "/reactions/" +
      encodeURIComponent(input.userId),
    { method: "DELETE" },
  );
}

export async function addSignalBookmark(input: { signalId: string; userId: string }) {
  return coreRequest<{ counts: SocialFeedCounts }>(
    "/signals/" + encodeURIComponent(input.signalId) + "/bookmarks",
    {
      method: "POST",
      body: { userId: input.userId },
    },
  );
}

export async function removeSignalBookmark(input: { signalId: string; userId: string }) {
  return coreRequest<{ counts: SocialFeedCounts }>(
    "/signals/" +
      encodeURIComponent(input.signalId) +
      "/bookmarks/" +
      encodeURIComponent(input.userId),
    { method: "DELETE" },
  );
}

export async function getSignal(id: string) {
  return readOrFallback(
    async () => {
      const response = await coreRequest<{ signal?: TradeSignal } | TradeSignal>(
        "/signals/" + encodeURIComponent(id),
        { allowNotFound: true },
      );

      if (!response) {
        return null;
      }

      return "signal" in response && response.signal ? response.signal : (response as TradeSignal);
    },
    null as TradeSignal | null,
  );
}

export async function listMarketSignals(marketId: string) {
  return readOrFallback(async () => {
    const response = await coreRequest<{ signals?: TradeSignal[] } | TradeSignal[]>(
      "/markets/" + encodeURIComponent(marketId) + "/signals",
      { allowNotFound: true },
    );

    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : (response.signals ?? []);
  }, [] as TradeSignal[]);
}

export async function listTraderSignals(traderId: string) {
  return readOrFallback(async () => {
    const response = await coreRequest<{ signals?: TradeSignal[] } | TradeSignal[]>(
      "/trader-profiles/" + encodeURIComponent(traderId) + "/signals",
      { allowNotFound: true },
    );

    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : (response.signals ?? []);
  }, [] as TradeSignal[]);
}

export async function getPosition(id: string) {
  return readOrFallback(
    async () => {
      const response = await coreRequest<{ position?: Position } | Position>(
        "/positions/" + encodeURIComponent(id),
        { allowNotFound: true },
      );

      if (!response) {
        return null;
      }

      return "position" in response && response.position
        ? response.position
        : (response as Position);
    },
    null as Position | null,
  );
}

export async function listUserPositions(userId: string) {
  return readOrFallback(async () => {
    const response = await coreRequest<{ positions?: Position[] } | Position[]>(
      "/users/" + encodeURIComponent(userId) + "/positions",
      { allowNotFound: true },
    );

    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : (response.positions ?? []);
  }, [] as Position[]);
}

export async function listTraderPositions(traderId: string) {
  return readOrFallback(async () => {
    const response = await coreRequest<{ positions?: Position[] } | Position[]>(
      "/trader-profiles/" + encodeURIComponent(traderId) + "/positions",
      { allowNotFound: true },
    );

    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : (response.positions ?? []);
  }, [] as Position[]);
}

export async function listUserCopyIntents(userId: string) {
  return readOrFallback(async () => {
    const response = await coreRequest<
      { copyTrades?: CopyIntent[]; copyIntents?: CopyIntent[] } | CopyIntent[]
    >("/users/" + encodeURIComponent(userId) + "/copy-trades", { allowNotFound: true });

    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    return response.copyIntents ?? response.copyTrades ?? [];
  }, [] as CopyIntent[]);
}

export async function listPositionCopyIntents(positionId: string) {
  return readOrFallback(async () => {
    const response = await coreRequest<
      { copyTrades?: CopyIntent[]; copyIntents?: CopyIntent[] } | CopyIntent[]
    >("/positions/" + encodeURIComponent(positionId) + "/copy-trades", { allowNotFound: true });

    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    return response.copyIntents ?? response.copyTrades ?? [];
  }, [] as CopyIntent[]);
}

export async function createMarginPositionIntent(input: CreateMarginPositionInput) {
  const response = await coreRequest<{ position?: Position } | Position>("/positions", {
    method: "POST",
    body: {
      ...input,
      executionMode: "MARGIN",
    },
  });

  return "position" in response && response.position ? response.position : (response as Position);
}

export async function prepareCollateralApprovalContractCall(input: { positionId: string }) {
  return coreRequest<PreparedContractTransaction>("/contracts/collateral-approvals/prepare", {
    method: "POST",
    body: input,
  });
}

export async function prepareCollateralDepositContractCall(input: { positionId: string }) {
  return coreRequest<PreparedContractTransaction>("/contracts/deposits/prepare", {
    method: "POST",
    body: input,
  });
}

export async function prepareMarginIntentContractCall(input: {
  positionId: string;
  maxSlippageBps?: number;
  deadline?: number;
}) {
  return coreRequest<PreparedMarginIntent>("/contracts/margin-intents/prepare", {
    method: "POST",
    body: input,
  });
}

export async function updateContractTransaction(
  transactionId: string,
  input: {
    transactionHash?: string;
    status?: ContractTransactionStatus;
    responsePayload?: unknown;
  },
) {
  const response = await coreRequest<{ transaction?: ContractTransaction } | ContractTransaction>(
    "/contracts/transactions/" + encodeURIComponent(transactionId),
    {
      method: "PATCH",
      body: input,
    },
  );

  return "transaction" in response && response.transaction
    ? response.transaction
    : (response as ContractTransaction);
}

export async function startPositionExecution(positionId: string) {
  const response = await coreRequest<{ executionAttempt?: ExecutionAttempt } | ExecutionAttempt>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/start",
    { method: "POST" },
  );

  return "executionAttempt" in response && response.executionAttempt
    ? response.executionAttempt
    : (response as ExecutionAttempt);
}

export async function settlePositionExecution(positionId: string) {
  const response = await coreRequest<{ executionAttempt?: ExecutionAttempt } | ExecutionAttempt>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/settle",
    { method: "POST" },
  );

  return "executionAttempt" in response && response.executionAttempt
    ? response.executionAttempt
    : (response as ExecutionAttempt);
}

export async function preparePolymarketMarginExecution(
  positionId: string,
  input: {
    userId: string;
    idempotencyKey: string;
    nonce: string;
    deadline: number;
    maxSlippageBps: number;
  },
) {
  const response = await coreRequest<{ prepared: PreparedPolymarketMarginExecution }>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/polymarket/prepare",
    { method: "POST", body: input },
  );
  return response.prepared;
}

export async function authorizePolymarketMarginExecution(
  positionId: string,
  input: {
    userId: string;
    idempotencyKey: string;
    nonce: string;
    deadline: number;
    maxSlippageBps: number;
    quoteId: string;
    borrowAssets: string;
    minimumOutcomeShares: string;
    financingFeeAssets: string;
    priceLimit: string;
    signature: string;
  },
) {
  const response = await coreRequest<{ execution: PolymarketMarginExecution }>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/polymarket/authorize",
    { method: "POST", body: input },
  );
  return response.execution;
}

export async function getPolymarketMarginExecution(positionId: string, userId: string) {
  const response = await coreRequest<{ execution: PolymarketMarginExecution }>(
    "/execution/positions/" +
      encodeURIComponent(positionId) +
      "/polymarket?userId=" +
      encodeURIComponent(userId),
  );
  return response.execution;
}

export async function recordPolymarketReservation(
  executionId: string,
  input: { userId: string; transactionHash: string },
) {
  const response = await coreRequest<{ execution: PolymarketMarginExecution }>(
    "/execution/polymarket/" + encodeURIComponent(executionId) + "/reservation",
    { method: "POST", body: input },
  );
  return response.execution;
}

export async function recordPolymarketWalletCommit(
  executionId: string,
  input: { userId: string; transactionHash: string },
) {
  const response = await coreRequest<{ execution: PolymarketMarginExecution }>(
    "/execution/polymarket/" + encodeURIComponent(executionId) + "/wallet-commit",
    { method: "POST", body: input },
  );
  return response.execution;
}

export async function advancePolymarketExecution(executionId: string, userId: string) {
  const response = await coreRequest<{ execution: PolymarketMarginExecution }>(
    "/execution/polymarket/" + encodeURIComponent(executionId) + "/advance",
    { method: "POST", body: { userId } },
  );
  return response.execution;
}

export async function preparePolymarketPositionClose(
  positionId: string,
  input: {
    userId: string;
    idempotencyKey: string;
    nonce: string;
    deadline: number;
    maxSlippageBps: number;
  },
) {
  const response = await coreRequest<{ prepared: PreparedPolymarketClose }>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/polymarket/close/prepare",
    { method: "POST", body: input },
  );
  return response.prepared;
}

export async function authorizePolymarketPositionClose(
  positionId: string,
  input: {
    userId: string;
    idempotencyKey: string;
    nonce: string;
    deadline: number;
    maxSlippageBps: number;
    minimumProceeds: string;
    priceLimit: string;
    signature: string;
  },
) {
  const response = await coreRequest<{ closeAttempt: PolymarketCloseAttempt }>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/polymarket/close/authorize",
    { method: "POST", body: input },
  );
  return response.closeAttempt;
}

export async function listPolymarketCloseAttempts(positionId: string, userId: string) {
  const response = await coreRequest<{ closeAttempts: PolymarketCloseAttempt[] }>(
    "/execution/positions/" +
      encodeURIComponent(positionId) +
      "/polymarket/close-attempts?userId=" +
      encodeURIComponent(userId),
  );
  return response.closeAttempts;
}

export async function getPolymarketPositionControls(positionId: string, userId: string) {
  const response = await coreRequest<{ controls: PolymarketPositionControls }>(
    "/execution/positions/" +
      encodeURIComponent(positionId) +
      "/polymarket/controls?userId=" +
      encodeURIComponent(userId),
  );
  return response.controls;
}

export async function preparePolymarketPositionControls(
  positionId: string,
  input: {
    userId: string;
    stopLossPrice: string | null;
    takeProfitPrice: string | null;
    nonce: string;
    deadline: number;
  },
) {
  const response = await coreRequest<{ prepared: PreparedPolymarketControls }>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/polymarket/controls/prepare",
    { method: "POST", body: input },
  );
  return response.prepared;
}

export async function updatePolymarketPositionControls(
  positionId: string,
  input: {
    userId: string;
    stopLossPrice: string | null;
    takeProfitPrice: string | null;
    nonce: string;
    deadline: number;
    signature: string;
  },
) {
  const response = await coreRequest<{ controls: PolymarketPositionControls }>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/polymarket/controls",
    { method: "PUT", body: input },
  );
  return response.controls;
}

export async function preparePolymarketPrincipalRepayment(
  positionId: string,
  input: { userId: string; assets: string },
) {
  const response = await coreRequest<{ prepared: PreparedPolymarketRepayment }>(
    "/execution/positions/" + encodeURIComponent(positionId) + "/polymarket/repay/prepare",
    { method: "POST", body: input },
  );
  return response.prepared;
}

export async function recordPolymarketPrincipalRepayment(
  executionId: string,
  input: { userId: string; assets: string; transactionHash: string },
) {
  const response = await coreRequest<{ controls: PolymarketPositionControls }>(
    "/execution/polymarket/" + encodeURIComponent(executionId) + "/repayments",
    { method: "POST", body: input },
  );
  return response.controls;
}

export async function getUserPreference(userId: string) {
  const response = await coreRequest<{ preference: UserPreference }>(
    "/users/" + encodeURIComponent(userId) + "/preferences",
  );
  return response.preference;
}

export async function updateUserPreference(
  userId: string,
  input: Partial<
    Pick<
      UserPreference,
      "topics" | "regions" | "sports" | "mediaTypes" | "newsIntervalMinutes" | "notifyInActivity"
    >
  >,
) {
  const response = await coreRequest<{ preference: UserPreference }>(
    "/users/" + encodeURIComponent(userId) + "/preferences",
    { method: "PUT", body: input },
  );
  return response.preference;
}

export async function listActivityMedia(options: { userId?: string | null; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.userId) params.set("userId", options.userId);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  const response = await coreRequest<{ items: ActivityMediaItem[] }>(
    "/activity-media" + (query ? "?" + query : ""),
  );
  return response.items;
}

export async function generateActivityMedia(input: { userId: string; limit?: number }) {
  const response = await coreRequest<{ items: ActivityMediaItem[] }>("/activity-media/generate", {
    method: "POST",
    body: input,
  });
  return response.items;
}

export async function createSupportTicket(input: {
  userId?: string | null;
  wallet?: string | null;
  email: string;
  subject: string;
  summary: string;
  transcript?: string | null;
}) {
  const response = await coreRequest<{ ticket: SupportTicket }>("/support/tickets", {
    method: "POST",
    body: input,
  });
  return response.ticket;
}

export async function listSupportTickets(
  input: { userId?: string | null; email?: string | null; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (input.userId) params.set("userId", input.userId);
  if (input.email) params.set("email", input.email);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  const response = await coreRequest<{ tickets: SupportTicket[] }>(
    "/support/tickets" + (query ? "?" + query : ""),
  );
  return response.tickets;
}

export async function getSupportTicket(ticketId: string) {
  const response = await coreRequest<{ ticket: SupportTicket }>(
    "/support/tickets/" + encodeURIComponent(ticketId),
  );
  return response.ticket;
}

export async function createSupportReply(input: {
  ticketId: string;
  userId?: string | null;
  subject?: string | null;
  body: string;
}) {
  const response = await coreRequest<{ ticket: SupportTicket; reply: SupportTicketReply }>(
    "/support/tickets/" + encodeURIComponent(input.ticketId) + "/replies",
    {
      method: "POST",
      body: {
        userId: input.userId ?? null,
        subject: input.subject ?? null,
        body: input.body,
      },
    },
  );
  return response;
}

export async function updateUserEmail(userId: string, email: string) {
  return coreRequest<{ email: string }>("/users/" + encodeURIComponent(userId) + "/email", {
    method: "PATCH",
    body: { email },
  });
}

export async function listAdminFallbackProfiles(token: string) {
  return coreRequest<AdminFallbackProfilesResult>("/admin/fallback-profiles", {
    headers: { Authorization: "Bearer " + token },
  });
}

export async function createCopyIntent(input: CreateCopyIntentInput) {
  const response = await coreRequest<
    { copyTrade?: CopyIntent; copyIntent?: CopyIntent } | CopyIntent
  >("/copy-trades", {
    method: "POST",
    body: input,
  });

  if ("copyIntent" in response && response.copyIntent) {
    return response.copyIntent;
  }

  if ("copyTrade" in response && response.copyTrade) {
    return response.copyTrade;
  }

  return response as CopyIntent;
}

export async function recordUsageEvent(input: RecordUsageEventInput) {
  return coreRequest<{ eventId: string; sessionId: string }>("/analytics/events", {
    method: "POST",
    body: input,
  });
}

export async function getAdminUsageAnalytics(token: string) {
  return coreRequest<AdminUsageAnalyticsResult>("/admin/analytics", {
    headers: { Authorization: "Bearer " + token },
  });
}

type CoreRequestOptions = {
  allowNotFound?: boolean;
  body?: unknown;
  headers?: HeadersInit;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
};

const defaultCoreRequestTimeoutMs = 8000;

const unavailableExecutionCapabilities: ExecutionCapabilities = {
  evmOnly: true,
  architecture: "INTENT_FIRST_SPOT_ADAPTERS_BEFORE_MARGIN",
  spotExecutionEnabled: false,
  marginExecutionEnabled: false,
  leverageEnabled: false,
  marginIntentsEnabled: false,
  leverageRequiresContracts: true,
  maxPendingMarginLeverage: 10,
  activeAdapters: [],
  recommendation:
    "Core API execution capabilities are unavailable. Keep margin execution disabled until contracts and adapters are live.",
  chains: [],
};

function coreRequest<TData>(
  path: string,
  options: CoreRequestOptions & { allowNotFound: true },
): Promise<TData | null>;
function coreRequest<TData>(
  path: string,
  options?: CoreRequestOptions & { allowNotFound?: false },
): Promise<TData>;
async function coreRequest<TData>(path: string, options: CoreRequestOptions = {}) {
  const headers: HeadersInit = {
    Accept: "application/json",
  };
  const hasBody = typeof options.body !== "undefined";

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  if (options.headers) {
    const extraHeaders = new Headers(options.headers);
    extraHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  let response: Response;

  try {
    response = await fetch(getCoreApiUrl() + path, {
      method: options.method ?? "GET",
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: createCoreRequestSignal(),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new CoreApiError("Core API request timed out.", {
        code: "CORE_API_TIMEOUT",
        statusCode: 504,
      });
    }

    throw new CoreApiError("Core API is not reachable.", {
      code: "CORE_API_UNAVAILABLE",
      statusCode: 502,
    });
  }

  const body = await parseJson(response);

  if (response.status === 404 && options.allowNotFound) {
    return null;
  }

  if (!response.ok) {
    const apiError = isApiFailure(body) ? body.error : null;
    throw new CoreApiError(apiError?.message ?? "Core API returned " + response.status, {
      code: apiError?.code ?? "CORE_API_ERROR",
      statusCode: response.status,
    });
  }

  if (isApiFailure(body)) {
    throw new CoreApiError(body.error.message, {
      code: body.error.code,
      statusCode: response.status,
    });
  }

  if (isApiSuccess<TData>(body)) {
    return body.data;
  }

  return body as TData;
}

async function parseJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CoreApiError("Core API returned invalid JSON.", {
      code: "CORE_API_INVALID_RESPONSE",
      statusCode: response.status,
    });
  }
}

function createCoreRequestSignal() {
  return AbortSignal.timeout(getCoreRequestTimeoutMs());
}

function getCoreRequestTimeoutMs() {
  const parsed = Number(process.env.CORE_API_REQUEST_TIMEOUT_MS);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultCoreRequestTimeoutMs;
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

export function getCoreApiUrl() {
  return (
    process.env.CORE_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000"
  )
    .trim()
    .replace(/\/$/, "");
}

async function readOrFallback<TData>(operation: () => Promise<TData>, fallback: TData) {
  try {
    return await operation();
  } catch (error) {
    if (isRecoverableReadError(error)) {
      return fallback;
    }

    throw error;
  }
}

function isRecoverableReadError(error: unknown) {
  return (
    error instanceof CoreApiError &&
    (error.code === "CORE_API_UNAVAILABLE" ||
      error.code === "CORE_API_INVALID_RESPONSE" ||
      error.statusCode >= 500)
  );
}

function isApiSuccess<TData>(body: unknown): body is ApiSuccess<TData> {
  return isRecord(body) && body.ok === true && "data" in body;
}

function isApiFailure(body: unknown): body is ApiFailure {
  return (
    isRecord(body) &&
    body.ok === false &&
    isRecord(body.error) &&
    typeof body.error.code === "string" &&
    typeof body.error.message === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
