import { NextResponse } from "next/server";

import { generateActivityMedia } from "../../../../lib/core-api";

export async function POST(request: Request) {
  const body = await parseBody(request);
  const userId = isRecord(body) && typeof body.userId === "string" ? body.userId : "";
  const limit = isRecord(body) && typeof body.limit === "number" ? body.limit : 8;

  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_USER", message: "userId is required." } }, { status: 422 });
  }

  const items = await generateActivityMedia({ userId, limit });
  return NextResponse.json({ ok: true, data: { items } }, { status: 201 });
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
