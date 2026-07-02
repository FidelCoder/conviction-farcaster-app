import { NextResponse } from "next/server";

import { CoreApiError, listAdminFallbackProfiles } from "../../../../lib/core-api";

export async function POST(request: Request) {
  const body = await parseBody(request);

  if (!isRecord(body)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_ADMIN_REQUEST", message: "Request body must be a JSON object." } },
      { status: 422 },
    );
  }

  const token = stringField(body, "token");

  if (!token) {
    return NextResponse.json(
      { ok: false, error: { code: "ADMIN_TOKEN_REQUIRED", message: "Admin token is required." } },
      { status: 401 },
    );
  }

  try {
    const result = await listAdminFallbackProfiles(token);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof CoreApiError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { ok: false, error: { code: "ADMIN_FALLBACK_PROFILES_FAILED", message: "Core API did not return fallback profiles." } },
      { status: 502 },
    );
  }
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}
