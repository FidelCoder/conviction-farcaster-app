import { NextResponse } from "next/server";

import { CoreApiError, createFarcasterSession, upsertTraderProfile } from "../../../lib/core-api";

type FarcasterSessionBody = {
  fid?: unknown;
  username?: unknown;
  displayName?: unknown;
  pfpUrl?: unknown;
};

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return validationError("Request body must be a JSON object.");
  }

  const fid = parseFid(body.fid);
  const username = optionalString(body.username);

  if (!fid) {
    return validationError("A valid Farcaster fid is required.");
  }

  try {
    const session = await createFarcasterSession({
      fid,
      username,
      displayName: optionalString(body.displayName),
      pfpUrl: optionalString(body.pfpUrl),
    });
    const traderProfile =
      session.traderProfile ??
      (await upsertTraderProfile({
        userId: session.user.id,
        handle: buildStableTraderHandle(fid, username),
        bio: null,
      }));

    return NextResponse.json(
      { ok: true, data: { session: { ...session, traderProfile } } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "FARCASTER_SESSION_FAILED",
          message: "Core API did not accept the Farcaster session.",
        },
      },
      { status: 502 },
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

function validationError(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_FARCASTER_SESSION",
        message,
      },
    },
    { status: 422 },
  );
}

function parseFid(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is FarcasterSessionBody {
  return typeof value === "object" && value !== null;
}

function buildStableTraderHandle(fid: number, username: string | null) {
  const base = (username ?? "fc" + String(fid))
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .replace(/\.viction$/, "")
    .slice(0, 32);

  return (base || "fc" + String(fid)) + ".viction";
}
