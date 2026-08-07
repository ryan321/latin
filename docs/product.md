# Product: Year 1 High School Latin

Personal learning app for one student. Not a commercial product.

## Purpose

Help a high-school student complete an **effective Year 1 Latin course**: solid grammar foundations, reading/writing small amounts of Latin, and enough **Roman Empire context** to make the language feel historically real.

Success is **meeting a standard before moving on**, not letter grades or completion for its own sake.

## Audience

| Role | Who | Needs |
|------|-----|--------|
| Student | One teenager | Short lessons, mixed practice, clear pass/retry feedback, help when stuck |
| Teacher / parent | You | Progress visibility, ability to unblock or review attempts (lightweight) |

Standalone product — not part of Best Subjects / the live-workbook platform. Patterns and AI UX may be inspired by `../education`.

## Pedagogical approach

**Henle-inspired, not Henle-cloned.**

Take inspiration from Henle’s grammar-first high-school style:

- Clear grammar presentation (rules + paradigms)
- Vocabulary that shows up in exercises
- Form work (decline, conjugate, identify)
- Translation both directions as skill grows
- Steady, cumulative review

Do **not** mimic Henle’s exact unit layout, exercise wording, or copyrighted content. Lessons and questions are original.

### English grammar before Latin (standing rule — all years)

**Never assume the student already understands a grammar concept at the depth Latin will require.**

When introducing a new *type* of idea (tense, voice, agreement, relative clauses, comparison, participles, mood later, etc.):

1. Teach and practice it in **English / plain language** until the lesson standard is met.  
2. Only then teach the **Latin forms or syntax** that encode that idea.  
3. Give **enough lessons** for real grasp—not a one-line “reminder” before a full paradigm.

Models already in the course: **parts of speech** and **case meanings** before charts. Extend that pattern everywhere (see `docs/curriculum-principles.md`).

### Pronunciation

**Classical** pronunciation. Early lessons introduce vowels, consonants, stress, and macrons. Spoken audio is optional later; written guidance is enough for v1.

### Twin goals each unit

1. **Grammar & forms** — the student can use the unit’s morphology and syntax correctly.
2. **Roman context** — short, concrete notes on the Roman world (people, places, institutions, army, family, empire) tied loosely to the language work.

## Course scope: Year 1

Aim for what a solid **first-year high school Latin** class covers, delivered as many short digital lessons rather than long textbook chapters.

### Approximate content map (flexible)

Exact lesson count can grow over time. The curriculum should eventually cover roughly:

| Strand | Year 1 targets (illustrative) |
|--------|-------------------------------|
| Foundations | Parts of speech; case **meanings** before full charts |
| Nouns | 1st–5th declensions; major case uses |
| Adjectives | 1st/2nd and 3rd declension; agreement |
| Pronouns | Personal, demonstrative, relative (intro) |
| Verbs | Present system through perfect system for regular conjugations; *sum* / *possum*; principal parts habit |
| Syntax | Basic sentence patterns; prepositional phrases; agreement; intro to subordinate ideas as appropriate |
| Vocabulary | Periodic batches + drills/quizzes; recycled in passages |
| Skills | Read short Latin **sentences and passages**; answer comprehension questions; write short Latin; parse forms; vocabulary retention |
| Culture | Republic → early Empire snapshot; daily life; key figures/places; army & provinces at a high level |

v1 implementation can ship a **strong first arc** (e.g. 1st declension, *sum*, basic cases, intro culture) while the full Year 1 outline remains the product north star.

## Lesson (module) model

Every lesson is built the same way. Naming: **lesson** in the UI; “module” means the same object in design talk.

```
┌─────────────────────────────────────────────────────────────┐
│  LESSON                                                     │
│                                                             │
│  1. STANDARD (stated, visible to student)                   │
│     What “done” means — measurable, not vibes               │
│                                                             │
│  2. TEACH                                                   │
│     Fixed content: explanation, paradigm, culture note      │
│                                                             │
│  3. EVALUATE (standard methods)                             │
│     Seed activities using common Activity objects           │
│     Graded by rules engine and/or AI                        │
│                                                             │
│  4. ADAPT (AI, same Activity objects)                       │
│     More drills / practice / guidance until STANDARD met    │
│     Open chat answers questions in the same context         │
│                                                             │
│  → Unlock next lesson only when STANDARD is met             │
└─────────────────────────────────────────────────────────────┘
```

### 1. Stated standard

Each lesson **declares** a standard in student-facing language and in machine-checkable form.

**Student sees** (example):

> **Standard:** Decline a 1st-declension noun in all cases singular and plural, and translate three short sentences that use those forms (Latin→English and English→Latin).

**System stores** something like:

- Required activity targets (e.g. 1 full paradigm grid `passed`, with any 1st-decl lemma)
- Translation counters (e.g. ≥2 L→E sentence `passed`, ≥1 E→L sentence `passed`)
- Optional: remediation streak, culture reflection complete

The standard is the **contract**. Teaching and practice exist to meet it; AI does not invent a different goal mid-lesson.

### 2. Standard ways to teach

Teaching material is **authored and fixed** for the lesson, rendered as **rich MDX** (see [`rich-content.md`](./rich-content.md)):

- Headings, callouts, paradigm tables, pronunciation cards, Latin/English examples, case role cards, comparisons, steps, culture boxes, images/video
- Sibling `.mdx` file preferred over plain JSON string for student-facing body
- Vocab/construction **allow-list** for this lesson (what AI may use later)
- JSON `teach` kept as plain context for the AI tutor

AI does not replace the teach step for v1; it can **explain** the same material in chat when asked.

### 3. Standard ways to evaluate

Each lesson includes **seed activities** drawn from a small library of **common activity object types** (see below): paradigm grids, single-form slots, translate items, MC, etc.

Evaluation path is determined by type:

| Object type | How we evaluate |
|-------------|-----------------|
| Paradigm grid, single-form, MC, matching | Deterministic (rules / keys) |
| Translate, short answer, reflection | AI against rubric + samples + allow-list |

Every evaluation returns the same shape: `passed` | `partial` | `pending` + feedback (+ optional `issues[]`). Results **count toward the lesson standard**.

### 4. AI until the standard is met

While the standard is **not** met, the AI may:

| Action | Uses common objects? | Purpose |
|--------|----------------------|---------|
| **Evaluate** a student response | Yes — grades an Activity instance | Status + guidance |
| **Create more practice** | Yes — emits new Activity objects (grids, translates, slots…) | Extra reps on weak spots |
| **Create more drills** | Yes — especially form templates with new lemmas | Automaticity |
| **Answer questions** (chat) | Context = lesson standard + teach + allow-list + recent activities | Unblock confusion |

AI **must** stay inside:

- This lesson’s **standard** (what we’re aiming at)
- This lesson’s **allow-lists** (vocab / grammar already in scope)
- The **Activity schema** (no free-form mystery exercises the UI can’t render)

When the standard **is** met → stop generating busywork → show completion → unlock next.

### Mastery loop (every lesson)

```
Show STANDARD + TEACH
        │
        ▼
Serve seed Activities (standard evaluate kit)
        │
        ▼
Student works ──► evaluate (rules or AI) ──► update progress vs STANDARD
        │
        ├── STANDARD met → complete / unlock
        │
        └── not met → feedback + (retry and/or AI generates more
              Activity objects of allowed types targeting gaps)
                    │
                    └── chat available anytime (same lesson context)
                              │
                              └────────── loop ──────────┘
```

This is why the product is iterative: **fixed standard and teach**, **flexible practice volume** via AI operating on shared forms.

### Length

Short lessons: roughly **10–20 minutes** when the student is on pace; longer if remediation loops. Prefer many small lessons (clear standards) over few huge ones.

Intro / culture-only lessons still have a stated standard (e.g. “Read the note and answer one reflection at meets-standard”).

## Activity objects (common form library)

All practice — seed **and** AI-generated — is instances of shared **Activity** types the UI knows how to render and the server knows how to grade. Do not invent one-off exercise shapes per lesson.

Experiment with *which* types a lesson uses; do not fork the object model.

### Primary activity: ending / paradigm forms

The most common drill in this course is **adding endings** — repeatedly, until automatic.

This is not a rare “bonus widget.” It is the **default muscle-building activity** for every new paradigm (noun cases, adjective agreement, verb person endings, tense signs, etc.). Students will fill 1st-declension charts, then 2nd, then verb presents, over and over across Year 1, including spiral review of old paradigms.

**Core interaction patterns** (all supported; lessons pick what fits):

| Pattern | What the student does | Example |
|---------|----------------------|---------|
| **Ending grid (full paradigm)** | Type the form in each case/person cell for a given lemma | Decline *puella* sg+pl; conjugate *amō* present |
| **Endings only** | Stem shown; student supplies only the ending (or full form from stem) | Stem *puell-* → cells get *-a, -ae, -ae, -am…* |
| **Single slot** | One prompt: “genitive singular of *via*” | Fast reps between longer tasks |
| **Partial chart** | Some cells pre-filled; student completes the rest | Scaffold early; remove scaffolding later |
| **Dictation-style form** | Prompt in English labels (“dat. pl.”) → Latin form | Case-use ↔ form link |
| **Same endings, new word** | Identical chart structure, fresh vocabulary | Transfer: endings, not memorizing one row of English |

**UX expectations**

- Feels like a **clear table** (case × number, or person × number), not a wall of free-text.
- **Check per cell or whole chart** — prefer whole-chart submit for v1 simplicity; optional per-cell feedback later.
- Immediate feedback: wrong cells highlighted; correct cells lock or show check.
- Retries unlimited; student fixes only wrong cells when possible.
- Keyboard-friendly (tab between cells) for teens who type fast.
- Optional “show stem” / “show labels” toggles as scaffolding that lessons can enable by default early in a unit.

**Evaluation**

- Mostly **deterministic**: normalize case, whitespace, and (by default) macrons, then compare to accepted forms.
- **Partial** if most cells right but a systematic error (e.g. all datives wrong).
- AI optional for messy free-text “write the whole paradigm in one box”; prefer structured grids so AI is not required for the common path.
- Tutor chat: “why is genitive plural *-ārum*?” — help on the system, not a substitute for filling the grid.

**Frequency**

- Nearly every **G** (grammar) lesson includes at least one ending/forms activity.
- Checkpoints recycle earlier paradigms under time/variety pressure (new lemmas, mixed declensions).
- Expect the student to decline 1st declension **many times** across Units 1–4+ as review, not only once when it is introduced.

### Primary activity: translation (both directions)

The other workhorse is **“translate this”** — Latin → English and English → Latin — from **single words → short phrases → full sentences** (and eventually short connected bits in later units).

Unlike ending grids (mostly deterministic), translation is **AI-evaluated and adaptive**. The point is not one lucky correct submit; it is **iterate until the standard is met**, with guidance and **more practice items** when the student is weak on a pattern.

**Directions**

| Direction | Skill | Grading emphasis |
|-----------|--------|------------------|
| **Latin → English** | Reading / comprehension | Meaning first; accept natural English paraphrase; flag missing core ideas |
| **English → Latin** | Production | Correct forms & function (case, agreement, verb ending); word order flexible when meaning is clear |

**Length ladder** (lessons and adaptive follow-ups climb this):

1. **Word** — gloss or best equivalent (*silva* → “forest/woods”)  
2. **Phrase** — prep + case, noun + adjective (*in silvā magnā*)  
3. **Clause / sentence** — full finite verb (*Puellae in silvā ambulant.*)  
4. **Mini-set** — 2–4 related sentences (later units / checkpoints)

**AI roles on every translation item**

1. **Evaluate** — `passed` / `partial` / `pending` + short feedback  
2. **Guide** — what to fix (case? vocab? agreement? tense?) without always dumping a full key on first fail  
3. **Adapt** — if below standard, generate **additional practice** targeting the same skill (new sentence, same construction; or simpler rung on the ladder; or isolate the failing form)

**Adaptive mastery loop (translation)**

```
Author seed item(s) for the lesson
        │
        ▼
Student translates ──► AI grades + feedback
        │
        ├── passed → count toward lesson standard
        │
        └── partial / pending → guidance
                    │
                    ▼
              Offer retry on same item and/or
              AI generates next practice item
              (same target grammar/vocab)
                    │
                    └──────► loop until standard met
                              or teacher override
```

**What “meets standard” means for translation (lesson-level)**

Configurable per lesson, typically something like:

- At least **N** items `passed` at the target length (e.g. 3 sentences L→E and 2 E→L), **or**
- Seed items passed **and** any remediation streak shows stability (e.g. 2 in a row passed after a fail)

Not a percentage gradebook — a **clear pass bar** before unlock. Author sets the bar; AI supplies volume and variety when the student needs more reps.

**Guidance tone**

- High-school direct; name the grammar (*“Your noun is nominative; *in* + ablative needs ablative.”*)  
- On first fails: hint and local fix  
- After repeated fails on the same item: richer walkthrough; model sentence; then a **fresh** parallel item to prove it  
- Classical pronunciation only when relevant to the task (not every gloss)

**Authoring vs AI generation**

| Source | Role |
|--------|------|
| **Seed items** (in lesson content) | Guaranteed coverage of the lesson’s target; reviewed by you |
| **AI follow-ups** | Extra reps when adaptive loop needs them; constrained by lesson vocab list + allowed grammar so far |
| **Tutor chat** | Student-initiated questions anytime; separate from the graded translate form |

Constraints for generated practice: only lemmas and constructions **already taught** (plus the current lesson). No random Year 2 syntax.

### Other activity types

| Format | Purpose | Evaluation |
|--------|---------|------------|
| **Ending / paradigm grid** | **Primary** — produce forms by adding endings | Deterministic cell match (see above) |
| **Translate** (L→E / E→L) | **Primary** — word → phrase → sentence; adaptive reps | AI grade + guidance + optional generated follow-ups |
| **Matching** | Left column ↔ right column (case↔job, word↔gloss, letter↔sound) | Deterministic pairs |
| **Ordering** | Put steps/forms/principal parts in sequence | Deterministic order |
| **Multi-select** | Select all that apply | Deterministic set equality |
| **Cloze** | Fill blanks in a sentence (optional word bank) | Normalized blank match |
| **Multiple choice** | Single best option | Deterministic (correct option id) |
| **Short answer** | Explain a rule, identify syntax, culture reflection | AI grade + feedback |
| **Single-form production** | One declined/conjugated form (quick rep) | Normalized match |
| **Matching** (optional) | Vocab, form ↔ label | Deterministic |

### Two engines, one lesson

| Engine | Best for | Adaptive? |
|--------|----------|-----------|
| **Forms engine** | Charts, endings, single slots | Mostly fixed item banks + templates; shuffle lemmas |
| **Translation engine** | Meaning and production in context | **Yes** — AI eval, feedback, generated practice until standard |

A typical grammar lesson: **teach → ending grid(s) → translate ladder → checkpoint items**.  
A typical translation-heavy lesson: seed set + adaptive top-up until bar is met.  
Culture lessons: lighter translation (mottoes, short captions) + reflection.

### Design principles for items

- Prefer **one clear target skill** per item when possible; translation sentences may combine skills but feedback should name the main miss.
- **Forms before freestyle:** when teaching a paradigm, grid reps come before open translation of that pattern.
- Allow **retries** without penalty theater; status is meets standard / almost / try again.
- Translation accepts **reasonable variants** (English synonyms; Latin word order; alternate correct vocabulary when the prompt allows).
- Macrons: start **generous** (macrons optional unless the lesson is specifically about pronunciation/quantity).
- Same ending pattern practiced with **multiple lemmas** so students learn the system, not one example word.
- Adaptive practice is for **meeting the standard**, not infinite busywork — stop when the bar is met; don’t generate endless items after pass.

## Mastery & progression

### Status model (per activity)

Reuse the clear three-state model from the education platform:

| Status | Student-facing | Meaning |
|--------|----------------|---------|
| `passed` | Meets standard | Good enough to count |
| `partial` | Almost | On track; needs a fix or missing piece |
| `pending` | Try again | Off-base, blank, or wrong target |

Multiple-choice and exact-match items map onto the same statuses (usually `passed` or `pending`).

### Lesson completion = standard met

A lesson is complete only when its **stated standard** is satisfied.

- Standards are defined in lesson content (human text + machine checks).
- Seed activities and **AI-generated** activities both contribute evidence using the same status model.
- Culture reflections: effort/relevance bar when the standard says so.
- Optional/bonus activities do not block unlock unless listed in the standard.
- Once the standard is met, **stop** generating more practice for that lesson.

### Gate

**Hard unlock** by default: next lesson stays locked until the current lesson’s standard is met.

Teacher override (you) can mark standard met or unlock if the AI is wrong or mastery was shown offline.

### Retries

Unlimited retries on any Activity. Student may edit and resubmit. AI feedback should **hint and coach**, not always dump the full key on first failure. After repeated fails, richer guidance + new parallel Activity; **tutor chat** for deeper walkthroughs.

## AI roles

The AI only operates **inside a lesson**, aimed at that lesson’s **standard**, and only through **common Activity objects** (plus chat text).

### Shared context (every AI call)

- Lesson id, title, **standard** (student text + machine checks)
- Teach body (summary or full)
- Allow-lists: lemmas, constructions, activity types permitted to generate
- Progress vs standard (what’s left)
- Recent attempts / `issues[]` (what’s failing)

### 1. Evaluate

- Input: one Activity instance + student response (+ attempt number)
- Output: `{ status, feedback, issues[] }`
- Free-form types (translate, short answer) use the model; grids/MC use rules (AI skipped)
- Hint ladder: first fails nudge; later fails explain more; still prefer a **new** Activity to prove mastery

### 2. Generate practice / drills

- When standard not met (or author marks “warm-up bank empty”)
- Output: **JSON array of Activity objects** matching allowed types only  
  e.g. another `paradigm_grid` for *terra*, a `translate` E2L phrase with *in* + abl, a `single_form` gen. pl.
- Server validates with Zod against the Activity schema; invalid objects discarded
- UI renders them with the **same widgets** as seed content
- Caps per lesson to control cost and fatigue; then point student to chat or you

### 3. Answer questions (chat)

- Open side-panel tutor; student-driven
- Same lesson context; may reference the standard (“you still need two sentence translations”)
- Must not casually complete graded Activities for the student on first ask; coach toward them
- After repeated stuckness: fuller walkthrough, then a generated parallel Activity to pass

### What AI is not (v1)

- Not changing or replacing the lesson **standard**
- Not inventing UI types outside the Activity library
- Not a global multi-year planner — adaptation is **local to the lesson**
- Not unsupervised curriculum authoring — **you** write standards, teach, and seeds; AI supplies volume, evaluation nuance, and Q&A
- Not letter grades / percentages as primary UX

## UX principles

Inspired by the live-workbook lesson experience in `../education`:

1. **Two-pane lesson** — content + activities (main); tutor chat (side, sticky).
2. **Inline check** — submit → status chip → feedback under the activity.
3. **Clear completion** — banner + link to next lesson when standard met.
4. **Progress map** — unit/lesson list with locked / available / complete.
5. **No anti-copy / anti-paste** — home use; trust the student.
6. **No gradebook theater** — progress = skills met and path unlocked.

Visual tone: serious but approachable classical/academic, readable for teens — not a cartoon kids app and not a dense university syllabus PDF.

## Explicit non-goals (v1)

- Multi-tenant SaaS, marketing site, subscriptions, Stripe
- Many student accounts / school rostering
- Mobile-native apps (responsive web is enough)
- Full spoken conversation practice
- Perfect coverage of every Year 1 textbook on day one
- i18n (English UI)
- Shared package monorepo with `../education` (copy patterns; keep repos separate)

## Success criteria

The product is working when:

1. The student can complete early lessons without you re-explaining the UI.
2. AI feedback on Latin production feels **fair** more often than not.
3. The student uses chat when stuck instead of stalling.
4. Unlocking the next lesson correlates with actually knowing the forms.
5. Over months, the path supports a full **Year 1** outcome, not a demo toy.

## Open experiments (allowed)

- New activity widgets (drag paradigms, timed form drills, cloze with word bank)
- Spaced review sessions between units
- Teacher notes / private comments on an attempt
- Optional macrons-strict mode for advanced practice
- Audio for classical pronunciation of paradigms

Ship the core loop first; experiment inside the activity-type system.
