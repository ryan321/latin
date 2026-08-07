# Reading passages

Students must get **skilled at reading continuous Latin**, not only isolated forms. Passages are **lesson-appropriate**: only grammar and vocab the student has met (or lightly glossed).

## Design

1. **Teach** shows the passage (`<ReadingPassage>`).
2. **Practice** repeats the same passage on each question via the activity `passage` field (title, latin, optional notes).
3. Questions mix:
   - comprehension (who/what/where/when)
   - grammar-in-context (tense, case, antecedent, voice)
   - short translate of a line from the passage
   - summary / short answer

## Progression (Year 1)

| Stage | Typical length | Grammar focus |
|-------|----------------|---------------|
| After 1st decl + *sum* | 3–4 short sentences | Nom, *est/sunt*, *in* + abl |
| After 1st conj | 4 sentences | Present active, acc objects |
| After 2nd decl / adjectives | 4 sentences | *-us/-um*, agreement |
| After imperfect / future | 4 sentences | Tense meaning in story |
| After 3rd decl / 3rd conj | 4–5 sentences | New nouns/verbs in context |
| After perfect | 4–5 sentences | Perfect vs imperfect vs pluperfect |
| After prep/pronouns / demos | 4 sentences | *ad/ab/cum*, *hic/ille* |
| After relative | 4 sentences | *quī* + antecedent |
| After passive | 4 sentences | Passive + agent |
| Reading unit / capstone | 5+ sentences | Mixed Year 1 |

## Activity `passage` field

```json
{
  "type": "multiple_choice",
  "prompt": "According to the passage, where is the girl?",
  "passage": {
    "title": "In the villa",
    "latin": "Puella in villā est.\nFēmina quoque in villā est.",
    "notes": "Optional gloss line"
  },
  "payload": { "options": [], "correctOptionId": "b" }
}
```

The UI renders the passage above every question that includes it.

## Authoring rules

- **Comprehensible input first** — student should understand ~most of the passage.
- Gloss rare words in `notes`, not a dictionary dump.
- Prefer **story** (someone does something) over random disconnected sentences.
- At least one question must require **reading the whole**, not a single memorized line.
- Keep building the habit: every major grammar arc gets a passage lesson before or at the checkpoint.

## Standards

Passage lessons use `skill_count` on `"passage reading"` plus required comprehension activities. AI remediation may generate more passage-linked questions when that skill is weak.

## Vocabulary first

Passage lessons should follow the unit’s **vocabulary batch** when one exists, so students read known words. Gloss only leftovers in `passage.notes`.

