# Polymarket margin release checklist

This is the release gate for real Polygon pUSD execution. A green build or readiness response is not
a completed canary. Keep `POLYMARKET_CANARY_PASSED=false` until source-system evidence exists.

## Deployment order

1. Deploy and verify the Polygon vault and deposit-wallet factory artifacts. Configure separated
   governance, guardian, risk-manager, and adapter roles.
2. Apply the Core database schema. Deploy Core with `CONVICTION_EXECUTION_MODE=disabled` and confirm
   account linking, market sync, health, reconciliation authorization, and the readiness endpoint.
3. Configure every server-only Core variable listed in `conviction-core-api/.env.example`. Required
   groups are official V2 contracts, vault/factory, execution signer and encryption, linked-account
   encryption, relayer or builder HMAC credentials, governance roles, lifecycle jobs, invite wallets,
   one through five canary condition IDs, and release caps.
4. Deploy the frontend with `CORE_API_URL`, `NEXT_PUBLIC_APP_URL`, and
   `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`. Keep unrelated markets, Pulse, profiles, vault reads, and
   intent-only records available while execution is blocked.
5. Enable active repayment and lifecycle recovery, then set Core execution mode to `polymarket`.
   Confirm `/beta-readiness` shows `INVITE ONLY CANARY`, every execution gate ready, and the approved
   cap values. Do not set the canary-passed flag.

## Deterministic checks

Run on Node 20.18 or newer:

```bash
npm test
npm run lint
npm run build
```

These checks cover session restoration, fail-closed capability/readiness disagreement, canary versus
production state, no-fill evidence, and complete open-close/liquidation evidence requirements. They
do not claim a real venue fill.

## Real canary matrix

Use only invited wallets and allowlisted markets. Keep each position under the effective pUSD and 2x
caps shown by readiness.

| Flow                          | Required result                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| Existing EOA session          | Refresh restores the same wallet and claimed `.viction` identity.                           |
| Existing smart-wallet session | Refresh restores the same smart account; no second account is created.                      |
| Polymarket link               | Wallet proof returns a verified linked account and imported positions/history.              |
| LP deposit                    | pUSD approval occurs only when needed; vault shares and TVL change onchain.                 |
| LP immediate withdraw         | `maxWithdraw` path confirms assets and shares on Polygon.                                   |
| LP queued withdraw            | Illiquid request creates a queue record; it is not shown as paid.                           |
| YES open/close                | FOK order fills, shares enter isolated custody, loan activates, close repays vault.         |
| NO open/close                 | Same evidence as YES using the NO token orderbook.                                          |
| No fill                       | FOK records no trades, all pUSD returns, reservation/loan fails without active debt.        |
| Restart/retry                 | Refresh reuses the existing reservation hash and never submits duplicate value.             |
| RPC/relayer delay             | Record enters recoverable state and reconciliation advances from source state.              |
| Stop/take trigger             | Signed control is wallet-bound and lifecycle monitor creates one close attempt.             |
| Liquidation                   | Conservative executable exit breaches maintenance and a LIQUIDATION close repays vault.     |
| Portfolio                     | IDs, hashes, actual fills/fees/shares, debt, custody, health, and close records match Core. |
| Mobile/desktop                | Quote review, wallet prompts, resume, close, repay, and explorer links remain usable.       |

## Evidence record

For every YES, NO, no-fill, and liquidation run, retain:

- Conviction user, position, execution, and close-attempt IDs
- condition and outcome-token IDs
- CLOB open/close order IDs and trade IDs
- all Polygon reservation, funding, custody, activation, return, and settlement hashes
- actual fill price, shares, spent assets, venue/financing fees, debt, and health snapshot
- vault loan ID, isolated custody address, and repayment hash
- LP total assets/share value before and after
- final Core readiness response and support/incident notes

The canary is incomplete when any field required by the scenario is missing. Screenshots alone are not
evidence.

## Rollback

Block new risk first: set `CONVICTION_EXECUTION_MODE=disabled` and pause the vault if contract-level
protection is needed. Keep Core reconciliation, no-fill restoration, close, and repayment code online.
Never delete or manually mark execution records. Reconcile every nonterminal position and require zero
uncovered bad debt before reopening. Roll the frontend back only if Portfolio recovery remains
accessible in the deployed version.

Support requests must include the wallet, position/execution ID, current state, and relevant Polygon
hash. Never request a private key, seed phrase, API secret, encryption key, or raw signature payload.
