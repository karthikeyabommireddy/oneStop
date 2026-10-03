// The hooks as Claude Code runs them - separate processes, payloads on stdin.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { call, denied, hook, hookAsync, hookText, ledger, makeRepo, removeRepo, report } from './helpers.mjs';

const A = 'session-A';
const B = 'session-B';
const as = (agent) => ({ session_id: A, agent_id: `id-${agent}`, agent_type: `plugin:onestop:${agent}` });

function openOwned() {
  const dir = makeRepo({ 'package.json': '{"name":"x"}', 'src/App.tsx': 'export const App = 1;' }, { git: true });
  assert.equal(call(dir, 'run_open', { request: 'add CSV export' }).created, true);
  hook(dir, 'post-tool', { session_id: A, tool_name: 'mcp__plugin_onestop_engine__run_open', tool_input: {} });
  return dir;
}

test('only the sessions that own the run are guarded', () => {
  const dir = openOwned();
  try {
    assert.match(fs.readFileSync(path.join(dir, '.onestop', 'sessions'), 'utf8'), /session-A/);
    assert.ok(denied(hook(dir, 'pre-tool', { session_id: A, tool_name: 'Bash', tool_input: { command: 'git commit -m x' } })));
    assert.equal(hook(dir, 'pre-tool', { session_id: B, tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }), null);
    assert.equal(hook(dir, 'stop', { session_id: B }), null);
    assert.match(hookText(dir, 'session-start', { session_id: B, source: 'startup' }), /does not affect this session/);
    call(dir, 'run_close', { status: 'stopped' });
    assert.equal(fs.existsSync(path.join(dir, '.onestop', 'sessions')), false);
    assert.equal(hook(dir, 'pre-tool', { session_id: A, tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }), null);
  } finally { removeRepo(dir); }
});

test('nobody but the engine writes the ledger', () => {
  const dir = openOwned();
  try {
    const target = path.join(dir, '.onestop', 'run.json');
    assert.ok(denied(hook(dir, 'pre-tool', { session_id: B, tool_name: 'Write', tool_input: { file_path: target, content: '{}' } })));
    assert.ok(denied(hook(dir, 'pre-tool', { ...as('implementer'), tool_name: 'Edit', tool_input: { file_path: target, old_string: 'a', new_string: 'b' } })));
    assert.equal(hook(dir, 'pre-tool', { session_id: A, tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src', 'App.tsx'), old_string: '1', new_string: '2' } }), null);
  } finally { removeRepo(dir); }
});

test('read-only and documentation roles are held to their scope', () => {
  const dir = openOwned();
  const write = (agent, rel) => hook(dir, 'pre-tool', { ...as(agent), tool_name: 'Write', tool_input: { file_path: path.join(dir, rel), content: 'x' } });
  const sh = (agent, command) => hook(dir, 'pre-tool', { ...as(agent), tool_name: 'Bash', tool_input: { command } });
  try {
    assert.ok(denied(write('code-reviewer', 'src/App.tsx')));
    assert.equal(write('code-reviewer', '.onestop/reports/review/code-reviewer.full.md'), null);
    assert.equal(write('planner', 'docs/design/csv/plan.md'), null);
    assert.ok(denied(write('planner', 'src/plan.ts')));
    assert.equal(write('implementer', 'src/export.ts'), null);
    assert.ok(denied(sh('code-reviewer', 'npm test > out.txt')));
    assert.equal(sh('code-reviewer', 'npm test 2>&1 | tail -5'), null);
    assert.equal(sh('implementer', 'npm test > out.txt'), null);
  } finally { removeRepo(dir); }
});

test('reports are captured as specialists finish, and a missing REPORT is sent back', () => {
  const dir = openOwned();
  try {
    call(dir, 'gate_record', { phase: 'intake', decision: 'approved', intent: 'feature', tier: 'standard' });
    call(dir, 'phase_start', { phase: 'context' });
    const back = hook(dir, 'subagent-stop', { ...as('stack-adapter'), last_assistant_message: 'All good.', stop_hook_active: false });
    assert.equal(back.hookSpecificOutput.decision, 'block');
    const twice = hook(dir, 'subagent-stop', { ...as('stack-adapter'), last_assistant_message: 'Still no block.', stop_hook_active: true });
    assert.equal(twice, null, 'never loops: a second stop is let through');
    const text = report('stack-adapter', 'context', { open: 'Which test command? recommended: pnpm test' });
    assert.equal(hook(dir, 'subagent-stop', { ...as('stack-adapter'), last_assistant_message: text, stop_hook_active: false }), null);
    const run = ledger(dir);
    assert.equal(run.phases.context.reports.filter((r) => r.endsWith('stack-adapter.md')).length >= 1, true);
    assert.equal(run.open.filter((o) => !o.resolved).length, 1);
    assert.equal(call(dir, 'report_store', { phase: 'context', agent: 'stack-adapter', report: text }).duplicate, true);
  } finally { removeRepo(dir); }
});

test('specialists finishing at the same moment all land (ledger lock)', async () => {
  const dir = openOwned();
  try {
    call(dir, 'gate_record', { phase: 'intake', decision: 'approved', intent: 'feature', tier: 'standard' });
    call(dir, 'phase_start', { phase: 'context' });
    await Promise.all([1, 2, 3, 4, 5].map((n) => hookAsync(dir, 'subagent-stop', {
      session_id: A, agent_id: `p${n}`, agent_type: 'plugin:onestop:discovery-scout',
      last_assistant_message: `${report('discovery-scout', 'context')}\n(unit ${n})`, stop_hook_active: false,
    })));
    assert.equal(ledger(dir).phases.context.reports.length, 5);
    assert.equal(fs.existsSync(path.join(dir, '.onestop', 'ledger.lock')), false);
  } finally { removeRepo(dir); }
});

test('hooks stay silent when there is no run', () => {
  const dir = makeRepo({ 'a.txt': 'x' }, { git: true });
  try {
    assert.equal(hook(dir, 'pre-tool', { session_id: A, tool_name: 'Bash', tool_input: { command: 'git push --force' } }), null);
    assert.equal(hook(dir, 'stop', { session_id: A }), null);
    assert.equal(hookText(dir, 'session-start', { session_id: A, source: 'startup' }), '');
    assert.equal(fs.existsSync(path.join(dir, '.onestop')), false);
  } finally { removeRepo(dir); }
});
