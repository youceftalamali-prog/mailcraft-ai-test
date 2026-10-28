# Mailcraft Auth API (isolated Worker)

This service is intentionally separate from `server.ts` to keep the existing Gemini campaign, image, chat, and TTS implementations untouched.

## Status

Scaffold only. It is not routed to the frontend, not deployed, and not production-ready. Do not deploy until code review, typecheck/tests, origin/routing decisions, and a real staging database are confirmed.

## Architecture

- Cloudflare Worker + Hono handles authentication routes.
- Neon PostgreSQL is reached through a Cloudflare Hyperdrive binding named `AUTH_DB`.
- Passwords must be stored only as salted PBKDF2 verifiers; session tokens are random and only their SHA-256 hashes are stored.
- The browser session cookie is HttpOnly, Secure, SameSite=Lax, and Path=/.
- Public signup always creates role=user. Admin role must never be accepted from signup input.
- The existing AI API remains separate. Route `/api/auth/*` to this Worker only after same-origin routing and cookie behavior are verified.

## Setup (staging only)

1. Create a dedicated Neon database or isolated staging database.
2. Apply `migrations/0001_auth.sql` using a trusted SQL client.
3. Create a Cloudflare Hyperdrive configuration for that database; set its ID in `wrangler.jsonc`.
4. Replace the example `APP_ORIGIN` with the exact staging app origin.
5. Configure the secret `ADMIN_BOOTSTRAP_TOKEN` with `wrangler secret put ADMIN_BOOTSTRAP_TOKEN`. Never commit it or send it in chat.
6. Run `npm install`, `npm run typecheck`, and endpoint/security tests before considering a deployment.

The bootstrap endpoint must be enabled only for the first admin setup and disabled/rotated immediately after use. Avoid exposing this endpoint publicly without a strong token and a one-time database guard.

## Plan enforcement

Quota checks must happen on the server immediately before each billable generation endpoint. Do not trust plan names or counters supplied by the browser. The current scaffold does not yet enforce usage quotas on the existing Gemini endpoints; that requires deliberate route integration after regression tests.

## Billing

Paid plans remain inactive until a payment provider, verified webhook signatures, idempotency, and eligibility for Algerian business onboarding/payouts have been confirmed. Never accept a client-side plan change as proof of payment.