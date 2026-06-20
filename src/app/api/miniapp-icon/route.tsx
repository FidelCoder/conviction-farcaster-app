import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const iconPath = searchParams.get("size") === "splash" ? "/logo/icon-192.png" : "/logo/icon-512.png";

  return NextResponse.redirect(new URL(iconPath, request.url), {
    headers: {
      "Cache-Control": "public, immutable, no-transform, max-age=31536000",
    },
    status: 308,
  });
}
