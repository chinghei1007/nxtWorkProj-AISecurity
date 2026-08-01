# Sentinel AI Security Scanner

Sentinel is a private, multi-user code-security scanner. It validates that a submission resembles source code, sends accepted source to the selected AI provider for static analysis, and stores structured findings without retaining the full source.

## Stack

- Vite, React, TypeScript, Tailwind CSS, Zustand, and TanStack Query
- Fastify with HTTP-only database-backed sessions
- PostgreSQL and Prisma migrations
- Shared Zod contracts for frontend and API validation
- Groq/OpenAI-compatible shared model profiles and encrypted user-owned Gemini keys

## Local setup

Prerequisites: Node.js 22+, npm, and Docker.

1. Install dependencies:

   ~~~powershell
   npm install
   ~~~

2. Merge the values from .env.example into .env. Keep existing provider keys. Generate a credential-encryption key with:

   ~~~powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ~~~

3. Start PostgreSQL, apply the committed migration, and seed the administrator:

   ~~~powershell
   docker compose up -d postgres
   npm run db:migrate
   npm run db:seed
   ~~~

4. Start the API and web app:

   ~~~powershell
   npm run dev
   ~~~

Open [http://localhost:5173](http://localhost:5173). The initial local administrator is chinghei1007 with temporary password Oct0puspass. Sentinel requires a new 12-character password immediately after login.

The existing local .env in this workspace has already been supplemented with the database URL and a randomly generated encryption key. It remains ignored by Git.

## Model configuration

Shared profiles are defined in MODEL_PROFILES_JSON. Keys remain separate environment variables:

~~~json
[
  {
    "id": "groq-default",
    "label": "Groq · GPT OSS 120B",
    "provider": "groq",
    "model": "openai/gpt-oss-120b",
    "baseUrl": "https://api.groq.com/openai/v1",
    "apiKeyEnv": "GROQ_API_KEY"
  }
]
~~~

Supported shared provider values are groq and openai-compatible. Only administrators can change this server configuration. Users can add Gemini keys in Settings; keys are validated before storage, encrypted with AES-256-GCM, and never returned to the browser.

## API surface

All application endpoints use /api and return errors as:

~~~json
{
  "error": {
    "code": "NOT_CODE",
    "message": "Does not seem like code."
  }
}
~~~

- Authentication/account: /api/auth/login, /api/auth/logout, /api/auth/me, /api/account, /api/account/change-password
- Scans: /api/scans, /api/scans/:id
- Models and credentials: /api/models, /api/model-preference, /api/credentials, /api/credentials/:id/models
- Administration: /api/admin/users, /api/admin/users/:id, /api/admin/users/:id/reset-password

State-changing requests from browsers are origin-checked. The frontend authenticates through a secure HTTP-only cookie; no database or shared provider key is exposed to client code.

## Verification

~~~powershell
npm run typecheck
npm test
npm run build
~~~

Runtime verification uses the isolated security_scanner_verify database:

~~~powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/security_scanner_verify?schema=public"
npm run verify:runtime
~~~

An optional real-provider smoke test uses the configured default shared profile and consumes one provider request:

~~~powershell
npm run verify:provider
~~~

## Security and data behavior

- Submitted source is capped at 50,000 characters, never executed, and excluded from request logs.
- Obvious prose is rejected before a provider request.
- Successful history records include a SHA-256 hash, a 160-character preview, model metadata, summary, and findings—not the full source.
- User queries are ownership-scoped. Administrator routes enforce roles and preserve at least one active administrator.
- Session tokens are random, stored only as SHA-256 hashes, and rotated after password changes.
- Provider responses are schema-validated and receive at most one repair attempt.
