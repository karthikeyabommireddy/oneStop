// The run ledger and the state machine over it.
//
// The engine is the only writer of .onestop/run.json. Every transition is checked:
// a phase cannot start before the phases ahead of it are done and gated, implementation
// cannot start without its authorising gate, a skip of security review or of tests
// needs a second confirmation, and a fix loop cannot run past its budget. Each refusal
// says what to do instead, so the orchestrator is steered rather than merely stopped.

import fs from 'node:fs';
import path from 'node:path';
import { guidePath, nowIso, registry, slash, slugify } from './env.mjs';
import { appendJsonl, ensureStateDir, readJson, readJsonl, statePath, validate, writeJsonAtomic } from './store.mjs';
import { effectiveSettings } from './config.mjs';
import { planPhases } from './plan.mjs';
import * as git from './git.mjs';
import { recipe } from './dispatch.mjs';

export function ledgerFile(root) {
  return statePath(root, 'run.json');
}

const fail = (error, hint) => ({ ok: false, error, ...(hint ? { hint } : {}) });

function rmQuiet(file) {
  try { fs.unlinkSync(file); } catch { /* already gone */ }
}

function trim(text, max) {
  const s = String(text ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function loadRun(root) {
  const r = readJson(ledgerFile(root));
  if (!r.ok) return r;
  const errors = validate(registry('run.schema'), r.value);
  if (errors.length) {
    return { ok: false, invalid: true, run: r.value, error: `run.json does not match registry/run.schema.json: ${errors.slice(0, 5).join('; ')}` };
  }
  return { ok: true, run: r.value };
}

function event(root, tool, detail = {}) {
  appendJsonl(statePath(root, 'events.jsonl'), { t: nowIso(), source: 'engine', tool, ...detail });
}

function save(root, run) {
  run.updated = nowIso();
  const errors = validate(registry('run.schema'), run);
  if (errors.length) throw new Error(`the engine produced an invalid ledger - this is an onestop bug: ${errors.join('; ')}`);
  writeJsonAtomic(ledgerFile(root), run);
}

const SYMBOL = { done: '✓', skipped: '⤼', active: '▶', awaiting_gate: '⏸', blocked: '✗', pending: '·' };

export function progressLine(run) {
  return run.mask.map((p) => `${SYMBOL[run.phases[p]?.status] || '?'}${p}`).join(' ');
}

function nextPending(run) {
  return run.mask.find((p) => run.phases[p] && run.phases[p].status === 'pending') || null;
}

function nextAfter(run, phase) {
  const i = run.mask.indexOf(phase);
  return run.mask.slice(i + 1).find((p) => run.phases[p] && run.phases[p].status === 'pending') || null;
}

export function summary(run) {
  const awaiting = run.mask.find((p) => run.phases[p]?.status === 'awaiting_gate') || null;
  return {
    run_id: run.run_id,
    status: run.status,
    request: run.request,
    intent: run.intent,
    tier: run.tier,
    gate_mode: run.gate_mode,
    current: run.current,
    progress: progressLine(run),
    awaiting_gate: awaiting,
    authorising_phase: run.authorising_phase,
    blocked_reason: run.blocked_reason,
    open: run.open.filter((o) => !o.resolved),
  };
}

function securityFlags(root) {
  return readJsonl(statePath(root, 'security-flags.jsonl'));
}

function archive(root, run, why) {
  const dir = statePath(root, 'runs');
  fs.mkdirSync(dir, { recursive: true });
  if (!run) {
    const dest = path.join(dir, `unreadable-${Date.now()}.json`);
    try { fs.renameSync(ledgerFile(root), dest); } catch { /* nothing to move */ }
    return slash(dest);
  }
  let dest = path.join(dir, `${run.run_id}.json`);
  for (let i = 2; fs.existsSync(dest); i++) dest = path.join(dir, `${run.run_id}-${i}.json`);
  writeJsonAtomic(dest, { ...run, archived_because: why });
  rmQuiet(ledgerFile(root));
  return slash(dest);
}

function uniqueRunId(root, slug) {
  const base = `${nowIso().slice(0, 10)}-${slug}`;
  const dir = statePath(root, 'runs');
  let id = base;
  for (let i = 2; fs.existsSync(path.join(dir, `${id}.json`)); i++) id = `${base}-${i}`;
  return id;
}

// ---------------------------------------------------------------- open / status / close

export function openRun(root, { request = '', on_conflict: onConflict } = {}) {
  ensureStateDir(root);
  const req = String(request || '').trim();
  const existing = loadRun(root);

  if (existing.corrupt || existing.invalid) {
    if (onConflict !== 'archive') {
      return {
        ok: false,
        corrupt: true,
        error: existing.error,
        hint: "Tell the user the run ledger is unreadable and name the error. Offer: archive it and start fresh (run_open again with on_conflict:'archive'), or stop. Archived ledgers stay in .onestop/runs/.",
      };
    }
    archive(root, existing.invalid ? existing.run : null, 'unreadable');
  } else if (existing.ok) {
    const run = existing.run;
    if (run.status === 'active' || run.status === 'blocked') {
      if (!req || onConflict === 'resume') {
        event(root, 'run_open', { resumed: run.run_id });
        return { ok: true, resumed: true, ...summary(run), next: run.current ? `Resume at ${run.current}.` : 'Call run_status.' };
      }
      if (onConflict === 'stop') return { ok: true, stopped: true, note: 'Nothing changed. The active run is untouched.' };
      if (onConflict !== 'archive') {
        return {
          ok: false,
          conflict: true,
          active: { run_id: run.run_id, request: run.request, current: run.current, status: run.status },
          options: ['resume', 'archive', 'stop'],
          hint: `A run is already active. Ask the user once: resume "${run.request}" at ${run.current} | archive it and start this new request (recommended when the requests differ) | stop. Then call run_open again with on_conflict set to their answer. Never overwrite an active run without that answer.`,
        };
      }
      run.status = 'stopped';
      archive(root, run, 'superseded by a new request');
    } else {
      archive(root, run, run.status);
    }
  }

  if (!req) return fail('there is no active run to resume and no request was given', 'Ask the user what to build - that is genuinely missing information.');

  const settings = effectiveSettings(root);
  const isGit = git.isRepo(root);
  const slug = slugify(req);
  const now = nowIso();
  const run = {
    schema: 2,
    run_id: uniqueRunId(root, slug),
    status: 'active',
    request: req,
    slug,
    intent: null,
    tier: null,
    gate_mode: settings.effective.gate_mode,
    settings: {
      ...settings.effective,
      approvals: settings.approvals,
      limits: settings.limits,
      style: settings.style,
      automation: settings.automation,
    },
    created: now,
    updated: now,
    base_commit: isGit ? git.headCommit(root) : null,
    git: isGit,
    stack: null,
    commands: {},
    mask: ['intake'],
    stops: ['intake'],
    authorising_phase: null,
    current: 'intake',
    blocked_reason: null,
    phases: { intake: { status: 'active', mode: 'engine', started: now } },
    units: [],
    decisions: [],
    open: [],
    approvals: [],
    amendments: [],
    loops: {},
    ship: null,
    checkpoints: [],
  };
  // Flags and owners from an earlier run must not bleed into this one. The session that
  // called run_open claims the new run right after this returns (PostToolUse hook).
  rmQuiet(statePath(root, 'security-flags.jsonl'));
  rmQuiet(statePath(root, 'requested'));
  rmQuiet(statePath(root, 'sessions'));
  save(root, run);
  event(root, 'run_open', { run_id: run.run_id });
  return {
    ok: true,
    created: true,
    guide: guidePath('start'),
    run_id: run.run_id,
    slug,
    git: isGit,
    settings: settings.effective,
    settings_source: settings.source,
    warnings: settings.warnings,
    next: isGit
      ? 'Call classify, then present gate zero.'
      : 'Call classify, then present gate zero. This folder is not a git repository: say so at gate zero - checkpoints, history search and every git step in ship are unavailable unless the user initialises one.',
  };
}

export function status(root, { events = 10 } = {}) {
  const loaded = loadRun(root);
  if (loaded.missing) return { ok: true, active: false, note: 'No onestop run in this repository.' };
  if (!loaded.ok) {
    const runsDir = statePath(root, 'runs');
    const runs = fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : [];
    return { ok: false, corrupt: true, error: loaded.error, archives: runs.slice(-5), hint: 'Report the error. Offer to archive the unreadable ledger with run_open on_conflict:"archive".' };
  }
  const run = loaded.run;
  return {
    ok: true,
    active: run.status === 'active' || run.status === 'blocked',
    ...summary(run),
    phases: run.phases,
    decisions: run.decisions.slice(-10),
    commands: run.commands,
    checkpoints: run.checkpoints.length,
    ship: run.ship,
    security_flags: securityFlags(root).length,
    recent_events: readJsonl(statePath(root, 'events.jsonl'), events),
  };
}

export function closeRun(root, { status: final = 'complete', note } = {}) {
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no run to close');
  const run = loaded.run;
  if (!['complete', 'stopped'].includes(final)) return fail('status must be complete or stopped');
  if (final === 'complete') {
    const unfinished = run.mask.filter((p) => !['done', 'skipped'].includes(run.phases[p]?.status));
    if (unfinished.length) return fail(`cannot complete: ${unfinished.join(', ')} not finished`, 'Finish and gate those phases, or close with status "stopped".');
  }
  run.status = final;
  run.current = null;
  if (note) run.amendments.push({ at: nowIso(), note });
  save(root, run);
  const archived = path.join(statePath(root, 'runs'), `${run.run_id}.json`);
  writeJsonAtomic(archived, run);
  rmQuiet(statePath(root, 'security-flags.jsonl'));
  rmQuiet(statePath(root, 'requested'));
  rmQuiet(statePath(root, 'sessions'));
  event(root, 'run_close', { status: final });
  return { ok: true, run_id: run.run_id, status: final, archived: slash(archived), progress: progressLine(run) };
}

// ---------------------------------------------------------------- phases and gates

export function startPhase(root, { phase, mode = 'delegated', note } = {}) {
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run', 'Call run_open first.');
  const run = loaded.run;
  if (run.status === 'blocked') return fail(`the run is blocked: ${run.blocked_reason}`, 'Present the blocked gate, then call gate_record on the blocked phase.');
  if (run.status !== 'active') return fail(`the run is ${run.status}`);
  if (!run.intent) return fail('gate zero has not been approved', 'Call classify, present gate zero, then gate_record with phase "intake".');
  const ph = run.phases[phase];
  if (!ph) return fail(`"${phase}" is not in this run's phases: ${run.mask.join(' -> ')}`);
  if (ph.status === 'active') return { ok: true, already_active: true, phase, recipe: recipe(root, run, phase), progress: progressLine(run) };
  if (ph.status !== 'pending') return fail(`${phase} is already ${ph.status}`);
  if (mode === 'inline' && !note) return fail('a phase run inline needs a note saying why it was not delegated');

  for (const p of run.mask.slice(0, run.mask.indexOf(phase))) {
    const s = run.phases[p].status;
    if (s === 'awaiting_gate') return fail(`${p} is waiting for its gate`, `Present the ${p} gate and call gate_record before starting ${phase}.`);
    if (s !== 'done' && s !== 'skipped') return fail(`${p} has not run yet (${s}) - phases run in order: ${run.mask.join(' -> ')}`);
  }

  if (phase === 'implement') {
    const auth = run.authorising_phase;
    const g = auth ? run.phases[auth]?.gate : undefined;
    if (!(g === 'approved' || g === 'adjusted')) {
      return fail(
        `implementation is not authorised: its authorising gate is the ${auth} gate, which reads "${g || 'not reached'}"`,
        `Present the ${auth} gate and record the user's approval. Implementation never starts on an unapproved ${auth}.`,
      );
    }
  }

  Object.assign(ph, { status: 'active', started: nowIso(), mode, ...(note ? { note } : {}) });
  run.current = phase;
  // The baseline, once, at the first phase after gate zero: the tree before this run
  // wrote anything, the user's own uncommitted work included - so undoing the whole run
  // never touches that work.
  if (run.git && !run.checkpoints.length) addCheckpoint(root, run, 'baseline');
  save(root, run);
  event(root, 'phase_start', { phase, mode });
  return { ok: true, phase, recipe: recipe(root, run, phase), progress: progressLine(run) };
}

export function finishPhase(root, { phase, summary: text = '', artifacts = [] } = {}) {
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run');
  const run = loaded.run;
  const ph = run.phases[phase];
  if (!ph) return fail(`"${phase}" is not in this run`);
  if (ph.status !== 'active') return fail(`${phase} is ${ph.status}, not active`, ph.status === 'pending' ? 'Call phase_start first.' : undefined);
  // A phase that dispatches specialists is finished by their reports, not by a summary
  // the orchestrator writes in their place.
  const shape = registry('phases').phases[phase]?.dispatch;
  if (shape && shape !== 'engine' && !(ph.reports || []).length) {
    return fail(
      `no specialist report is stored for ${phase}`,
      'Reports are stored automatically when a specialist finishes (SubagentStop hook). None arrived - hooks may be off. Call report_store with each specialist\'s REPORT text, then phase_finish again. If the phase genuinely needed no specialist, store a one-line report as agent "orchestrator" saying why.',
    );
  }
  ph.summary = trim(text, 400);
  if (artifacts.length) ph.artifacts = artifacts.map(String);
  ph.finished = nowIso();
  // A checkpoint after every phase that wrote something, review fixes included, so
  // /onestop-undo can reverse exactly that phase.
  if (run.git && run.checkpoints.length && (registry('phases').phases[phase]?.read_only === false || phaseWrote(root, ph))) {
    addCheckpoint(root, run, `after ${phase}`);
  }
  // A decision only the user can make stops the run in every gate mode: autonomous
  // means "do not stop to approve", never "decide for the user".
  const asks = run.open.filter((o) => !o.resolved && o.phase === phase);
  const stops = run.stops.includes(phase) || asks.length > 0;
  if (stops) {
    ph.status = 'awaiting_gate';
  } else {
    ph.status = 'done';
    ph.gate = 'auto';
    run.current = nextPending(run);
  }
  save(root, run);
  event(root, 'phase_finish', { phase, gated: stops, asks: asks.length });
  const next = stops ? nextAfter(run, phase) : run.current;
  const ship = registry('policies').ship;
  return {
    ok: true,
    phase,
    needs_gate: stops,
    ...(asks.length ? { open_questions: asks.map(({ question, recommended }) => ({ question, ...(recommended ? { recommended } : {}) })) } : {}),
    next,
    progress: progressLine(run),
    gate: stops
      ? {
        is_ship: phase === 'ship',
        options: phase === 'ship'
          ? Object.entries(ship.choices).map(([k, v]) => `${k}: ${v}`)
          : [`Continue to ${next || 'close the run'}`, ...(next && next !== 'ship' ? [`Skip ${next}`] : []), 'Adjust first', 'Stop here'],
        recommended: phase === 'ship' ? ship.recommended : 'continue',
        guide: guidePath('gates'),
      }
      : { note: `${phase} is not a stopping boundary in ${run.gate_mode} mode - narrate it in one line and continue to ${next || 'run_close'}.` },
  };
}

function skipWarning(root, run, next) {
  if (next === 'review') {
    const flags = securityFlags(root);
    if (flags.length || run.intent === 'security') {
      const surfaces = [...new Set(flags.map((f) => f.surface))].join(', ') || 'a security task';
      return `Review is mandatory here: this change touched ${surfaces}. Skipping it ships unreviewed security-relevant code.`;
    }
  }
  // At implement's own gate the phase is still awaiting_gate - that is exactly when a skip
  // of test is chosen, so it must warn there too, not only once implement reads done.
  if (next === 'test' && ['done', 'awaiting_gate'].includes(run.phases.implement?.status)) {
    return 'This change altered behaviour. Skipping test ships it with no test proving it works.';
  }
  return null;
}

const DECISIONS = ['approved', 'adjusted', 'skip_next', 'rerun', 'stopped'];

export function recordGate(root, args = {}) {
  const { phase, decision, note, intent, tier, gate_mode: gateMode, skip, ship_choice: shipChoice, confirmed } = args;
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run');
  const run = loaded.run;
  if (run.status !== 'active' && run.status !== 'blocked') return fail(`the run is ${run.status}`);
  if (!DECISIONS.includes(decision)) return fail(`decision must be one of ${DECISIONS.join(', ')}`);
  const ph = run.phases[phase];
  if (!ph) return fail(`"${phase}" is not in this run's phases: ${run.mask.join(' -> ')}`);
  const now = nowIso();

  if (decision === 'stopped') {
    ph.gate = 'stopped';
    if (ph.status !== 'pending') ph.status = 'done';
    run.status = 'stopped';
    run.current = null;
    if (note) ph.note = note;
    save(root, run);
    event(root, 'gate_record', { phase, decision });
    return { ok: true, stopped: true, progress: progressLine(run), hint: 'Call run_close with status "stopped" to archive the run.' };
  }

  // Gate zero commits the classification and the phase plan the user accepted.
  if (phase === 'intake') {
    if (!['approved', 'adjusted'].includes(decision)) return fail('gate zero takes approved, adjusted or stopped');
    if (!intent) return fail('gate zero needs the intent the user accepted', 'Pass intent (and tier, and any skip list) exactly as the user confirmed them.');
    const plan = planPhases({ intent, tier: tier || 'standard', gateMode: gateMode || run.gate_mode, settings: run.settings, skip: skip || [] });
    if (!plan.ok) return fail(plan.error);
    run.intent = intent;
    run.tier = plan.tier;
    run.gate_mode = plan.gate_mode;
    run.mask = plan.mask;
    run.stops = plan.stops;
    run.authorising_phase = plan.authorising_phase;
    for (const p of plan.mask) {
      if (p === 'intake') continue;
      run.phases[p] = { status: 'pending', ...(plan.light.includes(p) ? { light: true } : {}) };
    }
    for (const p of Object.keys(run.phases)) if (!plan.mask.includes(p)) delete run.phases[p];
    Object.assign(run.phases.intake, { status: 'done', gate: decision, finished: now, ...(note ? { note } : {}) });
    run.current = nextPending(run);
    save(root, run);
    event(root, 'gate_record', { phase, decision, intent, tier: plan.tier });
    return {
      ok: true,
      plan: { mask: plan.mask, stops: plan.stops, authorising_phase: plan.authorising_phase, removed: plan.removed, light: plan.light },
      next: run.current,
      progress: progressLine(run),
    };
  }

  // A blocked phase - a budget ran out. The user decides how to proceed.
  if (ph.status === 'blocked') {
    if (decision === 'adjusted') {
      for (const entry of Object.values(run.loops)) {
        if (entry.phase === phase && entry.exhausted) { entry.limit += entry.base; entry.exhausted = false; }
      }
      ph.status = 'active';
      run.status = 'active';
      run.blocked_reason = null;
      run.amendments.push({ at: now, phase, note: note || 'another approach, chosen at the blocked gate' });
      save(root, run);
      event(root, 'gate_record', { phase, decision, unblocked: true });
      return { ok: true, resumed_phase: phase, note: 'One more round of the exhausted budget is allowed. Brief the specialist with the approach the user chose.' };
    }
    if (decision === 'approved') {
      Object.assign(ph, { status: 'done', gate: 'approved', note: note || 'accepted with an unresolved blocker' });
      run.status = 'active';
      run.blocked_reason = null;
      run.current = nextPending(run);
      save(root, run);
      event(root, 'gate_record', { phase, decision, accepted_blocker: true });
      return { ok: true, next: run.current, progress: progressLine(run) };
    }
    if (decision === 'rerun') {
      ph.status = 'pending';
      run.status = 'active';
      run.blocked_reason = null;
      for (const [k, entry] of Object.entries(run.loops)) if (entry.phase === phase) delete run.loops[k];
      run.current = phase;
      save(root, run);
      return { ok: true, rerun: phase, hint: `Call phase_start ${phase}.` };
    }
    return fail('a blocked phase takes adjusted (try another approach), approved (accept and move on), rerun, or stopped');
  }

  if (ph.status !== 'awaiting_gate') {
    return fail(`${phase} is ${ph.status}, not awaiting its gate`, ph.status === 'active' ? `Call phase_finish ${phase} first.` : undefined);
  }

  if (phase === 'ship' && (decision === 'approved' || decision === 'adjusted')) {
    const choices = Object.keys(registry('policies').ship.choices);
    if (!choices.includes(shipChoice)) return fail(`the ship gate needs ship_choice: one of ${choices.join(', ')}`, 'Ask the user which, recommending local-commit.');
    run.ship = { choice: shipChoice, approved: true };
  }

  if (decision === 'rerun') {
    ph.status = 'pending';
    delete ph.gate;
    delete ph.finished;
    run.current = phase;
    save(root, run);
    event(root, 'gate_record', { phase, decision });
    return { ok: true, rerun: phase, hint: `Call phase_start ${phase} with the user's adjustment in the brief.` };
  }

  if (decision === 'skip_next') {
    const next = nextAfter(run, phase);
    if (!next) return fail('there is no next phase to skip');
    if (next === 'ship') return fail('ship cannot be skipped', 'At the ship gate, choose "leave-uncommitted" to keep everything out of git.');
    const warning = skipWarning(root, run, next);
    if (warning && !confirmed) {
      return {
        ok: false,
        needs_confirmation: true,
        guide: guidePath('gates'),
        warning,
        hint: 'Show this warning to the user and ask once more. If they still choose to skip, call gate_record again with confirmed: true - it is their decision, and it is recorded.',
      };
    }
    run.phases[next] = { status: 'skipped', gate: 'skipped-by-user', ...(note ? { note } : {}) };
    if (warning) run.approvals.push({ kind: 'skip', item: next, phase, note: note || 'skipped after a warning' });
    // Skipping the phase whose gate would have authorised implementation moves that
    // authority to the gate the user is answering right now - they saw what comes next.
    if (next === run.authorising_phase) run.authorising_phase = phase;
  }

  Object.assign(ph, { status: 'done', gate: decision === 'skip_next' ? 'approved' : decision, ...(note ? { note } : {}) });
  run.current = nextPending(run);
  save(root, run);
  event(root, 'gate_record', { phase, decision, ...(shipChoice ? { ship_choice: shipChoice } : {}) });
  return {
    ok: true,
    next: run.current,
    progress: progressLine(run),
    ...(phase === 'ship' && run.ship ? { ship: run.ship, hint: `Run git exactly as chosen (${run.ship.choice}); the guard hook permits only that. Then call run_close.` } : {}),
    ...(run.current ? {} : { hint: 'Every phase is finished - call run_close.' }),
  };
}

// ---------------------------------------------------------------- notes, reports, budgets

export function addNote(root, args = {}) {
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run');
  const run = loaded.run;
  const at = nowIso();
  switch (args.kind) {
    case 'decision':
      if (!args.choice || !args.rule) return fail('a decision needs choice and rule');
      run.decisions.push({ choice: String(args.choice), rule: String(args.rule), ...(args.evidence ? { evidence: String(args.evidence) } : {}), ...(run.current ? { phase: run.current } : {}) });
      break;
    case 'open':
      if (!args.question) return fail('an open question needs question');
      run.open.push({ question: String(args.question), ...(args.recommended ? { recommended: String(args.recommended) } : {}), ...(run.current ? { phase: run.current } : {}) });
      break;
    case 'resolve': {
      const item = run.open.find((o, i) => !o.resolved && (o.question === args.question || i === args.index));
      if (!item) return fail('no unresolved open question matches');
      item.resolved = true;
      if (args.answer) item.answer = String(args.answer);
      break;
    }
    case 'approval': {
      const kinds = ['dependency', 'version', 'tool', 'delete', 'ci', 'skip'];
      if (!kinds.includes(args.approval_kind) || !args.item) return fail(`an approval needs approval_kind (${kinds.join(', ')}) and item, e.g. "npm:zod@3.23.8"`);
      run.approvals.push({ kind: args.approval_kind, item: String(args.item), ...(run.current ? { phase: run.current } : {}), ...(args.note ? { note: String(args.note) } : {}) });
      break;
    }
    case 'amendment':
      if (!args.note) return fail('an amendment needs note');
      run.amendments.push({ at, ...(run.current ? { phase: run.current } : {}), note: String(args.note) });
      break;
    case 'commands':
      for (const [name, cmd] of Object.entries(args.commands || {})) {
        if (typeof cmd === 'string' && cmd.trim()) run.commands[name] = { cmd: cmd.trim(), source: args.source || 'the user', confidence: args.confidence || 'user' };
      }
      break;
    case 'stack':
      run.stack = args.stack || null;
      break;
    case 'units':
      if (!Array.isArray(args.units)) return fail('units must be a list');
      run.units = args.units;
      break;
    default:
      return fail('kind must be one of decision, open, resolve, approval, amendment, commands, stack, units');
  }
  save(root, run);
  event(root, 'run_note', { kind: args.kind });
  return { ok: true };
}

function parseReport(text, maxLines) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*REPORT\b/i.test(l));
  const fields = {};
  if (start >= 0) {
    let key = null;
    for (const line of lines.slice(start + 1)) {
      const m = line.match(/^\s*([a-z][a-z_ -]*?)\s*:\s?(.*)$/i);
      if (m && /^(did|files|commands|decisions|open|blocked|full|verdict|findings|diff|scanners)$/i.test(m[1].trim())) {
        key = m[1].trim().toLowerCase();
        fields[key] = m[2];
      } else if (key && line.trim()) {
        fields[key] += `\n${line.trim()}`;
      }
    }
  }
  const block = (start >= 0 ? lines.slice(start) : lines).filter((l) => l.trim());
  const digest = block.slice(0, maxLines).join('\n') + (block.length > maxLines ? `\n… (${block.length - maxLines} more lines in the stored report)` : '');
  return { found: start >= 0, fields, digest };
}

function openItems(value) {
  if (!value) return [];
  const v = value.trim();
  if (!v || /^(none|n\/a|-)$/i.test(v)) return [];
  return v
    .split(/\n|;\s+(?=[A-Z0-9])/)
    .map((s) => s.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((s) => s && !/^none$/i.test(s))
    .map((s) => {
      const m = s.match(/^(.*?)\s*(?:[-–(]\s*)?recommended:?\s*(.+?)\)?$/i);
      return m ? { question: m[1].replace(/[-–(]\s*$/, '').trim(), recommended: m[2].trim() } : { question: s };
    });
}

// Whether a specialist's final message carries the report contract - used by the
// SubagentStop hook to send a specialist back before its output is lost.
export function reportCheck(text) {
  const policy = registry('policies').report;
  const parsed = parseReport(text, policy.max_lines);
  return { found: parsed.found, missing: policy.required_fields.filter((f) => !(f in parsed.fields)) };
}

export function storeReport(root, { phase, agent, report } = {}) {
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run');
  const run = loaded.run;
  const ph = run.phases[phase];
  if (!ph) return fail(`"${phase}" is not in this run`);
  if (!agent || !report) return fail('report_store needs agent and the report text the agent returned');
  const name = String(agent).replace(/^(?:plugin:)?onestop:/i, '');
  const policy = registry('policies').report;
  const dir = statePath(root, 'reports', phase);
  fs.mkdirSync(dir, { recursive: true });
  // The hook stores every report as the specialist finishes; an orchestrator re-sending
  // the same text must not count it twice or add its open questions twice.
  const suffix = `-${slugify(name, 30)}.md`;
  for (const rel of ph.reports || []) {
    if (!rel.endsWith(suffix)) continue;
    let prior = null;
    try { prior = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { /* moved or removed */ }
    if (prior === String(report)) {
      return { ok: true, duplicate: true, path: slash(path.join(root, rel)), digest: parseReport(prior, policy.max_lines).digest, open_added: 0 };
    }
  }
  const n = (ph.reports?.length || 0) + 1;
  const file = path.join(dir, `${String(n).padStart(2, '0')}${suffix}`);
  fs.writeFileSync(file, String(report));
  ph.reports = [...(ph.reports || []), slash(path.relative(root, file))];
  const parsed = parseReport(report, policy.max_lines);
  const missing = policy.required_fields.filter((f) => !(f in parsed.fields));
  const opens = openItems(parsed.fields.open);
  for (const o of opens) run.open.push({ ...o, phase });
  save(root, run);
  event(root, 'report_store', { phase, agent: name, open: opens.length });
  return {
    ok: true,
    path: slash(file),
    digest: parsed.digest,
    open_added: opens.length,
    ...(missing.length ? { warning: `the report is missing ${missing.join(', ')} - the agent did not follow the return contract; ask it to re-send the REPORT block if anything is unclear` } : {}),
  };
}

function baseLimit(kind, limits) {
  switch (kind) {
    case 'build_fix': return limits.build_fix_per_root_cause;
    case 'test_fix': return limits.test_fix_per_test;
    case 'review_fix': return limits.review_fix_per_finding;
    case 'dev_loop': return limits.dev_loop_iterations;
    case 'lane_retry': return registry('policies').retry_budget.lane_retry.per_lane;
    default: return null;
  }
}

export function loopAttempt(root, { loop, kind, root_cause: rootCause } = {}) {
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run');
  const run = loaded.run;
  if (run.status !== 'active') return fail(`the run is ${run.status}`);
  const limits = run.settings.limits;
  const base = baseLimit(kind, limits);
  if (base === null || base === undefined) return fail('kind must be build_fix, test_fix, review_fix, dev_loop or lane_retry');
  if (!loop) return fail('loop needs an id - the module, test, finding or lane this attempt is for');
  const phase = run.current;
  const keyName = kind === 'build_fix' ? `${phase}:build_fix:${rootCause || 'unspecified'}` : `${phase}:${kind}:${loop}`;
  const entry = run.loops[keyName] || { kind, phase, loop, attempts: 0, limit: base, base, exhausted: false };
  let exceeded = null;
  if (entry.attempts + 1 > entry.limit) exceeded = `${entry.attempts} of ${entry.limit} attempts used${kind === 'build_fix' ? ` on root cause "${rootCause || 'unspecified'}"` : ''}`;
  if (!exceeded && kind === 'build_fix') {
    const fixes = Object.values(run.loops).filter((e) => e.phase === phase && e.kind === 'build_fix');
    const phaseTotal = fixes.reduce((a, e) => a + e.attempts, 0);
    const extra = fixes.reduce((a, e) => a + (e.limit - e.base), 0);
    if (phaseTotal + 1 > limits.build_fix_per_phase + extra) exceeded = `${phaseTotal} build-fix runs already in ${phase} (limit ${limits.build_fix_per_phase})`;
  }
  if (exceeded) {
    entry.exhausted = true;
    run.loops[keyName] = entry;
    run.status = 'blocked';
    run.phases[phase].status = 'blocked';
    run.blocked_reason = `${kind} budget exhausted for ${loop}: ${exceeded}`;
    save(root, run);
    event(root, 'loop_attempt', { kind, loop, exhausted: true });
    return {
      ok: true,
      allowed: false,
      exhausted: true,
      guide: guidePath('gates'),
      reason: run.blocked_reason,
      hint: 'Stop looping. Present a gate with the last real error output and every approach tried. Options: try another approach (decision "adjusted", approach in note) | accept and move on ("approved") | stop ("stopped").',
    };
  }
  entry.attempts += 1;
  run.loops[keyName] = entry;
  save(root, run);
  event(root, 'loop_attempt', { kind, loop, attempt: entry.attempts });
  return { ok: true, allowed: true, attempt: entry.attempts, limit: entry.limit, remaining: entry.limit - entry.attempts };
}

// ---------------------------------------------------------------- checkpoints

function addCheckpoint(root, run, label) {
  const snap = git.snapshot(root, label);
  if (!snap.ok) return snap;
  if (!run.base_commit && snap.base) run.base_commit = snap.base;
  const n = run.checkpoints.length ? run.checkpoints[run.checkpoints.length - 1].n + 1 : 0;
  run.checkpoints.push({ n, label, tree_commit: snap.commit, at: nowIso(), ...(run.current ? { phase: run.current } : {}) });
  event(root, 'checkpoint', { n, label });
  return { ok: true, n, commit: snap.commit };
}

// The engine checkpoints on its own: a baseline before the first phase that may write,
// and a checkpoint after every phase that wrote something. Undo then covers the whole
// run - not only the slices the orchestrator remembered to mark.
function phaseWrote(root, ph) {
  return (ph.reports || []).some((rel) => {
    let text = '';
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return false; }
    const files = parseReport(text, Infinity).fields.files;
    return Boolean(files && !/^(none|n\/a|-)?$/i.test(files.trim()));
  });
}

export function checkpoint(root, { label } = {}) {
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run');
  const run = loaded.run;
  if (!run.git) return { ok: false, available: false, error: 'not a git repository - checkpoints are unavailable', hint: 'Say so at the next gate; undo is not possible for this run.' };
  const name = label || `checkpoint ${run.checkpoints.length}`;
  const snap = addCheckpoint(root, run, name);
  if (!snap.ok) return fail(snap.error);
  save(root, run);
  return { ok: true, n: snap.n, label: name, commit: snap.commit };
}

// Undo is two-step: without confirm it only describes what would change, so the
// command can show the user before anything is touched.
//
// Only the run's own checkpointed delta is reversed - from the chosen checkpoint to the
// latest one, never to "now". Anything changed after the latest checkpoint, the user's
// own edits included, is not part of the delta and is left alone; and if those edits
// touched the same lines, the reverse patch no longer applies and nothing is modified.
export function checkpointRevert(root, { scope = 'last', confirm = false } = {}) {
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no run');
  const run = loaded.run;
  if (!run.git) return fail('not a git repository - there are no checkpoints to revert');
  if (!['last', 'whole-run'].includes(scope)) return fail('scope must be "last" or "whole-run"');
  const cps = run.checkpoints;
  if (cps.length < 2) return fail('nothing to undo yet - the run has no checkpointed change since its baseline');
  const latest = cps[cps.length - 1];
  const base = scope === 'whole-run' ? cps[0] : cps[cps.length - 2];
  if (!confirm) {
    const now = git.snapshot(root, 'undo preview');
    const later = now.ok ? git.diffStat(root, latest.tree_commit, now.commit) : '';
    return {
      ok: true,
      preview: true,
      scope,
      undoes: `${base.label} -> ${latest.label}`,
      changes: git.diffStat(root, base.tree_commit, latest.tree_commit) || '(no changes)',
      ...(later ? { left_alone: later } : {}),
      hint: 'Show the changes. If left_alone is present, say those later changes are not part of the undo and stay as they are. Ask: reverse it | cancel. Call again with confirm:true only on "reverse it".',
    };
  }
  const result = git.revertBetween(root, base.tree_commit, latest.tree_commit);
  event(root, 'checkpoint_revert', { scope, ok: result.ok });
  if (result.ok) {
    run.checkpoints = scope === 'whole-run' ? [cps[0]] : cps.slice(0, -1);
    run.amendments.push({ at: nowIso(), ...(run.current ? { phase: run.current } : {}), note: `undo (${scope}) reversed ${result.files.length} file(s): ${base.label} -> ${latest.label}` });
    save(root, run);
  }
  return result;
}
