"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { FarcasterSessionPanel } from "../../../components/FarcasterSessionPanel";
import { useFarcasterSession } from "../../../hooks/useFarcasterSession";

type ProfileEditState =
  | { status: "idle"; message: string }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ProfileResponse =
  | {
      ok: true;
      data: {
        traderProfile: { id: string; handle: string; bio: string | null; avatarUrl: string | null };
      };
    }
  | { ok: false; error: { code: string; message: string } };

type EmailResponse =
  | { ok: true; data: { email: string } }
  | { ok: false; error: { code: string; message: string } };

const avatarOptions = [
  { id: "signal", name: "Signal Flame", note: "orange execution energy" },
  { id: "oracle", name: "Oracle Glass", note: "clean probability lens" },
  { id: "vault", name: "Vault Crest", note: "collateral guardian" },
  { id: "cast", name: "Cast Ring", note: "social conviction loop" },
  { id: "neon", name: "Neon Thesis", note: "night-market analyst" },
] as const;

type AvatarVariant = (typeof avatarOptions)[number]["id"];

const victionSuffix = ".viction";

export default function ProfilePage() {
  const sessionState = useFarcasterSession();
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarVariant>("signal");
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [state, setState] = useState<ProfileEditState>({
    status: "idle",
    message: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReady = sessionState.status === "ready";
  const session = isReady ? sessionState.session : null;
  const traderProfile = session?.traderProfile;
  const fullHandle = useMemo(() => buildFullHandle(handle), [handle]);
  const generatedAvatarUrl = useMemo(
    () => buildAvatarUrl(selectedAvatar, fullHandle),
    [fullHandle, selectedAvatar],
  );
  const avatarDisplay = avatarUrl || generatedAvatarUrl || session?.socialAccount?.profileUrl || "";
  const shareTarget = typeof window !== "undefined" ? window.location.origin + "/social" : "";
  const shareText =
    "I claimed " +
    fullHandle +
    " on Conviction Markets. Real signals, clean intent records, no fake PnL.";
  const castUrl =
    "https://warpcast.com/~/compose?text=" +
    encodeURIComponent(shareText) +
    (shareTarget ? "&embeds[]=" + encodeURIComponent(shareTarget) : "");
  const xShareUrl =
    "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(shareText) +
    (shareTarget ? "&url=" + encodeURIComponent(shareTarget) : "");

  useEffect(() => {
    if (traderProfile) {
      const profileHandle = stripVictionSuffix(traderProfile.handle);
      setHandle(profileHandle);
      setBio(traderProfile.bio ?? "");

      if (traderProfile.avatarUrl) {
        const variant = getAvatarVariantFromUrl(traderProfile.avatarUrl);

        if (variant) {
          setSelectedAvatar(variant);
          setAvatarUrl("");
        } else {
          setAvatarUrl(traderProfile.avatarUrl);
        }
      }
    }

    if (session?.user.email) {
      setEmail(session.user.email);
      setShowEmailPrompt(false);
    } else if (isReady) {
      setShowEmailPrompt(true);
    }
  }, [traderProfile, session, isReady]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = isReady ? sessionState.session : null;

    if (!session) {
      setState({ status: "error", message: "Connect a Farcaster account first." });
      return;
    }

    const cleanHandle = normalizeHandleInput(handle);
    const nextFullHandle = buildFullHandle(cleanHandle);

    if (cleanHandle.length < 2) {
      setState({ status: "error", message: "Handle must be at least 2 characters." });
      return;
    }

    setState({ status: "saving", message: "Claiming your .viction profile..." });

    try {
      const profileResponse = await fetch("/api/trader-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          handle: nextFullHandle,
          bio: bio.trim() || null,
          avatarUrl: avatarUrl.trim() || buildAvatarUrl(selectedAvatar, nextFullHandle),
        }),
      });
      const profileBody = (await profileResponse.json()) as ProfileResponse;

      if (!profileResponse.ok || !profileBody.ok) {
        setState({
          status: "error",
          message: profileBody.ok ? "Profile update failed." : profileBody.error.message,
        });
        return;
      }

      if (email.trim() && email.trim() !== session.user.email) {
        const emailResponse = await fetch("/api/user-email", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id, email: email.trim() }),
        });
        const emailBody = (await emailResponse.json()) as EmailResponse;

        if (!emailResponse.ok || !emailBody.ok) {
          setState({
            status: "error",
            message: emailBody.ok ? "Email update failed." : emailBody.error.message,
          });
          return;
        }
      }

      setHandle(cleanHandle);
      setState({ status: "success", message: "Claimed " + nextFullHandle + "." });
      setShowEmailPrompt(false);

      setTimeout(() => {
        setState((current) =>
          current.status === "success" ? { status: "idle", message: "" } : current,
        );
      }, 3500);
    } catch {
      setState({ status: "error", message: "Core API did not accept the profile update." });
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as { ok: boolean; url?: string; error?: string };

      if (body.ok && body.url) {
        setAvatarUrl(body.url);
      } else {
        setState({ status: "error", message: body.error ?? "Image upload failed." });
      }
    } catch {
      setState({ status: "error", message: "Image upload failed." });
    }
  }

  function selectGeneratedAvatar(variant: AvatarVariant) {
    setSelectedAvatar(variant);
    setAvatarUrl("");
  }

  return (
    <main className="page-shell wide">
      <section className="page-heading compact split-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>Claim your .viction identity</h1>
          <p>
            Your handle, avatar, bio, and email become the identity layer around your signals and
            margin intents.
          </p>
        </div>
        <div className="my-activity-actions">
          <Link className="text-link" href="/me/settings">
            Settings
          </Link>
          <Link className="text-link" href="/me/notifications">
            Notifications
          </Link>
        </div>
      </section>

      <FarcasterSessionPanel
        label="Farcaster account"
        readyMessage="Edit your trader profile below."
        sessionState={sessionState}
      />

      <form className="profile-layout" onSubmit={handleSave}>
        <section className="profile-form" aria-label="Profile editor">
          <div className="profile-avatar-section">
            <div className="profile-avatar-preview">
              <div className="profile-avatar-img-wrapper">
                <img
                  alt="Profile avatar"
                  className="profile-avatar-img"
                  src={avatarDisplay}
                  onError={(event) => {
                    (event.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>
            <div className="profile-avatar-actions">
              <button
                className="profile-action-button"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Upload image
              </button>
              <button
                className="profile-action-button secondary"
                onClick={() => setAvatarUrl("")}
                type="button"
              >
                Use generated
              </button>
              <input
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="profile-file-input"
                onChange={handleFileUpload}
                ref={fileInputRef}
                type="file"
              />
              <span className="profile-avatar-hint">Pick a culture card or bring your own.</span>
            </div>
          </div>

          <label className="profile-field">
            <span>Handle</span>
            <div className="profile-handle-input">
              <input
                className="profile-handle-prefix"
                onChange={(event) => setHandle(normalizeHandleInput(event.target.value))}
                placeholder="sue"
                type="text"
                value={handle}
              />
              <span className="profile-handle-suffix">.viction</span>
            </div>
            <small className="profile-field-hint">
              Your claimed tag will be <strong>{fullHandle}</strong>.
            </small>
          </label>

          <label className="profile-field">
            <span>Avatar URL</span>
            <input
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://example.com/avatar.png"
              type="url"
              value={avatarUrl}
            />
          </label>

          <label className="profile-field">
            <span>Bio</span>
            <textarea
              maxLength={280}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Prediction markets, onchain margin, high-conviction theses."
              value={bio}
            />
            <small className="profile-field-hint">{bio.length}/280 characters</small>
          </label>

          <label className={"profile-field" + (showEmailPrompt ? " profile-field-highlight" : "")}>
            <span>
              Email
              {showEmailPrompt ? <span className="profile-email-badge">Recommended</span> : null}
            </span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <small className="profile-field-hint">
              Used for position notifications, vault transaction updates, and beta access.
            </small>
          </label>

          <button className="profile-submit" disabled={state.status === "saving"} type="submit">
            {state.status === "saving" ? "Claiming..." : "Claim .viction profile"}
          </button>

          <p
            className={
              "profile-message" +
              (state.status === "error" ? " error" : "") +
              (state.status === "success" ? " success" : "")
            }
          >
            {state.message || " "}
          </p>
        </section>

        <aside className="profile-claim-panel" aria-label="Claim preview">
          <div className="viction-card">
            <img alt="Selected .viction avatar" src={avatarDisplay} />
            <div>
              <span>Conviction tag</span>
              <strong>{fullHandle}</strong>
              <p>{bio || "Signals first. Culture follows conviction."}</p>
            </div>
          </div>

          <div className="avatar-option-grid" aria-label="Generated avatars">
            {avatarOptions.map((option) => {
              const isSelected = !avatarUrl && selectedAvatar === option.id;

              return (
                <button
                  aria-pressed={isSelected}
                  className={isSelected ? "avatar-option selected" : "avatar-option"}
                  key={option.id}
                  onClick={() => selectGeneratedAvatar(option.id)}
                  type="button"
                >
                  <img alt="" src={buildAvatarUrl(option.id, fullHandle)} />
                  <span>{option.name}</span>
                  <small>{option.note}</small>
                </button>
              );
            })}
          </div>

          <div className="profile-share-actions">
            <a href={castUrl} rel="noreferrer" target="_blank">
              Cast claim
            </a>
            <a href={xShareUrl} rel="noreferrer" target="_blank">
              Post to X
            </a>
            {traderProfile?.id ? (
              <Link href={"/traders/" + traderProfile.id}>View public card</Link>
            ) : null}
          </div>
        </aside>
      </form>
    </main>
  );
}

function normalizeHandleInput(value: string) {
  return stripVictionSuffix(value)
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .toLowerCase()
    .slice(0, 32);
}

function buildFullHandle(value: string) {
  const base = normalizeHandleInput(value) || "yourname";

  return base + victionSuffix;
}

function stripVictionSuffix(value: string) {
  const trimmed = value.trim().toLowerCase();

  return trimmed.endsWith(victionSuffix) ? trimmed.slice(0, -victionSuffix.length) : trimmed;
}

function buildAvatarUrl(variant: AvatarVariant, handle: string) {
  return (
    "/api/viction-avatar?variant=" +
    encodeURIComponent(variant) +
    "&handle=" +
    encodeURIComponent(handle)
  );
}

function getAvatarVariantFromUrl(value: string): AvatarVariant | null {
  try {
    const url = new URL(value, "https://conviction.local");

    if (url.pathname !== "/api/viction-avatar") return null;

    const variant = url.searchParams.get("variant");

    return avatarOptions.some((option) => option.id === variant)
      ? (variant as AvatarVariant)
      : null;
  } catch {
    return null;
  }
}
