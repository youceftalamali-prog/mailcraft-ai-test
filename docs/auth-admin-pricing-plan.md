# Mailcraft AI — Auth, Admin & Pricing Implementation Plan

## Scope and non-negotiable constraints

- Add public registration and login, a protected administrator area, and a pricing page with free and paid tiers.
- Preserve the current campaign generator, image generation, chatbot, Algerian voice studio, and all existing Gemini/TTS request and response paths.
- Do not change `server.ts` TTS endpoints as part of the page work unless a separately reviewed security integration strictly requires an isolated addition.
- Work only on `feat/auth-admin-pricing-pages`; do not merge, deploy, or modify production without explicit approval.

## Repository review (main)

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4, entrypoint `src/main.tsx`, single-screen app in `src/App.tsx`.
- Existing navigation is tab-based in `src/components/Header.tsx`; no router is currently configured in the reviewed files.
- Backend: Express in `server.ts`; current API includes AI campaign, image, chat, and voice generation endpoints.
- Environment example currently documents `GEMINI_API_KEY` and `APP_URL`.
- No authentication provider, user model, database connection, session middleware, subscription system, or payment integration was found in the reviewed files.
- There is an open PR #1 for Gemini TTS request-format changes on another branch. This work must not modify or merge that PR.

## Proposed pages and routes

1. `/login` and `/signup`
   - Responsive forms, server-side validation, clear error/loading states, logout, and password-reset flow only once an email delivery mechanism is configured.
   - Passwords must be hashed with a modern password-hashing algorithm; never store plain-text passwords or secrets in client code.
2. `/pricing`
   - Show Free and paid tiers, feature/usage limits, billing cadence, and a clear upgrade CTA.
   - Do not claim a paid plan is active based on a client-side button. Paid entitlements must come from trusted server-side subscription state.
3. `/admin`
   - Server-enforced admin-only access; user/plan/usage overview and account management.
   - Never rely on hiding an admin link or a client-side role flag as authorization.
4. Existing app
   - Keep all three existing tabs and their generation workflows unchanged; add only the smallest navigation integration needed.

## Security and data design gates

- Before implementation, select a durable database and deployment-compatible connection method. No database is currently configured in the reviewed source.
- Define users, role, plan, usage counters, and subscription status with server-side ownership checks.
- Prefer secure, HTTP-only, SameSite cookies; protect state-changing requests against CSRF as appropriate; rate-limit login/signup; validate inputs; avoid leaking provider errors or secrets.
- Bootstrap the first administrator through a one-time server-side environment secret or an explicit manual database operation. Never allow public signup to choose the admin role.
- Keep Gemini credentials server-side and leave existing Gemini/TTS provider calls untouched.
- A paid tier requires a payment provider, webhook signature verification, and idempotent subscription updates. Pricing UI can be built before live billing, but checkout must be clearly marked unavailable until configured.
- Never store payment card data directly.

## Safe implementation sequence

1. Baseline: record current branch/head and existing test/build results; inspect complete API routes and deployment constraints.
2. Add a router and new page components in isolated files, preserving the current app as the default authenticated/guest workspace according to the agreed product behavior.
3. Add auth persistence and server-side authorization only after database/provider choice is confirmed.
4. Add plan/usage enforcement server-side without changing generation logic; wrap access checks around endpoints rather than rewriting their AI internals.
5. Add payment-provider adapter and webhook only after provider selection and credentials are available.
6. Validate with TypeScript/lint, unit tests, production build, route access tests (guest/user/admin), and regression checks for campaign, image, chat, and TTS flows.
7. Open a pull request for review. Do not merge or deploy without explicit approval.

## Decisions still required before live auth/billing

- Database/provider available in the target deployment (or approval to add one).
- Payment processor that can onboard the business and accept payouts in Algeria.
- Exact plan prices, billing cadence, usage quotas, and whether free users must verify email.
- Email provider for password resets and account verification.

## Status

Planning only. This document does not alter app runtime behavior or Gemini/TTS code.
