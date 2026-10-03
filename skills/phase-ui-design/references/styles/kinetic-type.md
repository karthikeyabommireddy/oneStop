# Style recipe - Kinetic type

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
