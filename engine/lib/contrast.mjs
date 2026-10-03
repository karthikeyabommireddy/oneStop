// WCAG 2.x contrast, computed - never estimated.
//
// The ui-designer was told to verify every colour pair "programmatically", and nothing
// shipped to do it, so the ratios in its reports were estimates. This accepts the forms
// onestop's palettes are written in - hex, rgb() and oklch() - and returns the ratio and
// the AA verdicts for body text, large text and UI component boundaries.

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function number(token, percentScale = 1) {
  const t = String(token).trim();
  if (t.endsWith('%')) return (parseFloat(t) / 100) * percentScale;
  return parseFloat(t);
}

// Returns linear-light sRGB channels in 0..1, or null for an unreadable colour.
export function parseColor(input) {
  const s = String(input).trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  }
  m = s.match(/^rgba?\(\s*([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    if (parts.length < 3) return null;
    return parts.map((p) => srgbToLinear(clamp01(number(p, 255) / 255)));
  }
  m = s.match(/^oklch\(\s*([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const L = number(parts[0]);
    const C = number(parts[1], 0.4);
    const h = (parseFloat(parts[2]) * Math.PI) / 180;
    if (![L, C, h].every(Number.isFinite)) return null;
    // OKLCH -> OKLab -> linear sRGB (Ottosson). Out-of-gamut channels are clamped, which
    // is what a browser shows.
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const k = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * k,
      -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * k,
      -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * k,
    ].map(clamp01);
  }
  return null;
}

export function luminance(input) {
  const rgb = parseColor(input);
  if (!rgb) return null;
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) {
    return { ok: false, error: `cannot read ${a === null ? fg : bg} - use #rgb, #rrggbb, rgb() or oklch()` };
  }
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const r = Math.floor(ratio * 100) / 100;
  return {
    ok: true,
    fg,
    bg,
    ratio: r,
    aa_text: r >= 4.5,
    aa_large: r >= 3,
    ui: r >= 3,
    aaa_text: r >= 7,
  };
}
