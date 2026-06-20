import { NextResponse } from "next/server";

import { getUserPreference, updateUserPreference } from "../../../../lib/core-api";

type Context = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: Context) {
  const { userId } = await context.params;
  const preference = await getUserPreference(userId);
  return NextResponse.json({ ok: true, data: { preference } });
}

export async function PUT(request: Request, context: Context) {
  const { userId } = await context.params;
  const body = await parseBody(request);
  const preference = await updateUserPreference(userId, body && typeof body === "object" ? body : {});
  return NextResponse.json({ ok: true, data: { preference } });
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}
