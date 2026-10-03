# Style recipe - Spatial

The test first: does depth carry information a flat view could not? If not, flatten it.

```css
.scene { perspective: 1200px; }
.layer { transform: translateZ(var(--z, 0)); transition: transform 400ms cubic-bezier(.2, .8, .2, 1); }
.layer--near { --z: 60px; box-shadow: 0 30px 60px -20px color-mix(in oklch, black 35%, transparent); }
.layer--far  { --z: -40px; opacity: .85; }

@media (prefers-reduced-motion: reduce) {
  .scene { perspective: none; }
  .layer { transform: none; transition: none; }          /* flatten - do not merely slow */
}
```

A WebGPU or Three.js canvas always ships with an equivalent non-visual path - the same
data as a table or list in the DOM - and a 2D fallback where WebGPU is unavailable.
