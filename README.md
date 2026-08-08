# Latin Year 1

Personal mastery-based Year 1 high-school Latin app (Henle-inspired, classical pronunciation). Lessons declare a **standard**; practice uses shared activity types (ending grids, translation, …); AI grades free responses, generates more practice, and tutors in chat.

See `docs/` for product, curriculum, stack, and runbook. Authoring rule for all years: **English grammar concepts before Latin forms** (`docs/curriculum-principles.md`). Lesson art lives under `public/media/` and is embedded with MDX `<Image>` / `<Scene>` (`docs/lesson-media.md`).

## Quick start (local Postgres)

```bash
# DB (once)
createdb latin   # or use Docker — see docs/build-and-run.md

cp .env.example .env.local
# edit DATABASE_URL if needed; add OPENROUTER_API_KEY for AI features

npm install
npm run db:push      # or db:migrate after generating migrations
npm run db:seed
npm run dev
```

Open http://localhost:3040 — sign in with seed credentials (`student@local.test` / `latin-learn` by default).

## Neon

Set `DATABASE_URL` to your Neon pooled connection string (`?sslmode=require`), then `npm run db:push` or migrate against Neon. Same app code as local.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run db:push` | Push schema to DB (fast local iterate) |
| `npm run db:generate` / `db:migrate` | Versioned migrations |
| `npm run db:seed` | Create/update student user |
