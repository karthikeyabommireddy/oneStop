# Style recipe - Editorial

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
