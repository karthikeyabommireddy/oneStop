# Style recipe - Claymorphism

```css
.clay {
  border-radius: 32px;
  background: #f0a6ca;                   /* differs from the ground - unlike neumorphism */
  box-shadow:
    0 16px 32px rgba(0, 0, 0, 0.12),               /* lift */
    inset -8px -8px 16px rgba(0, 0, 0, 0.10),      /* volume, away from the light */
    inset  8px  8px 16px rgba(255, 255, 255, 0.55);/* highlight, toward the light */
}
```

Because the surface differs from the background it keeps its contrast and its affordance
- which is the whole reason it is safer than neumorphism.
