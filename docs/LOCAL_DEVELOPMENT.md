# Local development and pre-deployment test

## Run the existing app on your own computer

This repository currently runs the existing Express + Vite app locally. It does not need Cloudflare deployment to show the local UI.

### Windows PowerShell

```powershell
git clone --branch feat/auth-admin-pricing-pages https://github.com/youceftalamali-prog/mailcraft-ai-test.git
cd mailcraft-ai-test
npm install
Copy-Item .env.example .env
notepad .env
npm run dev
```

In `.env`, set `GEMINI_API_KEY` to your own key. Keep it private; never commit it or paste it into chat. The current app starts at:

- App: http://localhost:3000
- Pages: http://localhost:3000/pricing, http://localhost:3000/signup, http://localhost:3000/login, http://localhost:3000/admin

If port 3000 is occupied, run `$env:PORT=3001; npm run dev` and use http://localhost:3001.

### Test commands

Open a second PowerShell terminal in the project folder:

```powershell
npm run lint
npm test
npm run build
```

Record the output of each command before treating the branch as verified.

## What works in this local preview today

- The existing campaign, image, chat, and voice UI can be opened through the current Express/Vite dev server, subject to having a valid Gemini API key and the provider being available.
- The new Video Studio tab combines a user-selected still image, visible script text, and audio returned by the existing `/api/generate-voice-script` endpoint. It creates a vertical WebM in the browser where MediaRecorder is supported; it does not generate AI motion footage or MP4.
- The new pricing and account pages are visual previews.
- The auth Worker is a separate service and is not yet connected to the local frontend. Signup/login will not create accounts yet.
- The admin route is not a production security boundary in the frontend. Do not expose it publicly or enter sensitive information into it.
- Monthly usage quotas are not yet enforced on existing generation endpoints.

## Next local integration milestone

Before using real accounts, configure a separate staging Neon database, apply `auth-service/migrations/0001_auth.sql`, configure Hyperdrive for the Worker, then create a same-origin local/staging route for `/api/auth/*` and `/api/admin/*`. Do not put database passwords or bootstrap secrets in frontend environment variables. After wiring, run signup/login/logout/admin denial tests and confirm campaign/image/chat/voice/video regressions.

## Deployment gate

No production deploy is part of this guide. Only consider deployment after typecheck, tests, production build, auth/security checks, and AI/TTS regression tests pass, then review the changes and explicitly approve publishing.
