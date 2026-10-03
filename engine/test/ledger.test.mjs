// The run ledger as a state machine: order, gates, reports, budgets, undo.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { call, ledger, makeRepo, readText, removeRepo, report } from './helpers.mjs';

function start(dir, { intent = 'defect', gate_mode = 'every-phase' } = {}) {
  assert.equal(call(dir, 'run_open', { request: 'a request' }).ok, true);
  const g = call(dir, 'gate_record', { phase: 'intake', decision: 'approved', intent, tier: 'standard', gate_mode });
  assert.equal(g.ok, true, g.error);
}

function runPhase(dir, phase, { files = 'none', open = 'none', approve = true } = {}) {
  let r = call(dir, 'phase_start', { phase });
  assert.equal(r.ok, true, `${phase}: ${r.error}`);
  r = call(dir, 'report_store', { phase, agent: 'onestop:specialist', report: report('specialist', phase, { files, open }) });
  assert.equal(r.ok, true, r.error);
  r = call(dir, 'phase_finish', { phase, summary: phase });
  assert.equal(r.ok, true, r.error);
  if (approve && r.needs_gate) assert.equal(call(dir, 'gate_record', { phase, decision: 'approved' }).ok, true);
  return r;
}

test('a second request never overwrites an active run', () => {
  const dir = makeRepo({}, { git: true });
  try {
    call(dir, 'run_open', { request: 'first' });
    const r = call(dir, 'run_open', { request: 'second' });
    assert.equal(r.conflict, true);
    assert.equal(call(dir, 'run_open', { on_conflict: 'resume' }).resumed, true);
  } finally { removeRepo(dir); }
});

test('phases run in order, only after gate zero, each after the previous gate', () => {
  const dir = makeRepo({}, { git: true });
  try {
    call(dir, 'run_open', { request: 'x' });
    assert.match(call(dir, 'phase_start', { phase: 'context' }).error, /gate zero/);
    call(dir, 'gate_record', { phase: 'intake', decision: 'approved', intent: 'defect', tier: 'standard' });
    assert.equal(call(dir, 'phase_start', { phase: 'discovery' }).ok, false);
    runPhase(dir, 'context', { approve: false });
    assert.match(call(dir, 'phase_start', { phase: 'discovery' }).error, /waiting for its gate/);
  } finally { removeRepo(dir); }
});

test('implementation waits for its authorising gate', () => {
  const dir = makeRepo({}, { git: true });
  try {
    start(dir, { intent: 'defect' });
    runPhase(dir, 'context');
    runPhase(dir, 'discovery');
    runPhase(dir, 'reproduce', { approve: false });
    assert.match(call(dir, 'phase_start', { phase: 'implement' }).error, /waiting for its gate|not authorised/);
    call(dir, 'gate_record', { phase: 'reproduce', decision: 'approved' });
    assert.equal(call(dir, 'phase_start', { phase: 'implement' }).ok, true);
  } finally { removeRepo(dir); }
});

test('a specialist phase cannot finish without a stored report', () => {
  const dir = makeRepo({}, { git: true });
  try {
    start(dir);
    call(dir, 'phase_start', { phase: 'context' });
    assert.match(call(dir, 'phase_finish', { phase: 'context', summary: 'x' }).error, /no specialist report/);
  } finally { removeRepo(dir); }
});

test('the same report sent twice is stored once', () => {
  const dir = makeRepo({}, { git: true });
  try {
    start(dir);
    call(dir, 'phase_start', { phase: 'context' });
    const text = report('stack-adapter', 'context', { open: 'Which test command? recommended: pnpm test' });
    assert.equal(call(dir, 'report_store', { phase: 'context', agent: 'plugin:onestop:stack-adapter', report: text }).open_added, 1);
    const again = call(dir, 'report_store', { phase: 'context', agent: 'stack-adapter', report: text });
    assert.equal(again.duplicate, true);
    assert.equal(ledger(dir).phases.context.reports.length, 1);
    assert.equal(ledger(dir).open.length, 1);
  } finally { removeRepo(dir); }
});

test('autonomous mode still stops for a decision only the user can make', () => {
  const dir = makeRepo({}, { git: true });
  try {
    start(dir, { gate_mode: 'autonomous' });
    const quiet = runPhase(dir, 'context');
    assert.equal(quiet.needs_gate, false);
    const asked = runPhase(dir, 'discovery', { open: 'Which framework? recommended: React', approve: false });
    assert.equal(asked.needs_gate, true);
    assert.equal(asked.open_questions[0].recommended, 'React');
    assert.equal(call(dir, 'run_note', { kind: 'resolve', question: 'Which framework?', answer: 'React' }).ok, true);
    assert.equal(call(dir, 'gate_record', { phase: 'discovery', decision: 'approved' }).ok, true);
  } finally { removeRepo(dir); }
});

test('a spent budget blocks the run until the user chooses another approach', () => {
  const dir = makeRepo({}, { git: true });
  try {
    start(dir, { intent: 'defect' });
    for (const p of ['context', 'discovery', 'reproduce']) runPhase(dir, p);
    call(dir, 'phase_start', { phase: 'implement' });
    for (let i = 1; i <= 3; i++) assert.equal(call(dir, 'loop_attempt', { loop: 'm1', kind: 'build_fix', root_cause: 'missing import' }).allowed, true);
    const spent = call(dir, 'loop_attempt', { loop: 'm1', kind: 'build_fix', root_cause: 'missing import' });
    assert.equal(spent.allowed, false);
    assert.equal(ledger(dir).status, 'blocked');
    assert.equal(call(dir, 'loop_attempt', { loop: 'm1', kind: 'build_fix', root_cause: 'missing import' }).ok, false);
    assert.equal(call(dir, 'gate_record', { phase: 'implement', decision: 'adjusted', note: 'try the other module path' }).ok, true);
    assert.equal(call(dir, 'loop_attempt', { loop: 'm1', kind: 'build_fix', root_cause: 'missing import' }).allowed, true);
  } finally { removeRepo(dir); }
});

test('skipping tests after a behaviour change needs a second answer; ship cannot be skipped', () => {
  const dir = makeRepo({}, { git: true });
  try {
    start(dir, { intent: 'defect' });
    for (const p of ['context', 'discovery', 'reproduce']) runPhase(dir, p);
    runPhase(dir, 'implement', { files: 'src/a.ts', approve: false });
    const warned = call(dir, 'gate_record', { phase: 'implement', decision: 'skip_next' });
    assert.equal(warned.needs_confirmation, true);
    assert.equal(call(dir, 'gate_record', { phase: 'implement', decision: 'skip_next', confirmed: true }).ok, true);
    assert.equal(ledger(dir).phases.test.status, 'skipped');
    runPhase(dir, 'review', { approve: false });
    assert.match(call(dir, 'gate_record', { phase: 'review', decision: 'skip_next' }).error, /ship cannot be skipped/);
  } finally { removeRepo(dir); }
});

test('the ship gate needs an explicit choice', () => {
  const dir = makeRepo({}, { git: true });
  try {
    start(dir, { intent: 'docs' });
    for (const p of ['context', 'discovery', 'implement', 'review']) runPhase(dir, p);
    runPhase(dir, 'ship', { approve: false });
    assert.match(call(dir, 'gate_record', { phase: 'ship', decision: 'approved' }).error, /ship_choice/);
    const ok = call(dir, 'gate_record', { phase: 'ship', decision: 'approved', ship_choice: 'local-commit' });
    assert.deepEqual(ok.ship, { choice: 'local-commit', approved: true });
    assert.equal(call(dir, 'run_close', { status: 'complete' }).ok, true);
  } finally { removeRepo(dir); }
});

test('undo reverses only the run\'s own checkpointed changes', () => {
  const dir = makeRepo({ 'a.txt': 'one\ntwo\n', 'c.txt': 'alpha\nbeta\n' }, { git: true });
  const write = (rel, body) => fs.writeFileSync(path.join(dir, rel), body);
  try {
    write('mine.txt', 'my work before the run\n');
    start(dir, { intent: 'feature', gate_mode: 'autonomous' });
    assert.equal(ledger(dir).checkpoints.length, 0);
    runPhase(dir, 'context');
    assert.equal(ledger(dir).checkpoints[0].label, 'baseline');
    assert.equal(ledger(dir).checkpoints.length, 1);

    call(dir, 'phase_start', { phase: 'requirements' });
    write('b.txt', 'written by the run\n');
    write('c.txt', 'alpha\nbeta\ngamma\n');
    call(dir, 'report_store', { phase: 'requirements', agent: 'ba-analyst', report: report('ba-analyst', 'requirements', { files: 'b.txt, c.txt' }) });
    call(dir, 'phase_finish', { phase: 'requirements', summary: 'x' });
    assert.equal(ledger(dir).checkpoints.at(-1).label, 'after requirements');

    write('a.txt', 'one\ntwo\nmy later edit\n');
    const preview = call(dir, 'checkpoint_revert', { scope: 'last' });
    assert.match(preview.changes, /b\.txt/);
    assert.doesNotMatch(preview.changes, /a\.txt/);
    assert.match(preview.left_alone, /a\.txt/);
    assert.equal(call(dir, 'checkpoint_revert', { scope: 'last', confirm: true }).ok, true);
    assert.equal(readText(dir, 'b.txt'), null);
    assert.equal(readText(dir, 'c.txt'), 'alpha\nbeta\n');
    assert.equal(readText(dir, 'a.txt'), 'one\ntwo\nmy later edit\n');
    assert.equal(readText(dir, 'mine.txt'), 'my work before the run\n');
    assert.equal(ledger(dir).checkpoints.length, 1);
  } finally { removeRepo(dir); }
});

test('undo refuses, changing nothing, when the user edited the same lines', () => {
  const dir = makeRepo({ 'c.txt': 'alpha\nbeta\n' }, { git: true });
  const write = (rel, body) => fs.writeFileSync(path.join(dir, rel), body);
  try {
    start(dir, { intent: 'feature', gate_mode: 'autonomous' });
    runPhase(dir, 'context');
    call(dir, 'phase_start', { phase: 'requirements' });
    write('c.txt', 'alpha\nBETA-by-run\n');
    call(dir, 'report_store', { phase: 'requirements', agent: 'ba-analyst', report: report('ba-analyst', 'requirements', { files: 'c.txt' }) });
    call(dir, 'phase_finish', { phase: 'requirements', summary: 'x' });
    write('c.txt', 'alpha\nBETA-by-user\n');
    const r = call(dir, 'checkpoint_revert', { scope: 'last', confirm: true });
    assert.equal(r.ok, false);
    assert.match(r.error, /no longer applies/);
    assert.equal(readText(dir, 'c.txt'), 'alpha\nBETA-by-user\n');
  } finally { removeRepo(dir); }
});
