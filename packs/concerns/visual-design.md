# Concern: Visual design

Loaded for any stack that renders a user interface. The `ui-designer` agent owns the
system; this pack is what every agent applies while writing UI code.

- **Every colour, size, space and duration is a token.** A literal in a component is a
  defect - it is the thing that makes a rebrand a rewrite.
- **Name tokens by role, not by hue.** `--color-danger`, never `--color-red-500`.
- **Verify contrast, do not estimate it.** 4.5:1 body, 3:1 large text, UI boundaries and
  focus rings. Adjust the colour when it fails; never the standard.
- **Dark mode is designed, not inverted.** Elevation gets lighter rather than gaining a
  shadow; accents lose chroma; the base is never pure black.
- **Proximity before decoration.** Group related things by space before adding a border
  or a background.
- **Nested radii are concentric** - inner equals outer minus padding.
- **Animate transform and opacity only**, and honour `prefers-reduced-motion` by
  reducing the motion, never by removing the feedback.
- **Body text never below 16px**; measure 45-75 characters.
- **Tabular figures** for any number that sits in a column.
- **`:focus-visible`, always.** Never remove an outline without replacing it.
- **Logical properties** (`padding-inline`, `margin-block`) so RTL works without a second
  stylesheet.
- **Every interactive state is designed** - rest, hover, active, focus, disabled,
  loading, error. A component missing its loading and error states is half-built.
