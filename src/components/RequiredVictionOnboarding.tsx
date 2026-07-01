"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { getSessionWalletAddress } from "../lib/browser-wallet-session";
import type { UserSession } from "../lib/core-api";
import {
  buildVictionHandle,
  isClaimedVictionHandle,
  normalizeVictionHandle,
} from "../lib/viction-profile";

type ProfileClaimResponse =
  | { ok: true; data: { session: UserSession | null; traderProfile?: UserSession["traderProfile"] } }
  | { ok: false; error: { code: string; message: string } };

const ONBOARDING_AVATARS = [
  { id: "bottts", label: "Signal Bot", style: "bottts" },
  { id: "rings", label: "Orbit Ring", style: "rings" },
  { id: "identicon", label: "Vault Sigil", style: "identicon" },
  { id: "shapes", label: "Market Shape", style: "shapes" },
  { id: "adventurer", label: "Desk Avatar", style: "adventurer-neutral" },
] as const;

type OnboardingAvatarId = (typeof ONBOARDING_AVATARS)[number]["id"];

export function RequiredVictionOnboarding({
  onClaimed,
  session,
}: {
  onClaimed: (session: UserSession) => void;
  session: UserSession | null;
}) {
  const walletAddress = getSessionWalletAddress(session);
  const existingHandle = session?.traderProfile?.handle ?? "";
  const requiresClaim = Boolean(session && !isClaimedVictionHandle(existingHandle));
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [avatarId, setAvatarId] = useState<OnboardingAvatarId>("bottts");
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "error"; message: string }>({
    type: "idle",
    message: "",
  });

  const orderedAvatars = useMemo(
    () => rotateOnboardingAvatars(walletAddress ?? session?.user.id ?? "guest"),
    [session?.user.id, walletAddress],
  );
  const fullHandle = buildVictionHandle(handle);
  const avatarUrl = buildOnboardingAvatarUrl(avatarId, fullHandle);

  useEffect(() => {
    if (!requiresClaim) {
      setStatus({ type: "idle", message: "" });
      return;
    }

    setEmail(session?.user.email ?? "");
    setHandle(suggestHandleFromSession(session));
    setAvatarId(orderedAvatars[0]?.id ?? "bottts");
  }, [orderedAvatars, requiresClaim, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) return;

    const cleanHandle = normalizeVictionHandle(handle);

    if (cleanHandle.length < 2) {
      setStatus({ type: "error", message: "Choose a handle with at least 2 characters." });
      return;
    }

    setStatus({ type: "saving", message: "Claiming your .viction identity..." });

    try {
      const profileResponse = await fetch("/api/trader-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          walletAddress,
          handle: buildVictionHandle(cleanHandle),
          bio: bio.trim() || null,
          avatarUrl,
        }),
      });
      const profileBody = (await profileResponse.json()) as ProfileClaimResponse;

      if (!profileResponse.ok || !profileBody.ok) {
        setStatus({
          type: "error",
          message: profileBody.ok ? "Profile claim failed." : profileBody.error.message,
        });
        return;
      }

      let nextSession = profileBody.data.session ?? {
        ...session,
        traderProfile: profileBody.data.traderProfile ?? session.traderProfile,
      };

      if (email.trim()) {
        const emailResponse = await fetch("/api/user-email", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id, walletAddress, email: email.trim() }),
        });
        const emailBody = (await emailResponse.json()) as ProfileClaimResponse;

        if (!emailResponse.ok || !emailBody.ok) {
          setStatus({
            type: "error",
            message: emailBody.ok ? "Email update failed." : emailBody.error.message,
          });
          return;
        }

        nextSession = {
          ...nextSession,
          user: { ...nextSession.user, email: email.trim() },
        };
      }

      onClaimed(nextSession);
    } catch {
      setStatus({ type: "error", message: "Core API did not accept the profile claim." });
    }
  }

  if (!requiresClaim) return null;

  return (
    <div className="viction-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="viction-onboarding-title">
      <form className="viction-onboarding-card" onSubmit={handleSubmit}>
        <div className="viction-onboarding-heading">
          <span>Required setup</span>
          <h2 id="viction-onboarding-title">Claim your .viction identity</h2>
          <p>Pick the name and avatar attached to this signed-in wallet before using Conviction.</p>
        </div>

        <div className="viction-onboarding-preview">
          <img alt="Selected .viction avatar" src={avatarUrl} />
          <div>
            <span>Profile tag</span>
            <strong>{fullHandle}</strong>
            <small>Wallet-linked identity active</small>
          </div>
        </div>

        <label className="viction-onboarding-field">
          <span>Handle</span>
          <div className="viction-onboarding-handle">
            <input
              autoFocus
              onChange={(event) => setHandle(normalizeVictionHandle(event.target.value))}
              placeholder="sue"
              type="text"
              value={handle}
            />
            <b>.viction</b>
          </div>
        </label>

        <label className="viction-onboarding-field">
          <span>Email</span>
          <input
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>

        <label className="viction-onboarding-field">
          <span>Bio</span>
          <textarea
            maxLength={160}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Prediction markets, sports edges, macro theses."
            value={bio}
          />
        </label>

        <div className="viction-onboarding-avatars" aria-label="Choose profile avatar">
          {orderedAvatars.map((avatar) => (
            <button
              aria-pressed={avatar.id === avatarId}
              className={avatar.id === avatarId ? "selected" : ""}
              key={avatar.id}
              onClick={() => setAvatarId(avatar.id)}
              type="button"
            >
              <img alt="" src={buildOnboardingAvatarUrl(avatar.id, fullHandle)} />
              <span>{avatar.label}</span>
            </button>
          ))}
        </div>

        {status.message ? (
          <p className={status.type === "error" ? "viction-onboarding-message error" : "viction-onboarding-message"}>
            {status.message}
          </p>
        ) : null}

        <div className="viction-onboarding-actions">
          <button disabled={status.type === "saving"} type="submit">
            {status.type === "saving" ? "Claiming..." : "Claim identity"}
          </button>
        </div>
      </form>
    </div>
  );
}

function rotateOnboardingAvatars(seed: string) {
  const offset = hashSeed(seed) % ONBOARDING_AVATARS.length;
  return [...ONBOARDING_AVATARS.slice(offset), ...ONBOARDING_AVATARS.slice(0, offset)];
}

function hashSeed(seed: string) {
  return Array.from(seed).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 17);
}

function buildOnboardingAvatarUrl(avatarId: OnboardingAvatarId, handle: string) {
  const option = ONBOARDING_AVATARS.find((item) => item.id === avatarId) ?? ONBOARDING_AVATARS[0];

  return (
    "https://api.dicebear.com/10.x/" +
    option.style +
    "/svg?seed=" +
    encodeURIComponent(handle + "-" + avatarId) +
    "&backgroundColor=0e0e0e,161616,201f1f&radius=12"
  );
}

function suggestHandleFromSession(session: UserSession | null) {
  const username = session?.socialAccount.username ?? "";
  const displayName = session?.user.displayName ?? "";
  const source = username.includes("...") ? displayName : username || displayName;

  if (!source || source.includes("...") || /^wallet\s+0x/i.test(source) || /^0x/i.test(source)) {
    return "";
  }

  const clean = normalizeVictionHandle(source.replace(/^wallet\s+/i, ""));

  return clean.length >= 2 ? clean : "";
}
