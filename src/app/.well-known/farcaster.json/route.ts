import { NextResponse } from "next/server";

import { getMiniAppManifest } from "../../../lib/miniapp";

export const dynamic = "force-dynamic";

export function GET() {
  const hostedManifestId = process.env.FARCASTER_HOSTED_MANIFEST_ID?.trim();

  if (hostedManifestId) {
    return NextResponse.redirect(
      "https://api.farcaster.xyz/miniapps/hosted-manifest/" + hostedManifestId,
      307,
    );
  }

  return NextResponse.json(getMiniAppManifest());
}
