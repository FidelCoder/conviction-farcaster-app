import { NextResponse } from "next/server";

import { CoreApiError, createPulsePost } from "../../../../lib/core-api";

export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const authorUserId = stringField(body, "authorUserId");
  const postBody = stringField(body, "body");
  const mediaUrl = optionalStringField(body, "mediaUrl");
  const mediaType = optionalStringField(body, "mediaType");

  if (!authorUserId || !postBody) return validationError("Author and post text are required.");

  try {
    const post = await createPulsePost({ authorUserId, body: postBody, mediaUrl, mediaType });
    return NextResponse.json({ ok: true, data: { post } }, { status: 201 });
  } catch (error) {
    return apiError(error, "PULSE_POST_FAILED", "Core API did not accept the Pulse post.");
  }
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}

function validationError(message: string) {
  return NextResponse.json({ ok: false, error: { code: "INVALID_PULSE_POST", message } }, { status: 422 });
}

function apiError(error: unknown, code: string, message: string) {
  if (error instanceof CoreApiError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.statusCode });
  }
  return NextResponse.json({ ok: false, error: { code, message } }, { status: 502 });
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function optionalStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
