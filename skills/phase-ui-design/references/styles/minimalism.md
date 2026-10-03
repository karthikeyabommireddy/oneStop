# Style recipe - Minimalism

```css
:root { --space-1:.25rem; --space-2:.5rem; --space-4:1rem; --space-8:2rem; --space-16:4rem; }
h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
p  { font-size: 1rem; max-width: 68ch; }
.section { padding-block: var(--space-16); }   /* space does the dividing */
.input { border: 1px solid var(--border-interactive); }  /* never borderless */
```

The failure mode is low-contrast grey passed off as restraint. Verify, never estimate.
