import { NextResponse } from "next/server";

import { CoreApiError, requestOmnistonQuote } from "../../../../lib/core-api";

type QuoteBody = {
  fromAsset?: unknown;
  toAsset?: unknown;
  amountUnits?: unknown;
  platformUserId?: unknown;
  username?: unknown;
};

export async function POST(request: Request) {
  let body: QuoteBody;

  try {
    body = (await request.json()) as QuoteBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_OMNISTON_QUOTE", message: "Request body must be JSON." } },
      { status: 422 },
    );
  }

  const fromAsset = normalizeString(body.fromAsset);
  const toAsset = normalizeString(body.toAsset);
  const amountUnits = normalizeString(body.amountUnits);

  if (!fromAsset || !toAsset || !amountUnits) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_OMNISTON_QUOTE", message: "Asset pair and amount are required." } },
      { status: 422 },
    );
  }

  try {
    const result = await requestOmnistonQuote({
      fromAsset,
      toAsset,
      amountUnits,
      platformUserId: normalizeString(body.platformUserId) || null,
      username: normalizeString(body.username) || null,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return apiError(error, "OMNISTON_QUOTE_FAILED", "Core API did not return an Omniston quote.");
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function apiError(error: unknown, code: string, message: string) {
  if (error instanceof CoreApiError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
  }

  return NextResponse.json({ ok: false, error: { code, message } }, { status: 502 });
}
