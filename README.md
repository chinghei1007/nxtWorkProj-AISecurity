# Sentinel Anonymous Security Scanner — Cloudflare D1 branch

This branch (`codex/cloudflare-d1-24h`) is the account-free Cloudflare edition of Sentinel. It serves the Vite/React SPA and a Hono Worker API from one origin, stores bounded report data in D1 for 24 hours, and lets visitors keep schema `1.0` JSON reports in their own browser.

The local PostgreSQL/Docker edition remains on `master`. `docker-compose.yml` is deliberately unchanged here and is not used by this branch.

## Data and security behavior

- Submitted source is capped at 50,000 characters, analyzed as untrusted text, never executed, and never stored in full.
- Obvious prose is rejected before Turnstile or provider inference with `NOT_CODE`.
- A successful scan receives a random, case-sensitive 12-character access code and a separate 256-bit management token. D1 stores only their SHA-256 hashes.
- Access codes permit view/export. Management tokens permit rename/delete and are returned only when a scan is created.
- Each D1 scan becomes unavailable exactly 24 hours after creation. A UTC cron runs every 15 minutes and physically deletes expired rows in bounded batches. Cloudflare's normal D1 recovery/time-travel facilities can retain deleted database history outside the application's access window.
- Share links use `/open#AccessCode`; URL fragments do not reach the Worker, request logs, or referrers.
- Personal Gemini keys live only in `sessionStorage` for the current tab. They are sent for validation/inference and never written to D1, IndexedDB, localStorage, logs, responses, or exports.
- Recent scan capabilities are stored in IndexedDB. localStorage receives only a non-sensitive display index. Explicitly saved/imported reports remain in IndexedDB until the visitor deletes them.

## Local development

Prerequisites: Node.js 22+ and npm. Docker and PostgreSQL are not required.

~~~powershell
npm install
Copy-Item .dev.vars.example .dev.vars
# Replace GROQ_API_KEY in .dev.vars with a development key.
npm run db:migrate:local
npm run dev
~~~

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to Wrangler on port 8787. The checked-in public key and `.dev.vars.example` secret are Cloudflare's always-pass Turnstile test credentials and must not be used for production.

Shared profiles use `MODEL_PROFILES_JSON`. `baseUrl` is optional; Groq profiles default to `https://api.groq.com/openai/v1`, while other OpenAI-compatible profiles default to `https://api.openai.com/v1`.

~~~json
[
  {
    "id": "groq-default",
    "label": "Groq · GPT OSS 120B",
    "provider": "groq",
    "model": "openai/gpt-oss-120b",
    "apiKeyEnv": "GROQ_API_KEY"
  }
]
~~~

Every `apiKeyEnv` value names a Worker secret; it is not the secret itself.

## Cloudflare provisioning and deployment

1. Create production and preview D1 databases:

   ~~~powershell
   npx wrangler d1 create sentinel-scans
   npx wrangler d1 create sentinel-scans-preview
   ~~~

2. Replace the placeholder `database_id` and `preview_database_id` values in `wrangler.jsonc` with the returned IDs. Keep the `DB` binding name.

3. Configure production secrets. Add one secret for every `apiKeyEnv` referenced by `MODEL_PROFILES_JSON`:

   ~~~powershell
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put GROQ_API_KEY
   ~~~

4. Create a Turnstile widget for the production hostname. Set the public site key only for the frontend build, and set `TURNSTILE_EXPECTED_HOSTNAME` plus any custom `MODEL_PROFILES_JSON` values as non-secret Worker variables in `wrangler.jsonc` or the Cloudflare dashboard:

   ~~~powershell
   $env:VITE_TURNSTILE_SITE_KEY="your-public-site-key"
   ~~~

5. Apply the committed D1 migration and deploy the Worker plus static assets:

   ~~~powershell
   npm run db:migrate:remote
   npm run deploy:dry-run
   npm run deploy
   ~~~

The cron expression `*/15 * * * *`, SPA fallback, D1 binding, static assets, and Worker-first `/api/*` routing are committed in `wrangler.jsonc`. Cloudflare may take several minutes to propagate a newly changed Cron Trigger.

## Abuse controls and quotas

- Every scan requires server-side Turnstile Siteverify validation.
- Shared-key scans: 3/minute/IP.
- Personal Gemini (BYOK) scans: 10/minute/IP.
- Access-code resolution: 30 attempts/minute/IP.
- Shared models also use an atomic D1 daily cap, default 100 scans per UTC day. Change `SHARED_SCAN_DAILY_CAP` to configure it.

Rate-limit bindings are defined in `wrangler.jsonc`. Namespace IDs must be unique within the Cloudflare account.

## API surface

All errors use `{ "error": { "code": "...", "message": "...", "fieldErrors": {} } }`.

- `POST /api/scans` — source, title, Turnstile token, and model selection; returns the report and one-time capabilities.
- `POST /api/scans/resolve` — resolves an unexpired access code.
- `GET /api/scans/:id` and `GET /api/scans/:id/export` — require `X-Scan-Access-Code`.
- `PATCH /api/scans/:id` and `DELETE /api/scans/:id` — require `X-Scan-Management-Token`.
- `GET /api/models` — safe shared profile metadata only.
- `POST /api/models/gemini` — validates a supplied personal key and lists compatible Gemini models.

The export document remains schema `1.0` and contains no access codes, management tokens, Turnstile values, provider keys, full source, or internal configuration. JSON upload is read and validated entirely in the browser, limited to 5 MB, and deduplicated by the SHA-256 fingerprint of canonical JSON.

## Verification

~~~powershell
npm run typecheck
npm test
npm run build
npm run deploy:dry-run
~~~

`npm run db:migrate:local` verifies the Wrangler migration against the local D1 database. Real provider verification requires the profile variables and key in the current process and consumes one provider request:

~~~powershell
$env:LIVE_PROVIDER_TEST="1"
npm run verify:provider
~~~
