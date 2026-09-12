# Reference - The fifteen styles, as CSS

Selection data and accessibility notes live in
`${CLAUDE_PLUGIN_ROOT}/registry/ui-styles.json`. This is the code.

Every recipe assumes tokens, not literals. The hex values below are illustrative - in a
real build they are `var(--surface)`, `var(--accent)` and so on, so a rebrand is a token
change rather than a search-and-replace.

---

## The three that fail contrast if you are careless

These carry a real cost. Ship the mitigation with the style or do not ship the style.

### Glassmorphism

```css
.glass {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);          /* 8-15px; cost climbs sharply above */
  -webkit-backdrop-filter: blur(12px);  /* Safari still wants the prefix */
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
}

/* The fallback is SOLID, never transparent - unreadable is worse than unfashionable. */
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: rgba(20, 20, 28, 0.92); }
}

/* Guarantee contrast regardless of what scrolls underneath. */
.glass__text { background: rgba(10, 10, 16, 0.55); border-radius: 8px; padding: 0.5rem; }

@media (prefers-reduced-transparency: reduce) {
  .glass { background: var(--surface); backdrop-filter: none; }
}
```

Budget: 2-3 glass elements per viewport, 6-8px blur on mobile. **Never animate a
backdrop-filtered element** - it re-renders the blur every frame.

### Neumorphism

```css
.neu {
  background: var(--base);              /* identical to the parent - that is the style */
  box-shadow: 9px 9px 18px #bec3c9, -9px -9px 18px #ffffff;
  border-radius: 16px;

  /* The mitigation, not optional: the boundary otherwise has zero contrast. */
  border: 1px solid rgba(0, 0, 0, 0.12);
  min-height: 44px; min-width: 44px;
}
.neu:active { box-shadow: inset 9px 9px 18px #bec3c9, inset -9px -9px 18px #ffffff; }
.neu:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
```

One light direction for the entire interface. Two light sources is the tell of a
cargo-culted implementation.

### Cyberpunk

```css
:root { --ground: #05050a; --cyan: #22d3ee; --pink: #f472b6; }

body { background: var(--ground); color: rgba(255,255,255,0.88);
       font-family: 'JetBrains Mono', ui-monospace, monospace; }

/* ONE loud element per page. Neon everywhere is neon nowhere. */
.focal { border: 1px solid var(--cyan);
         box-shadow: 0 0 0 1px rgba(34,211,238,0.35), 0 0 24px rgba(34,211,238,0.25); }
.panel { border: 1px solid rgba(255,255,255,0.10); }   /* everything else is quiet */

@media (prefers-reduced-motion: reduce) { .glitch, .scanlines { animation: none; } }
```

Near-black (`#05050a`), not `#000` - pure black with pure neon is the maximum-eye-strain
combination. Accent coverage stays at 10-15% of the surface. Body text must not drop
below 0.45 opacity.

---

## The bold ones

### Neo-brutalism

```css
.nb {
  border: 3px solid #0f172a;
  box-shadow: 6px 6px 0 0 #0f172a;      /* zero blur, zero spread - solid block */
  border-radius: 4px;
  background: #facc15;
  transition: transform 80ms, box-shadow 80ms;
}
/* Press distance EXACTLY equals the shadow offset. A mismatch is the giveaway. */
.nb:active { transform: translate(6px, 6px); box-shadow: 0 0 0 0 #0f172a; }
/* The border cannot double as focus - it is already there. Offset outline instead. */
.nb:focus-visible { outline: 3px solid #2563eb; outline-offset: 4px; }
```

Yellow with white text fails badly - check every saturated fill against its text.

### Brutalism

```css
/* Start from the default stylesheet and resist overriding it. */
body { font-family: ui-monospace, monospace; max-width: 70ch; margin: 2rem auto;
       padding: 0 1rem; line-height: 1.6; }
a { color: #0000ee; }                    /* the default link colour is a feature */
/* Buttons and inputs stay native: correct semantics and keyboard behaviour for free. */
:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
```

The two real risks are a measure running the full window width, and stripped focus
styles. Both are fixed above.

### Maximalism

```css
.max { display: grid; grid-template-columns: repeat(12, 1fr); }  /* invisible, load-bearing */
.max__display { font-size: clamp(3rem, 12vw, 9rem); line-height: 0.9; }
.max__body    { font-size: 1.0625rem; max-width: 62ch; }        /* the calm column */
/* Text over imagery always gets a plate - never trust the photo to stay dark. */
.max__over-image { background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)); }
```

One region of every screen stays deliberately empty. That emptiness is what makes the
rest read as intentional rather than accidental.

---

## The soft ones

### Claymorphism

```css
.clay {
  border-radius: 32px;
  background: #f0a6ca;                   /* differs from the ground - unlike neumorphism */
  box-shadow:
    0 16px 32px rgba(0, 0, 0, 0.12),               /* lift */
    inset -8px -8px 16px rgba(0, 0, 0, 0.10),      /* volume, away from the light */
    inset  8px  8px 16px rgba(255, 255, 255, 0.55);/* highlight, toward the light */
}
```

Because the surface differs from the background it keeps its contrast and its affordance
- which is the whole reason it is safer than neumorphism.

### Skeuomorphism

Selective, not decorative: depth only where it communicates something flat could not.

```css
.knob  { background: radial-gradient(circle at 30% 25%, #6b7280, #1f2937 70%);
         border-radius: 50%;
         box-shadow: 0 4px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3); }
.panel { background-image: var(--texture); background-blend-mode: overlay; }
.panel__label { background: var(--surface); }  /* type sits on a flat plate, never texture */
```

A realistic knob is not keyboard-operable on its own. Put a real `<input type="range">`
underneath it with an accessible name and arrow-key support.

---

## The systems

### Flat design 2.0

```css
/* Flat 2.0 exists because pure flat removed the cue that said "clickable". */
.btn { background: var(--accent); color: var(--on-accent); border-radius: 6px;
       box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.btn:hover  { background: var(--accent-hover); }
.btn:active { background: var(--accent-active); box-shadow: none; }
.input { border: 1px solid var(--border-interactive); }   /* affordance, restored */
```

Every actionable element needs at least two of: contrasting fill, border, elevation.

### Material Design 3

Adopt the token layer; do not imitate the look. Hard-coding hex values into Material
components breaks the contrast guarantees the tonal palette exists to provide.

```css
:root {
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-color-primary: #6750a4;      /* generated by Material Theme Builder */
}
.card { border-radius: var(--md-sys-shape-corner-medium); }
```

### Minimalism

```css
:root { --space-1:.25rem; --space-2:.5rem; --space-4:1rem; --space-8:2rem; --space-16:4rem; }
h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
p  { font-size: 1rem; max-width: 68ch; }
.section { padding-block: var(--space-16); }   /* space does the dividing */
.input { border: 1px solid var(--border-interactive); }  /* never borderless */
```

The failure mode is low-contrast grey passed off as restraint. Verify, never estimate.

---

## The layouts

### Bento

```css
.bento { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1rem; }
.bento__tile--hero      { grid-column: span 8; grid-row: span 2; }
.bento__tile--secondary { grid-column: span 4; }
.bento__tile--small     { grid-column: span 4; }

@media (max-width: 720px) {
  .bento { grid-template-columns: 1fr; }
  .bento__tile { grid-column: auto; grid-row: auto; }   /* priority order = DOM order */
}
```

Decide what matters most **first**, then assign spans - a bento grid whose tile sizes do
not encode importance is just an uneven layout. DOM order must match visual priority, or
keyboard and screen-reader users receive the page in a meaningless sequence. Each tile
gets a real heading, and a fully-clickable tile still needs one focusable element with an
accessible name.

### Editorial

```css
.article { display: grid; grid-template-columns: repeat(8, 1fr); gap: 1.5rem; }
.article > *        { grid-column: 3 / 7; }              /* the reading column */
.article > figure   { grid-column: 1 / -1; }             /* full bleed, to the grid */
.article > .pull    { grid-column: 1 / 3; }

p  { font-size: 1.125rem; line-height: 1.55; max-width: 68ch; }  /* 50-75 characters */
h1 { font-size: clamp(2.5rem, 6vw, 4rem); }                      /* scale is the hierarchy */
```

Size in `rem` so user font-size settings are honoured. Pull quotes and captions are the
usual contrast offenders - they get set light on purpose and fail.

---

## The nostalgic ones

### Y2K

```css
.chrome-text {
  background: linear-gradient(180deg, #eef2f7 0%, #9aa6b2 45%, #f0f4f8 52%, #6b7280 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-weight: 900; letter-spacing: -0.02em;
}
```

**Display sizes only.** Chrome gradient text is unreadable at body size - keep body copy
flat and high-contrast, and never put essential information inside a gradient-filled or
distorted element. Gate glitch and scan-line animation behind `prefers-reduced-motion`.

### Retro

```css
/* Pick ONE decade. Mixing eras is what makes retro read as generic. */
:root {  /* 1970s */
  --mustard:#d4a017; --burnt:#cc5500; --avocado:#568203; --chocolate:#3d2b1f;
}
.grain::after { content:''; position:absolute; inset:0; opacity:.08;
                background-image: var(--grain); pointer-events:none; }
h1 { font-family: 'Cooper', serif; }
p  { font-family: system-ui; color: #2a1d12; }   /* darker than the era ever printed */
```

Period palettes fail contrast easily - keep the era hues for surfaces and ornament, and
darken the text past what the decade actually used. The grain overlay sits *behind* text,
never over it.

---

## Before handing off, whatever the style

- [ ] Every colour pair measured, not estimated - 4.5:1 body, 3:1 interactive boundaries
- [ ] The style's own named mitigation is implemented, not merely noted
- [ ] `:focus-visible` on every interactive element, distinct from the resting border
- [ ] `prefers-reduced-motion` honoured by reducing motion, never by removing feedback
- [ ] Hit targets at least 44x44px regardless of visual size
- [ ] Dark mode designed, not inverted - elevation lightens, accents lose chroma
- [ ] Every value a token; not one literal colour inside a component
- [ ] Rest, hover, active, focus, disabled, loading, error and empty all specified
