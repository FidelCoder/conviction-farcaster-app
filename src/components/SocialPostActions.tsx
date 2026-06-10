"use client";

import { FormEvent, useState } from "react";

import { getFarcasterSessionLabel, useFarcasterSession } from "../hooks/useFarcasterSession";
import type { SignalReply, SocialFeedCounts, SocialViewerState } from "../lib/core-api";

type SocialPostActionsProps = {
  initialCounts: SocialFeedCounts;
  initialReplies: SignalReply[];
  initialViewer: SocialViewerState | null;
  signalId: string;
};

type SocialActionResponse =
  | { ok: true; data: { counts?: SocialFeedCounts; reply?: SignalReply } }
  | { ok: false; error: { code: string; message: string } };

export function SocialPostActions({
  initialCounts,
  initialReplies,
  initialViewer,
  signalId,
}: SocialPostActionsProps) {
  const sessionState = useFarcasterSession();
  const [counts, setCounts] = useState(initialCounts);
  const [viewer, setViewer] = useState<SocialViewerState>(
    initialViewer ?? { reacted: false, bookmarked: false },
  );
  const [replies, setReplies] = useState(initialReplies);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<"bookmark" | "reaction" | "reply" | null>(
    null,
  );
  const canWrite = sessionState.status === "ready";
  const userId = canWrite ? sessionState.session.user.id : null;

  async function toggleReaction() {
    if (!userId) {
      showSessionMessage();
      return;
    }

    setPendingAction("reaction");
    setMessage("");

    try {
      const body = await callSocialAction(
        "/api/social/signals/" + encodeURIComponent(signalId) + "/reactions",
        viewer.reacted ? "DELETE" : "POST",
        { userId },
      );

      if (!body.ok) {
        setMessage(body.error.message);
        return;
      }

      if (body.data.counts) {
        setCounts(body.data.counts);
      }

      setViewer((current) => ({ ...current, reacted: !current.reacted }));
    } catch {
      setMessage("Reaction was not saved.");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleBookmark() {
    if (!userId) {
      showSessionMessage();
      return;
    }

    setPendingAction("bookmark");
    setMessage("");

    try {
      const body = await callSocialAction(
        "/api/social/signals/" + encodeURIComponent(signalId) + "/bookmarks",
        viewer.bookmarked ? "DELETE" : "POST",
        { userId },
      );

      if (!body.ok) {
        setMessage(body.error.message);
        return;
      }

      if (body.data.counts) {
        setCounts(body.data.counts);
      }

      setViewer((current) => ({ ...current, bookmarked: !current.bookmarked }));
    } catch {
      setMessage("Bookmark was not saved.");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      showSessionMessage();
      return;
    }

    const body = replyBody.trim();

    if (!body) {
      setMessage("Write a reply first.");
      return;
    }

    setPendingAction("reply");
    setMessage("");

    try {
      const response = await callSocialAction(
        "/api/social/signals/" + encodeURIComponent(signalId) + "/replies",
        "POST",
        { authorUserId: userId, body },
      );

      if (!response.ok) {
        setMessage(response.error.message);
        return;
      }

      if (response.data.reply) {
        setReplies((current) => [...current, response.data.reply as SignalReply].slice(-4));
        setCounts((current) => ({ ...current, replies: current.replies + 1 }));
      }

      setReplyBody("");
      setReplyOpen(false);
      setMessage("Reply posted.");
    } catch {
      setMessage("Reply was not saved.");
    } finally {
      setPendingAction(null);
    }
  }

  function showSessionMessage() {
    setMessage("Use a real Farcaster account to reply, like, or bookmark.");
  }

  return (
    <div className="social-actions-panel">
      <div className="social-action-row" aria-label="Post actions">
        <button
          aria-expanded={replyOpen}
          className={replyOpen ? "social-count-action active" : "social-count-action"}
          onClick={() => setReplyOpen((current) => !current)}
          type="button"
        >
          <span className="feed-tool reply" aria-hidden="true" />
          <strong>{counts.replies}</strong>
        </button>
        <button
          className={viewer.reacted ? "social-count-action active yes" : "social-count-action"}
          disabled={pendingAction === "reaction"}
          onClick={toggleReaction}
          type="button"
        >
          <span className="feed-tool heart" aria-hidden="true" />
          <strong>{counts.reactions}</strong>
        </button>
        <button
          className={viewer.bookmarked ? "social-count-action active" : "social-count-action"}
          disabled={pendingAction === "bookmark"}
          onClick={toggleBookmark}
          type="button"
        >
          <span className="feed-tool bookmark" aria-hidden="true" />
          <strong>{counts.bookmarks}</strong>
        </button>
        <span className="social-copy-count">{counts.copyIntents} copy intents</span>
      </div>

      {replies.length > 0 ? (
        <div className="social-reply-preview" aria-label="Recent replies">
          {replies.map((reply) => (
            <div key={reply.id}>
              <strong>{getReplyAuthor(reply)}</strong>
              <span>{reply.body}</span>
            </div>
          ))}
        </div>
      ) : null}

      {replyOpen ? (
        <form className="social-reply-form" onSubmit={submitReply}>
          <label>
            <span>{canWrite ? "Reply as " + getFarcasterSessionLabel(sessionState.session) : "Reply"}</span>
            <textarea
              maxLength={1000}
              onChange={(event) => setReplyBody(event.target.value)}
              placeholder="Add a market take, not noise."
              value={replyBody}
            />
          </label>
          <button disabled={pendingAction === "reply"} type="submit">
            Reply
          </button>
        </form>
      ) : null}

      {message ? <p className="social-action-message">{message}</p> : null}
    </div>
  );
}

async function callSocialAction(
  path: string,
  method: "DELETE" | "POST",
  body: Record<string, string>,
) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return (await response.json()) as SocialActionResponse;
}

function getReplyAuthor(reply: SignalReply) {
  return reply.author.username
    ? "@" + reply.author.username
    : reply.author.handle ?? reply.author.displayName ?? compactId(reply.authorUserId);
}

function compactId(id: string) {
  return id.length > 10 ? id.slice(0, 6) + "..." + id.slice(-4) : id;
}
