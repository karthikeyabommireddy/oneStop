#!/usr/bin/env node
// Every onestop hook, one dispatcher, run as `node hooks.mjs <event>` in exec form.
//
// Node instead of bash: exec-form `node` runs the same on Windows, macOS and Linux
// with no shell - so no Git Bash dependency, no bash 3.2 breakage on a default Mac, and
// real JSON parsing of the payload instead of grep. Every hook is quiet outside an
// active run: installing onestop must not change a session that never used it.
// Advisory hooks never fail a turn - any error exits 0 silently.

import fs from 'node:fs';
import path from 'node:path';
import { envValue, nowIso } from './lib/env.mjs';
import { appendJsonl, ensureStateDir, readJsonl, statePath } from './lib/store.mjs';
import { loadRun, progressLine } from './lib/ledger.mjs';
import { checkCommand, scanSurfaces } from './lib/guard.mjs';
import { kgRefreshBackground } from './lib/kg.mjs';

const event = process.argv[2];

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

const payload = readStdin();
const root = path.resolve(envValue('CLAUDE_PROJECT_DIR') || payload.cwd || process.cwd());
const kgSetting = envValue('CLAUDE_PLUGIN_OPTION_KNOWLEDGE_GRAPH') || 'auto';

// 'active' when a readable run is in progress; 'unknown' when run.json exists but cannot
// be read - the guard treats that as active, because failing open is the wrong default.
function runState() {
  const loaded = loadRun(root);
  if (loaded.ok) return { state: ['active', 'blocked'].includes(loaded.run.status) ? 'active' : 'idle', run: loaded.run };
  if (loaded.missing) return { state: 'none', run: null };
  return { state: 'unknown', run: loaded.run || null };
}

function newContent(input = {}) {
  const parts = [input.content, input.new_string, input.new_source];
  for (const e of input.edits || []) parts.push(e.new_string);
  return parts.filter((p) => typeof p === 'string').join('\n');
}

function preTool() {
  if (!['Bash', 'PowerShell'].includes(payload.tool_name)) return;
  const { state, run } = runState();
  if (state !== 'active' && state !== 'unknown') return;
  const verdict = checkCommand(payload.tool_input?.command || '', run, root);
  if (verdict.allow) return;
  appendJsonl(statePath(root, 'events.jsonl'), { t: nowIso(), source: 'hook', tool: payload.tool_name, blocked: verdict.rule, cmd: String(payload.tool_input?.command || '').slice(0, 200) });
  emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: verdict.reason } });
}

function postTool() {
  const tool = payload.tool_name;
  const input = payload.tool_input || {};
  const edits = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool);
  if (edits && kgSetting === 'auto' && fs.existsSync(path.join(root, 'graphify-out', 'graph.json'))) {
    const file = input.file_path || input.notebook_path;
    if (file) { ensureStateDir(root); fs.appendFileSync(statePath(root, 'kg-dirty'), `${file}\n`); }
  }
  const { state } = runState();
  if (state !== 'active') return;
  const file = String(input.file_path || input.notebook_path || '');
  const rel = file ? path.relative(root, path.resolve(root, file)).split(path.sep).join('/') : '';
  if (edits && rel) {
    for (const surface of scanSurfaces(rel, newContent(input))) {
      appendJsonl(statePath(root, 'security-flags.jsonl'), { t: nowIso(), file: rel, surface });
    }
  }
  if (edits || ['Agent', 'Task', 'Bash', 'PowerShell'].includes(tool)) {
    appendJsonl(statePath(root, 'events.jsonl'), {
      t: nowIso(),
      source: 'hook',
      tool,
      ...(rel ? { file: rel } : {}),
      ...(input.subagent_type ? { agent: input.subagent_type } : {}),
      ...(input.description ? { desc: String(input.description).slice(0, 120) } : {}),
      ...(input.command ? { cmd: String(input.command).slice(0, 200) } : {}),
    });
  }
}

function stop() {
  const { state, run } = runState();
  const notes = [];
  if (state === 'none' && fs.existsSync(statePath(root, 'requested'))) {
    notes.push('/onestop was requested, but the engine never opened a run - the pipeline did not execute. Call run_open with the request.');
  }
  if (state === 'unknown') notes.push('.onestop/run.json cannot be read. Call run_status for the error and offer to archive it.');
  if (state === 'active' && run) {
    const awaiting = run.mask.find((p) => run.phases[p]?.status === 'awaiting_gate');
    if (awaiting) notes.push(`The ${awaiting} gate is pending and was not answered this turn - present it before any other work.`);
    if (run.status === 'blocked') notes.push(`The run is blocked: ${run.blocked_reason}. Present the blocked gate.`);
    const flags = readJsonl(statePath(root, 'security-flags.jsonl'));
    const reviewDone = ['done', 'skipped'].includes(run.phases.review?.status);
    if (flags.length && run.phases.review && !reviewDone) {
      notes.push(`Security surfaces touched (${[...new Set(flags.map((f) => f.surface))].join(', ')}) - security-reviewer will bind in review.`);
    }
  }
  if (kgSetting === 'auto') { try { kgRefreshBackground(root); } catch { /* the graph is an optimisation, never a blocker */ } }
  if (!notes.length) return;
  const text = `[onestop] ${run ? `${progressLine(run)}\n` : ''}${notes.map((n) => `- ${n}`).join('\n')}`;
  emit({
    systemMessage: text,
    ...(payload.stop_hook_active ? {} : { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: text } }),
  });
}

function sessionStart() {
  const { state, run } = runState();
  if (state !== 'active' || !run) return;
  // Plain stdout from SessionStart goes into the model's context - after a resume or a
  // compaction this is what re-anchors the orchestrator to where the run actually is.
  process.stdout.write(`onestop: run ${run.run_id} ("${run.request}") is active at ${run.current || 'a gate'}.\n${progressLine(run)}\nIf the user continues it, call the onestop engine's run_status first and resume from there.\n`);
}

function promptSubmit() {
  const prompt = String(payload.prompt || '');
  if (/^\s*\/(onestop:)?onestop(\s|$)/i.test(prompt)) {
    ensureStateDir(root);
    fs.writeFileSync(statePath(root, 'requested'), `${nowIso()}\n`);
  }
}

try {
  ({ 'pre-tool': preTool, 'post-tool': postTool, stop, 'session-start': sessionStart, 'prompt-submit': promptSubmit }[event] || (() => {}))();
} catch {
  // Advisory: never fail the user's turn because a hook tripped.
}
process.exitCode = 0;
