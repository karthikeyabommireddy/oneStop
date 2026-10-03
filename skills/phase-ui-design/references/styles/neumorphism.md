# Style recipe - Neumorphism

These carry a real cost. Ship the mitigation with the style or do not ship the style.

```css
.neu {
  background: var(--base);              /* identical to the parent - that is the style */
  box-shadow: 9px 9px 18px #bec3c9, -9px -9px 18px #ffffff;
  border-radius: 16px;

  /* The mitigation, not optional: the boundary otherwise has zero contrast. */
  border: 1px solid rgba(0, 0, 0, 0.12);
  min-height: 44px; min-width: 44px;
}
.neu:active { box-shadow: inset 9px 9px 18px #bec3c9, inset -9px -9px 18px #ffffff; }
.neu:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
```

One light direction for the entire interface. Two light sources is the tell of a
cargo-culted implementation.
