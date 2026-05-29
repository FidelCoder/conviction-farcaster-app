"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { UserSession } from "../lib/core-api";

export type FarcasterSessionSnapshot =
  | { status: "loading"; message: string }
  | { status: "ready"; message: string; session: UserSession }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export type FarcasterSessionState = FarcasterSessionSnapshot & {
  retry: () => void;
};

type FarcasterSessionResponse =
  | {
      ok: true;
      data: {
        session: UserSession;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type FarcasterContext = {
  user?: {
    fid?: unknown;
    username?: unknown;
    displayName?: unknown;
    pfpUrl?: unknown;
  };
};

const loadingSessionState: FarcasterSessionSnapshot = {
  status: "loading",
  message: "Connecting Farcaster account...",
};

const sessionListeners = new Set<(state: FarcasterSessionSnapshot) => void>();
let cachedSessionState: FarcasterSessionSnapshot | null = null;
let pendingSessionState: Promise<FarcasterSessionSnapshot> | null = null;

export function useFarcasterSession() {
  const [sessionState, setSessionState] = useState<FarcasterSessionSnapshot>(
    cachedSessionState ?? loadingSessionState,
  );

  const retry = useCallback(() => {
    cachedSessionState = null;
    pendingSessionState = null;
    broadcastSessionState(loadingSessionState);
    void refreshFarcasterSessionState();
  }, []);

  useEffect(() => {
    sessionListeners.add(setSessionState);

    if (cachedSessionState) {
      setSessionState(cachedSessionState);
    } else {
      void refreshFarcasterSessionState();
    }

    return () => {
      sessionListeners.delete(setSessionState);
    };
  }, []);

  return useMemo(() => ({ ...sessionState, retry }), [retry, sessionState]);
}

export function getFarcasterSessionLabel(session: UserSession) {
  return session.socialAccount.username
    ? "@" + session.socialAccount.username
    : "fid " + session.socialAccount.platformUserId;
}

function normalizeFid(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function broadcastSessionState(state: FarcasterSessionSnapshot) {
  for (const listener of sessionListeners) {
    listener(state);
  }
}

async function refreshFarcasterSessionState() {
  const nextState = await getOrCreateFarcasterSessionState();

  broadcastSessionState(nextState);
}

async function getOrCreateFarcasterSessionState() {
  if (cachedSessionState) {
    return cachedSessionState;
  }

  pendingSessionState ??= loadFarcasterSessionState();
  cachedSessionState = await pendingSessionState;

  return cachedSessionState;
}

async function loadFarcasterSessionState(): Promise<FarcasterSessionSnapshot> {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const isInMiniApp = await sdk.isInMiniApp();

    if (!isInMiniApp) {
      return {
        status: "unavailable",
        message: "Open this page as a Farcaster Mini App to attach your real account.",
      };
    }

    const context = (await sdk.context) as FarcasterContext;
    const user = context.user;
    const fid = normalizeFid(user?.fid);

    if (!fid) {
      return {
        status: "error",
        message: "Farcaster context did not include a valid fid.",
      };
    }

    const response = await fetch("/api/farcaster-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fid,
        username: normalizeOptionalString(user?.username),
        displayName: normalizeOptionalString(user?.displayName),
        pfpUrl: normalizeOptionalString(user?.pfpUrl),
      }),
    });
    const body = (await response.json()) as FarcasterSessionResponse;

    if (!response.ok || !body.ok) {
      return {
        status: "error",
        message: body.ok ? "Farcaster session failed." : body.error.message,
      };
    }

    return {
      status: "ready",
      message: "Connected as " + getFarcasterSessionLabel(body.data.session) + ".",
      session: body.data.session,
    };
  } catch {
    return {
      status: "error",
      message: "Unable to create a Farcaster session through the core API.",
    };
  }
}
