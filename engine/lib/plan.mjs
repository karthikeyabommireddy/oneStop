// Which phases run, which boundaries stop for the user, and which gate authorises
// implementation. Pure functions over the registries - no state, no I/O.
//
// "Implementation needs an approved plan gate" broke every intent without a plan
// phase - defect, refactor, security, docs - and every trivial change, whose tier
// skipped planning. The rule that actually holds is narrower: implementation needs ONE
// approved gate that covers it, and which gate that is depends on the mask.

import { registry } from './env.mjs';

// Never removable by tier, setting or user adjustment. intake carries gate zero; ship
// carries the only gate that lets anything leave the machine.
const PINNED = new Set(['intake', 'ship']);

// Closest-to-implement wins among these; `plan` outranks them all when present.
const AUTHORISERS_BY_PROXIMITY = ['reproduce', 'verify-green', 'upgrade-plan', 'review'];

export function authorisingPhase(mask) {
  const i = mask.indexOf('implement');
  if (i < 0) return null;
  const before = mask.slice(0, i);
  if (before.includes('plan')) return 'plan';
  let best = null;
  let bestPos = -1;
  for (const p of AUTHORISERS_BY_PROXIMITY) {
    const pos = before.lastIndexOf(p);
    if (pos > bestPos) { best = p; bestPos = pos; }
  }
  return best || before[before.length - 1] || 'intake';
}

// Gate zero (intake) and ship stop in every mode. Milestone mode stops at the
// authorising phase - so a defect run in milestone mode still shows you the red test
// before the fix - plus design, implement and ship.
export function stopsFor(mask, gateMode, authorising) {
  let stops;
  if (gateMode === 'autonomous') stops = ['intake', 'ship'];
  else if (gateMode === 'milestone') stops = ['intake', authorising, 'design', 'implement', 'ship'];
  else stops = [...mask];
  const set = new Set(stops.filter(Boolean));
  return mask.filter((p) => set.has(p));
}

export function planPhases({ intent, tier = 'standard', gateMode = 'every-phase', settings = {}, skip = [] } = {}) {
  const reg = registry('intents');
  const def = reg.intents.find((i) => i.id === intent);
  if (!def) {
    return { ok: false, error: `unknown intent "${intent}" - one of: ${reg.intents.map((i) => i.id).join(', ')}` };
  }
  const tierDef = reg.size_tiers.tiers.find((t) => t.id === tier);
  if (!tierDef) {
    return { ok: false, error: `unknown tier "${tier}" - one of: ${reg.size_tiers.tiers.map((t) => t.id).join(', ')}` };
  }
  const overrides = tierDef.phase_overrides || {};
  const forced = new Set(overrides.force || []);
  const removed = [];
  let mask = [...def.phase_mask];

  const drop = (phase, reason) => {
    if (!mask.includes(phase) || PINNED.has(phase)) return;
    mask = mask.filter((p) => p !== phase);
    removed.push({ phase, reason });
  };

  for (const p of overrides.skip || []) drop(p, `skipped at the ${tier} tier`);
  if (settings.auto_automation === false && !forced.has('automation')) drop('automation', 'auto_automation is off');
  if (settings.research_depth === 'none' && !forced.has('research')) drop('research', 'research_depth is none');
  for (const p of skip) {
    if (PINNED.has(p)) continue;
    drop(p, 'skipped by the user at gate zero');
  }

  const light = (overrides.light || []).filter((p) => mask.includes(p));
  const authorising = authorisingPhase(mask);
  const effectiveAuthoriser = gateMode === 'autonomous' && authorising ? 'intake' : authorising;
  return {
    ok: true,
    intent,
    tier,
    gate_mode: gateMode,
    mask,
    removed,
    light,
    authorising_phase: effectiveAuthoriser,
    stops: stopsFor(mask, gateMode, authorising),
    pinned_note: 'intake (gate zero) and ship cannot be removed; to keep work out of git, choose "leave uncommitted" at the ship gate.',
  };
}
