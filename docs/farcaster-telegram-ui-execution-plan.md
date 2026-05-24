# Conviction Markets Farcaster And Telegram Plan

This repo is the Farcaster/web surface for Conviction Markets. The current priority is to make the Farcaster Mini App credible first, then carry the same core API contracts into Telegram.

## Current State

- App: `conviction-farcaster-app`
- Active contributor for this pass: `buidlLabs3`
- Current branch: `feature/farcaster-signal-share-copy`
- Open PR: signal sharing and copy intents
- Data rule: all visible markets, signals, positions, and copy intents come from `conviction-core-api`
- No fake markets, fake balances, fake PnL, fake fills, or simulated execution should be added

## Important Clarification

The Farcaster app currently does not contain a leveraged probability trade implementation. It can display real market records, real signals, real position intent records, and submit copy intents through the core API.

That means the leveraged probability trade issue should be handled as a real execution/product contract task, not hidden in the frontend. Until the core API exposes a confirmed execution adapter and trade endpoint, the Farcaster app should show intent and pending execution language only.

## Phase 1: Farcaster Mini App Polish

Goal: make the first screen feel like a real Mini App dashboard instead of a rough scaffold.

Tasks:

- Keep the homepage market-first and mobile-first.
- Show only aggregate counts derived from real core API records.
- Improve market cards with source, status, token mapping state, real price snapshots, and sync state.
- Keep empty states clear when no markets have been synced.
- Preserve Mini App metadata and share-card behavior.

Acceptance:

- No hardcoded market records.
- No fake stats beyond counts derived from fetched records.
- `npm run lint` passes.
- `npm run build` passes.

## Phase 2: Copy Intent Reliability

Goal: make the current copy-intent flow truthful and harder to submit incorrectly.

Tasks:

- Validate amount on the client and server.
- Reject zero amounts.
- Keep status language as `Copy intent submitted` unless the core API returns `EXECUTED`.
- Surface core API validation and provider failures clearly.

Acceptance:

- Zero amount is rejected before and after network submission.
- Submitted intents are not described as executed unless the core API confirms execution.

## Phase 3: Leveraged Probability Trade Contract

Goal: define the missing trade contract before building UI that pretends to execute trades.

Tasks:

- Confirm whether leveraged probability trading means a position intent, an order intent, or a real execution request.
- Add or confirm a core API contract for the real flow.
- Define required fields such as user, market, side, quantity, price/probability, leverage/risk amount, source, and idempotency key.
- Define execution statuses returned by the core API.
- Decide which fields can be null when no real market price or execution adapter exists.

Acceptance:

- Farcaster can call one real API contract.
- The UI can show pending/failed/executed states without inventing outcomes.
- There is no frontend-only simulated trade success.

## Phase 4: Farcaster Trade UI

Goal: add the trade/intent UI only after the core API contract is real.

Tasks:

- Add a market detail action panel for YES/NO intent creation.
- Add validation for quantity, probability/price bounds, leverage/risk, missing market, missing user, and unavailable execution.
- Show real observed market price when the API returns it.
- Keep unavailable execution states explicit.

Acceptance:

- A valid submission creates a real backend record.
- Invalid submissions never hit the backend.
- Failed API calls stay visible to the user.

## Phase 5: Telegram After Farcaster

Goal: implement Telegram against the same core API contracts once the Farcaster flow is stable.

Tasks:

- Keep Telegram as UX only.
- Do not add a Telegram database.
- Reuse the same market, signal, position, and copy-intent contracts.
- Commands should use real empty states when core API has no records.

Acceptance:

- Telegram and Farcaster point to the same `CORE_API_URL`.
- A record created from one surface appears on the other.
- No duplicated business logic.

## Branch And Merge Policy

- Product code goes through PRs.
- Do not push product changes directly to `main`.
- Direct `main` pushes should be limited to explicitly approved docs or metadata changes only.
- Keep branches few; continue using the existing Farcaster feature branch while PR #3 is open.
