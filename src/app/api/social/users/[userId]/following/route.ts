import { NextResponse } from "next/server";

import { CoreApiError, listUserFollowing } from "../../../../../../lib/core-api";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const url = new URL(request.url);
  const limit = normalizeLimit(url.searchParams.get("limit"));

  try {
    const following = await listUserFollowing(userId, limit);
    return NextResponse.json({ ok: true, data: { following } });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ ok: false, error: { code: "FOLLOWING_FAILED", message: "Core API did not return following users." } }, { status: 502 });
  }
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 100;
}
