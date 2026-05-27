"use client";

import { useEffect, useState } from "react";

import type { UserSession } from "../lib/core-api";

export type FarcasterSessionState =
  | { status: "loading"; message: string }
  | { status: "ready"; message: string; session: UserSession }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

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

export function useFarcasterSession() {
  const [sessionState, setSessionState] = useState<FarcasterSessionState>({
    status: "loading",
    message: "Connecting Farcaster account...",
  });

  useEffect(() => {
    let isMounted = true;

    async function connectFarcasterSession() {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const isInMiniApp = await sdk.isInMiniApp();

        if (!isMounted) {
          return;
        }

        if (!isInMiniApp) {
          setSessionState({
            status: "unavailable",
            message: "Open this page as a Farcaster Mini App to attach your real account.",
          });
          return;
        }

        const context = (await sdk.context) as FarcasterContext;
        const user = context.user;
        const fid = normalizeFid(user?.fid);

        if (!fid) {
          setSessionState({
            status: "error",
            message: "Farcaster context did not include a valid fid.",
          });
          return;
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

        if (!isMounted) {
          return;
        }

        if (!response.ok || !body.ok) {
          setSessionState({
            status: "error",
            message: body.ok ? "Farcaster session failed." : body.error.message,
          });
          return;
        }

        setSessionState({
          status: "ready",
          message: "Connected as " + getFarcasterSessionLabel(body.data.session) + ".",
          session: body.data.session,
        });
      } catch {
        if (isMounted) {
          setSessionState({
            status: "error",
            message: "Unable to create a Farcaster session through the core API.",
          });
        }
      }
    }

    void connectFarcasterSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return sessionState;
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
