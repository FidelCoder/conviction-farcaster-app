"use client";

import {
  CheckCircle2,
  Copy,
  ExternalLink,
  History,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unlink,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getSessionWalletAddress,
  getStoredBrowserSessionWalletKind,
} from "../lib/browser-wallet-session";
import type {
  PolymarketAccount,
  PolymarketAccountChallenge,
  PolymarketPositionSnapshot,
  PolymarketWalletType,
  UserSession,
} from "../lib/core-api";
import {
  getOwnershipWalletChainId,
  requestOwnershipSignature,
} from "../lib/polymarket-account-signing";

type ManagerProps = {
  session: UserSession | null;
  showPositions?: boolean;
};

type PendingProof = {
  accountId?: string;
  challenge: PolymarketAccountChallenge;
  convictionSignature: string;
  ownerAddress: string;
  purpose: "LINK" | "UNLINK";
};

type RequestState = {
  busy: boolean;
  message: string;
  tone: "idle" | "success" | "error";
};

type AccountsResponse =
  | { ok: true; data: { accounts: PolymarketAccount[] } }
  | { ok: false; error: { code: string; message: string } };

type AccountActionResponse =
  | {
      ok: true;
      data: {
        account?: PolymarketAccount;
        challenge?: PolymarketAccountChallenge;
      };
    }
  | { ok: false; error: { code: string; message: string } };

const walletOptions: Array<{
  type: PolymarketWalletType;
  label: string;
  description: string;
}> = [
  { type: "EOA", label: "EOA", description: "Owner and funder are the same wallet." },
  {
    type: "GNOSIS_SAFE",
    label: "Safe",
    description: "Existing Polymarket Safe controlled by your signer.",
  },
  {
    type: "POLY_PROXY",
    label: "Proxy",
    description: "Legacy Polymarket email or social-login proxy.",
  },
  {
    type: "POLY_1271",
    label: "Deposit wallet",
    description: "Current Polymarket deposit-wallet account.",
  },
];

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export function PolymarketAccountManager({ session, showPositions = false }: ManagerProps) {
  const convictionAddress = getSessionWalletAddress(session);
  const hasEvmSession = Boolean(convictionAddress && evmAddressPattern.test(convictionAddress));
  const [accounts, setAccounts] = useState<PolymarketAccount[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [walletType, setWalletType] = useState<PolymarketWalletType>("EOA");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [funderAddress, setFunderAddress] = useState("");
  const [pendingProof, setPendingProof] = useState<PendingProof | null>(null);
  const [state, setState] = useState<RequestState>({
    busy: false,
    message: "Linking is read-only until venue credentials and custody checks pass.",
    tone: "idle",
  });

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status !== "DISCONNECTED"),
    [accounts],
  );
  const importedOpen = useMemo(
    () =>
      activeAccounts.flatMap((account) =>
        account.positions.filter((item) => item.state === "OPEN"),
      ),
    [activeAccounts],
  );
  const importedClosed = useMemo(
    () =>
      activeAccounts.flatMap((account) =>
        account.positions.filter((item) => item.state === "CLOSED"),
      ),
    [activeAccounts],
  );

  const loadAccounts = useCallback(async () => {
    if (!session?.user.id) {
      setAccounts([]);
      return;
    }

    setState((current) => ({ ...current, busy: true }));

    try {
      const response = await fetch(
        "/api/polymarket/accounts?userId=" + encodeURIComponent(session.user.id),
        { cache: "no-store" },
      );
      const body = (await response.json()) as AccountsResponse;

      if (!response.ok || !body.ok)
        throw new Error(body.ok ? "Accounts failed to load." : body.error.message);

      setAccounts(body.data.accounts);
      setState({
        busy: false,
        message:
          body.data.accounts.length > 0
            ? "Linked accounts and public position history are current."
            : "No Polymarket account is linked to this .viction identity.",
        tone: "idle",
      });
    } catch (error) {
      setState({
        busy: false,
        message: error instanceof Error ? error.message : "Linked accounts could not be loaded.",
        tone: "error",
      });
    }
  }, [session?.user.id]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!hasEvmSession || !convictionAddress) return;

    setOwnerAddress(convictionAddress);
    setFunderAddress(convictionAddress);
    setPendingProof(null);
    setFormOpen(false);
    setWalletType("EOA");
  }, [convictionAddress, hasEvmSession, session?.user.id]);

  function chooseWalletType(type: PolymarketWalletType) {
    setWalletType(type);

    if (type === "EOA" && ownerAddress) {
      setFunderAddress(ownerAddress);
    }
  }

  async function beginLink() {
    if (!session || !convictionAddress || !hasEvmSession) {
      setState({
        busy: false,
        message: "Sign in with the EVM wallet attached to this .viction profile first.",
        tone: "error",
      });
      return;
    }

    const normalizedOwner = ownerAddress.trim();
    const normalizedFunder = (walletType === "EOA" ? normalizedOwner : funderAddress).trim();

    if (!evmAddressPattern.test(normalizedOwner) || !evmAddressPattern.test(normalizedFunder)) {
      setState({
        busy: false,
        message: "Enter valid Polymarket owner and funder addresses.",
        tone: "error",
      });
      return;
    }

    setState({ busy: true, message: "Preparing ownership proof...", tone: "idle" });

    try {
      const walletKind = getStoredBrowserSessionWalletKind();
      const convictionChainId = await getOwnershipWalletChainId(walletKind);
      const challenge = await postAccountAction({
        action: "challenge-link",
        userId: session.user.id,
        convictionAddress,
        convictionChainId,
        polymarketOwnerAddress: normalizedOwner,
        polymarketFunderAddress: normalizedFunder,
        polymarketWalletType: walletType,
      });
      const convictionSignature = await requestOwnershipSignature({
        address: convictionAddress,
        message: requireChallenge(challenge).message,
        walletKind,
      });

      if (sameAddress(convictionAddress, normalizedOwner)) {
        await completeProof({
          challenge: requireChallenge(challenge),
          convictionSignature,
          ownerAddress: normalizedOwner,
          purpose: "LINK",
        });
        return;
      }

      setPendingProof({
        challenge: requireChallenge(challenge),
        convictionSignature,
        ownerAddress: normalizedOwner,
        purpose: "LINK",
      });
      setState({
        busy: false,
        message:
          "Conviction wallet verified. Switch to the Polymarket owner wallet for one final signature.",
        tone: "idle",
      });
    } catch (error) {
      setState({ busy: false, message: errorMessage(error), tone: "error" });
    }
  }

  async function completeOwnerProof() {
    if (!pendingProof) return;

    setState({ busy: true, message: "Waiting for Polymarket owner signature...", tone: "idle" });

    try {
      const polymarketSignature = await requestOwnershipSignature({
        address: pendingProof.ownerAddress,
        message: pendingProof.challenge.message,
        walletKind: "eoa",
      });
      await completeProof(pendingProof, polymarketSignature);
    } catch (error) {
      setState({ busy: false, message: errorMessage(error), tone: "error" });
    }
  }

  async function completeProof(proof: PendingProof, polymarketSignature?: string) {
    if (!session) throw new Error("Conviction session is no longer active.");

    const response = await postAccountAction({
      action: proof.purpose === "LINK" ? "complete-link" : "complete-unlink",
      userId: session.user.id,
      accountId: proof.accountId,
      challengeId: proof.challenge.id,
      convictionSignature: proof.convictionSignature,
      polymarketSignature: polymarketSignature ?? null,
    });
    const account = requireAccount(response);

    setAccounts((current) => upsertAccount(current, account));
    setPendingProof(null);
    setFormOpen(false);
    setState({
      busy: false,
      message:
        proof.purpose === "LINK"
          ? "Polymarket account linked. Public positions are now separate from Conviction margin."
          : "Polymarket account disconnected. Your Conviction identity and history remain intact.",
      tone: "success",
    });
  }

  async function beginUnlink(account: PolymarketAccount) {
    if (!session || !convictionAddress || !hasEvmSession) {
      setState({ busy: false, message: "Reconnect the profile EVM wallet first.", tone: "error" });
      return;
    }

    setState({ busy: true, message: "Preparing disconnect proof...", tone: "idle" });

    try {
      const walletKind = getStoredBrowserSessionWalletKind();
      const convictionChainId = await getOwnershipWalletChainId(walletKind);
      const response = await postAccountAction({
        action: "challenge-unlink",
        userId: session.user.id,
        accountId: account.id,
        convictionAddress,
        convictionChainId,
      });
      const challenge = requireChallenge(response);
      const convictionSignature = await requestOwnershipSignature({
        address: convictionAddress,
        message: challenge.message,
        walletKind,
      });
      const proof: PendingProof = {
        accountId: account.id,
        challenge,
        convictionSignature,
        ownerAddress: account.ownerAddress,
        purpose: "UNLINK",
      };

      if (sameAddress(convictionAddress, account.ownerAddress)) {
        await completeProof(proof);
        return;
      }

      setPendingProof(proof);
      setState({
        busy: false,
        message: "Switch to the Polymarket owner wallet to confirm disconnection.",
        tone: "idle",
      });
    } catch (error) {
      setState({ busy: false, message: errorMessage(error), tone: "error" });
    }
  }

  function prepareRelink(account: PolymarketAccount) {
    setWalletType(account.walletType);
    setOwnerAddress(account.ownerAddress);
    setFunderAddress(account.funderAddress);
    setPendingProof(null);
    setFormOpen(true);
    setState({
      busy: false,
      message: "Reverify ownership to recover a stale or failed linked account.",
      tone: "idle",
    });
  }

  async function syncAccount(accountId: string) {
    if (!session) return;

    setState({ busy: true, message: "Syncing public Polymarket positions...", tone: "idle" });

    try {
      const response = await postAccountAction({
        action: "sync",
        userId: session.user.id,
        accountId,
      });
      const account = requireAccount(response);

      setAccounts((current) => upsertAccount(current, account));
      setState({ busy: false, message: "Imported positions refreshed.", tone: "success" });
    } catch (error) {
      setState({ busy: false, message: errorMessage(error), tone: "error" });
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setState({ busy: false, message: "Funder address copied.", tone: "success" });
  }

  return (
    <section className="polymarket-account-manager" id="polymarket-account">
      <div className="polymarket-account-heading">
        <div>
          <span className="wallet-eyebrow">Trading account</span>
          <h2>Polymarket connection</h2>
          <p>
            Keep {session?.traderProfile?.handle ?? "your .viction identity"} as your Conviction
            account and attach an existing Polygon trading account.
          </p>
        </div>
        <div className="polymarket-heading-actions">
          <button
            className="polymarket-icon-button"
            disabled={state.busy || !session}
            onClick={() => void loadAccounts()}
            title="Refresh linked accounts"
            type="button"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="polymarket-primary-button"
            disabled={!hasEvmSession}
            onClick={() => setFormOpen((current) => !current)}
            type="button"
          >
            <Link2 size={16} />
            {formOpen ? "Close" : "Connect account"}
          </button>
        </div>
      </div>

      {!session ? (
        <AccountNotice
          icon={<WalletCards size={18} />}
          title="Sign in required"
          body="Use your existing Conviction sign-in first. Linking never creates a second user."
        />
      ) : !hasEvmSession ? (
        <AccountNotice
          icon={<WalletCards size={18} />}
          title="EVM proof required"
          body="Your current session is not an EVM wallet. Sign in with an EOA or Google smart wallet attached to this .viction profile."
        />
      ) : null}

      {formOpen && hasEvmSession ? (
        <div className="polymarket-link-form">
          <div
            className="polymarket-wallet-types"
            role="radiogroup"
            aria-label="Polymarket account type"
          >
            {walletOptions.map((option) => (
              <button
                aria-checked={walletType === option.type}
                className={walletType === option.type ? "active" : ""}
                key={option.type}
                onClick={() => chooseWalletType(option.type)}
                role="radio"
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          <div className="polymarket-address-fields">
            <label>
              <span>Owner or signer address</span>
              <input
                autoComplete="off"
                onChange={(event) => {
                  const value = event.target.value;
                  setOwnerAddress(value);
                  if (walletType === "EOA") setFunderAddress(value);
                }}
                placeholder="0x..."
                spellCheck={false}
                value={ownerAddress}
              />
            </label>
            <label>
              <span>Polymarket funder address</span>
              <input
                autoComplete="off"
                disabled={walletType === "EOA"}
                onChange={(event) => setFunderAddress(event.target.value)}
                placeholder="0x..."
                spellCheck={false}
                value={walletType === "EOA" ? ownerAddress : funderAddress}
              />
            </label>
          </div>

          <div className="polymarket-form-footer">
            <p>
              Two ownership signatures may be required. They authorize linking only, never a trade
              or token transfer.
            </p>
            <button
              className="polymarket-primary-button"
              disabled={state.busy}
              onClick={() => void beginLink()}
              type="button"
            >
              <ShieldCheck size={16} />
              Verify ownership
            </button>
          </div>
        </div>
      ) : null}

      {pendingProof ? (
        <div className="polymarket-proof-step">
          <div>
            <span>Final proof</span>
            <strong>{shortAddress(pendingProof.ownerAddress)}</strong>
            <p>Switch your wallet to this owner address, then sign the same one-time message.</p>
          </div>
          <div>
            <button
              className="polymarket-secondary-button"
              onClick={() => {
                setPendingProof(null);
                setState({ busy: false, message: "Ownership proof cancelled.", tone: "idle" });
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="polymarket-primary-button"
              disabled={state.busy}
              onClick={() => void completeOwnerProof()}
              type="button"
            >
              <ShieldCheck size={16} />
              Sign as owner
            </button>
          </div>
        </div>
      ) : null}

      <p className={"polymarket-account-message " + state.tone}>{state.message}</p>

      <div className="polymarket-account-list">
        {activeAccounts.map((account) => (
          <article className="polymarket-linked-account" key={account.id}>
            <div className="polymarket-account-title">
              <div className="polymarket-account-mark">
                <WalletCards size={20} />
              </div>
              <div>
                <span>{walletTypeLabel(account.walletType)}</span>
                <h3>{shortAddress(account.funderAddress)}</h3>
              </div>
              <StatusBadge account={account} />
            </div>

            <div className="polymarket-account-facts">
              <div>
                <span>Ownership</span>
                <strong>{account.walletVerifiedAt ? "Verified" : "Venue check pending"}</strong>
              </div>
              <div>
                <span>Trading</span>
                <strong>{account.credentialsVerifiedAt ? "Enabled" : "Read-only import"}</strong>
              </div>
              <div>
                <span>Open</span>
                <strong>{account.positions.filter((item) => item.state === "OPEN").length}</strong>
              </div>
              <div>
                <span>Closed</span>
                <strong>
                  {account.positions.filter((item) => item.state === "CLOSED").length}
                </strong>
              </div>
            </div>

            {account.lastSyncError ? (
              <p className="polymarket-account-error">{account.lastSyncError}</p>
            ) : null}

            <div className="polymarket-account-actions">
              <button onClick={() => void copyAddress(account.funderAddress)} type="button">
                <Copy size={15} />
                Copy
              </button>
              <button
                disabled={state.busy}
                onClick={() => void syncAccount(account.id)}
                type="button"
              >
                <RefreshCw size={15} />
                Sync
              </button>
              <button disabled={state.busy} onClick={() => prepareRelink(account)} type="button">
                <ShieldCheck size={15} />
                Reverify
              </button>
              <button
                className="danger"
                disabled={state.busy}
                onClick={() => void beginUnlink(account)}
                type="button"
              >
                <Unlink size={15} />
                Disconnect
              </button>
            </div>
          </article>
        ))}
      </div>

      {activeAccounts.length === 0 && session ? (
        <div className="polymarket-create-account">
          <div>
            <span>No existing Polymarket account?</span>
            <h3>Create a Conviction trading account</h3>
            <p>
              Create a dedicated Polymarket deposit wallet, then return to link it without changing
              your Conviction login.
            </p>
          </div>
          <a href="https://polymarket.com/settings" rel="noreferrer" target="_blank">
            Create account
            <ExternalLink size={15} />
          </a>
        </div>
      ) : null}

      {showPositions && activeAccounts.length > 0 ? (
        <div className="polymarket-imported-ledger">
          <ImportedPositions
            empty="No open Polymarket positions were returned."
            icon={<ShieldCheck size={17} />}
            positions={importedOpen}
            title="Imported open positions"
          />
          <ImportedPositions
            empty="No closed Polymarket history was returned."
            icon={<History size={17} />}
            positions={importedClosed}
            title="Imported closed history"
          />
        </div>
      ) : null}
    </section>
  );
}

function ImportedPositions({
  empty,
  icon,
  positions,
  title,
}: {
  empty: string;
  icon: React.ReactNode;
  positions: PolymarketPositionSnapshot[];
  title: string;
}) {
  return (
    <section className="polymarket-position-section">
      <div className="polymarket-position-heading">
        <div>
          {icon}
          <h3>{title}</h3>
        </div>
        <span>{positions.length}</span>
      </div>
      {positions.length > 0 ? (
        <div className="polymarket-position-list">
          {positions.map((position) => (
            <article className="polymarket-position-row" key={position.id}>
              <div
                aria-label={position.title ? position.title + " market image" : "Market image"}
                className="polymarket-position-image"
                role="img"
                style={
                  position.iconUrl
                    ? { backgroundImage: "url(" + position.iconUrl + ")" }
                    : undefined
                }
              >
                {position.iconUrl ? null : (position.outcome?.slice(0, 2).toUpperCase() ?? "PM")}
              </div>
              <div className="polymarket-position-copy">
                <span>{position.outcome ?? "Outcome"}</span>
                <strong>{position.title ?? "Imported Polymarket position"}</strong>
                <small>
                  {formatPositionValue(position.size)} shares at{" "}
                  {formatProbability(position.averagePrice)}
                </small>
              </div>
              <div className="polymarket-position-value">
                <span>{position.state}</span>
                <strong>{formatUsdValue(position.currentValue ?? position.realizedPnl)}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="polymarket-position-empty">{empty}</p>
      )}
    </section>
  );
}

function AccountNotice({
  body,
  icon,
  title,
}: {
  body: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="polymarket-account-notice">
      {icon}
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}

function StatusBadge({ account }: { account: PolymarketAccount }) {
  const ready = account.status === "READY";
  const error = account.status === "ERROR";

  return (
    <span className={"polymarket-status-badge " + (ready ? "ready" : error ? "error" : "")}>
      {ready ? <CheckCircle2 size={13} /> : null}
      {ready ? "Ready" : error ? "Needs attention" : "Linked"}
    </span>
  );
}

async function postAccountAction(body: Record<string, unknown>) {
  const response = await fetch("/api/polymarket/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as AccountActionResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Linked-account action failed." : payload.error.message);
  }

  return payload.data;
}

function requireChallenge(data: { challenge?: PolymarketAccountChallenge }) {
  if (!data.challenge) throw new Error("Core did not return an ownership challenge.");
  return data.challenge;
}

function requireAccount(data: { account?: PolymarketAccount }) {
  if (!data.account) throw new Error("Core did not return a linked account.");
  return data.account;
}

function upsertAccount(accounts: PolymarketAccount[], account: PolymarketAccount) {
  const existing = accounts.findIndex((item) => item.id === account.id);

  if (existing < 0) return [account, ...accounts];

  return accounts.map((item) => (item.id === account.id ? account : item));
}

function walletTypeLabel(type: PolymarketWalletType) {
  switch (type) {
    case "EOA":
      return "Polymarket EOA";
    case "GNOSIS_SAFE":
      return "Polymarket Safe";
    case "POLY_PROXY":
      return "Polymarket proxy";
    case "POLY_1271":
      return "Polymarket deposit wallet";
  }
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function shortAddress(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Linked-account action failed.";
}

function formatPositionValue(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "--";
}

function formatProbability(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? (parsed * 100).toFixed(1) + "%" : "--";
}

function formatUsdValue(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      })
    : "--";
}
