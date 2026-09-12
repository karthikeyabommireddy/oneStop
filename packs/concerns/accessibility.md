# Concern: Accessibility

Loaded for any stack whose UI is user-facing. Detail lives in the `a11y-agent`; this
pack is what every agent applies while writing or reviewing UI code.

- Use the native element. A div with a click handler is a keyboard failure.
- Every interactive element has an accessible name. Icon-only buttons are the usual gap.
- Focus is visible, ordered logically, never trapped, and moved deliberately on route
  change and dialog open/close.
- Announce state changes through a live region - loading, empty and error states are
  announced, not only drawn.
- Contrast: 4.5:1 text, 3:1 large text and interactive boundaries.
- Never colour alone to convey meaning.
- Form errors are tied to their field and say how to fix the problem.
- Native apps: platform accessibility label and role on every control; verify at the
  largest font scale.
