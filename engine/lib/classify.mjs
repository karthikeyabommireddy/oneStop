// Intent classification, as code rather than as prose the model re-implements.
//
// The rule is registry/intents.json `classification`: whole-word signal matching,
// strong 1.0 / weak 0.4 / negative -0.8, divided by (1 + 0.15 * positive hits) so an
// intent with a long signal list is not automatically favoured. This is a direct port
// of the rule scripts/test_routing.py specified - same normalisation, same weights,
// same stable tie order - so every routing case that held before still holds.

import { registry } from './env.mjs';

const WEIGHTS = { strong: 1.0, weak: 0.4, negative: -0.8 };

// Lowercase, collapse every non-alphanumeric run to one space, pad both ends. Testing
// " signal " against the padded text gives whole-word and whole-phrase matching: the
// signal `change` must not fire inside "changes".
export function normalize(text) {
  const collapsed = String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return ` ${collapsed} `;
}

function matches(signal, padded) {
  return padded.includes(` ${normalize(signal).trim()} `);
}

export function scoreIntent(request, intent) {
  const padded = normalize(request);
  let total = 0;
  let hits = 0;
  const fired = [];
  for (const [kind, weight] of Object.entries(WEIGHTS)) {
    for (const sig of intent.signals[kind] || []) {
      if (matches(sig, padded)) {
        total += weight;
        if (weight > 0) hits += 1;
        fired.push(`${kind}:${sig}`);
      }
    }
  }
  return { score: hits ? total / (1 + 0.15 * hits) : total, fired };
}

function maskDistance(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  let d = 0;
  for (const p of sa) if (!sb.has(p)) d++;
  for (const p of sb) if (!sa.has(p)) d++;
  return d;
}

const TRIVIAL_WORDS = ['typo', 'spelling', 'misspelt', 'misspelled', 'rename variable', 'one line', 'one-line', 'comment out', 'bump the version'];

// A first guess at the size tier, stated at gate zero for the user to correct. Real
// file counts are unknown until discovery, so this only reads the request.
export function tierHint(request, intentId, securityHit) {
  const padded = normalize(request);
  const reasons = [];
  let tier = 'standard';
  if (TRIVIAL_WORDS.some((w) => padded.includes(` ${normalize(w).trim()} `))) {
    tier = 'trivial';
    reasons.push('the request reads as a one-line change');
  }
  if (intentId === 'mvp') { tier = 'large'; reasons.push('a new project is large by construction'); }
  if (intentId === 'flow' && tier !== 'large') { tier = 'standard'; reasons.push('a narrated flow is at least standard'); }
  if (securityHit && tier === 'trivial') { tier = 'standard'; reasons.push('it names a security surface, which is never below standard'); }
  if (!reasons.length) reasons.push('no size signal in the request - standard until discovery says otherwise');
  return { tier, reasons };
}

function securitySurfaceHits(request) {
  const padded = normalize(request);
  const words = ['auth', 'authentication', 'authorization', 'login', 'password', 'token', 'secret', 'credential',
    'session', 'cookie', 'cors', 'upload', 'payment', 'pii', 'phi', 'encrypt', 'crypto', 'sql', 'deserialize', 'oauth', 'jwt'];
  return words.filter((w) => padded.includes(` ${w} `));
}

export function classify(request, { greenfield = false } = {}) {
  const reg = registry('intents');
  const ranked = reg.intents
    .map((intent, order) => ({ intent, order, ...scoreIntent(request, intent) }))
    .sort((a, b) => b.score - a.score || a.order - b.order);
  const [top, second] = ranked;
  const security = securitySurfaceHits(request);

  // An empty folder is a new project, whatever the words were. "create a todo API"
  // scores as `feature`, whose mask has no scaffold phase - the new project would get
  // no skeleton and no stack choice.
  if (greenfield) {
    const mvp = reg.intents.find((i) => i.id === 'mvp');
    return {
      intent: 'mvp',
      announce_as: mvp.announce_as,
      score: Number(top.score.toFixed(3)),
      runner_up: top.intent.id === 'mvp' ? second.intent.id : top.intent.id,
      ambiguous: false,
      signals: top.intent.id === 'mvp' ? top.fired : [],
      reason: 'The project has no source files and no manifest, so this is a new project (mvp) regardless of the wording.',
      tier_hint: tierHint(request, 'mvp', security.length > 0),
      security_words: security,
    };
  }

  if (top.score <= 0) {
    const fallback = reg.intents.find((i) => i.id === reg.classification.default_intent);
    return {
      intent: fallback.id,
      announce_as: fallback.announce_as,
      score: 0,
      runner_up: null,
      ambiguous: false,
      signals: [],
      reason: `No intent signal fired, so this falls back to ${fallback.id}. Say so at gate zero - it is a guess, and the user should correct it.`,
      tier_hint: tierHint(request, fallback.id, security.length > 0),
      security_words: security,
    };
  }

  const close = top.score - second.score < reg.classification.ambiguity_margin;
  const ambiguous = close && maskDistance(top.intent.phase_mask, second.intent.phase_mask) > 1;
  return {
    intent: top.intent.id,
    announce_as: top.intent.announce_as,
    score: Number(top.score.toFixed(3)),
    runner_up: second.intent.id,
    runner_up_score: Number(second.score.toFixed(3)),
    ambiguous,
    signals: top.fired,
    reason: ambiguous
      ? `"${top.intent.id}" and "${second.intent.id}" are within the ambiguity margin and run materially different phases - ask which one, recommending ${top.intent.id}.`
      : `Signals ${top.fired.join(', ')} decided it.`,
    tier_hint: tierHint(request, top.intent.id, security.length > 0),
    security_words: security,
  };
}
