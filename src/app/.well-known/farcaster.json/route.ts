import { NextResponse } from "next/server";

import { getMiniAppManifest } from "../../../lib/miniapp";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getMiniAppManifest());
}
