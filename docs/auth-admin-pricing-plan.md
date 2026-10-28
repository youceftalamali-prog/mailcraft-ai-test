# Mailcraft AI — Auth, Admin & Pricing Implementation Plan

## Scope and non-negotiable constraints

- Add public registration and login, a protected administrator area, and a pricing page with free and paid tiers.
- Preserve the current campaign generator, image generation, chatbot, Algerian voice studio, and all existing Gemini/TTS request and response paths.
- Do not change `server.ts` TTS endpoints as part of this feature unless a separately reviewed security integration strictly requires an isolated addition.
- Work only on `feat/auth-admin-pricing-pages`; do not merge, deploy, or modify production without explicit approval.

## Repository review

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4, entrypoint `src/main.tsx`, single-screen app in `src/App.tsx`.
- Backend: Express in `server.ts`; existing APIs cover campaign generation, image generation, chat, and voice generation.
- No existing auth provider, user model, database connection, session middleware, subscription system, or payment integration was found.
- An existing PR #1 for Gemini TTS request-format changes is on another branch and remains untouched.

## Architecture decision

Create an isolated Cloudflare Worker for auth/admin APIs, backed by Neon PostgreSQL through Cloudflare Hyperdrive. This keeps the existing Gemini/TTS service out of the first auth implementation's change surface. Before enabling it, configure same-origin routing for `/api/auth/*` and `/api/admin/*`, set the exact staging origin, and test cookie behavior. No deployment has been made.

## Implemented on this branch (scaffold; not production-ready)

- Added `auth-service/` with a Cloudflare Worker/Hono entrypoint, TypeScript config, Wrangler configuration template, and setup instructions.
- Added PostgreSQL schema for users, sessions, monthly usage, rate-limit buckets, and audit events.
- Added registration/login/logout/session lookup routes. Passwords use PBKDF2-SHA-256 with a per-account random salt; raw session tokens are not stored in the database. Cookies are HttpOnly, Secure, SameSite=Lax.
- Public signup always assigns the normal `user` role. A token-gated bootstrap route can create the first administrator; remove the route and rotate the bootstrap secret immediately after setup.
- Added an admin overview endpoint with server-side session and role checks.
- Added server-side plan entitlement definitions and an atomic monthly usage reservation helper.

## Explicit remaining blockers

- No Neon database or Hyperdrive configuration has been supplied/configured in this repository; the SQL migration has not been applied to a live database.
- The auth Worker is not routed to the frontend and has not been deployed. The sample origin and Hyperdrive ID in `wrangler.jsonc` are placeholders.
- The usage reservation helper is not yet connected to the existing campaign/image/voice generation routes. Do not claim quotas are enforced until that integration and its regression tests are complete.
- The account form UI still needs to be connected to the staged API after routing and cookie behavior are verified.
- Email verification/password reset are not implemented; they require a mail provider and product decision.
- Paid checkout is disabled until a payment provider that supports business onboarding and payouts in Algeria is selected, with verified, idempotent webhooks.
- No typecheck, build, or automated tests have been run in this remote-edit step.

## Next steps

1. Configure a dedicated staging Neon database and Hyperdrive binding, using secrets in Cloudflare/GitHub settings rather than chat or committed files.
2. Run migrations and implement Worker unit/integration tests for signup, login, logout, sessions, rate limits, admin denial, and bootstrap.
3. Set up same-origin staging routing and connect the account UI to the auth API.
4. Integrate quota reservations at the server boundary for campaign, image, and voice endpoints without rewriting their Gemini/TTS logic.
5. Run typecheck/build and regression smoke tests for campaign, image, chat, and all voice/TTS flows.
6. Open a review PR when checks are available. Do not merge or deploy without explicit approval.

This branch is a reviewable implementation scaffold, not a launch-ready authentication or billing system.
