#!/usr/bin/env node
// Every onestop hook - one dispatcher, run as `node hooks.mjs <event>` in exec form.
//
// Node instead of bash: exec-form `node` runs the same on Windows, macOS and Linux
// with no shell - so no Git Bash dependency, no bash 3.2 breakage on a default Mac, and
// real JSON parsing of the payload instead of grep.
//
// Every hook is quiet outside an active run, and quiet in any session that does not own
// the run (owners.mjs): installing onestop must not change a session that never used it.
// Advisory hooks never fail a turn - any error exits 0 silently.

import fs from 'node:fs';
import path from 'node:path';
import { envValue, nowIso, registry } from './lib/env.mjs';
import { appendJsonl, ensureStateDir, readJsonl, statePath, withLock } from './lib/store.mjs';
import { loadRun, progressLine, reportCheck, storeReport } from './lib/ledger.mjs';
import { checkCommand, checkScopedCommand, checkWrite, isLedgerFile, onestopAgent, scanSurfaces } from './lib/guard.mjs';
import { claim, isOwner } from './lib/owners.mjs';
import { kgRefreshBackground } from './lib/kg.mjs';

const event = process.argv[2];
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
const RUN_OPEN = 'mcp__plugin_onestop_engine__run_open';

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

const payload = readStdin();
const root = path.resolve(envValue('CLAUDE_PROJECT_DIR') || payload.cwd || process.cwd());
const kgSetting = envValue('CLAUDE_PLUGIN_OPTION_KNOWLEDGE_GRAPH') || 'auto';
// The calling specialist, when the hook fires inside one: plugin:onestop:<agent>.
const agent = onestopAgent(payload.agent_type);

// 'active' when a readable run is in progress; 'unknown' when run.json exists but cannot
// be read - the guard treats that as active, because failing open is the wrong default.
function runState() {
  const loaded = loadRun(root);
  if (loaded.ok) return { state: ['active', 'blocked'].includes(loaded.run.status) ? 'active' : 'idle', run: loaded.run };
  if (loaded.missing) return { state: 'none', run: null };
  return { state: 'unknown', run: loaded.run || null };
}

function relPath(file) {
  if (!file) return '';
  return path.relative(root, path.resolve(root, String(file))).split(path.sep).join('/');
}

function newContent(input = {}) {
  const parts = [input.content, input.new_string, input.new_source];
  for (const e of input.edits || []) parts.push(e.new_string);
  return parts.filter((p) => typeof p === 'string').join('\n');
}

function deny(reason, rule, detail = {}) {
  try {
    appendJsonl(statePath(root, 'events.jsonl'), { t: nowIso(), source: 'hook', tool: payload.tool_name, blocked: rule, ...(agent ? { agent } : {}), ...detail });
  } catch { /* the denial matters more than its log line */ }
  emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
}

function preTool() {
  const tool = payload.tool_name;
  const input = payload.tool_input || {};
  const { state, run } = runState();
  const live = state === 'active' || state === 'unknown';

  if (EDIT_TOOLS.includes(tool)) {
    const rel = relPath(input.file_path || input.notebook_path);
    if (!rel) return;
    // The ledger belongs to the engine whenever one exists, in every session.
    if (state !== 'none' && isLedgerFile(rel)) return deny(checkWrite(rel, agent).reason, 'ledger', { file: rel });
    if (!agent || !live) return;
    const verdict = checkWrite(rel, agent);
    if (!verdict.allow) deny(verdict.reason, verdict.rule, { file: rel });
    return;
  }

  if (!['Bash', 'PowerShell'].includes(tool) || !live || !isOwner(root, payload)) return;
  const command = String(input.command || '');
  let verdict = checkCommand(command, run, root);
  if (verdict.allow && agent) verdict = checkScopedCommand(command, agent);
  if (!verdict.allow) deny(verdict.reason, verdict.rule, { cmd: command.slice(0, 200) });
}

function postTool() {
  const tool = payload.tool_name;
  const input = payload.tool_input || {};
  if (tool === RUN_OPEN) {
    // The session that opens or resumes a run owns it - the guard and the reminders
    // apply to it, and to no other session.
    if (runState().state === 'active') claim(root, payload.session_id);
    return;
  }
  const edits = EDIT_TOOLS.includes(tool);
  if (edits && kgSetting === 'auto' && fs.existsSync(path.join(root, 'graphify-out', 'graph.json'))) {
    const file = input.file_path || input.notebook_path;
    if (file) { ensureStateDir(root); fs.appendFileSync(statePath(root, 'kg-dirty'), `${file}\n`); }
  }
  const { state } = runState();
  if (state !== 'active' || !isOwner(root, payload)) return;
  const rel = relPath(input.file_path || input.notebook_path);
  if (edits && rel) {
    for (const surface of scanSurfaces(rel, newContent(input))) {
      appendJsonl(statePath(root, 'security-flags.jsonl'), { t: nowIso(), file: rel, surface, ...(agent ? { agent } : {}) });
    }
  }
  if (edits || ['Agent', 'Task', 'Bash', 'PowerShell'].includes(tool)) {
    appendJsonl(statePath(root, 'events.jsonl'), {
      t: nowIso(),
      source: 'hook',
      tool,
      ...(agent ? { by: agent } : {}),
      ...(rel ? { file: rel } : {}),
      ...(input.subagent_type ? { agent: input.subagent_type } : {}),
      ...(input.description ? { desc: String(input.description).slice(0, 120) } : {}),
      ...(input.command ? { cmd: String(input.command).slice(0, 200) } : {}),
    });
  }
}

// A specialist's final message is its report. Store it as it arrives - the orchestrator
// never has to re-send it - and send the specialist back, once, if the report contract is
// missing: whatever it found is otherwise lost with its context.
function subagentStop() {
  if (!agent) return;
  const { state, run } = runState();
  if (state !== 'active' || !run || !run.current || run.phases[run.current]?.status !== 'active') return;
  const text = String(payload.last_assistant_message || '');
  const check = reportCheck(text);
  if ((!check.found || check.missing.length) && !payload.stop_hook_active) {
    const why = check.found ? `your REPORT is missing ${check.missing.join(', ')}` : 'your final message has no REPORT block';
    const reason = `onestop: ${why}. End with the REPORT block from your brief - did, files, decisions, open, blocked - in at most ${registry('policies').report.max_lines} lines. The orchestrator reads nothing else.`;
    emit({ hookSpecificOutput: { hookEventName: 'SubagentStop', decision: 'block', reason, additionalContext: reason } });
    return;
  }
  if (!text.trim()) return;
  withLock(root, 'ledger', () => storeReport(root, { phase: run.current, agent, report: text }));
}

function requestedHere() {
  try {
    const by = fs.readFileSync(statePath(root, 'requested'), 'utf8').split('\t')[0].trim();
    return !by || !payload.session_id || by === payload.session_id;
  } catch {
    return false;
  }
}

function stop() {
  const { state, run } = runState();
  const owner = isOwner(root, payload);
  const notes = [];
  if (state === 'none' && requestedHere()) {
    notes.push('/onestop was requested, but the engine never opened a run - the pipeline did not execute. Call run_open with the request.');
  }
  if (state === 'unknown' && owner) notes.push('.onestop/run.json cannot be read. Call run_status for the error and offer to archive it.');
  if (state === 'active' && run && owner) {
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
  // Plain stdout from SessionStart goes into the model's context. In the owning session,
  // after a resume or a compaction, this re-anchors the orchestrator to where the run is.
  // Any other session gets one line, so it knows the run exists and leaves it alone.
  if (isOwner(root, payload)) {
    process.stdout.write(`onestop: run ${run.run_id} ("${run.request}") is active at ${run.current || 'a gate'}.\n${progressLine(run)}\nIf the user continues it, call the onestop engine's run_status first and resume from there.\n`);
  } else {
    process.stdout.write(`onestop: a run is active in this repository ("${run.request}", at ${run.current || 'a gate'}). It does not affect this session; /onestop-resume continues it here.\n`);
  }
}

function promptSubmit() {
  const prompt = String(payload.prompt || '');
  if (/^\s*\/(onestop:)?onestop(\s|$)/i.test(prompt)) {
    ensureStateDir(root);
    fs.writeFileSync(statePath(root, 'requested'), `${payload.session_id || ''}\t${nowIso()}\n`);
  }
}

try {
  ({
    'pre-tool': preTool,
    'post-tool': postTool,
    'subagent-stop': subagentStop,
    stop,
    'session-start': sessionStart,
    'prompt-submit': promptSubmit,
  }[event] || (() => {}))();
} catch {
  // Advisory: never fail the user's turn because a hook tripped.
}
process.exitCode = 0;
