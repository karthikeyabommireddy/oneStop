# Style recipe - Liquid glass

On Apple platforms, use the system material - in SwiftUI, the glass effect modifiers that
arrived with iOS 26. It reacts to content, scroll and ambient light in ways CSS cannot
reproduce. On the web, approximate it and say that it is an approximation:

```css
/* Chrome only - toolbars, tab bars, floating controls. Content stays on opaque surfaces. */
.liquid-glass {
  background: color-mix(in oklch, var(--surface) 55%, transparent);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid color-mix(in oklch, white 22%, transparent);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 color-mix(in oklch, white 45%, transparent),   /* the specular edge */
    inset 0 -1px 0 color-mix(in oklch, black 12%, transparent),
    0 8px 24px color-mix(in oklch, black 18%, transparent);
}

@supports not (backdrop-filter: blur(1px)) {
  .liquid-glass { background: var(--surface); }
}

@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .liquid-glass { background: var(--surface); backdrop-filter: none; border-color: var(--border-strong); }
}
```

Body text never sits on the material. Same budget as glassmorphism: a few elements per
viewport, and never an animated backdrop filter.
