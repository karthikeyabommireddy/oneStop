# Style recipe - Bento

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
