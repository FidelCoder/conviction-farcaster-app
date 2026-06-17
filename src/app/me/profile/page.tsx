"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { TerminalShell } from "../../../components/TerminalShell";
import {
  getExecutionCapabilities,
  listMarkets,
  type ExecutionCapabilities,
  type TraderProfile,
  type UserSession,
} from "../../../lib/core-api";

type ProfileEditState =
  | { status: "idle"; message: string }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ProfileResponse =
  | {
      ok: true;
      data: {
        session: UserSession;
        traderProfile: TraderProfile;
      };
    }
  | { ok: false; error: { code: string; message: string } };

type EmailResponse =
  | { ok: true; data: { email: string; session: UserSession } }
  | { ok: false; error: { code: string; message: string } };

const avatarOptions = [
  { id: "bottts", name: "Signal Bot", note: "clean Web3 robo-PFP", style: "bottts" },
  { id: "rings", name: "Orbit Ring", note: "abstract onchain identity", style: "rings" },
  { id: "identicon", name: "Vault Sigil", note: "wallet-native symbol", style: "identicon" },
  { id: "shapes", name: "Market Shape", note: "bold protocol geometry", style: "shapes" },
  { id: "adventurer", name: "Desk Avatar", note: "human trader card", style: "adventurer-neutral" },
] as const;

type AvatarVariant = (typeof avatarOptions)[number]["id"];

const victionSuffix = ".viction";

export default function ProfilePage() {
  const [terminalData, setTerminalData] = useState<{
    execution: ExecutionCapabilities;
    marketCount: number;
  } | null>(null);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarVariant>("bottts");
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [state, setState] = useState<ProfileEditState>({
    status: "idle",
    message: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<UserSession | null>(null);
  const walletAddress = getConnectedWalletAddress(session);
  const isWalletConnected = Boolean(walletAddress);
  const traderProfile = isWalletConnected ? (session?.traderProfile ?? null) : null;
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
  const hasClaimedProfile = Boolean(isWalletConnected && traderProfile);
  const shouldShowProfileView = hasClaimedProfile && !isEditing;

  useEffect(() => {
    void Promise.all([getExecutionCapabilities(), listMarkets()]).then(([execution, markets]) => {
      setTerminalData({ execution, marketCount: markets.length });
    });

    const raw = window.localStorage.getItem("conviction-browser-session");
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem("conviction-browser-session");
      }
    }
  }, []);

  useEffect(() => {
    if (!isWalletConnected) {
      setHandle("");
      setBio("");
      setAvatarUrl("");
      setEmail("");
      setShowEmailPrompt(false);
      setIsEditing(false);
      return;
    }

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
    } else if (session) {
      setShowEmailPrompt(true);
    }
  }, [isWalletConnected, traderProfile, session]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !walletAddress) {
      setState({ status: "error", message: "Connect a wallet from the terminal header first." });
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
          walletAddress,
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

      let nextEmail = session.user.email;

      if (email.trim() && email.trim() !== session.user.email) {
        const emailResponse = await fetch("/api/user-email", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, email: email.trim() }),
        });
        const emailBody = (await emailResponse.json()) as EmailResponse;

        if (!emailResponse.ok || !emailBody.ok) {
          setState({
            status: "error",
            message: emailBody.ok ? "Email update failed." : emailBody.error.message,
          });
          return;
        }

        nextEmail = emailBody.data.email;
      }

      const nextSession: UserSession = {
        ...profileBody.data.session,
        user: { ...profileBody.data.session.user, email: nextEmail },
        traderProfile: profileBody.data.traderProfile,
      };

      setSession(nextSession);
      window.localStorage.setItem("conviction-browser-session", JSON.stringify(nextSession));
      setHandle(cleanHandle);
      setEmail(nextEmail ?? "");
      setState({ status: "success", message: "Claimed " + nextFullHandle + "." });
      setShowEmailPrompt(false);
      setIsEditing(false);

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
    if (!isWalletConnected) {
      setState({ status: "error", message: "Connect a wallet before setting a profile picture." });
      event.target.value = "";
      return;
    }

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

  function promptWalletConnection(message = "Connect a wallet from the terminal header first.") {
    setState({ status: "error", message });
  }

  function selectGeneratedAvatar(variant: AvatarVariant) {
    if (!isWalletConnected) {
      promptWalletConnection("Connect a wallet before choosing a profile picture.");
      return;
    }

    setSelectedAvatar(variant);
    setAvatarUrl("");
  }

  return (
    <TerminalShell
      activeTab="profile"
      execution={terminalData?.execution ?? fallbackExecution}
      marketCount={terminalData?.marketCount ?? 0}
      onSessionChange={setSession}
      sessionOverride={session ?? undefined}
    >
      <main className="terminal-page terminal-account-page">
        <section className="terminal-page-heading">
          <div>
            <p>Profile</p>
            <h1>Claim your .viction identity</h1>
            <span>
              Your handle, avatar, bio, and email become the identity layer around your signals and
              margin intents.
            </span>
          </div>
          <div className="my-activity-actions">
            <Link className="text-link" href="/me/settings">
              Settings
            </Link>
            {hasClaimedProfile ? (
              <button className="text-link" onClick={() => setIsEditing(true)} type="button">
                Edit Profile
              </button>
            ) : null}
            <Link className="text-link" href="/me/notifications">
              Notifications
            </Link>
          </div>
        </section>

        <section className="terminal-connect-panel">
          <span>{isWalletConnected ? "Wallet profile active" : "Wallet profile required"}</span>
          <p>
            Connect a browser wallet from the top-right action before editing. Profile and email
            records are keyed to that wallet address.
          </p>
        </section>

        {shouldShowProfileView ? (
          <section className="profile-confirmed-view" aria-label="Confirmed profile">
            <article className="profile-confirmed-card">
              <img alt="Selected .viction avatar" src={avatarDisplay} />
              <div className="profile-confirmed-copy">
                <span>Claim confirmed</span>
                <h2>{fullHandle}</h2>
                <p>{bio || "Signals first. Culture follows conviction."}</p>
                <dl>
                  <div>
                    <dt>Wallet</dt>
                    <dd>{walletAddress ? formatWalletAddress(walletAddress) : "Not connected"}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{email || "Not set"}</dd>
                  </div>
                </dl>
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
                  <button onClick={() => setIsEditing(true)} type="button">
                    Edit profile
                  </button>
                </div>
              </div>
            </article>

            <p className="profile-message success">
              {state.status === "success" ? state.message : "Your .viction profile is active."}
            </p>
          </section>
        ) : (
          <form className="profile-layout" onSubmit={handleSave}>
            <section className="profile-form" aria-label="Profile editor">
              {!isWalletConnected ? (
                <div className="profile-wallet-lock">
                  <strong>Wallet connection required</strong>
                  <span>Profile, email, and avatar changes unlock after wallet connection.</span>
                </div>
              ) : null}
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
                    aria-disabled={!isWalletConnected}
                    onClick={() => {
                      if (!isWalletConnected) {
                        promptWalletConnection(
                          "Connect a wallet before setting a profile picture.",
                        );
                        return;
                      }

                      fileInputRef.current?.click();
                    }}
                    type="button"
                  >
                    Upload image
                  </button>
                  <button
                    className="profile-action-button secondary"
                    aria-disabled={!isWalletConnected}
                    onClick={() => {
                      if (!isWalletConnected) {
                        promptWalletConnection(
                          "Connect a wallet before choosing a generated avatar.",
                        );
                        return;
                      }

                      setAvatarUrl("");
                    }}
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
                  <span className="profile-avatar-hint">
                    Pick a culture card or bring your own.
                  </span>
                </div>
              </div>

              <label className="profile-field">
                <span>Handle</span>
                <div className="profile-handle-input">
                  <input
                    className="profile-handle-prefix"
                    onFocus={() => {
                      if (!isWalletConnected) promptWalletConnection();
                    }}
                    onChange={(event) => setHandle(normalizeHandleInput(event.target.value))}
                    placeholder="sue"
                    readOnly={!isWalletConnected}
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
                  onFocus={() => {
                    if (!isWalletConnected) promptWalletConnection();
                  }}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.png"
                  readOnly={!isWalletConnected}
                  type="url"
                  value={avatarUrl}
                />
              </label>

              <label className="profile-field">
                <span>Bio</span>
                <textarea
                  maxLength={280}
                  onFocus={() => {
                    if (!isWalletConnected) promptWalletConnection();
                  }}
                  onChange={(event) => setBio(event.target.value)}
                  readOnly={!isWalletConnected}
                  placeholder="Prediction markets, onchain margin, high-conviction theses."
                  value={bio}
                />
                <small className="profile-field-hint">{bio.length}/280 characters</small>
              </label>

              <label
                className={"profile-field" + (showEmailPrompt ? " profile-field-highlight" : "")}
              >
                <span>
                  Email
                  {showEmailPrompt ? (
                    <span className="profile-email-badge">Recommended</span>
                  ) : null}
                </span>
                <input
                  onFocus={() => {
                    if (!isWalletConnected) promptWalletConnection();
                  }}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  readOnly={!isWalletConnected}
                  type="email"
                  value={email}
                />
                <small className="profile-field-hint">
                  Used for position notifications, vault transaction updates, and beta access.
                </small>
              </label>

              <button className="profile-submit" disabled={state.status === "saving"} type="submit">
                {state.status === "saving"
                  ? "Claiming..."
                  : isWalletConnected
                    ? "Claim .viction profile"
                    : "Connect wallet to claim"}
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
                      aria-disabled={!isWalletConnected}
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
                {isWalletConnected && traderProfile?.id ? (
                  <>
                    <a href={castUrl} rel="noreferrer" target="_blank">
                      Cast claim
                    </a>
                    <a href={xShareUrl} rel="noreferrer" target="_blank">
                      Post to X
                    </a>
                    <Link href={"/traders/" + traderProfile.id}>View public card</Link>
                  </>
                ) : (
                  <button onClick={() => promptWalletConnection()} type="button">
                    Connect wallet to share
                  </button>
                )}
              </div>
            </aside>
          </form>
        )}
      </main>
    </TerminalShell>
  );
}

function formatWalletAddress(walletAddress: string) {
  return walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);
}

function getConnectedWalletAddress(session: UserSession | null) {
  if (session?.socialAccount.platform !== "WEB") return null;

  const walletAddress = session.socialAccount.platformUserId.trim();

  return /^0x[a-fA-F0-9]{40}$/.test(walletAddress) ? walletAddress : null;
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
  const option = avatarOptions.find((item) => item.id === variant) ?? avatarOptions[0];

  return (
    "https://api.dicebear.com/10.x/" +
    option.style +
    "/svg?seed=" +
    encodeURIComponent(handle + "-" + variant) +
    "&backgroundColor=0e0e0e,161616,201f1f&radius=12"
  );
}

function getAvatarVariantFromUrl(value: string): AvatarVariant | null {
  try {
    const url = new URL(value, "https://conviction.local");

    const matchedOption = avatarOptions.find((option) =>
      url.pathname.includes("/" + option.style + "/"),
    );

    return matchedOption?.id ?? null;
  } catch {
    return null;
  }
}

const fallbackExecution: ExecutionCapabilities = {
  evmOnly: true,
  architecture: "INTENT_FIRST_MULTICHAIN_MARGIN_LAYER",
  spotExecutionEnabled: false,
  marginExecutionEnabled: false,
  leverageEnabled: false,
  leverageRequiresContracts: true,
  activeAdapters: [],
  recommendation: "Connect core API for live execution capabilities.",
  chains: [],
};
