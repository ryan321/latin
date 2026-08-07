# Rich lesson content (MDX)

Teach material can use **MDX** with a Latin-focused component palette — same idea as `../education` lesson blocks (callouts, diagrams, media), tuned for paradigms, pronunciation, and Roman context.

## How content is loaded

For each lesson slug:

1. If `content/units/<unit>/lessons/<slug>.mdx` exists → **that file** is the teach body (preferred).
2. Else → JSON field `teach` (markdown/MDX string).

JSON still holds: title, standard, seeds, allowList, and a plain `teach` string used as **AI tutor context** (keep it accurate even when MDX is rich).

```
content/units/01-first-declension/lessons/
  01-puella-chart.json    # meta + seeds + teach (for AI)
  01-puella-chart.mdx     # rich student-facing body
```

## Component palette

Import nothing — components are injected by the renderer.

| Component | Purpose | Example props |
|-----------|---------|----------------|
| `KeyTerm` | Highlight a term | `<KeyTerm>ablative</KeyTerm>` |
| `Latin` | Inline Latin (serif italic) | `<Latin>puella</Latin>` |
| `Callout` | Note / remember / try / warning / example / culture | `kind="remember"` |
| `LatinExample` | Latin + English + optional note | `latin` `english` `note` |
| `ParadigmTable` | Full chart | `lemma` `headers` `rows` (pipe-delimited) |
| `EndingsStrip` | Chip row of endings | `label` `endings="a\|ae\|am"` |
| `SoundCard` | Pronunciation card | `letter` `ipa` `example` `tip` |
| `CaseCards` | Case → role grid | `items="Nom ~ subject\|Acc ~ object"` |
| `Compare` | Two-column contrast | `left` `right` `rows="a ~ b\|…"` |
| `Steps` | Numbered process | `steps="One\|Two\|Three"` |
| `FlowChart` | Horizontal flow | `steps="A\|B\|C"` |
| `MapCallout` | Culture / place box | `title` + children |
| `VowelChart` | Short vs long vowels | `short="a\|e\|…"` `long="ā\|ē\|…"` |
| `LetterRow` | Chip row of letters/diphthongs | `letters="ae\|au\|oe"` |
| `Image` / `Video` | Media | `src` `alt` / `caption` |

Prefer `VowelChart` / `ParadigmTable` over raw markdown tables in MDX — GFM tables can flatten under MDX.

Array-like props use **pipe-delimited strings** (MDX-friendly), same convention as education diagrams.

### ParadigmTable detail

```mdx
<ParadigmTable
  lemma="puella, puellae f."
  headers="Case|Singular|Plural"
  rows="Nominative|puella|puellae|Genitive|puellae|puellārum|Dative|puellae|puellīs|Accusative|puellam|puellās|Ablative|puellā|puellīs"
/>
```

Cells are **row-major**: for each row, one cell per header column.

### Callout kinds

`note` · `remember` · `try` · `warning` · `example` · `culture`

## Markdown still works

Headings, lists, tables, bold/italic, links — GFM via `remark-gfm`.

You can mix:

```mdx
## Title

Paragraph with <KeyTerm>genitive</KeyTerm>.

<LatinExample latin="…" english="…" />
```

## Raw HTML / Tailwind

MDX allows limited HTML with `className` for one-off layouts (e.g. two-column cards). Prefer palette components when possible so styling stays consistent.

## Adding a new visual type

1. Add a React component in `src/components/lesson-blocks/index.tsx`.
2. Export it on `lessonComponents`.
3. Document it in this file.
4. Use it in a lesson `.mdx`.

No lesson JSON change required for new visuals.

## Assets

Put static files under `public/` (e.g. `public/lessons/map-italy.svg`) and reference:

```mdx
<Image src="/lessons/map-italy.svg" alt="Map of Italy" caption="Italia" />
```

(Optional later: content-local assets via an API route like education’s `/api/content/...`.)
