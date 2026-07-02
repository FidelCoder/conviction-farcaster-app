import { NextResponse } from "next/server";

import { CoreApiError, discoverUsers } from "../../../../lib/core-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const query = url.searchParams.get("query")?.trim() || undefined;
  const viewerUserId = url.searchParams.get("viewerUserId")?.trim() || undefined;
  const claimedOnly = url.searchParams.get("claimedOnly") === "true";

  try {
    const users = await discoverUsers({ limit, query, viewerUserId, claimedOnly });
    return NextResponse.json({ ok: true, data: { users } });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { ok: false, error: { code: "USERS_DISCOVERY_FAILED", message: "Core API did not return users." } },
      { status: 502 },
    );
  }
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50;
}
