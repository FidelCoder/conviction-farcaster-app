"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { useFarcasterSession } from "../../../hooks/useFarcasterSession";
import { FarcasterSessionPanel } from "../../../components/FarcasterSessionPanel";

type ProfileEditState =
  | { status: "idle"; message: string }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ProfileResponse =
  | { ok: true; data: { traderProfile: { id: string; handle: string; bio: string | null; avatarUrl: string | null } } }
  | { ok: false; error: { code: string; message: string } };

type EmailResponse =
  | { ok: true; data: { email: string } }
  | { ok: false; error: { code: string; message: string } };

export default function ProfilePage() {
  const sessionState = useFarcasterSession();
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [state, setState] = useState<ProfileEditState>({
    status: "idle",
    message: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReady = sessionState.status === "ready";
  const session = isReady ? sessionState.session : null;
  const traderProfile = session?.traderProfile;

  useEffect(() => {
    if (traderProfile) {
      setHandle(traderProfile.handle.replace(".viction", ""));
      setBio(traderProfile.bio ?? "");
      setAvatarUrl(traderProfile.avatarUrl ?? "");
    }
    if (session?.user.email) {
      setEmail(session.user.email);
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

    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const fullHandle = cleanHandle.endsWith(".viction") ? cleanHandle : cleanHandle + ".viction";

    if (cleanHandle.length < 2) {
      setState({ status: "error", message: "Handle must be at least 2 characters." });
      return;
    }

    setState({ status: "saving", message: "Saving your profile..." });

    try {
      const profileResponse = await fetch("/api/trader-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          handle: fullHandle,
          bio: bio.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
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
        await fetch("/api/user-email", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id, email: email.trim() }),
        });
      }

      setState({ status: "success", message: "Profile saved. You are " + fullHandle });
      setShowEmailPrompt(false);

      setTimeout(() => {
        setState((current) =>
          current.status === "success" ? { status: "idle", message: "" } : current,
        );
      }, 3000);
    } catch {
      setState({ status: "error", message: "Core API did not accept the profile update." });
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
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
      }
    } catch {
      setState({ status: "error", message: "Image upload failed." });
    }
  }

  const avatarDisplay = avatarUrl || session?.socialAccount?.profileUrl;

  return (
    <main className="page-shell">
      <section className="page-heading compact split-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>Your .viction identity</h1>
          <p>
            Set your handle, avatar, and bio. Your <code>.viction</code> handle is your
            reputation on Conviction Markets.
          </p>
        </div>
      </section>

      <FarcasterSessionPanel
        label="Farcaster account"
        readyMessage="Edit your trader profile below."
        sessionState={sessionState}
      />

      <form className="profile-form" onSubmit={handleSave}>
        {/* Avatar Section */}
        <div className="profile-avatar-section">
          <div className="profile-avatar-preview">
          <div className="profile-avatar-img-wrapper">
            <img
              alt="Profile avatar"
              className="profile-avatar-img"
              src={avatarDisplay ?? ""}
              style={{ display: avatarDisplay ? "block" : "none" }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
                const placeholder = document.getElementById("avatar-placeholder");
                if (placeholder) placeholder.style.display = "grid";
              }}
              onLoad={(e) => {
                const placeholder = document.getElementById("avatar-placeholder");
                if (placeholder && avatarDisplay) placeholder.style.display = "none";
              }}
            />
            <div
              className="profile-avatar-placeholder"
              id="avatar-placeholder"
              style={{ display: avatarDisplay ? "none" : "grid" }}
            >
              {(handle || "?").slice(0, 2).toUpperCase()}
            </div>
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
            <input
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="profile-file-input"
              onChange={handleFileUpload}
              ref={fileInputRef}
              type="file"
            />
            <span className="profile-avatar-hint">
              Or paste a URL below
            </span>
          </div>
        </div>

        <label className="profile-field">
          <span>Avatar URL</span>
          <input
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            type="url"
            value={avatarUrl}
          />
        </label>

        {/* Handle with .viction suffix */}
        <label className="profile-field">
          <span>Handle</span>
          <div className="profile-handle-input">
            <input
              className="profile-handle-prefix"
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9_.-]/g, "").toLowerCase();
                setHandle(cleaned);
              }}
              placeholder="yourname"
              type="text"
              value={handle}
            />
            <span className="profile-handle-suffix">.viction</span>
          </div>
          <small className="profile-field-hint">
            Your full handle will be <strong>{handle || "yourname"}.viction</strong>.
            Use letters, numbers, underscores, dots, and dashes.
          </small>
        </label>

        {/* Bio */}
        <label className="profile-field">
          <span>Bio</span>
          <textarea
            maxLength={280}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Trader, analyst, conviction seeker."
            value={bio}
          />
          <small className="profile-field-hint">{bio.length}/280 characters</small>
        </label>

        {/* Email */}
        <label className={"profile-field" + (showEmailPrompt ? " profile-field-highlight" : "")}>
          <span>
            Email
            {showEmailPrompt ? (
              <span className="profile-email-badge">Recommended</span>
            ) : null}
          </span>
          <input
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
          <small className="profile-field-hint">
            Used for position notifications and platform updates. Never shared.
          </small>
        </label>

        <button
          className="profile-submit"
          disabled={state.status === "saving"}
          type="submit"
        >
          {state.status === "saving" ? "Saving..." : "Save profile"}
        </button>

        <p
          className={
            "profile-message" +
            (state.status === "error" ? " error" : "") +
            (state.status === "success" ? " success" : "")
          }
        >
          {state.message || "\u00A0"}
        </p>

        {state.status === "success" ? (
          <div className="profile-success-actions">
            <Link className="text-link" href={"/traders/" + traderProfile?.id}>
              View your profile
            </Link>
            <Link className="text-link" href="/social">
              Go to social feed
            </Link>
          </div>
        ) : null}
      </form>
    </main>
  );
}
