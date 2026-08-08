# Lesson media (images & artwork)

Yes — lessons can include pictures. Teach bodies are **MDX**, and the palette already includes media components.

## How to add an image to a lesson

1. Put the file under **`public/media/`** (served at URL `/media/…`).
2. Reference it in the lesson `.mdx` with `<Image>` or `<Scene>`.

```mdx
<Scene
  src="/media/lessons/00-foundations/rome-tiber.jpg"
  alt="Rome on hills beside the Tiber River"
  title="Roman world"
  caption="Rome grew on the Tiber, inland from the west coast of Italy."
  credit="Course illustration"
/>

<Image
  src="/media/shared/villa-courtyard.jpg"
  alt="Atrium of a Roman country house"
  caption="A villa might have a courtyard and rooms around a central space."
  variant="default"
/>
```

### Components

| Component | Use |
|-----------|-----|
| `Image` | General figure; `variant="hero" \| "default" \| "inline"` |
| `Scene` | Culture / story beat with optional title strip |
| `Video` | Optional short clips (`src`, `poster`, `caption`) |

Always set meaningful **`alt`** text (accessibility + screen readers).

## Folder convention

```
public/media/
  shared/                 # reused across units (villa, forum, camp…)
  lessons/
    00-foundations/
    03-first-declension/
    …
  vocab/                  # optional lemma icons later
```

**URL path** = path under `public`, e.g. file `public/media/shared/x.jpg` → `/media/shared/x.jpg`.

Prefer **WebP or JPEG** for photos/illustrations; **SVG** for maps and labeled diagrams.

## What kind of art fits this course

| Good | Avoid |
|------|--------|
| Roman daily life, villa, forum, camp, roads | Random stock that doesn’t match the lesson |
| Clear, calm educational illustration | Busy memes / cluttered screenshots |
| Maps and simple diagrams (**prefer SVG/code** for accurate labels) | AI maps with invented place names |
| Culture callouts next to grammar | Decorative noise that distracts from the standard |

**Grammar charts** stay as `ParadigmTable` / components — not screenshots of textbooks.

## Where images help most

- **Foundations / culture** — Italy, Tiber, Rome  
- **Family & villa** — household scenes for 1st declension  
- **Army & camp** — 3rd conjugation / perfect narrative  
- **Forum / temples** — demonstratives, public life  
- **Provinces** — empire map (SVG preferred)  
- **Vocab** — optional small scene per batch, not one icon per word  

Passages can open with a **Scene** so reading feels placed in a world.

## Sources

1. **Course art** — generate or commission illustrations; credit “Course illustration”.  
2. **Public domain / CC** — Wikimedia, museums (check license; keep attribution in `credit`).  
3. **Your own photos** — trips, models, etc.

Do **not** paste copyrighted textbook plates or paid stock without a license.

## Optional JSON (for future galleries)

Not required today. If useful later:

```json
"media": [
  { "src": "/media/…", "alt": "…", "caption": "…", "role": "hero" }
]
```

For now, **MDX is the source of truth** for placement.

## Workflow tip

When authoring a unit, ask: *Is there one picture that makes this lesson’s world clearer?*  
If yes, add **one** strong image near the top or culture callout — not a slideshow.
