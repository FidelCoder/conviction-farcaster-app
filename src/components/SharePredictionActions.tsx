"use client";

import { useState } from "react";

import { getAbsoluteAppUrl, getWarpcastShareUrl } from "../lib/miniapp";

type SharePredictionActionsProps = {
  className?: string;
  path: string;
  title: string;
  context?: string;
};

export function SharePredictionActions({
  className = "",
  context,
  path,
  title,
}: SharePredictionActionsProps) {
  const [copyLabel, setCopyLabel] = useState("Copy");
  const shareText = context ? title + " | " + context : title;
  const absoluteUrl = getAbsoluteAppUrl(path);
  const xUrl = getXShareUrl({ text: shareText, url: absoluteUrl });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy"), 1800);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel("Copy"), 1800);
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      await handleCopy();
      return;
    }

    await navigator.share({
      text: shareText,
      title,
      url: absoluteUrl,
    });
  }

  return (
    <div className={"share-actions " + className} aria-label="Share prediction">
      <a
        className="share-action cast"
        href={getWarpcastShareUrl({ path, text: shareText })}
        rel="noreferrer"
        target="_blank"
      >
        Cast
      </a>
      <a className="share-action" href={xUrl} rel="noreferrer" target="_blank">
        Tweet
      </a>
      <button className="share-action" onClick={handleCopy} type="button">
        {copyLabel}
      </button>
      <button className="share-action compact-only" onClick={handleNativeShare} type="button">
        Share
      </button>
    </div>
  );
}

function getXShareUrl({ text, url }: { text: string; url: string }) {
  const shareUrl = new URL("https://twitter.com/intent/tweet");

  shareUrl.searchParams.set("text", text);
  shareUrl.searchParams.set("url", url);

  return shareUrl.toString();
}
