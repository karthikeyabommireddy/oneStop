# Style recipe - Neo-brutalism

```css
.nb {
  border: 3px solid #0f172a;
  box-shadow: 6px 6px 0 0 #0f172a;      /* zero blur, zero spread - solid block */
  border-radius: 4px;
  background: #facc15;
  transition: transform 80ms, box-shadow 80ms;
}
/* Press distance EXACTLY equals the shadow offset. A mismatch is the giveaway. */
.nb:active { transform: translate(6px, 6px); box-shadow: 0 0 0 0 #0f172a; }
/* The border cannot double as focus - it is already there. Offset outline instead. */
.nb:focus-visible { outline: 3px solid #2563eb; outline-offset: 4px; }
```

Yellow with white text fails badly - check every saturated fill against its text.
