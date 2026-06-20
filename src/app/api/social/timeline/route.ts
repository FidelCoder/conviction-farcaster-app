import { NextResponse } from "next/server";

import { CoreApiError, getSocialTimeline } from "../../../../lib/core-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const userId = url.searchParams.get("userId")?.trim() || undefined;
  const scopeValue = url.searchParams.get("scope")?.trim();
  const scope = scopeValue === "following" ? "following" : "all";

  try {
    const timeline = await getSocialTimeline({ limit, userId, scope });

    return NextResponse.json({ ok: true, data: { events: timeline.events } });
  } catch (error) {
    return apiError(error, "SOCIAL_TIMELINE_FAILED", "Core API did not return social timeline.");
  }
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50;
}

function apiError(error: unknown, code: string, message: string) {
  if (error instanceof CoreApiError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
  }

  return NextResponse.json({ ok: false, error: { code, message } }, { status: 502 });
}
