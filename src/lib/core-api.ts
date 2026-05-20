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
  syncedAt?: string | null;
};

export type TraderProfile = {
  id: string;
  userId: string;
  handle: string;
  bio: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  resultingPositionId: string | null;
  status: string;
  externalOrderId?: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCopyIntentInput = {
  followerId: string;
  sourcePositionId: string;
  requestedQuantity: string;
  sourceSignalId?: string | null;
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
  const response = await coreRequest<{ markets?: Market[] } | Market[]>("/markets");

  return Array.isArray(response) ? response : (response.markets ?? []);
}

export async function getMarket(id: string) {
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
}

export async function getTraderProfile(id: string) {
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
}

export async function getSignal(id: string) {
  const response = await coreRequest<{ signal?: TradeSignal } | TradeSignal>(
    "/signals/" + encodeURIComponent(id),
    { allowNotFound: true },
  );

  if (!response) {
    return null;
  }

  return "signal" in response && response.signal ? response.signal : (response as TradeSignal);
}

export async function listMarketSignals(marketId: string) {
  const response = await coreRequest<{ signals?: TradeSignal[] } | TradeSignal[]>(
    "/markets/" + encodeURIComponent(marketId) + "/signals",
    { allowNotFound: true },
  );

  if (!response) {
    return [];
  }

  return Array.isArray(response) ? response : (response.signals ?? []);
}

export async function listTraderSignals(traderId: string) {
  const response = await coreRequest<{ signals?: TradeSignal[] } | TradeSignal[]>(
    "/trader-profiles/" + encodeURIComponent(traderId) + "/signals",
    { allowNotFound: true },
  );

  if (!response) {
    return [];
  }

  return Array.isArray(response) ? response : (response.signals ?? []);
}

export async function getPosition(id: string) {
  const response = await coreRequest<{ position?: Position } | Position>(
    "/positions/" + encodeURIComponent(id),
    { allowNotFound: true },
  );

  if (!response) {
    return null;
  }

  return "position" in response && response.position ? response.position : (response as Position);
}

export async function listTraderPositions(traderId: string) {
  const response = await coreRequest<{ positions?: Position[] } | Position[]>(
    "/trader-profiles/" + encodeURIComponent(traderId) + "/positions",
    { allowNotFound: true },
  );

  if (!response) {
    return [];
  }

  return Array.isArray(response) ? response : (response.positions ?? []);
}

export async function listPositionCopyIntents(positionId: string) {
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
  method?: "GET" | "POST";
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

  const response = await fetch(getCoreApiUrl() + path, {
    method: options.method ?? "GET",
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

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

  return JSON.parse(text) as unknown;
}

function getCoreApiUrl() {
  return (
    process.env.CORE_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
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
