# Style recipe - Brutalism

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
