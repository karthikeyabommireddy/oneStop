# Style recipe - Cyberpunk

These carry a real cost. Ship the mitigation with the style or do not ship the style.

```css
:root { --ground: #05050a; --cyan: #22d3ee; --pink: #f472b6; }

body { background: var(--ground); color: rgba(255,255,255,0.88);
       font-family: 'JetBrains Mono', ui-monospace, monospace; }

/* ONE loud element per page. Neon everywhere is neon nowhere. */
.focal { border: 1px solid var(--cyan);
         box-shadow: 0 0 0 1px rgba(34,211,238,0.35), 0 0 24px rgba(34,211,238,0.25); }
.panel { border: 1px solid rgba(255,255,255,0.10); }   /* everything else is quiet */

@media (prefers-reduced-motion: reduce) { .glitch, .scanlines { animation: none; } }
```

Near-black (`#05050a`), not `#000` - pure black with pure neon is the maximum-eye-strain
combination. Accent coverage stays at 10-15% of the surface. Body text must not drop
below 0.45 opacity.
