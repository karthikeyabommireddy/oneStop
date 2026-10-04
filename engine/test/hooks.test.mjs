// The hooks as Claude Code runs them - separate processes, payloads on stdin.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
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
    assert.equal(back.decision, 'block', 'top-level, where Claude Code and Copilot CLI both read it');
    assert.match(back.reason, /no REPORT block/);
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

test('session start speaks to every client', () => {
  const dir = openOwned();
  try {
    const out = hook(dir, 'session-start', { session_id: A, source: 'resume' });
    assert.match(out.additionalContext, /is active/, 'Copilot CLI reads the top-level field');
    assert.equal(out.hookSpecificOutput.additionalContext, out.additionalContext, 'Claude Code and VS Code read hookSpecificOutput');
  } finally { removeRepo(dir); }
});

// ---------------------------------------------------------------- GitHub Copilot CLI and VS Code

const C = 'copilot-owner';
const trace = (n) => `00-${String(n).repeat(32)}-${'1'.repeat(16)}-01`;

// Copilot CLI names the engine's tools <server>-<tool> and sends a W3C traceparent.
function openByCopilot() {
  const dir = makeRepo({ 'package.json': '{"name":"x"}', 'src/App.tsx': 'export const App = 1;' }, { git: true });
  assert.equal(call(dir, 'run_open', { request: 'add CSV export' }).created, true);
  hook(dir, 'post-tool', { hook_event_name: 'PostToolUse', session_id: C, tool_name: 'engine-run_open', tool_input: {}, traceparent: trace(1) });
  return dir;
}

test('GitHub Copilot CLI: its tool arguments meet the same guard', () => {
  const dir = openByCopilot();
  const copilot = (tool_name, tool_input, session_id = C) => hook(dir, 'pre-tool', { hook_event_name: 'PreToolUse', session_id, tool_name, tool_input, traceparent: trace(1) });
  try {
    assert.match(fs.readFileSync(path.join(dir, '.onestop', 'sessions'), 'utf8'), /copilot-owner/, 'engine-run_open claims the run');
    assert.ok(denied(copilot('Bash', { command: 'git push origin main', description: 'push' })));
    assert.ok(denied(copilot('Write', { path: path.join(dir, '.onestop', 'run.json'), file_text: '{}' }, 'someone-else')));
    assert.equal(copilot('Edit', { path: path.join(dir, 'src', 'App.tsx'), old_str: '1', new_str: '2' }), null);
    assert.equal(copilot('Bash', { command: 'npm test' }), null);
  } finally { removeRepo(dir); }
});

test('a Copilot CLI specialist works in its own session: linked by trace, named by transcript', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'onestop-copilot-home-'));
  const dir = openByCopilot();
  const transcript = path.join(home, 'session-state', C, 'events.jsonl');
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.writeFileSync(transcript, `${[
    { type: 'session.start', data: { sessionId: C } },
    { type: 'subagent.selected', data: { agentName: 'onestop:code-reviewer', tools: ['Read'] }, agentId: 'sub-1' },
  ].map((e) => JSON.stringify(e)).join('\n')}\n`);
  const copilot = (session_id, turn, tool_name, tool_input) => hook(dir, 'pre-tool', { hook_event_name: 'PreToolUse', session_id, tool_name, tool_input, traceparent: trace(turn) }, { COPILOT_HOME: home });
  try {
    // The owner's dispatch records this turn's trace before the specialist starts.
    assert.equal(copilot(C, 2, 'Agent', { agent_type: 'onestop:code-reviewer', prompt: 'review' }), null);
    assert.ok(denied(copilot('sub-1', 2, 'Bash', { command: 'git commit -m x' })), 'the specialist is guarded');
    assert.ok(denied(copilot('sub-1', 2, 'Write', { path: path.join(dir, 'src', 'App.tsx'), file_text: 'x' })), 'and held to its read-only scope');
    assert.match(fs.readFileSync(path.join(dir, '.onestop', 'subagents'), 'utf8'), /^sub-1\tonestop:code-reviewer\t/m);
    assert.equal(copilot('stranger', 3, 'Bash', { command: 'git commit -m x' }), null, 'an unrelated session is left alone');
    call(dir, 'run_close', { status: 'stopped' });
    for (const f of ['sessions', 'traces', 'subagents']) assert.equal(fs.existsSync(path.join(dir, '.onestop', f)), false, `${f} goes with the run`);
  } finally {
    removeRepo(dir);
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a specialist is sent back once, even by a client that does not flag the second stop', () => {
  const dir = openByCopilot();
  try {
    call(dir, 'gate_record', { phase: 'intake', decision: 'approved', intent: 'feature', tier: 'standard' });
    call(dir, 'phase_start', { phase: 'context' });
    const stopped = (msg) => hook(dir, 'subagent-stop', { hook_event_name: 'SubagentStop', session_id: C, agent_id: 'sub-9', agent_type: 'onestop:stack-adapter', last_assistant_message: msg, stop_reason: 'end_turn' });
    assert.equal(stopped('Looked around.').decision, 'block');
    assert.equal(stopped('Still nothing.'), null, 'never loops');
    assert.equal(stopped(report('stack-adapter', 'context')), null);
    const stored = ledger(dir).phases.context.reports.map((r) => fs.readFileSync(path.join(dir, r), 'utf8'));
    assert.ok(stored.some((t) => t.startsWith('REPORT stack-adapter - context')));
  } finally { removeRepo(dir); }
});

test('VS Code: its own tools are read by what they do', () => {
  const dir = openOwned();
  const vscode = (tool_name, tool_input) => hook(dir, 'pre-tool', { hook_event_name: 'PreToolUse', session_id: A, tool_name, tool_input });
  const runJson = path.join(dir, '.onestop', 'run.json');
  try {
    assert.ok(denied(vscode('run_in_terminal', { command: 'git push', explanation: 'x', isBackground: false })));
    assert.ok(denied(vscode('create_file', { filePath: runJson, content: '{}' })));
    assert.ok(denied(vscode('multi_replace_string_in_file', { replacements: [
      { filePath: path.join(dir, 'src', 'App.tsx'), oldString: '1', newString: '2' },
      { filePath: runJson, oldString: 'a', newString: 'b' },
    ] })));
    assert.ok(denied(vscode('apply_patch', { input: '*** Begin Patch\n*** Update File: .onestop/run.json\n@@\n-a\n+b\n*** End Patch', explanation: 'x' })));
    assert.equal(vscode('replace_string_in_file', { filePath: path.join(dir, 'src', 'App.tsx'), oldString: '1', newString: '2' }), null);
    assert.equal(vscode('read_file', { filePath: runJson }), null, 'reading the ledger is fine');
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
