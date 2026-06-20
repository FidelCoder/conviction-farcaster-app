import { NextResponse } from "next/server";

import { CoreApiError, followUser, unfollowUser } from "../../../../lib/core-api";

export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const followerId = stringField(body, "followerId");
  const followingId = stringField(body, "followingId");
  if (!followerId || !followingId) return validationError("Follower and following users are required.");

  try {
    const follow = await followUser({ followerId, followingId });
    return NextResponse.json({ ok: true, data: { follow } }, { status: 201 });
  } catch (error) {
    return apiError(error, "FOLLOW_FAILED", "Core API did not accept the follow.");
  }
}

export async function DELETE(request: Request) {
  const body = await parseBody(request);
  if (!isRecord(body)) return validationError("Request body must be a JSON object.");

  const followerId = stringField(body, "followerId");
  const followingId = stringField(body, "followingId");
  if (!followerId || !followingId) return validationError("Follower and following users are required.");

  try {
    const result = await unfollowUser({ followerId, followingId });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return apiError(error, "UNFOLLOW_FAILED", "Core API did not remove the follow.");
  }
}

async function parseBody(request: Request) {
  try { return (await request.json()) as unknown; } catch { return null; }
}

function validationError(message: string) {
  return NextResponse.json({ ok: false, error: { code: "INVALID_FOLLOW", message } }, { status: 422 });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
