import { NextResponse } from "next/server";

import { CoreApiError, getOmnistonSummary } from "../../../../lib/core-api";

export async function GET() {
  try {
    const summary = await getOmnistonSummary();
    return NextResponse.json({ ok: true, data: { summary } });
  } catch (error) {
    return apiError(error, "OMNISTON_SUMMARY_FAILED", "Core API did not return Omniston quote summary.");
  }
}

function apiError(error: unknown, code: string, message: string) {
  if (error instanceof CoreApiError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
  }

  return NextResponse.json({ ok: false, error: { code, message } }, { status: 502 });
}
