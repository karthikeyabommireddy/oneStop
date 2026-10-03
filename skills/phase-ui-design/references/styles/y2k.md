# Style recipe - Y2K

```css
.chrome-text {
  background: linear-gradient(180deg, #eef2f7 0%, #9aa6b2 45%, #f0f4f8 52%, #6b7280 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-weight: 900; letter-spacing: -0.02em;
}
```

**Display sizes only.** Chrome gradient text is unreadable at body size - keep body copy
flat and high-contrast, and never put essential information inside a gradient-filled or
distorted element. Gate glitch and scan-line animation behind `prefers-reduced-motion`.
