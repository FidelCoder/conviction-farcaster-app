import { NextResponse } from "next/server";

import { getFarcasterBetaReadiness } from "../../../lib/beta-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: await getFarcasterBetaReadiness(),
  });
}
