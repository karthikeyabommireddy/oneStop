# Style recipe - Flat design 2.0

```css
/* Flat 2.0 exists because pure flat removed the cue that said "clickable". */
.btn { background: var(--accent); color: var(--on-accent); border-radius: 6px;
       box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.btn:hover  { background: var(--accent-hover); }
.btn:active { background: var(--accent-active); box-shadow: none; }
.input { border: 1px solid var(--border-interactive); }   /* affordance, restored */
```

Every actionable element needs at least two of: contrasting fill, border, elevation.
