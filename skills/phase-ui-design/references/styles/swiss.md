# Style recipe - Swiss

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
