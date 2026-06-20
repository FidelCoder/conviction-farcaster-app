import { NextResponse } from "next/server";

import { CoreApiError, getSignalSocialParticipants } from "../../../../../../lib/core-api";

type RouteContext = {
  params: Promise<{ signalId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { signalId } = await context.params;
  const url = new URL(request.url);
  const limit = normalizeLimit(url.searchParams.get("limit"));

  try {
    const participants = await getSignalSocialParticipants(signalId, limit);

    return NextResponse.json({ ok: true, data: { participants } });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SIGNAL_PARTICIPANTS_FAILED",
          message: "Core API did not return signal participants.",
        },
      },
      { status: 502 },
    );
  }
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20;
}
