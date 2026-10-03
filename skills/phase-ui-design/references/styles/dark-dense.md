# Style recipe - Dark dense

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
