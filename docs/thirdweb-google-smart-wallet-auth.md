# Thirdweb Google Smart Wallet Auth

Conviction Markets now supports a thirdweb connect modal for:

- External EOA wallets such as MetaMask, Coinbase Wallet, Rainbow, Rabby, Trust Wallet, OKX, and Phantom.
- Google-backed in-app wallet routed through thirdweb smart wallet/account abstraction.

Email OTP is intentionally disabled. The in-app wallet auth options are limited to Google only.

## Required Environment

Set this in the frontend Vercel project:

```txt
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=<thirdweb client id>
```

The app still falls back to the existing injected EVM wallet flow when this value is missing.

## Runtime

The thirdweb dependency tree includes packages that expect Node 20+. The frontend package now requires:

```txt
node >=20.18.0
```

Configure Vercel to use Node 20 or newer before deploying this branch.

## Session Model

After thirdweb connects an account, Conviction calls `/api/browser-session` with the connected account address. Profiles, emails, activity, support, and portfolio continue to be keyed to the EVM address returned by the wallet.

For Google smart wallet users, this address is the smart account address, not a MetaMask EOA. Funds must be on that smart account address for vault deposits and margin transactions.

## Follow-Up

The current PR wires authentication/session sync. Vault deposits and margin execution still use the existing EIP-1193 transaction path. A follow-up PR should add a transaction adapter that sends prepared contract calls through thirdweb for smart wallet accounts.
