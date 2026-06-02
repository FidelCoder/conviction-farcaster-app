# Conviction Markets Farcaster And Execution Plan

This repo is the Farcaster/web surface for Conviction Markets. Telegram is no longer part of the active roadmap. The priority is to finish a credible Farcaster beta, then move into the smart contract execution layer.

## Current State

- App: `conviction-farcaster-app`
- Active product surface: Farcaster Mini App and web
- Data rule: all visible markets, signals, positions, and copy intents come from `conviction-core-api`
- No fake markets, fake balances, fake PnL, fake fills, or simulated execution should be added
- Current execution mode: real user intent records only; leveraged execution remains disabled until contracts and adapters are live

## Completed Farcaster Foundation

- Market-first Mini App UI backed by real synced markets.
- Real Farcaster session creation through the core API.
- Real signal creation against synced markets.
- Real margin intent submission with execution blocked until the core reports live adapters.
- Real copy-intent submission language that only says executed if the core returns `EXECUTED`.
- Mini App readiness checks for public URL, manifest endpoint, verification config, core reachability, real markets, and execution claims.
- Focused market-to-signal entry from market detail pages.

## Phase 1: Farcaster Beta Finalization

Goal: make Farcaster usable enough for a controlled market beta with real records only.

Tasks:

- Add a real `/me` activity surface for the connected Farcaster user.
- Show real signals, position intents, and submitted copy intents when the core API exposes them.
- Keep empty states explicit when the user has no records.
- Confirm Mini App verification with either `FARCASTER_ACCOUNT_ASSOCIATION_JSON` or `FARCASTER_HOSTED_MANIFEST_ID`.
- Test inside the real Farcaster client: launch Mini App, create/fetch Farcaster user, create signal, create margin intent, share signal/position, and submit copy intent from another account.
- Keep execution language as intent-only until contracts and adapters are live.

Acceptance:

- `/beta-readiness` has no blocking failures.
- `/me` shows only records returned by the core API.
- No frontend-only demo data is introduced.
- `npm run format:check`, `npm run lint`, and `npm run build` pass.

## Phase 2: Smart Contracts And Execution Layer

Goal: move from recorded intent to real testnet execution only after the contract and adapter layer is specified and tested.

Tasks:

- Define vault contracts for margin collateral and vault liquidity.
- Define margin accounting, borrow limits, liquidation thresholds, and forced close before market resolution.
- Define execution adapter contracts/interfaces for real market venues.
- Add idempotent execution requests from core API to adapters.
- Add testnet-only execution flow first.
- Add event indexing for fills, failures, liquidations, and closes.
- Only enable `EXECUTED`, PnL, balances, and leverage claims when confirmed by real contracts/adapters.

Acceptance:

- Contracts have tests for deposit, margin open, liquidation guard, close, failure paths, and accounting.
- Core API can verify execution results from adapter/contract events.
- Farcaster UI reads execution status from core and never infers fills locally.
- Production remains intent-only until testnet flow is proven.

## Branch And Merge Policy

- Product code goes through PRs.
- Do not push product changes directly to `main`.
- Keep branches small and reviewable.
- Alternate contributor accounts for normal work, without adding badge-focused commits.
