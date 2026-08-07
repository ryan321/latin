# Typing Latin characters (macrons)

Long vowels (ā ē ī ō ū ȳ) appear in teaching charts. In this app, **macrons are optional** on most graded answers (normalized matching). Students can still type them for practice.

## In-app mini keyboard

On activities that need Latin text entry (paradigm grids, single forms, cloze, translate), a **Long vowels** strip appears under the field:

- Tap **ā ē ī ō ū ȳ** (and uppercase on some layouts)
- Character inserts at the caret of the focused field
- **Keyboard shortcuts** opens a short Mac / iPad cheatsheet

Full page: `/help/typing`

## Mac

1. **System Settings → Keyboard → Input Sources → +**
2. Add **ABC – Extended** (sometimes listed as “U.S. Extended”)
3. Switch to that input source when typing Latin
4. Dead-key macron: hold **Option (⌥)** + **a**, release, then type the vowel:

| Keys | Result |
|------|--------|
| ⌥a then a | ā |
| ⌥a then e | ē |
| ⌥a then i | ī |
| ⌥a then o | ō |
| ⌥a then u | ū |
| ⌥a then y | ȳ |
| ⌥a then Shift+vowel | Ā Ē Ī Ō Ū |

Leave the default U.S. layout for normal English typing; switch to ABC – Extended when doing Latin homework.

## iPad / iPhone

1. **Hold** a vowel key on the software keyboard until the accent popup appears
2. Slide to the long vowel (ā, ē, …) when available
3. Or **Settings → General → Keyboard → Keyboards → Add New Keyboard** and add a useful layout if your iPadOS version offers one
4. In Safari/this app, the **on-screen long-vowel buttons** are often the fastest option

## Windows (brief)

Use Character Map, a Latin keyboard layout, or a compose tool (e.g. WinCompose). Prefer the in-app mini keyboard during drills.

## Implementation notes

- Component: `src/components/latin-keyboard/LatinKeyboard.tsx`
- Wired from `ActivityCard` for `paradigm_grid`, `single_form`, `cloze`, `translate`
- Grading still accepts unmarked vowels via `stripMacrons` in `src/lib/normalize.ts`
