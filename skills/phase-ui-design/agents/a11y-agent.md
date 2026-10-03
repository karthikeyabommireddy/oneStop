# a11y-agent - method

Read by the `a11y-agent` specialist before it acts; its brief names this file first.

## Structure First

Most accessibility defects are structural, and no amount of ARIA repairs them.

**Semantics.** A native element carries behavior, focus handling and announcement for
free. A div with a click handler carries none of it. Use the real element - button,
link, heading, list, table, label - and reach for ARIA only when no native element
exists. **ARIA is a last resort, and a wrong role is worse than no role.**

**Heading order.** One h1, descending without skipping. Headings are how screen reader
users navigate a page; a page with no headings is a wall.

**Landmarks.** Main, navigation, banner, contentinfo. They let a user skip to what they
came for.

**Names.** Every interactive element needs an accessible name - not a placeholder, not a
title attribute, but a real label or an aria-label where visible text is genuinely
absent. An icon-only button with no name is unusable, and it is the single most common
defect.

## Keyboard

Every interaction must work without a pointer.

- Reachable in a logical order that matches the visual order.
- A visible focus indicator - never removed without a replacement that meets contrast.
- No keyboard trap: whatever can be entered can be left.
- Focus moved deliberately on route change, dialog open and dialog close - and returned
  to the trigger when a dialog closes.
- Escape closes dismissible overlays.

## State and Change

- Dynamic changes announced through a live region, chosen for urgency - polite for
  status, assertive only for genuine errors.
- Loading, empty and error states announced, not only drawn.
- Form errors associated with their field programmatically, describing how to fix the
  problem rather than merely that one exists.
- Toggle and expansion state exposed through the appropriate state attribute.

## Visual

- Text contrast 4.5:1, large text 3:1, interactive boundaries and focus indicators 3:1.
- **Never colour alone** to convey meaning - pair it with text, shape, or an icon.
- Usable at 200 percent zoom and at 320 CSS pixels wide without horizontal scrolling.
- Respect reduced-motion preferences for anything that animates.
- Touch targets at least 24 by 24 CSS pixels, with adequate spacing.

## Native Apps

The same principles through platform APIs: accessibilityLabel and traits on iOS,
contentDescription and focus flags on Android, Semantics in Flutter, and the
accessibility props in React Native. Check dynamic type and font scaling - a layout that
breaks at the largest font size fails a large share of real users. Verify focus order
and grouping, and that decorative images are hidden from the accessibility tree.

## Output

```
ACCESSIBILITY  <surface>  <WCAG 2.2 AA | platform APIs>

[BLOCKER] <failure>                              <path:line>
  affects:   <who cannot complete the task, and how>
  criterion: <WCAG success criterion, or platform guideline>
  fix:       <the specific change>

VERIFIED
  <what was checked and passes>

NOT CHECKABLE STATICALLY
  <what needs a real screen reader or device to confirm>
```
