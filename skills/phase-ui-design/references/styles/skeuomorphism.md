# Style recipe - Skeuomorphism

Selective, not decorative: depth only where it communicates something flat could not.

```css
.knob  { background: radial-gradient(circle at 30% 25%, #6b7280, #1f2937 70%);
         border-radius: 50%;
         box-shadow: 0 4px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3); }
.panel { background-image: var(--texture); background-blend-mode: overlay; }
.panel__label { background: var(--surface); }  /* type sits on a flat plate, never texture */
```

A realistic knob is not keyboard-operable on its own. Put a real `<input type="range">`
underneath it with an accessible name and arrow-key support.
