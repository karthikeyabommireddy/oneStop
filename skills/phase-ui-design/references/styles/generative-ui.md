# Style recipe - Generative UI

The style is a contract more than a look. The agent chooses from a catalogue of
pre-approved components and passes structured props; it never emits markup.

```tsx
const catalogue = { OrderSummary, FlightOptions, ConfirmDialog } as const;

function renderSurface(surface: { component: string; props: unknown }) {
  if (!(surface.component in catalogue)) return <Fallback />;              // unknown names fail closed
  const Component = catalogue[surface.component as keyof typeof catalogue];
  const props = schemas[surface.component].parse(surface.props);         // validated before render
  return <Component {...props} />;
}
```

```css
.surface--generated { animation: settle 180ms ease-out; }
@keyframes settle { from { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .surface--generated { animation: none; } }
```

Announce agent progress in a `role="status"` live region, and move focus deliberately to
each new surface. Tight, structured cards where actions are irreversible; looser surfaces
only where exploration is the point.
