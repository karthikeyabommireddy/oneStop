---
name: phase-ui-design
description: Establish or extend the visual design system before UI implementation - domain-matched palette with verified contrast, type scale, spacing, elevation and motion, emitted as tokens. Runs automatically when the change touches user interface. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: ui-design
---

# Phase - UI Design

Decide how the product looks and feels **before** components are written. Retrofitting a
design system onto built components means touching every one of them, which is why it
usually does not happen and the product stays inconsistent.

## When It Runs

Automatically when the change touches UI - detected from the stack (a frontend or mobile
pack is bound) and the change surface (component, view, screen, page or style files).

Skipped, with the reason stated, for backend-only work, libraries, CLIs and migrations.

Runs **light** when a design system already exists and the change adds no new pattern:
confirm the tokens cover the new work, add any that are missing, and move on. A full
pass is for a new product, a new surface, or a deliberate redesign.

## Bind the Visual Style

Before the palette, decide what the interface *feels* like. Fifteen styles are available
in `${CLAUDE_PLUGIN_ROOT}/registry/ui-styles.json`; exactly one skin is bound, optionally
with one layout system alongside it.

**Derive it - never ask which one.** The inputs are the detected domain, the audience,
the session length, and the stakes of a mistake:

| Signal | Pulls toward |
|---|---|
| all-day professional tool | minimalism, flat, material, editorial |
| high stakes - money, health, irreversible | minimalism, material - never a style that weakens affordance |
| brand *is* the product | maximalism, neo-brutalism, y2k, retro |
| developer audience | neo-brutalism, cyberpunk, bento, brutalism |
| reading is the job | editorial |
| summary that must scan at a glance | bento (a layout - pair it with a skin) |
| children or onboarding | claymorphism |
| rich imagery already present | glassmorphism |

Two hard rules from the registry: a style whose `domain_fit.never` contains the detected
domain is **excluded outright**, whatever it looks like; and **an existing design system
always wins** - the bound style then describes new surfaces only, and you say so.

Ask only when two styles score within one point *and* would produce materially different
interfaces. That is a real two-option choice; anything else is a decision you owe the user.

State it in one line with the reason:

```
Style: bento tiles in a minimalist skin (devtools dashboard, metrics of unequal
       importance, all-day use rules out high-stimulus styles)
```

**Every style carries an accessibility cost, and it ships with its mitigation or it does
not ship.** Glass text needs a semi-opaque plate, because contrast otherwise depends on
what happens to scroll underneath. Neumorphism's defining feature - a control the same
colour as its surface - is its failure: no contrast at the boundary, so every control
needs a real border and a high-contrast focus ring, and if that removes the look, the
style was wrong for this product.

Worked recipes per style:
`${CLAUDE_PLUGIN_ROOT}/skills/phase-ui-design/references/styles.md`.

## Execution

Delegate to the `ui-designer` agent with the detected domain and the existing system, if
any. Load `${CLAUDE_PLUGIN_ROOT}/packs/concerns/visual-design.md` and, when the stack declares it,
`${CLAUDE_PLUGIN_ROOT}/packs/concerns/accessibility.md` - these two are decided together or the accessible
version becomes a later rewrite.

The agent produces tokens; this phase makes sure they are actually adopted.

## Artifacts

**Tokens** in the form the stack already uses - CSS custom properties, a Tailwind theme
extension, a design-tokens JSON, or a platform theme object. Follow the repo. Do not
introduce a token format the project has no tooling for.

**A contrast report** listing every checked pair with its ratio. This is the artifact
that proves the palette is real rather than aspirational.

**A short direction note** in `docs/` - domain, seed hue, rationale, and the rules a
future contributor must not break. One page. Its job is to stop the system drifting
once other people start adding to it.

## Adoption Check

Tokens that nothing consumes are decoration. Before this phase is complete:

- Components read tokens, not literals. Grep the change surface for hardcoded colours,
  pixel font sizes and one-off margins - each hit is either a token or a justified
  exception.
- The dark palette is defined for every token that needs one, not just for backgrounds.
- Focus indicators exist and meet 3:1 - this is the most commonly missing piece, and the
  one that makes a product unusable by keyboard.
- A reduced-motion path exists for every animation.

## Output

```
UI DESIGN
  mode:      full | light - <why>
  existing:  <system extended | created fresh>
  domain:    <detected, and the signal>
  tokens:    <file, and counts by category>
  contrast:  <pairs checked, all ratios, PASS/FAIL>
  dark:      <defined | not applicable - and how it differs>
  adoption:  <components consuming tokens; hardcoded values remaining>
  note:      <path to the direction note>
```

## Rules

1. **Design before components.** Retrofitting is how products stay inconsistent.
2. **Extend, never replace, an existing system.**
3. **Contrast is verified programmatically and reported**, never estimated by eye.
4. **Every colour is a token.**
5. **Dark mode is designed deliberately**, not derived by inversion.
6. **Tokens nothing consumes are not done.** Check adoption before closing the phase.
7. **Skip cleanly** for non-UI work, and say so.
