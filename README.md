# Conviction Farcaster App

Next.js Farcaster app workspace for Conviction Markets.

## Setup

Package manager: npm.

```sh
npm install
cp .env.example .env
npm run dev
```

## Commands

- `npm run dev` starts the Next.js development server.
- `npm run build` checks and builds the app.
- `npm run start` starts the production server after a build.
- `npm run lint` runs ESLint.
- `npm run format` runs Prettier.
- `npm run format:check` checks formatting.

## Structure

- `src/app` keeps App Router routes and layouts.
- `src/components` is reserved for reusable UI components.
- `src/lib` is reserved for API clients and shared helpers.
- `public` is reserved for static assets.

Business logic belongs in `conviction-core-api`; this app should call the API rather than duplicate product behavior.
