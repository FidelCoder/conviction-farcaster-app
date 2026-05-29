"use client";

import { getFarcasterSessionLabel, type FarcasterSessionState } from "../hooks/useFarcasterSession";

type FarcasterSessionPanelProps = {
  label: string;
  readyMessage?: string;
  sessionState: FarcasterSessionState;
};

export function FarcasterSessionPanel({
  label,
  readyMessage,
  sessionState,
}: FarcasterSessionPanelProps) {
  const isReady = sessionState.status === "ready";
  const accountLabel = isReady
    ? getFarcasterSessionLabel(sessionState.session)
    : sessionState.status === "loading"
      ? "Connecting..."
      : "Not connected";
  const message = isReady && readyMessage ? readyMessage : sessionState.message;

  return (
    <div className={isReady ? "session-panel ready" : "session-panel"}>
      <div className="session-panel-copy">
        <span>{label}</span>
        <strong>{accountLabel}</strong>
        <p>{message}</p>
      </div>
      {sessionState.status === "error" ? (
        <button className="session-retry-button" onClick={sessionState.retry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}
