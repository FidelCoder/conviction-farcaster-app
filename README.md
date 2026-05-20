# Conviction Farcaster App

Next.js Farcaster app workspace for Conviction Markets. The app reads product data from the core API and does not keep local markets, signals, positions, traders, or copy-intent records.

## Setup

Package manager: npm.

```sh
npm install
cp .env.example .env
npm run dev
```

Set `CORE_API_URL` to a running Conviction Core API instance.

## Commands

- `npm run dev` starts the Next.js development server.
- `npm run build` checks and builds the app.
- `npm run start` starts the production server after a build.
- `npm run lint` runs ESLint.
- `npm run format` runs Prettier.
- `npm run format:check` checks formatting.

## Routes

- `/` shows real synced market data from the core API.
- `/markets` lists synced markets.
- `/markets/[marketId]` shows one market and its signals.
- `/traders/[traderId]` shows a trader profile when the core API exposes it, plus signals and positions.
- `/signals/[signalId]` shows one signal.
- `/positions/[positionId]` shows one position and copy intents.

Empty states are rendered when the core API returns no records. No markets, traders, signals, positions, copy intents, balances, or execution results are hardcoded in this app.

## Structure

- `src/app` keeps App Router routes and layouts.
- `src/components` keeps reusable UI components.
- `src/lib` keeps the core API client and shared helpers.
- `public` is reserved for static assets.

Business logic belongs in `conviction-core-api`; this app should call the API rather than duplicate product behavior.
