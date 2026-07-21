type WalletMarkProps = { className?: string };
export function PolymarketWalletMark({ className = "" }: WalletMarkProps) {
  return (
    <span
      className={"wallet-brand-mark wallet-brand-mark-polymarket " + className}
      aria-label="Polymarket"
      role="img"
    >
      P
    </span>
  );
}

export function GoogleWalletMark({ className = "" }: WalletMarkProps) {
  return (
    <span
      className={"wallet-brand-mark wallet-brand-mark-google " + className}
      aria-label="Google"
      role="img"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path
          fill="#FFC107"
          d="M43.61 20.08H42V20H24v8h11.3C33.65 32.66 29.22 36 24 36c-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.65-.39-3.92Z"
        />
        <path
          fill="#FF3D00"
          d="m6.31 14.69 6.57 4.82C14.66 15.11 18.96 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 16.32 4 9.66 8.34 6.31 14.69Z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.17 0 9.86-1.98 13.41-5.2l-6.19-5.24C29.21 35.09 26.7 36 24 36c-5.2 0-9.61-3.31-11.28-7.93l-6.52 5.03C9.51 39.56 16.23 44 24 44Z"
        />
        <path
          fill="#1976D2"
          d="M43.61 20.08H42V20H24v8h11.3a12.05 12.05 0 0 1-4.08 5.56l6.19 5.24C36.97 39.2 44 34 44 24c0-1.34-.14-2.65-.39-3.92Z"
        />
      </svg>
    </span>
  );
}

export function BrowserWalletMarks({ className = "" }: WalletMarkProps) {
  return (
    <span
      className={"wallet-brand-cluster " + className}
      aria-label="MetaMask, Coinbase, Trust Wallet and more"
      role="img"
    >
      <span className="wallet-brand-chip wallet-brand-chip-metamask">M</span>
      <span className="wallet-brand-chip wallet-brand-chip-coinbase">C</span>
      <span className="wallet-brand-chip wallet-brand-chip-trust">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 3 19 6v5.4c0 4.45-2.76 8.44-7 9.6-4.24-1.16-7-5.15-7-9.6V6l7-3Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="wallet-brand-chip wallet-brand-chip-more">+</span>
    </span>
  );
}

export function TonWalletMark({ className = "" }: WalletMarkProps) {
  return (
    <span
      className={"wallet-brand-mark wallet-brand-mark-ton " + className}
      aria-label="TON wallet"
      role="img"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path
          d="M6.4 12.8c.86-1.52 2.49-2.46 4.24-2.46h26.72c1.75 0 3.38.94 4.24 2.46.86 1.51.83 3.38-.09 4.87L27.91 39.63a4.57 4.57 0 0 1-7.82 0L6.49 17.67a4.74 4.74 0 0 1-.09-4.87Z"
          fill="url(#tonGradient)"
        />
        <path
          d="M13.55 15.16h20.9c.52 0 .85.56.59 1.01L25.02 33.34a1.18 1.18 0 0 1-2.04 0L12.96 16.17a.68.68 0 0 1 .59-1.01Zm9.08 2.66h-5.72l5.72 9.8v-9.8Zm2.74 9.8 5.72-9.8h-5.72v9.8Z"
          fill="#fff"
        />
        <defs>
          <linearGradient
            id="tonGradient"
            x1="8"
            x2="40"
            y1="12"
            y2="38"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#35C4FF" />
            <stop offset="1" stopColor="#007AFF" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export function ThirdwebMark({ className = "" }: WalletMarkProps) {
  return (
    <span className={"wallet-brand-thirdweb " + className} aria-label="Powered by thirdweb">
      <span>Powered by thirdweb</span>
    </span>
  );
}
