import { NextResponse } from "next/server";

import { CoreApiError, getOmnistonStatus } from "../../../../lib/core-api";

export async function GET() {
  try {
    const omniston = await getOmnistonStatus();
    return NextResponse.json({ ok: true, data: { omniston } });
  } catch (error) {
    return apiError(error, "OMNISTON_STATUS_FAILED", "Core API did not return Omniston status.");
  }
}

function apiError(error: unknown, code: string, message: string) {
  if (error instanceof CoreApiError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
  }

  return NextResponse.json({ ok: false, error: { code, message } }, { status: 502 });
}
