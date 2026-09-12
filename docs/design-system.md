# Design direction

When a change touches UI, onestop runs a `ui-design` phase before any component is
written. It produces design tokens - never colours scattered through components.

## Colour follows the domain

A palette that fights its domain reads as untrustworthy before anyone can say why. A
clinical product in neon gradients feels unsafe. A developer tool in pastel feels like a
toy. A payments product with a playful accent loses the user at the exact moment they
are deciding whether to trust it.

So onestop detects the product domain - from the request, the dependencies, the model and
route names - and binds a profile from `registry/design.json`. Eleven profiles:

| Domain | Hue direction | Density | Motion | Defining constraint |
|---|---|---|---|---|
| fintech | deep blue / forest green | compact | minimal | one accent only; tabular figures everywhere |
| healthcare | teal / soft blue | comfortable | minimal | red reserved **entirely** for clinical alerts |
| devtools | indigo / cyan | compact | fast | dark-first; syntax colours are a separate scale |
| ecommerce | brand-led, neutral canvas | comfortable | moderate | CTA colour used for nothing else |
| enterprise | neutral blue | compact | minimal | interface recedes; customer data is the content |
| media | dark, single accent | comfortable | expressive | never pure black behind video |
| education | warm blue / green | comfortable | moderate | "incorrect" must inform, not punish |
| social | brand-led, neutral chrome | comfortable | expressive | chrome must host any user content |
| logistics | blue chrome, status-led | compact | minimal | status readable in greyscale and sunlight |
| creative | monochrome | spacious | expressive | typography and whitespace carry it |
| generic | neutral blue | comfortable | moderate | defensible defaults, stated as such |

An existing design system always wins. onestop extends it rather than replacing it - a
half-migrated design system is worse than either system alone.

## How the palette is built

**OKLCH**, with hex fallbacks. OKLCH is perceptually uniform, so holding chroma and
stepping lightness produces ramp steps that actually look evenly spaced. HSL does not,
which is why HSL-derived ramps always have a muddy middle.

1. Seed from the domain hue, or the brand.
2. Ramp 50 to 950, tapering chroma at both ends so the extremes do not go muddy or washed.
3. Neutrals with a faint cast toward the seed - a truly neutral grey beside a hued
   primary looks accidental.
4. Semantic colours with surface, border and content variants each.
5. **Name by role, never by hue.** `--color-danger` survives a rebrand; `--color-red-500`
   becomes a lie the moment danger turns orange.

## Contrast is verified, not estimated

Every token pair the UI actually uses is checked and the ratios reported: 4.5:1 body,
3:1 large text and component boundaries, 3:1 focus indicators.

A palette that looks good and fails contrast is not a palette - it is a redesign
scheduled for later. When a pair fails, the colour changes. The standard never does.

## Dark mode is designed

Not inverted. Base near `oklch(0.18 0.01 h)` rather than pure black, which causes
halation around light text. **Elevation gets lighter** instead of gaining a shadow -
shadows barely register on dark surfaces. Accents lose 15-25% chroma or they vibrate.

## The modern baseline

CSS custom properties for every token, `oklch()` with fallback, `clamp()` for fluid type
and space, container queries where a component adapts to its container, `light-dark()` or
`[data-theme]`, logical properties so RTL needs no second stylesheet, and
`:focus-visible` so focus rings do not punish mouse users.

Nested radii are concentric - inner equals outer minus padding. Get that wrong and people
see something is off without being able to name it.

Motion animates transform and opacity only, communicates causality, and honours
`prefers-reduced-motion` by *reducing* - never by removing the feedback.
