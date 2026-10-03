# Style recipe - Retro

```css
/* Pick ONE decade. Mixing eras is what makes retro read as generic. */
:root {  /* 1970s */
  --mustard:#d4a017; --burnt:#cc5500; --avocado:#568203; --chocolate:#3d2b1f;
}
.grain::after { content:''; position:absolute; inset:0; opacity:.08;
                background-image: var(--grain); pointer-events:none; }
h1 { font-family: 'Cooper', serif; }
p  { font-family: system-ui; color: #2a1d12; }   /* darker than the era ever printed */
```

Period palettes fail contrast easily - keep the era hues for surfaces and ornament, and
darken the text past what the decade actually used. The grain overlay sits *behind* text,
never over it.
