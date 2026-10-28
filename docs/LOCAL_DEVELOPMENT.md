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

In `.env`, set `GEMINI_API_KEY` to your own key. Keep it private; never commit it or paste it into chat. For the xKiro storyboard helper, also set `XKIRO_API_KEY`; the default planning model is `qwen/qwen3.8-omni-flash:free`. The xKiro key is only read by the Express server and must never be put in frontend code. The current app starts at:

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


## xKiro and the video studio

- Create a key in the [xKiro dashboard](https://xkiro.com/) and set `XKIRO_API_KEY` in your local `.env`.
- The Video Studio can ask xKiro to produce a timestamped ad storyboard. The default model is `qwen/qwen3.8-omni-flash:free`; check xKiro's live catalog for current availability and free-tier limits.
- Important limitation: xKiro's published API reference currently documents chat, image generation, speech and search endpoints, but does not list a video-generation endpoint. Therefore this integration generates a storyboard, **not** AI-rendered moving video. The existing browser exporter still produces a still-image WebM with Gemini TTS audio.
- Gemini TTS remains unchanged. Do not commit API keys or deploy this branch until local lint, tests and build have been reviewed.


## Luma Ray 3.2 Text-to-Video

- Create an API key at [Luma API Platform](https://platform.lumalabs.ai/) and set `LUMA_AGENTS_API_KEY` in your local `.env`. Keep it private and do not commit it.
- The Video Studio submits a text-to-video job to the official Luma Agents API, polls for completion, and displays the resulting video.
- The default model is `ray-3.2`; the UI offers 9:16, 16:9 and other aspect ratios, 5s/9s durations, and 540p/720p/1080p options.
- This first integration is **text-to-video**. It does not yet animate the user's uploaded product image; image-to-video needs a supported image reference/upload flow.
- Gemini TTS remains unchanged. Luma API use is credit-based; trial credits and costs depend on the account and requested output. Confirm the account's balance before generating.
- Validate locally with `npm run lint`, `npm test`, and `npm run build` before deployment. This branch has not yet been run through those commands.
