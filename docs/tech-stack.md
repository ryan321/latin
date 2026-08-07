# Tech stack: Year 1 Latin app

Personal standalone app. Optimize for **fast iteration**, **clear AI loops**, and **eventual Fly.io deploy** — not multi-tenant scale.

**How to build, run, and deploy day-to-day:** see [`build-and-run.md`](./build-and-run.md).

## Summary

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript | Preference; shared mental model with `../education` |
| Runtime | Node.js | Preference; Fly-friendly |
| App framework | **Next.js** (App Router) | Full-stack TS, API routes, good enough SSR/SPA hybrid for lessons |
| UI | React + Tailwind CSS | Fast UI; education-like lesson layouts |
| AI | **OpenRouter** → **DeepSeek V4 Pro 0731** | Requested; OpenAI-compatible API |
| Config | **`.env` / `.env.local`** | Keys and model ids |
| DB | **PostgreSQL** + **Drizzle** (`postgres.js`) | **Local Postgres** for dev; **Neon** for deploy |
| Auth | Simple (single household) | Email/password or single shared login; no OAuth required for v1 |
| Deploy | **Fly.io** when ready | Matches education ops experience |
| Content | Files in-repo (MD/MDX or JSON) + DB metadata | Easy to edit lessons in git |

## Relationship to `../education`

**Standalone repo.** Do not couple runtimes or databases.

**Reuse as patterns (not a hard dependency):**

- `src/lib/openrouter.ts` — thin chat-completions client, reasoning controls for DeepSeek
- `src/lib/tutor.ts` — split `tutorReply` vs `gradeAnswer`, JSON parse hardening
- Lesson client UX — main column activities + sticky tutor chat
- Status enum — `passed` | `partial` | `pending`
- Persist chat + answers per lesson

**Drop from education for this product:**

- Stripe, gifts, multi-book commerce
- i18n / next-intl (unless needed later)
- Copy/cut/paste blocking
- Great Minds personas, marketing pages
- Complex access/billing gates

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Next.js client)                               │
│  - Standard banner + teach body                         │
│  - Activity widgets (shared components by type)         │
│  - Progress vs standard                                 │
│  - Chat                                                 │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────┐
│  Next.js server                                         │
│  - Load Lesson { standard, teach, seeds, allowLists }   │
│  - POST /api/activities/grade   → rules | AI            │
│  - POST /api/activities/generate → AI → Activity[]      │
│  - POST /api/chat               → tutor                 │
│  - recomputeStandard(progress) → unlock?                │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
              ▼                           ▼
        PostgreSQL                   OpenRouter
        (Drizzle)                    DeepSeek Pro
```

Single deployable: Next.js standalone output on Fly (same general shape as education’s Dockerfile).

## Core domain: Lesson + Standard + Activity

Everything adaptive hangs off three concepts.

### Lesson (content module)

```ts
type Lesson = {
  id: string;
  slug: string;
  title: string;
  unitId: string;
  /** Student-facing “you will be able to…” */
  standardSummary: string;
  /** Machine-checkable completion rules */
  standard: StandardSpec;
  /** Markdown/MDX teach body */
  teachPath: string;
  /** Seed activities shown first */
  seeds: Activity[];
  /** What AI may use when generating more practice */
  allowList: {
    lemmas: string[];
    constructions: string[];
    /** subset of ActivityType */
    activityTypes: ActivityType[];
  };
};
```

### StandardSpec

```ts
type StandardSpec = {
  /** e.g. require N passes of given kinds */
  requirements: StandardRequirement[];
};

type StandardRequirement =
  | { type: "activity_passed"; activityId: string } // specific seed
  | { type: "count"; activityType: ActivityType; filter?: object; n: number }
  | { type: "paradigm_mastery"; declension?: string; conjugation?: string; n: number }
  | { type: "translate_count"; direction: "L2E" | "E2L"; length: "word" | "phrase" | "sentence"; n: number };
```

`recomputeStandard(userId, lessonId)` aggregates attempts (seed + generated) and sets `lesson_completions` when all requirements are satisfied.

### Activity (common form object)

One schema family for **seeds and AI output**:

```ts
type ActivityType =
  | "paradigm_grid"
  | "single_form"
  | "translate"
  | "multiple_choice"
  | "short_answer"
  | "matching";

type Activity = {
  id: string; // stable for seeds; generated ids for AI items
  type: ActivityType;
  source: "seed" | "generated";
  /** Links evidence to standard counters */
  targets?: string[];
  prompt?: string;
  payload: ParadigmGridPayload | TranslatePayload | MultipleChoicePayload | /* … */;
};
```

- **UI:** `components/activities/<type>.tsx` renders any Activity of that type.
- **Grade:** `lib/grade/dispatch(activity, response)` → rules or AI.
- **Generate:** model returns `Activity[]`; Zod parses; reject unknown types / empty prompts.

AI is not allowed to invent a new `type` string. If we need a new exercise shape, we **add a typed Activity** to the library first.

## AI integration

### Provider

- Base URL: `https://openrouter.ai/api/v1/chat/completions`
- Auth: `OPENROUTER_API_KEY`
- Default model: DeepSeek V4 Pro 0731 via OpenRouter model id (pin exact slug in env after verifying on OpenRouter)

### Env vars (illustrative)

```bash
# .env.local (dev) / Fly secrets (prod)
OPENROUTER_API_KEY=sk-or-...
DEFAULT_MODEL=deepseek/deepseek-v4-pro-0731
TUTOR_MODEL=          # optional override
GRADER_MODEL=         # optional override
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...   # or equivalent session secret
AUTH_URL=http://localhost:3040
```

Confirm the exact OpenRouter model slug at implementation time (`deepseek/deepseek-v4-pro-0731` or whatever OpenRouter lists).

### Three server-side AI functions

| Function | Input | Output | Notes |
|----------|--------|--------|--------|
| `gradeActivity` | Activity + response + lesson context + attempt # | `{ status, feedback, issues[] }` | Rules path for grids/MC; model for translate/short_answer; `reasoning: none` on JSON |
| `generateActivities` | standard remaining + allowList + recent issues + allowed types | `{ activities: Activity[] }` | **Same schema as seeds**; Zod-validate; hard caps |
| `tutorReply` | standard + teach + allowList + history + user message | assistant text | HS Latin tutor; may nudge toward unmet standard |

Grids/MC: pure functions inside `gradeActivity` — no model call.

### Grading strategy by activity type

| Type | Path |
|------|------|
| Multiple choice, matching | Server compares to key; no model required |
| Paradigm grid / single-form | Cell-by-cell normalize + compare; no model on happy path |
| Spelling / vocab (strict) | Normalize; optional AI for near-miss `partial` |
| **Translate L→E / E→L** | **AI grader** + attempt-aware hints; then optional **`generatePractice`** |
| Short answer / culture reflection | AI with rubric (tighter for grammar, looser for culture) |

Always return the **same status shape** to the UI so widgets stay consistent.

### Adaptive engine (all activity types)

```
POST /api/activities/grade     → grade seed or generated Activity
POST /api/activities/generate  → more Activity objects until standard met
POST /api/chat                 → questions in lesson context
GET  /api/lessons/:id/progress → standard requirements + evidence
```

**State to persist**

- Activities: seeds immutable in content; generated rows in DB (`source = generated`)
- Attempts: activityId, response payload, status, feedback, issues, timestamps
- Lesson progress: requirement → satisfied?
- Generation budget per lesson (and optional daily cap)

**Prompt constraints for `generateActivities`**

- Emit JSON only: `{ "activities": [ /* Activity objects */ ] }`
- Only `allowList.activityTypes` and allow-listed lemmas/constructions
- Prefer types that fill **unmet standard requirements** (if translate_count remaining → translate; if paradigm_mastery → paradigm_grid / single_form)
- Target recent `issues[]` when present
- Include enough payload for the grader (e.g. `cells` / `accept` / `sampleAnswers`) — server may fill keys from templates for grids when AI only supplies lemma + pattern id

**Hybrid generation for forms**

- Prefer **templates** for paradigm grids: AI or server picks `lemma` + `pattern: first_declension` → deterministic cell keys
- AI freer on **translate** / **short_answer** prompts; still Zod-checked

**Safety**

- Reject unknown activity types
- Unlock only via `recomputeStandard`, not “AI says done”
- Log generate/grade payloads for teacher review

### DeepSeek / reasoning caveat

Some DeepSeek models spend tokens on “thinking.” Education’s client:

- defaults reasoning effort carefully
- turns reasoning **off** for short JSON grading
- retries if content is empty

Port that behavior so grading does not randomly fail.

## Data model (conceptual)

Minimal tables for a single-student app:

- **users** — student (+ optional parent login later)
- **units** / **lessons** — catalog (or partly file-derived)
- **activities** — typed items belonging to a lesson (`type`, `prompt`, `payload` JSON for options/keys/paradigm specs, `sort_order`, `required`)
- **attempts** / **answers** — per user per activity: response, status, feedback, timestamps
- **lesson_completions** — denormalized unlock state
- **chat_messages** — per user per lesson
- **overrides** (optional) — teacher unlock / force complete

Content bodies can live as **MDX/Markdown files** keyed by lesson slug; structured activities as JSON in the file frontmatter, sidecar JSON, or DB seed from those files.

### Activity payload examples

```ts
// multiple_choice
{ options: [{ id: "a", label: "..." }], correctOptionId: "a" }

// paradigm_grid — PRIMARY activity (nouns, adjectives, verbs)
{
  type: "paradigm_grid",
  kind: "noun",              // noun | adjective | verb
  lemma: "puella",
  stem: "puell",             // optional; show for "endings only" mode
  mode: "full_form",         // full_form | ending_only
  labels: {
    rows: ["nom", "gen", "dat", "acc", "abl"],
    cols: ["sg", "pl"]
  },
  // accepted answers per cell id; list allows macron variants
  cells: {
    "nom.sg": ["puella", "puella"],
    "gen.sg": ["puellae", "puellae"],
    // ...
    "abl.pl": ["puellis", "puellīs"]
  },
  prefill: { "nom.sg": "puella" },  // optional scaffolding
  check: "whole_chart"              // v1: submit entire grid
}

// single_form — quick rep (same engine, one cell)
{
  type: "single_form",
  prompt: "Genitive singular of via",
  accept: ["viae"]
}

// conjugate_form (alias of single_form with morph metadata)
{
  lemma: "amo",
  ask: { person: 1, number: "sg", tense: "present", voice: "active", mood: "indicative" },
  accept: ["amo", "amō"]
}

// translate — PRIMARY (seed item; AI grades; may spawn follow-ups)
{
  type: "translate",
  direction: "L2E",             // L2E | E2L
  length: "sentence",           // word | phrase | sentence
  prompt: "Puellae in silvā ambulant.",
  sampleAnswers: [
    "The girls walk in the forest.",
    "The girls are walking in the woods."
  ],
  rubric: "Subject girls plural; walk/are walking; location in the forest/woods.",
  targets: ["1st decl pl nom", "in + abl", "1st conj present"],
  countsTowardStandard: true
}

// short_answer
{
  rubric: "Explain why the ablative is used after in here.",
  sampleAnswers: ["Location / place where construction"]
}
```

**Paradigm grid grading:** pure server-side string normalize + compare (trim, strip macrons unless `strictMacrons`). No model call on the happy path. Return per-cell correctness so the UI can highlight misses.

**Translate grading:** always AI (variants are too wide for exact match). Pass `attemptNumber` so feedback can escalate from hint → fuller guidance. On `partial`/`pending`, server may call `generatePractice` or let the client request “Try a similar one.”

Authoring can stay lightweight: TypeScript/JSON seeds checked into git. Reusable **ending templates** (e.g. `firstDeclensionEndings`) plus a stem/lemma generate full `cells` so we do not hand-author every chart.

## Application structure (proposed)

```
latin/
  docs/
    product.md
    tech-stack.md
  content/
    units/
      01-first-declension/
        lessons/
          01-intro.mdx
          ...
  src/
    app/                 # Next.js routes
    components/
      lesson/            # LessonShell, TutorChat, activity widgets
      activities/        # MultipleChoice, ShortAnswer, ParadigmDrill, ...
    lib/
      openrouter.ts
      tutor.ts
      grade.ts           # dispatch by activity type
      progress.ts
    db/
      schema.ts
      index.ts
  .env.example
  Dockerfile
  fly.toml
```

## Auth & multiplayer

v1: **one real student**. Options (pick at implementation):

1. Single password-protected site / basic auth for the deploy URL  
2. One user account (credentials in DB)  
3. You + student accounts with a tiny admin flag for overrides  

No Google OAuth, no org hierarchy required.

## Frontend UX implementation notes

- **Lesson page**: CSS grid; main column + `~400px` chat aside (stack on mobile).
- **Activity components**: shared chrome (prompt, status chip, feedback, submit).
- **Chat**: optimistic user message; markdown render for assistant; persist history.
- **No** clipboard blocking.
- Progress page: unit list with completion checks and locks.

## Deployment

### Local

```bash
npm install
cp .env.example .env.local   # fill keys
npm run dev
```

### Fly.io (later)

- Dockerfile with Next standalone output
- `fly.toml`: shared-cpu, auto stop/start OK for personal use
- Secrets: `OPENROUTER_API_KEY`, `DATABASE_URL`, session secret, `NEXTAUTH_URL` / public URL
- Postgres: Neon, Fly Postgres, or other managed PG

Cost stays low with one user and machine auto-stop.

## Security & safety (personal app, still basic hygiene)

- API keys only on server; never `NEXT_PUBLIC_` for OpenRouter
- Auth on grade/chat routes
- Zod validate request bodies
- Rate limit chat/grade lightly (protect against runaway loops / cost)
- Tutor system prompt: Latin/course scope; refuse harmful or off-platform abuse
- No need for kid copy-protection measures

## Testing strategy

- Unit tests: normalizers (macrons, case), MC grading, JSON grade parse
- Manual: one lesson of each activity type + chat + unlock
- Optional: fixture-based grader eval set (sample student answers → expected status) to tune prompts

## Implementation phases

### Phase 0 — Skeleton

- Next.js + Tailwind + Drizzle + `.env.example`
- OpenRouter client + health check
- Auth stub / single user
- Empty lesson shell (two-pane)

### Phase 1 — Core loop

- Lesson content shape: `standard` + teach + seeds + allowList
- Activity library: **paradigm_grid** + **translate** (+ MC if easy)
- `gradeActivity` (rules + AI) + chat; `recomputeStandard` → unlock
- Ending templates for grid keys

### Phase 2 — Full adaptive loop + Year 1 breadth

- `generateActivities` → validated Activity[] (forms via templates, translate via model)
- Issue-targeted remediation; generation caps; progress vs standard UI
- More units, culture, teacher override + dashboard

### Phase 3 — Harden & deploy

- Prompt tuning from real student answers
- Fly deploy + backups
- Spaced review / extra drill generation (if useful)

## Decisions log

| Decision | Choice |
|----------|--------|
| Product type | Personal, standalone |
| Curriculum | Year 1 HS Latin, Henle-inspired |
| Pronunciation | Classical |
| AI vendor | OpenRouter |
| Model | DeepSeek V4 Pro 0731 (pin slug in env) |
| Framework | Next.js + TypeScript + Node |
| DB | Postgres + Drizzle |
| Hosting | Fly.io (when ready) |
| Anti-copy | None |
| Grades | Standards-based unlock, not % report cards |
