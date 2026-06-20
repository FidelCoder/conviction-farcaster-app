import { NextResponse } from "next/server";

import { CoreApiError, listUserNotifications } from "../../../../../../lib/core-api";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const url = new URL(request.url);
  const limit = normalizeLimit(url.searchParams.get("limit"));

  try {
    const notifications = await listUserNotifications(userId, limit);
    return NextResponse.json({ ok: true, data: { notifications } });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ ok: false, error: { code: "NOTIFICATIONS_FAILED", message: "Core API did not return notifications." } }, { status: 502 });
  }
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50;
}
