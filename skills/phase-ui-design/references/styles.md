# Reference - Style recipes (index)

Selection data and accessibility notes live in
`${CLAUDE_PLUGIN_ROOT}/registry/ui-styles.json`. This is the code.

Every recipe assumes tokens, not literals. The hex values below are illustrative - in a
real build they are `var(--surface)`, `var(--accent)` and so on, so a rebrand is a token
change rather than a search-and-replace.

---

Read only the recipe for the style you bound - one file each, under `styles/`:

| Style | Recipe |
|---|---|
| Minimalism | `styles/minimalism.md` |
| Maximalism | `styles/maximalism.md` |
| Glassmorphism | `styles/glassmorphism.md` |
| Neumorphism | `styles/neumorphism.md` |
| Claymorphism | `styles/claymorphism.md` |
| Brutalism | `styles/brutalism.md` |
| Neo-brutalism | `styles/neo-brutalism.md` |
| Skeuomorphism | `styles/skeuomorphism.md` |
| Flat design 2.0 | `styles/flat.md` |
| Material Design 3 | `styles/material.md` |
| Bento | `styles/bento.md` |
| Y2K | `styles/y2k.md` |
| Retro | `styles/retro.md` |
| Cyberpunk | `styles/cyberpunk.md` |
| Editorial | `styles/editorial.md` |
| Liquid glass | `styles/liquid-glass.md` |
| Swiss | `styles/swiss.md` |
| Spatial | `styles/spatial.md` |
| Generative UI | `styles/generative-ui.md` |
| Aurora | `styles/aurora.md` |
| Kinetic type | `styles/kinetic-type.md` |
| Dark dense | `styles/dark-dense.md` |

## Before handing off, whatever the style

- [ ] Every colour pair measured, not estimated - 4.5:1 body, 3:1 interactive boundaries
- [ ] The style's own named mitigation is implemented, not merely noted
- [ ] `:focus-visible` on every interactive element, distinct from the resting border
- [ ] `prefers-reduced-motion` honoured by reducing motion, never by removing feedback
- [ ] Hit targets at least 44x44px regardless of visual size
- [ ] Dark mode designed, not inverted - elevation lightens, accents lose chroma
- [ ] Every value a token; not one literal colour inside a component
- [ ] Rest, hover, active, focus, disabled, loading, error and empty all specified
