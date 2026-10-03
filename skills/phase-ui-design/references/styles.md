# Reference - Style Recipes (CSS)

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

## The current generation

### Liquid glass

On Apple platforms, use the system material - in SwiftUI, the glass effect modifiers that
arrived with iOS 26. It reacts to content, scroll and ambient light in ways CSS cannot
reproduce. On the web, approximate it and say that it is an approximation:

```css
/* Chrome only - toolbars, tab bars, floating controls. Content stays on opaque surfaces. */
.liquid-glass {
  background: color-mix(in oklch, var(--surface) 55%, transparent);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid color-mix(in oklch, white 22%, transparent);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 color-mix(in oklch, white 45%, transparent),   /* the specular edge */
    inset 0 -1px 0 color-mix(in oklch, black 12%, transparent),
    0 8px 24px color-mix(in oklch, black 18%, transparent);
}

@supports not (backdrop-filter: blur(1px)) {
  .liquid-glass { background: var(--surface); }
}

@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .liquid-glass { background: var(--surface); backdrop-filter: none; border-color: var(--border-strong); }
}
```

Body text never sits on the material. Same budget as glassmorphism: a few elements per
viewport, and never an animated backdrop filter.

### Swiss

```css
.swiss {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--space-6);
  font-family: var(--font-sans);           /* one family: Inter, Helvetica Neue, a modern grotesk */
}
.swiss__title { grid-column: 1 / span 7; font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
.swiss__meta  { grid-column: 9 / span 4; align-self: end; font-weight: 500; }   /* asymmetry inside the grid */
.swiss__body  { grid-column: 3 / span 6; max-width: 70ch; text-align: start; hyphens: auto; }
.swiss :where(*) { border-radius: 0; box-shadow: none; }

@media (max-width: 40rem) {
  .swiss > * { grid-column: 1 / -1; }      /* a minimum column width keeps ragged lines readable */
}
```

Hierarchy comes from position and scale. Remove every colour: if the hierarchy goes with
it, the layout is not Swiss.

### Spatial

The test first: does depth carry information a flat view could not? If not, flatten it.

```css
.scene { perspective: 1200px; }
.layer { transform: translateZ(var(--z, 0)); transition: transform 400ms cubic-bezier(.2, .8, .2, 1); }
.layer--near { --z: 60px; box-shadow: 0 30px 60px -20px color-mix(in oklch, black 35%, transparent); }
.layer--far  { --z: -40px; opacity: .85; }

@media (prefers-reduced-motion: reduce) {
  .scene { perspective: none; }
  .layer { transform: none; transition: none; }          /* flatten - do not merely slow */
}
```

A WebGPU or Three.js canvas always ships with an equivalent non-visual path - the same
data as a table or list in the DOM - and a 2D fallback where WebGPU is unavailable.

### Generative UI

The style is a contract more than a look. The agent chooses from a catalogue of
pre-approved components and passes structured props; it never emits markup.

```tsx
const catalogue = { OrderSummary, FlightOptions, ConfirmDialog } as const;

function renderSurface(surface: { component: string; props: unknown }) {
  if (!(surface.component in catalogue)) return <Fallback />;              // unknown names fail closed
  const Component = catalogue[surface.component as keyof typeof catalogue];
  const props = schemas[surface.component].parse(surface.props);         // validated before render
  return <Component {...props} />;
}
```

```css
.surface--generated { animation: settle 180ms ease-out; }
@keyframes settle { from { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .surface--generated { animation: none; } }
```

Announce agent progress in a `role="status"` live region, and move focus deliberately to
each new surface. Tight, structured cards where actions are irreversible; looser surfaces
only where exploration is the point.

### Aurora

```css
.aurora { position: relative; isolation: isolate; overflow: hidden; background: var(--ground-deep); }
.aurora::before,
.aurora::after {
  content: "";
  position: absolute;
  inset: -20%;
  z-index: -1;
  filter: blur(80px);
  animation: drift 12s ease-in-out infinite alternate;
}
.aurora::before {
  background:
    radial-gradient(40% 50% at 20% 30%, oklch(0.62 0.20 300 / .55), transparent 70%),
    radial-gradient(35% 45% at 80% 20%, oklch(0.70 0.16 200 / .45), transparent 70%);
}
.aurora::after {
  background: radial-gradient(45% 40% at 60% 80%, oklch(0.68 0.18 150 / .35), transparent 70%);
  animation-duration: 16s;
}
@keyframes drift { to { transform: translate3d(4%, -3%, 0) scale(1.05); } }

.aurora__panel { background: color-mix(in oklch, var(--surface) 88%, transparent); border-radius: 20px; }

@media (prefers-reduced-motion: reduce) {
  .aurora::before, .aurora::after { animation: none; }   /* freeze the motion, keep the colour */
}
```

Text always sits on a panel - the gradient moves, so its contrast against any word moves
with it. One aurora region per page.

### Kinetic type

```css
.kinetic { font-family: var(--font-display-variable); font-variation-settings: "wght" 700; }

@supports (animation-timeline: view()) {
  .kinetic {
    animation: rise linear both;
    animation-timeline: view();
    animation-range: entry 10% cover 40%;
  }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(0.4em); font-variation-settings: "wght" 300; }
  to   { opacity: 1; transform: none; font-variation-settings: "wght" 700; }
}

@media (prefers-reduced-motion: reduce) {
  .kinetic { animation: none; }                          /* the final state, immediately */
}
```

When a phrase is split into per-letter spans for animation, the whole phrase keeps its
accessible name: `aria-label` on the element, `aria-hidden="true"` on the spans. Display
type only - body copy never moves.

### Dark dense

```css
:root[data-theme="dark"] {
  --surface-0: oklch(0.17 0.01 260);
  --surface-1: oklch(0.21 0.01 260);   /* elevation lightens the surface; no shadows */
  --surface-2: oklch(0.25 0.012 260);
  --text: oklch(0.93 0.005 260);       /* not pure white on pure black */
  --text-muted: oklch(0.72 0.01 260);
  --positive: oklch(0.78 0.15 155);    /* tuned for a dark ground */
  --negative: oklch(0.70 0.17 25);
}
.dense-table { font-size: 0.875rem; font-weight: 500; line-height: 1.35; font-variant-numeric: tabular-nums; }
.dense-table :is(td, th) { padding: 0.375rem 0.75rem; border-bottom: 1px solid var(--surface-2); }

/* A second cue besides colour, with alternative text for screen readers. */
.delta--up::before   { content: "▲ " / "up "; color: var(--positive); }
.delta--down::before { content: "▼ " / "down "; color: var(--negative); }
```

Measure the dark theme on its own: a pair that passes on light often fails here.

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
