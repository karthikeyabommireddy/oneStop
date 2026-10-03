# Style recipe - Maximalism

```css
.max { display: grid; grid-template-columns: repeat(12, 1fr); }  /* invisible, load-bearing */
.max__display { font-size: clamp(3rem, 12vw, 9rem); line-height: 0.9; }
.max__body    { font-size: 1.0625rem; max-width: 62ch; }        /* the calm column */
/* Text over imagery always gets a plate - never trust the photo to stay dark. */
.max__over-image { background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)); }
```

One region of every screen stays deliberately empty. That emptiness is what makes the
rest read as intentional rather than accidental.
