# Style recipe - Glassmorphism

These carry a real cost. Ship the mitigation with the style or do not ship the style.

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
