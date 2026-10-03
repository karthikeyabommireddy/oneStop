# Style recipe - Aurora

```css
.aurora { position: relative; isolation: isolate; overflow: hidden; background: var(--ground-deep); }
.aurora::before,
.aurora::after {
  content: "";
  position: absolute;
  inset: -20%;
  z-index: -1;
  filter: blur(80px);
  animation: drift 12s ease-in-out infinite alternate;
}
.aurora::before {
  background:
    radial-gradient(40% 50% at 20% 30%, oklch(0.62 0.20 300 / .55), transparent 70%),
    radial-gradient(35% 45% at 80% 20%, oklch(0.70 0.16 200 / .45), transparent 70%);
}
.aurora::after {
  background: radial-gradient(45% 40% at 60% 80%, oklch(0.68 0.18 150 / .35), transparent 70%);
  animation-duration: 16s;
}
@keyframes drift { to { transform: translate3d(4%, -3%, 0) scale(1.05); } }

.aurora__panel { background: color-mix(in oklch, var(--surface) 88%, transparent); border-radius: 20px; }

@media (prefers-reduced-motion: reduce) {
  .aurora::before, .aurora::after { animation: none; }   /* freeze the motion, keep the colour */
}
```

Text always sits on a panel - the gradient moves, so its contrast against any word moves
with it. One aurora region per page.
