# Vocabulary strand

Grammar alone is not enough. Students need **periodic vocabulary lessons**, **drills/quizzes**, and **recycling** in passages and grammar practice.

## Design

| Piece | Role |
|-------|------|
| `content/vocab/year1-batches.json` | Master batches + cumulative quizzes |
| Vocab lessons (`vocab-v…`) | Teach a set; matching both ways, MC, type gloss, word translate |
| Vocab quizzes (`vocab-vr…`) | Cumulative review under quiz pressure |
| Passages | Use taught words; light notes only for leftovers |
| Grammar `allowList.lemmas` | Keeps AI practice inside known words |

## Cadence (Year 1)

Roughly **one vocab batch per major grammar unit**, then a **cumulative quiz** every few batches:

1. Family & places (1st decl)  
2. Being & daily actions (*sum* + 1st conj)  
3. Men, tools & war (2nd decl)  
4. Describing words (adjectives) → **quiz: early core**  
5. Warn/see/have (2nd conj)  
6. Time words (for tense stories)  
7. Kings/soldiers/nature (3rd decl)  
8. Army verbs (3rd conj)  
9. Story & foundation → **quiz: mid-year**  
10. Travel & people (preps)  
11. Public life & law  
12. Empire & provinces → **quiz: late**  
13. Pronoun toolkit (*ego, hic, sē, suus, quis…*)  
14. Capstone **Year 1 core quiz**

~**130+** high-frequency entries in v1 bank (expandable toward 350–450).

## Drill types (every vocab lesson)

- Matching Latin → English (often two sets)  
- Matching English → Latin  
- Multiple choice “what does X mean?”  
- Type the English gloss (`single_form`)  
- Word translate L2E (and quiz E2L)  
- Multi-select (e.g. pick the verbs) when POS is mixed  
- Short reflection / use-in-a-sentence  

Standards use `skill_count` on **`vocabulary`** (and **`vocab quiz`** on reviews).

## Progressive use

1. **Learn** the batch with drills until standard met.  
2. **Meet** the words again in that unit’s **passage**.  
3. **Reuse** in later grammar allow-lists and mid/late quizzes.  
4. Capstone quiz samples the full year.

## Authoring rules

- Prefer **high-frequency** words that appear in passages.  
- Dictionary line in the list: genitive/gender or principal parts.  
- Glosses: short primary meaning; accept common synonyms in graders.  
- Do not introduce a passage full of untaught lemmas—either teach the batch first or gloss sparingly.  
- Add new batches to `year1-batches.json` and generate a lesson (same drill pattern).

## MDX

Use `<VocabList items="lemma — gloss (info)|..." />` on teach screens.
