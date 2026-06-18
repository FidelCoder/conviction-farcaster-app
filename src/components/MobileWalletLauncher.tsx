"use client";

import { Copy, ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";

import { getMobileWalletOptions } from "../lib/evm-wallet-provider";

type MobileWalletLauncherProps = {
  message?: string;
  onClose: () => void;
  open: boolean;
};

export function MobileWalletLauncher({ message, onClose, open }: MobileWalletLauncherProps) {
  const [copyStatus, setCopyStatus] = useState("Copy current link");
  const appUrl = typeof window === "undefined" ? "https://convictionmarkets.xyz" : window.location.href;
  const walletOptions = useMemo(() => getMobileWalletOptions(appUrl), [appUrl]);

  if (!open) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus("Copy current link"), 1800);
    } catch {
      setCopyStatus("Copy failed");
      window.setTimeout(() => setCopyStatus("Copy current link"), 1800);
    }
  }

  return (
    <div className="mobile-wallet-overlay" role="dialog" aria-modal="true" aria-labelledby="mobile-wallet-title">
      <div className="mobile-wallet-sheet">
        <button className="mobile-wallet-close" onClick={onClose} type="button" aria-label="Close wallet options">
          <X size={16} />
        </button>
        <span className="mobile-wallet-eyebrow">Mobile wallet</span>
        <h2 id="mobile-wallet-title">Open with a wallet browser</h2>
        <p>
          {message ??
            "Your phone browser cannot expose an EVM provider directly. Open this same page in a wallet browser, then connect again."}
        </p>
        <div className="mobile-wallet-options">
          {walletOptions.map((option) => (
            <a className="mobile-wallet-option" href={option.href} key={option.id}>
              <span>
                <strong>{option.name}</strong>
                <small>{option.description}</small>
              </span>
              <ExternalLink size={15} />
            </a>
          ))}
        </div>
        <div className="mobile-wallet-copy-row">
          <span>{appUrl}</span>
          <button onClick={copyLink} type="button">
            <Copy size={14} />
            {copyStatus}
          </button>
        </div>
      </div>
    </div>
  );
}
