# How standards and targeted practice work

## Meeting the standard (not an AI vibes check)

The lesson **standard** is a checklist of machine-checkable requirements in the lesson JSON. The AI does **not** decide “you’re done” with a free-form opinion.

### Requirement types

| Type | Meaning |
|------|---------|
| `activity_passed` | A specific seed activity id must have latest status `passed` |
| `count` | At least N distinct activities of a given **type** must be passed (seed or generated) |
| `skill_count` | At least N distinct passed activities whose `targets[]` include this **skill** tag |
| `translate_count` | N passed translate items (optional direction/length filters) |
| `paradigm_mastery` | N passed paradigm grids |

After every grade, the server runs `recomputeStandard()`:

1. Load all attempts for this user + lesson  
2. For each requirement, compute met / remaining  
3. If **all** met → write `lesson_completions` and unlock next lesson  

Statuses come from:

- **Deterministic graders** (matching, MC, multi-select, cloze, grids, single form)  
- **AI grader** (translate, short answer) returning `passed | partial | pending` + feedback + optional `issues[]`

So: AI may grade open answers, but **unlock is pure checklist math**.

### Skill tags

Activities carry `targets: ["noun", "verb", …]`. Generated remediation must include the weak skills in `targets` so `skill_count` requirements can be satisfied by **extra practice**, not only by one seed item.

Example standard:

```json
{
  "requirements": [
    { "type": "activity_passed", "activityId": "mc-pos-def" },
    { "type": "skill_count", "skill": "noun", "n": 3, "label": "noun identification" },
    { "type": "skill_count", "skill": "verb", "n": 3, "label": "verb identification" }
  ]
}
```

Passing three different noun-tagged activities (seed or generated) fills the noun skill bar.

---

## More practice (targeted, not “everything again”)

### When it runs

Student clicks **More practice (targeted)** (or the bottom CTA). Optional auto-nudge appears after a non-pass.

### What the server does

1. Recompute standard → list **unmet** requirements  
2. Build a **focus profile**:
   - `weakSkills` — from unmet `skill_count` and failed tagged items  
   - `weakTypes` — from unmet type counts  
   - `recentIssues` — from attempt `issues[]` (grader tags) + client last fails  
   - `failedPrompts` — recent non-pass prompts (style hints only)  
3. Generate **only** items aimed at that focus  
4. Cap per lesson (`GENERATION_MAX_PER_LESSON`, default 24)

### How items are built

**Layer 1 — Templates (no API key)**  
`src/lib/activities/remediate.ts` banks for:

- Parts of speech (match / multi-select)  
- Case meanings (match / MC)  
- 1st-declension single forms  

**Layer 2 — AI (OpenRouter)** if templates are not enough and `OPENROUTER_API_KEY` is set  

Prompt forces: *only weak skills*, required `targets[]`, allowed activity types and lemmas.

Off-target AI items are dropped.

### What it does *not* do

- Does not re-assign every seed  
- Does not mark the lesson complete without checklist pass  
- Does not invent new activity types outside the schema  
- Does not ignore allow-lists  

---

## Authoring tips for “a lot more practice”

1. Ship **many seeds** in the lesson (8–15 is fine for intro grammar).  
2. Prefer **`skill_count`** so generated items count toward the standard.  
3. Tag every activity with `targets`.  
4. Keep a few `activity_passed` anchors for must-do core items.  
5. Set `allowList.activityTypes` so remediation stays in the right formats.

---

## End-of-seed review (main coaching moment)

### Loop until standard met

```
Main seeds all checked
   → auto review (after_seeds)
        │
        ├─ met → congrats, unlock
        │
        └─ not met → coach + batch of extra questions
              │
              student checks every item in that batch
              │
              → auto review (after_extra)  ← repeats
                    │
                    ├─ met → congrats, unlock
                    └─ not met → new coach + new batch → …
```

1. **Every seed checked once** → auto `after_seeds` review  
2. **Recompute standard**  
3. **If met** → congratulations coaching; unlock  
4. **If not** → warm coaching (encourage → gaps → mini re-teach → “here are more questions”) + **one remediation batch**  
5. **Every item in that batch checked** → auto `after_extra` review again  
6. Repeat **4–5** until the standard is met (or generation cap is hit)  

Manual: **See how I did** / **Review now** if the student doesn’t want to wait for the full batch.

Per-item **Check** still updates the checklist live; batch completion triggers the structured coach loop.

---

## Student UX

- Standard panel shows ✓/○ and counts like `2/3 on “noun identification”`  
- After main set → **Coach** card + optional **Extra practice**  
- Tutor chat also receives the coach message for history  
- Tutor Q&A still does not auto-unlock  

---

## Implementation map

| Piece | File |
|-------|------|
| Standard eval | `src/lib/standard.ts` |
| Template remediation | `src/lib/activities/remediate.ts` |
| AI practice generation | `src/lib/ai/generate.ts` |
| Coach copy (AI + template) | `src/lib/ai/coach.ts` |
| End-of-set review API | `src/app/api/lessons/review/route.ts` |
| Grade → progress | `src/app/api/activities/grade/route.ts` |
| UI | `src/components/lesson/LessonClient.tsx` |
