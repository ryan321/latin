# Activity types (evaluation)

All practice is an **Activity** object: seed or AI-generated. The UI and grader dispatch on `type`.

## Catalog

| Type | Student does | Graded by | Typical Latin use |
|------|--------------|-----------|-------------------|
| `paradigm_grid` | Fill a case/person chart | Rules | Declensions, conjugations |
| `single_form` | Type one form | Rules | “Gen. sg. of *via*” |
| `translate` | L→E or E→L free text | AI | Sentences, phrases, glosses |
| `short_answer` | Free explanation | AI | Why this case? Culture reflection |
| `multiple_choice` | Pick one option | Rules | Quick recognition |
| `matching` | Pair left items with right | Rules | Case↔job, letter↔sound, lemma↔gloss |
| `ordering` | Reorder a list (↑↓) | Rules | Stress steps, principal parts order |
| `multi_select` | Check all that apply | Rules | “Which letters stay hard?” |
| `cloze` | Fill `{{1}}` blanks in a sentence | Rules | Guided production with word bank |

### Optional `passage` on any activity

Any activity may include a **`passage`** object so the student sees continuous Latin above the question (reading comprehension):

```json
"passage": {
  "title": "In the villa",
  "latin": "Puella in villā est.\nFēmina quoque est.",
  "notes": "Optional gloss line"
}
```

Use the same passage on every question in a passage lesson. See `docs/reading-passages.md`.

## Payload sketches

### matching

```json
{
  "type": "matching",
  "prompt": "Match each case to its job.",
  "payload": {
    "leftLabel": "Case",
    "rightLabel": "Job",
    "left": [{ "id": "nom", "label": "Nominative" }],
    "right": [{ "id": "subject", "label": "Subject of the verb" }],
    "pairs": { "nom": "subject" }
  }
}
```

Response: `{ "pairs": { "nom": "subject" } }`

Left/right labels may mark a target word with `**word**` (preferred) or `__word__` — both render as **bold amber** in the UI (e.g. `"The **girl** runs."`).

### ordering

```json
{
  "type": "ordering",
  "payload": {
    "items": [
      { "id": "a", "label": "First step" },
      { "id": "b", "label": "Second step" }
    ],
    "correctOrder": ["a", "b"]
  }
}
```

Response: `{ "order": ["a", "b"] }` — UI shuffles on load.

### multi_select

```json
{
  "type": "multi_select",
  "payload": {
    "options": [
      { "id": "c", "label": "c" },
      { "id": "g", "label": "g" }
    ],
    "correctOptionIds": ["c", "g"]
  }
}
```

Response: `{ "optionIds": ["c", "g"] }`

### cloze

```json
{
  "type": "cloze",
  "payload": {
    "template": "Puella in {{1}} {{2}}.",
    "blanks": {
      "1": ["villa", "villā"],
      "2": ["est"]
    },
    "wordBank": ["est", "villa", "spectat"]
  }
}
```

Response: `{ "blanks": { "1": "villa", "2": "est" } }`

## Adding a new type

1. Add enum value + Zod payload in `src/types/activity.ts`
2. Grade path in `src/lib/grade/dispatch.ts` (prefer deterministic when possible)
3. UI branch in `src/components/activities/ActivityCard.tsx`
4. Document here + allow in lesson `allowList.activityTypes` if AI may generate it
5. Optionally teach the generate prompt about the new shape

## Design notes

- Prefer **structured deterministic** types for forms and recognition; reserve **AI** for open production and explanation.
- Same status model everywhere: `passed` | `partial` | `pending`.
- New interaction patterns (drag-and-drop match, timed drills) can share these payloads with a richer UI later.
