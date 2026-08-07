# Flashcards (optional practice)

Flashcards are **practice only**. They do **not** count toward lesson standards or unlock the next lesson.

## Where they appear

1. **End of each lesson** — deck built automatically from that lesson’s material.  
2. **`/practice/flashcards`** — **vocabulary lessons only**; build a deck, or practice **words you’re weak on**.

Nav: **Flashcards** in the top bar.

## How cards are built (dynamic)

**Direction is chosen when building the deck** (on `/practice/flashcards`):  
**Show first: Latin | English**. Default is Latin first → English on flip.  
English first → Latin on flip is for production practice. Stored cards stay Latin|English pairs either way.

| Source | Card shape |
|--------|------------|
| Matching (L→E) | Latin → English gloss |
| MC “What does **x** mean?” | lemma → correct gloss |
| Single form (English of lemma) | lemma → answer |
| Word translate L2E | Latin word → sample English |
| `allowList.lemmas` | lemma → gloss from `content/vocab/year1-batches.json` |

We do **not** add reverse English→Latin cards by default. Same Latin|English pair merges under one **card key**.

## Success tracking

Table `flashcard_progress` (per user + card key):

- `correctCount` / `wrongCount`
- `streak`
- `lastResult` (`know` | `again`)
- `sourceLessons` (which lessons contributed)

Session flow:

1. **Flip card** — see the answer (grade buttons stay locked until flip)  
2. **Got it right** / **Got it wrong** — records success, shows next card  
   - Wrong puts the card back at the end of the stack for another try  

Stack controls:

- **Restart deck** — full original deck, fresh session counts  
- **Shuffle remaining** — randomize cards not yet graded this pass  
- **Edit stack** — remove individual cards from this practice  
- **Change lessons** / **More lessons…** — pick a different set of sources  

Deck order prefers weaker cards first when first built.

## APIs

- `GET /api/flashcards/deck?lessons=slug1,slug2`  
- `POST /api/flashcards/result` `{ cardKey, front, back, result, sourceLesson? }`

## Schema

Run DB migrate/push after pull so `flashcard_progress` exists:

```bash
npm run db:push
# or
npm run db:generate && npm run db:migrate
```
