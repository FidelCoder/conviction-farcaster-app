import { NextRequest, NextResponse } from "next/server";

import {
  CoreApiError,
  completePolymarketAccountLink,
  createPolymarketLinkChallenge,
  createPolymarketUnlinkChallenge,
  listPolymarketAccounts,
  syncPolymarketAccount,
  unlinkPolymarketAccount,
  type PolymarketWalletType,
} from "../../../../lib/core-api";

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const signaturePattern = /^0x[a-fA-F0-9]+$/;
const walletTypes = new Set<PolymarketWalletType>([
  "EOA",
  "POLY_PROXY",
  "GNOSIS_SAFE",
  "POLY_1271",
]);

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")?.trim();

  if (!userId) return validationError("A signed-in Conviction user is required.");

  try {
    const accounts = await listPolymarketAccounts(userId);
    return NextResponse.json({ ok: true, data: { accounts } });
  } catch (error) {
    return coreError(error, "POLYMARKET_ACCOUNTS_FAILED", "Linked accounts could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request);

  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const action = stringField(body, "action");
  const userId = stringField(body, "userId");

  if (!userId) return validationError("A signed-in Conviction user is required.");

  try {
    if (action === "challenge-link") {
      const convictionAddress = addressField(body, "convictionAddress");
      const ownerAddress = addressField(body, "polymarketOwnerAddress");
      const funderAddress = addressField(body, "polymarketFunderAddress");
      const walletType = stringField(body, "polymarketWalletType") as PolymarketWalletType;
      const convictionChainId = integerField(body, "convictionChainId");

      if (!convictionAddress || !ownerAddress || !funderAddress) {
        return validationError(
          "Valid Conviction owner and Polymarket funder addresses are required.",
        );
      }

      if (!walletTypes.has(walletType)) {
        return validationError("Choose a supported Polymarket account type.");
      }

      if (!convictionChainId)
        return validationError("The active Conviction wallet chain is required.");

      const challenge = await createPolymarketLinkChallenge({
        userId,
        convictionAddress,
        convictionChainId,
        polymarketOwnerAddress: ownerAddress,
        polymarketFunderAddress: funderAddress,
        polymarketWalletType: walletType,
      });

      return NextResponse.json({ ok: true, data: { challenge } }, { status: 201 });
    }

    if (action === "complete-link") {
      const challengeId = stringField(body, "challengeId");
      const convictionSignature = signatureField(body, "convictionSignature");
      const polymarketSignature = optionalSignatureField(body, "polymarketSignature");

      if (!challengeId || !convictionSignature) {
        return validationError("The ownership challenge and Conviction signature are required.");
      }

      const account = await completePolymarketAccountLink({
        userId,
        challengeId,
        convictionSignature,
        polymarketSignature,
      });

      return NextResponse.json({ ok: true, data: { account } }, { status: 201 });
    }

    if (action === "sync") {
      const accountId = stringField(body, "accountId");

      if (!accountId) return validationError("A linked account is required.");

      const account = await syncPolymarketAccount(userId, accountId);
      return NextResponse.json({ ok: true, data: { account } });
    }

    if (action === "challenge-unlink") {
      const accountId = stringField(body, "accountId");
      const convictionAddress = addressField(body, "convictionAddress");
      const convictionChainId = integerField(body, "convictionChainId");

      if (!accountId || !convictionAddress || !convictionChainId) {
        return validationError("The linked account and active Conviction wallet are required.");
      }

      const challenge = await createPolymarketUnlinkChallenge({
        userId,
        accountId,
        convictionAddress,
        convictionChainId,
      });

      return NextResponse.json({ ok: true, data: { challenge } }, { status: 201 });
    }

    if (action === "complete-unlink") {
      const accountId = stringField(body, "accountId");
      const challengeId = stringField(body, "challengeId");
      const convictionSignature = signatureField(body, "convictionSignature");
      const polymarketSignature = optionalSignatureField(body, "polymarketSignature");

      if (!accountId || !challengeId || !convictionSignature) {
        return validationError(
          "The account, ownership challenge, and Conviction signature are required.",
        );
      }

      const account = await unlinkPolymarketAccount({
        userId,
        accountId,
        challengeId,
        convictionSignature,
        polymarketSignature,
      });

      return NextResponse.json({ ok: true, data: { account } });
    }

    return validationError("Unsupported linked-account action.");
  } catch (error) {
    return coreError(
      error,
      "POLYMARKET_ACCOUNT_ACTION_FAILED",
      "The linked-account action failed.",
    );
  }
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function addressField(record: Record<string, unknown>, key: string) {
  const value = stringField(record, key);
  return evmAddressPattern.test(value) ? value : "";
}

function integerField(record: Record<string, unknown>, key: string) {
  const value = Number(record[key]);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function optionalSignatureField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (value === null || typeof value === "undefined" || value === "") return null;

  return signatureField(record, key);
}

function signatureField(record: Record<string, unknown>, key: string) {
  const value = stringField(record, key);
  return signaturePattern.test(value) && value.length >= 130 ? value : "";
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function validationError(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_POLYMARKET_ACCOUNT_REQUEST", message } },
    { status: 422 },
  );
}

function coreError(error: unknown, code: string, message: string) {
  if (error instanceof CoreApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }

  return NextResponse.json({ ok: false, error: { code, message } }, { status: 502 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
