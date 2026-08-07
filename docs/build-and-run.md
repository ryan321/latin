# How to build and run the Latin app

Operational guide for developing, running locally, and deploying the Year 1 Latin learning app. Product intent lives in [`product.md`](./product.md); stack choices and domain model in [`tech-stack.md`](./tech-stack.md); curriculum in [`year-1-outline.md`](./year-1-outline.md).

This document assumes the **target** stack (Next.js App Router, TypeScript, Drizzle, Postgres, OpenRouter). Paths and scripts below are the intended conventions once the app is scaffolded — adjust only if implementation deliberately diverges, and update this file when that happens.

---

## 1. What you are running

One **Next.js** process serves:

| Surface | Role |
|---------|------|
| Web UI | Units, lessons, activity widgets, tutor chat, progress |
| Route handlers | Grade activities, generate more practice, chat, auth |
| Server-side libs | OpenRouter client, deterministic graders, standard recompute |

**PostgreSQL** stores users, attempts, generated activities, chat, lesson completion.

**Lesson content** (standards, teach text, seed activities, allow-lists) lives in the **git repo** under `content/` and is loaded by the app at runtime (and/or synced into DB on seed). AI never owns the curriculum file of record.

**OpenRouter** (DeepSeek V4 Pro) is called only from the **server** for:

1. Grading free-form activities (translate, short answer, …)
2. Generating additional `Activity` objects when the standard is not met
3. Tutor chat replies

Deterministic activities (paradigm grids, MC) do **not** need the model to score.

```
Developer laptop / Fly VM
┌──────────────────────────────────────┐
│  next dev  |  next start (standalone)│
│    UI + API + grade/generate/chat    │
└─────────┬──────────────────┬─────────┘
          │                  │
          ▼                  ▼
     PostgreSQL         OpenRouter API
     (local/Neon/Fly)   (DeepSeek Pro)
```

---

## 2. Prerequisites

| Tool | Version (target) | Notes |
|------|------------------|--------|
| Node.js | **22 LTS** (or current LTS) | Match Dockerfile |
| npm | Comes with Node | Lockfile: `package-lock.json` |
| Git | Any recent | |
| Postgres | 15+ | Local Docker, Postgres.app, Neon free tier, etc. |
| OpenRouter account | — | API key with access to the DeepSeek model |
| Fly CLI | Optional until deploy | `flyctl` |
| Docker | Optional | Local Postgres + production image builds |

Optional: `psql` for inspecting the DB.

---

## 3. Repository layout (intended)

```
latin/
  content/                 # Curriculum source of truth
    units/
      00-foundations/
        unit.json          # title, order
        lessons/
          01-welcome.mdx   # teach body + frontmatter (standard, seeds, allowList)
          ...
    templates/             # Ending patterns (1st declension, 1st conj present, …)
  docs/
    product.md
    tech-stack.md
    year-1-outline.md
    build-and-run.md       # this file
  src/
    app/                   # Next.js App Router (pages + api/)
    components/
      activities/          # One widget per Activity type
      lesson/              # Shell: standard, teach, list, chat
    db/
      schema.ts
      index.ts
      migrations/
    lib/
      openrouter.ts
      grade/               # dispatch by activity type
      standard.ts          # recomputeStandard
      activities/          # generate, templates → grids
      auth.ts
      content.ts           # load lessons from content/
  .env.example
  .env.local               # gitignored — local secrets
  drizzle.config.ts
  Dockerfile
  fly.toml
  package.json
```

---

## 4. Environment variables

Copy the example file and fill values:

```bash
cp .env.example .env.local
```

### Required for local app + AI

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `OPENROUTER_API_KEY` | Server-only; never `NEXT_PUBLIC_*` |
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | Session signing (pick one convention at scaffold) |
| `AUTH_URL` / app URL | e.g. `http://localhost:3040` |

### Model selection

| Variable | Purpose | Default intent |
|----------|---------|----------------|
| `DEFAULT_MODEL` | Fallback for all AI tasks | `deepseek/deepseek-v4-pro-0731` (confirm slug on OpenRouter) |
| `GRADER_MODEL` | Optional override for grading | falls back to `DEFAULT_MODEL` |
| `TUTOR_MODEL` | Optional override for chat | falls back to `DEFAULT_MODEL` |
| `GENERATE_MODEL` | Optional override for practice generation | falls back to `DEFAULT_MODEL` |

Pin the exact OpenRouter model id after checking their model list; update `.env.example` when pinned.

### Optional

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL (production) |
| `GENERATION_MAX_PER_LESSON` | Cap AI-generated activities per lesson attempt (cost/fatigue) |
| `LOG_AI_PAYLOADS` | `true` in dev to log grade/generate JSON for debugging |

**Never commit** `.env.local` or production secrets. Fly uses `fly secrets set`, not committed env files.

### Example `.env.local`

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/latin?sslmode=disable
AUTH_SECRET=generate-a-long-random-string
AUTH_URL=http://localhost:3040

OPENROUTER_API_KEY=sk-or-v1-...
DEFAULT_MODEL=deepseek/deepseek-v4-pro-0731
# GRADER_MODEL=
# TUTOR_MODEL=
# GENERATE_MODEL=
```

Generate a secret:

```bash
openssl rand -base64 32
```

---

## 5. Database

### Local Postgres (development)

Use a local Postgres database for day-to-day work:

```bash
createdb latin
# DATABASE_URL=postgresql://USER@localhost:5432/latin
```

Docker alternative:

```bash
docker run --name latin-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=latin \
  -p 5432:5432 \
  -d postgres:16
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/latin
```

### Neon (staging / production)

1. Create a project in [Neon](https://neon.tech).
2. Copy the **pooled** connection string (include `?sslmode=require`).
3. Set `DATABASE_URL` in `.env.local` (or Fly secrets).
4. Run `npm run db:push` or `npm run db:migrate` against Neon.

The app uses **postgres.js** via Drizzle — the same driver works for local Postgres and Neon. No code change when switching URLs.

### Schema and migrations

```bash
npm run db:push       # fast iterate: push schema (good for local)
npm run db:generate   # drizzle-kit generate — after schema changes
npm run db:migrate    # apply versioned migrations
npm run db:studio     # Drizzle Studio GUI
npm run db:seed       # create/update student login
```

### Content vs DB

Lessons load from **`content/units/**`** JSON (standards, teach, seeds, allow-lists).  
DB holds **progress only**: users, attempts, generated activities, chat, completions.

---

## 6. Install and run (development)

From the repo root:

```bash
# 1. Dependencies
npm install

# 2. Env
cp .env.example .env.local
# edit .env.local — DATABASE_URL, OPENROUTER_API_KEY, AUTH_SECRET

# 3. Database
npm run db:migrate
npm run db:seed          # if provided

# 4. Dev server
npm run dev
```

Open **http://localhost:3040**.

| Script | Intent |
|--------|--------|
| `npm run dev` | Next.js dev server (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Serve production build locally |
| `npm run lint` | ESLint |
| `npm run db:generate` | Create migration from Drizzle schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed user / sync catalog if needed |
| `npm run deploy` | `fly deploy` (when configured) |

### Smoke-check after `dev` starts

1. Log in (single student or household account).
2. Open Unit 0 / first lesson — **standard** text visible.
3. Complete a **paradigm grid** without OpenRouter errors (deterministic grade).
4. Submit a **translate** item — feedback returns (needs `OPENROUTER_API_KEY`).
5. Ask the **tutor** a grammar question.
6. Fail a translate item, request **more practice** — new activity appears, still grades.
7. Meet standard → next lesson unlocks.

Without an API key: UI and grid grading should still work; translate/chat/generate should fail with a clear server error.

---

## 7. How a request runs (runtime paths)

### Grade an activity

```
Browser  POST /api/activities/grade  { activityId | activity, response }
    → auth
    → load lesson context (standard, allowList)
    → lib/grade/dispatch(activity, response)
         → paradigm_grid | single_form | mc  → pure TS compare
         → translate | short_answer          → OpenRouter JSON grade
    → persist attempt
    → recomputeStandard(user, lesson)
    → { status, feedback, issues, standardMet, progress }
```

### Generate more practice

```
Browser  POST /api/activities/generate  { lessonId, focus?: issues[] }
    → auth; reject if standard already met (or no-op)
    → check generation budget
    → OpenRouter returns Activity[] JSON
    → Zod validate against Activity schema; drop invalid
    → for paradigm patterns: expand template + lemma → cells
    → persist generated activities (source=generated)
    → return activities for UI widgets
```

### Tutor chat

```
Browser  POST /api/chat  { lessonId, message }
    → auth
    → load lesson teach + standard + recent progress + history
    → OpenRouter tutor completion
    → persist messages
    → { assistantMessage }
```

### Page load (lesson)

```
Server Component / loader
    → auth
    → load content lesson (MDX/JSON)
    → load attempts + generated activities + completion
    → render LessonShell(standard, teach, activities, progress)
```

---

## 8. Working on curriculum content

1. Add or edit files under `content/units/.../lessons/`.
2. Each lesson should declare:
   - `standardSummary` (student-facing)
   - `standard` requirements (machine-checkable)
   - teach body
   - `seeds` (Activity objects)
   - `allowList` (lemmas, constructions, activity types for AI)
3. Prefer **ending templates** for grids (`pattern: first_declension` + `lemma`) over hand-typing every cell when possible.
4. Reload the lesson page (dev hot reload usually picks up file changes; restart if content is cached aggressively).
5. Play the lesson as the student; tune rubrics and samples from real AI feedback.

Do not put secrets in content files.

See [`product.md`](./product.md) for Activity types and standard semantics; [`year-1-outline.md`](./year-1-outline.md) for sequence.

---

## 9. AI configuration notes (ops)

- **Keys** only on the server. Client never sees `OPENROUTER_API_KEY`.
- **Reasoning models:** grading/generate should use reasoning **off** or minimal so JSON `content` is not empty (same lesson as `../education` OpenRouter client).
- **Cost control:** generation caps per lesson; auto-stop when standard met; personal usage only.
- **Debugging unfair grades:** log attempt + model feedback; adjust rubric/samples; teacher override completion if needed.
- **Model pin:** when OpenRouter renames ids, change env only — no code change if model is env-driven.

---

## 10. Production build (local verify)

```bash
npm run build
npm run start
```

Uses `.env.local` or environment variables present in the shell. Confirm:

- Build completes with standalone output (if `output: 'standalone'` in Next config — intended for Fly).
- `start` serves on port **3040** locally (`npm run start`).
- Grade + chat still work against production `DATABASE_URL` only if that DB is reachable (don’t point local start at prod by accident).

---

## 11. Deploy on Fly.io

Intended when the app is ready to leave localhost.

### One-time setup

```bash
fly auth login
fly apps create <app-name>          # e.g. latin-year1
# configure fly.toml: app name, region (e.g. iad), internal_port 3000
```

Provision Postgres (Fly Postgres or external Neon):

```bash
# example: attach Fly postgres, or set Neon URL as secret
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set OPENROUTER_API_KEY="sk-or-..."
fly secrets set AUTH_SECRET="..."
fly secrets set NEXTAUTH_URL="https://<app-name>.fly.dev"
fly secrets set DEFAULT_MODEL="deepseek/deepseek-v4-pro-0731"
```

### Dockerfile intent

Multi-stage Node 22 image:

1. Install deps  
2. `npm run build`  
3. Run `node server.js` from Next **standalone** output  
4. Non-root user; `PORT=3000`, `HOSTNAME=0.0.0.0`  

Copy `content/` into the image so lessons are available at runtime.

### Deploy

```bash
npm run deploy
# or:
fly deploy --remote-only
```

### Post-deploy

```bash
fly ssh console
# run migrations if not in release command:
# npx drizzle-kit migrate   # or npm run db:migrate
```

Prefer a **release_command** in `fly.toml` that runs migrations on each deploy.

### Machines

Personal app: small VM, `auto_stop_machines` / `auto_start_machines` OK (like education) to save cost. Cold start may add a few seconds on first open.

---

## 12. Day-to-day developer workflow

| Task | Command / action |
|------|------------------|
| Feature work | `npm run dev` |
| Schema change | Edit `src/db/schema.ts` → `db:generate` → `db:migrate` |
| New activity type | Add Zod type + grader + React widget + allow in generate schema |
| New lesson | Add under `content/`; playtest; tighten standard |
| Prompt tune | Edit grader/tutor/generate prompts in `src/lib/`; retest same student answers |
| Check types | `npx tsc --noEmit` (or project script if added) |
| Ship | `fly deploy` after green build |

---

## 13. Teacher / household ops (runtime, not code)

| Need | How (product intent) |
|------|----------------------|
| See progress | Progress UI or simple admin view |
| Override stuck standard | Teacher mark complete / unlock next |
| Review AI fairness | Attempt history with feedback text |
| Reset a lesson | Clear attempts/completions for that lesson (admin action or SQL in emergency) |

No Stripe, no multi-tenant admin console required for v1.

---

## 14. Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| `OPENROUTER_API_KEY is not set` | Missing env | Set in `.env.local`; restart `dev` |
| Grade returns empty / “grader unavailable” | Reasoning ate tokens / bad JSON | Reasoning off for grade; raise `max_tokens`; fix parse + retry |
| Grid always wrong | Macron/normalize mismatch | Check normalizer; add accepted variants |
| Generate returns nothing useful | Allow-list too tight or invalid JSON | Log raw model output; widen allow-list carefully; harden Zod |
| Migrations fail | DB URL wrong / server down | Verify `DATABASE_URL`; `docker ps` |
| Lesson not found | Content path / slug mismatch | Check `content/` tree and loader |
| Unlock didn’t happen | Standard requirements not all satisfied | Inspect progress counters; seed vs generated evidence |
| Fly app crashes | Missing secrets / migrate not run | `fly logs`; `fly secrets list`; run migrations |

---

## 15. Security baseline (personal deploy)

- API keys and `AUTH_SECRET` only via env/secrets  
- All grade/generate/chat routes require a session  
- Zod-validate every POST body and every model JSON blob  
- Light rate limits on AI routes to avoid runaway loops  
- HTTPS via Fly; no need for kid anti-copy measures  

---

## 16. Implementation order (build sequence)

Use this when scaffolding from zero:

1. **Scaffold** Next.js + Tailwind + ESLint + `.env.example`  
2. **DB** Drizzle schema (users, attempts, activities generated, chat, completions) + migrate  
3. **Auth** Minimal single-user login  
4. **Content loader** One sample lesson with standard + teach + seeds  
5. **Paradigm grid** UI + deterministic grade + standard recompute  
6. **OpenRouter client** + translate grade + chat  
7. **Lesson shell** two-pane UX (activities + tutor)  
8. **generateActivities** + caps + progress banner  
9. **Unit 0–1 content** enough to dogfood daily  
10. **Dockerfile + fly.toml** + first deploy  

Do not start with Fly or multi-unit content before the standard loop works on one lesson.

---

## 17. Related docs

| Doc | Contents |
|-----|----------|
| [`product.md`](./product.md) | Standards, activities, AI roles, mastery |
| [`tech-stack.md`](./tech-stack.md) | Stack choices, schemas, phases |
| [`year-1-outline.md`](./year-1-outline.md) | Curriculum sequence |

When scripts, env names, or paths are finalized in code, **update this file** so it remains the runbook.
