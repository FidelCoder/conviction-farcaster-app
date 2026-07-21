import type { PolymarketAccount, PolymarketAuthChallenge, UserSession } from "./core-api";
import { resolveEvmWalletProvider, type EthereumProvider } from "./evm-wallet-provider";

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const signaturePattern = /^0x[a-fA-F0-9]{130,}$/;

type ApiFailure = {
  ok: false;
  error: { code: string; message: string };
};

type ChallengeResponse = { ok: true; data: { challenge: PolymarketAuthChallenge } } | ApiFailure;

type SessionResponse =
  | { ok: true; data: { session: UserSession; account: PolymarketAccount } }
  | ApiFailure;

export class PolymarketWalletUnavailableError extends Error {
  constructor() {
    super("A browser wallet that controls your Polymarket account was not found.");
    this.name = "PolymarketWalletUnavailableError";
  }
}

export async function signInWithPolymarketWallet(provider?: EthereumProvider) {
  const activeProvider = provider ?? (await resolveEvmWalletProvider());

  if (!activeProvider) {
    throw new PolymarketWalletUnavailableError();
  }

  const accounts = await activeProvider.request({ method: "eth_requestAccounts" });
  const ownerAddress = firstEvmAddress(accounts);

  if (!ownerAddress) {
    throw new Error("The wallet did not return a valid Polymarket owner address.");
  }

  const challengeBody = await postPolymarketAuth({
    action: "challenge",
    ownerAddress,
  });
  const challenge = parsePolymarketChallengeResponse(challengeBody, ownerAddress);
  const signature = await activeProvider.request({
    method: "personal_sign",
    params: [challenge.message, ownerAddress],
  });

  if (typeof signature !== "string" || !signaturePattern.test(signature)) {
    throw new Error("The wallet did not return a valid sign-in signature.");
  }

  const sessionBody = await postPolymarketAuth({
    action: "complete",
    challengeId: challenge.id,
    signature,
  });

  return parsePolymarketSessionResponse(sessionBody);
}

export function parsePolymarketChallengeResponse(body: unknown, expectedOwnerAddress: string) {
  if (isApiFailure(body)) {
    throw new Error(body.error.message);
  }

  if (!isRecord(body) || body.ok !== true || !isRecord(body.data)) {
    throw new Error("Polymarket sign-in returned an invalid challenge.");
  }

  const challenge = body.data.challenge;

  if (
    !isRecord(challenge) ||
    typeof challenge.id !== "string" ||
    !challenge.id ||
    typeof challenge.message !== "string" ||
    !challenge.message ||
    typeof challenge.ownerAddress !== "string" ||
    challenge.ownerAddress.toLowerCase() !== expectedOwnerAddress.toLowerCase() ||
    typeof challenge.funderAddress !== "string" ||
    !evmAddressPattern.test(challenge.funderAddress) ||
    typeof challenge.expiresAt !== "string"
  ) {
    throw new Error("Polymarket sign-in returned an invalid challenge.");
  }

  return challenge as unknown as PolymarketAuthChallenge;
}

export function parsePolymarketSessionResponse(body: unknown) {
  if (isApiFailure(body)) {
    throw new Error(body.error.message);
  }

  if (
    !isRecord(body) ||
    body.ok !== true ||
    !isRecord(body.data) ||
    !isRecord(body.data.session) ||
    !isRecord(body.data.account)
  ) {
    throw new Error("Polymarket sign-in returned an invalid session.");
  }

  return body.data as unknown as { session: UserSession; account: PolymarketAccount };
}

async function postPolymarketAuth(payload: Record<string, string>) {
  const response = await fetch("/api/polymarket/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as ChallengeResponse | SessionResponse;

  if (!response.ok && !isApiFailure(body)) {
    throw new Error("Polymarket sign-in is unavailable right now.");
  }

  return body;
}

function firstEvmAddress(value: unknown) {
  if (!Array.isArray(value)) return null;

  const address = value.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && evmAddressPattern.test(candidate),
  );

  return address ?? null;
}

function isApiFailure(value: unknown): value is ApiFailure {
  return (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.message === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
