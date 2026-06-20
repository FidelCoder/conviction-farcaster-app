import { NextResponse } from "next/server";

import { listActivityMedia } from "../../../lib/core-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const items = await listActivityMedia({ userId, limit });
  return NextResponse.json({ ok: true, data: { items } });
}
