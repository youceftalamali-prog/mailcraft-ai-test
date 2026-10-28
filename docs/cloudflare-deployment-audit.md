# Cloudflare Workers readiness audit — Mailcraft AI

Date: 2026-10-28
Target branch: `feat/auth-admin-pricing-pages`
Scope: architecture review only; no runtime code changes.

## Findings from `main`

- The application uses a single Express server in `server.ts`.
- The server imports Node modules (`path`, `url`, `dotenv`) and uses `app.listen()`; in development it starts Vite middleware dynamically, and in production serves `dist`.
- No `wrangler.jsonc`, `wrangler.toml`, Cloudflare Worker entrypoint, or Cloudflare Vite plugin was present in the repository tree reviewed.
- `package.json` scripts are `tsx server.ts`, `vite build`, `vite preview`, `tsc --noEmit`, and a campaign utility test. The current scripts do not demonstrate a Workers deployment build.
- Existing Gemini/TTS code lives in `server.ts`; it must be treated as protected scope and not refactored for this feature.

## Database recommendation

Use Neon PostgreSQL initially, connected through Cloudflare Hyperdrive once the Worker deployment entrypoint and binding are configured. Cloudflare's current Hyperdrive docs support Neon/PostgreSQL and recommend a compatible PostgreSQL driver (such as `pg` at the documented supported version) with Workers Node.js compatibility. Sources:
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/
- https://developers.cloudflare.com/hyperdrive/

This is a recommended target architecture, not a claim that the existing app is already connected.

## Important deployment blocker

The current source is an Express + Vite Node server and no Worker adapter/configuration was found. Before deploying the new auth APIs to Workers, establish how this existing server is deployed today and choose a supported Workers entrypoint strategy. Do not blindly add a Hyperdrive binding or assume `app.listen()` will work in a standard Worker entrypoint.

The safest options to evaluate are:
1. Preserve the existing AI/TTS service untouched and add a separate Worker for auth/admin/billing APIs, with explicit routing and shared-origin/session design; or
2. Use a supported Cloudflare Node compatibility/adapter setup for the existing app, only after proving all current routes—including voice generation—pass regression tests.

Option 1 has a smaller blast radius for Gemini/TTS, but requires careful cross-service auth cookies, CORS/CSRF settings, and route ownership. Prefer same-origin routing where possible.

## Auth and billing design gates

- Signup must always create a normal user; never accept an admin role from public input.
- Admin authorization must be enforced by server-side middleware on every admin API, not by frontend routing alone.
- Store password hashes, not passwords; use secure, HTTP-only, SameSite cookies and rate limiting.
- Plan limits and entitlements must be enforced on the server.
- Pricing can show free and paid plans, but paid activation must wait for a selected payment provider and verified, idempotent webhook processing.
- Do not store card details.
- Do not put database credentials, admin bootstrap secrets, or Gemini keys in client code.
- Set up the first admin through a one-time server-side secret or a controlled database operation.

## Next implementation order

1. Confirm current deployment topology and whether the existing app is already routed through a Worker adapter.
2. Add page components and minimal navigation in isolated frontend files.
3. Implement auth APIs in a separately testable module/service after choosing the deployment strategy.
4. Add database schema/migrations for users, sessions, plans, usage, subscriptions, and audit events.
5. Add admin bootstrap and server-side access control.
6. Add payment adapter only after processor availability and pricing are decided.
7. Test typecheck/build/unit tests, guest/user/admin access cases, and regression smoke tests for campaign, image, chat, and TTS endpoints.
8. Open a PR for review; do not merge or deploy without explicit approval.

## Current status

Audit only. This file does not change application behavior, Gemini requests, TTS requests, or production.
