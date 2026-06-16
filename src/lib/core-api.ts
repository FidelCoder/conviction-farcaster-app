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
  orderMinSize?: string | null;
  syncedAt?: string | null;
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
  createdAt: string;
  updatedAt: string;
};

export type UserSession = {
  user: CoreUser;
  socialAccount: SocialAccount;
  traderProfile: TraderProfile | null;
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

export type SocialFeedItem = {
  signal: TradeSignal;
  market: Market | null;
  trader: TraderProfile | null;
  author: SocialActor;
  counts: SocialFeedCounts;
  viewer: SocialViewerState | null;
  recentReplies: SignalReply[];
};

export type RecentSignalFeedResult =
  | { status: "ready"; signals: TradeSignal[]; message: null }
  | { status: "unavailable"; signals: []; message: string };

export type RecentSocialFeedResult =
  | { status: "ready"; feed: SocialFeedItem[]; message: null }
  | { status: "unavailable"; feed: []; message: string };

export type CreateTradeSignalInput = {
  traderProfileId: string;
  marketId: string;
  side: "YES" | "NO";
  thesis: string;
  convictionLevel?: number | null;
  source: "TELEGRAM" | "FARCASTER" | "WEB";
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
    const response = await coreRequest<{ markets?: Market[] } | Market[]>("/markets");

    return Array.isArray(response) ? response : (response.markets ?? []);
  }, [] as Market[]);
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
    },
  });
}

export async function createBrowserWalletSession(input: { walletAddress: string }) {
  const normalizedAddress = input.walletAddress.trim();

  return coreRequest<UserSession>("/social-accounts", {
    method: "POST",
    body: {
      platform: "WEB",
      platformUserId: normalizedAddress.toLowerCase(),
      username: normalizedAddress.slice(0, 6) + "..." + normalizedAddress.slice(-4),
      displayName: "Wallet " + normalizedAddress.slice(0, 6) + "..." + normalizedAddress.slice(-4),
      profileUrl: null,
    },
  });
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
        message: error instanceof CoreApiError ? error.message : "Core API signal feed is unavailable.",
      };
    }

    throw error;
  }
}

export async function listRecentSignals(limit = 50) {
  const feed = await getRecentSignalFeed(limit);

  return feed.signals;
}

export async function getSocialFeed(options: { limit?: number; viewerUserId?: string } = {}): Promise<RecentSocialFeedResult> {
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
        message: error instanceof CoreApiError ? error.message : "Core API social feed is unavailable.",
      };
    }

    throw error;
  }
}

export async function createSignalReply(input: { signalId: string; authorUserId: string; body: string }) {
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
    "/signals/" + encodeURIComponent(input.signalId) + "/reactions/" + encodeURIComponent(input.userId),
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
    "/signals/" + encodeURIComponent(input.signalId) + "/bookmarks/" + encodeURIComponent(input.userId),
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

export async function updateUserEmail(userId: string, email: string) {
  return coreRequest<{ email: string }>(
    "/users/" + encodeURIComponent(userId) + "/email",
    {
      method: "PATCH",
      body: { email },
    },
  );
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

type CoreRequestOptions = {
  allowNotFound?: boolean;
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
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
