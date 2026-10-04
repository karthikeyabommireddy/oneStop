#!/usr/bin/env node
// Every onestop hook - one dispatcher, run as `node "<plugin>/engine/hooks.mjs" <event>`.
//
// One hooks.json serves Claude Code, GitHub Copilot CLI and VS Code. Each runs the command
// through its own shell with the plugin root filled in (VS Code also quotes it), so the
// command stays a bare `node "<path>" <event>` that sh, bash, PowerShell and cmd all parse
// the same way. Node instead of a shell script: no Git Bash dependency, no bash 3.2
// breakage on a default Mac, and real JSON parsing of the payload. The payloads differ by
// client - tool names, argument shapes, where the calling specialist is named - so they are
// read through lib/toolcall.mjs and lib/owners.mjs, never field by field here.
//
// Every hook is quiet outside an active run, and quiet in any session that does not own
// the run (owners.mjs): installing onestop must not change a session that never used it.
// Advisory hooks never fail a turn - any error exits 0 silently. Under Copilot CLI that is
// also what keeps tools usable: it denies the tool when a PreToolUse hook exits non-zero.

import fs from 'node:fs';
import path from 'node:path';
import { envValue, nowIso, registry } from './lib/env.mjs';
import { appendJsonl, ensureStateDir, readJsonl, statePath, withLock } from './lib/store.mjs';
import { loadRun, progressLine, reportCheck, storeReport } from './lib/ledger.mjs';
import { checkCommand, checkScopedCommand, checkWrite, isLedgerFile, onestopAgent, scanSurfaces } from './lib/guard.mjs';
import { claim, identify } from './lib/owners.mjs';
import { toolCall } from './lib/toolcall.mjs';
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
let caller = null;
// Whether the run is the caller's, and which onestop specialist is calling - worked out
// only when an answer matters, because under Copilot CLI it can mean reading a transcript.
const who = () => (caller ||= identify(root, payload));

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

// The one denial shape all three clients honour - Copilot CLI included, which reports an
// exit code 2 as a failed hook and drops the reason.
function deny(reason, rule, detail = {}) {
  try {
    const { agent } = who();
    appendJsonl(statePath(root, 'events.jsonl'), { t: nowIso(), source: 'hook', tool: payload.tool_name, blocked: rule, ...(agent ? { agent } : {}), ...detail });
  } catch { /* the denial matters more than its log line */ }
  emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
}

function preTool() {
  const call = toolCall(payload);
  // Under Copilot CLI this records the trace that the owner's specialists will carry.
  if (call.kind === 'agent') return void who();
  if (!['write', 'shell'].includes(call.kind)) return;
  const { state, run } = runState();
  const live = state === 'active' || state === 'unknown';

  if (call.kind === 'write') {
    const rels = call.files.map(relPath).filter(Boolean);
    // The ledger belongs to the engine whenever one exists, in every session.
    const ledger = state !== 'none' && rels.find(isLedgerFile);
    if (ledger) return deny(checkWrite(ledger, who().agent).reason, 'ledger', { file: ledger });
    if (!live || !rels.length) return;
    const { agent } = who();
    if (!agent) return;
    for (const rel of rels) {
      const verdict = checkWrite(rel, agent);
      if (!verdict.allow) return deny(verdict.reason, verdict.rule, { file: rel });
    }
    return;
  }

  if (!live) return;
  const { owner, agent } = who();
  if (!owner) return;
  let verdict = checkCommand(call.command, run, root);
  if (verdict.allow && agent) verdict = checkScopedCommand(call.command, agent);
  if (!verdict.allow) deny(verdict.reason, verdict.rule, { cmd: call.command.slice(0, 200) });
}

function postTool() {
  const call = toolCall(payload);
  if (call.kind === 'run-open') {
    // The session that opens or resumes a run owns it - the guard and the reminders
    // apply to it, and to no other session.
    if (runState().state === 'active') claim(root, payload);
    return;
  }
  const edits = call.kind === 'write';
  if (edits && call.files.length && kgSetting === 'auto' && fs.existsSync(path.join(root, 'graphify-out', 'graph.json'))) {
    ensureStateDir(root);
    fs.appendFileSync(statePath(root, 'kg-dirty'), call.files.map((f) => `${f}\n`).join(''));
  }
  if (!['write', 'shell', 'agent'].includes(call.kind) || runState().state !== 'active') return;
  const { owner, agent } = who();
  if (!owner) return;
  const rels = call.files.map(relPath).filter(Boolean);
  for (const rel of rels) {
    for (const surface of scanSurfaces(rel, call.text)) {
      appendJsonl(statePath(root, 'security-flags.jsonl'), { t: nowIso(), file: rel, surface, ...(agent ? { agent } : {}) });
    }
  }
  const input = call.input;
  appendJsonl(statePath(root, 'events.jsonl'), {
    t: nowIso(),
    source: 'hook',
    tool: call.name,
    ...(agent ? { by: agent } : {}),
    ...(rels.length ? { file: rels.join(', ') } : {}),
    ...(call.agent ? { agent: call.agent } : {}),
    ...(input.description ? { desc: String(input.description).slice(0, 120) } : {}),
    ...(call.command ? { cmd: call.command.slice(0, 200) } : {}),
  });
}

// A specialist is sent back at most once. Claude Code flags its second stop
// (stop_hook_active); Copilot CLI does not, so the engine remembers whom it sent back.
function sendBackOnce() {
  if (payload.stop_hook_active) return false;
  const id = String(payload.agent_id || '');
  if (!id) return payload.stop_hook_active === false;
  const file = statePath(root, 'sent-back');
  let sent = [];
  try { sent = fs.readFileSync(file, 'utf8').split('\n'); } catch { /* none yet */ }
  if (sent.includes(id)) return false;
  ensureStateDir(root);
  fs.appendFileSync(file, `${id}\n`);
  return true;
}

// A specialist's final message is its report. Store it as it arrives - the orchestrator
// never has to re-send it - and send the specialist back, once, if the report contract is
// missing: whatever it found is otherwise lost with its context. VS Code passes no final
// message; there the orchestrator stores the report itself (report_store).
function subagentStop() {
  const agent = onestopAgent(payload.agent_type);
  if (!agent) return;
  const { state, run } = runState();
  if (state !== 'active' || !run || !run.current || run.phases[run.current]?.status !== 'active') return;
  const text = String(payload.last_assistant_message ?? payload.response ?? '');
  const check = reportCheck(text);
  if ((!check.found || check.missing.length) && sendBackOnce()) {
    const why = check.found ? `your REPORT is missing ${check.missing.join(', ')}` : 'your final message has no REPORT block';
    emit({
      decision: 'block',
      reason: `onestop: ${why}. End with the REPORT block from your brief - did, files, decisions, open, blocked - in at most ${registry('policies').report.max_lines} lines. The orchestrator reads nothing else.`,
    });
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
  const { owner } = who();
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
  // In the owning session, after a resume or a compaction, this re-anchors the orchestrator
  // to where the run is. Any other session gets one line, so it knows the run exists and
  // leaves it alone. Claude Code and VS Code read hookSpecificOutput; Copilot CLI reads the
  // top-level field.
  const text = who().owner
    ? `onestop: run ${run.run_id} ("${run.request}") is active at ${run.current || 'a gate'}.\n${progressLine(run)}\nIf the user continues it, call the onestop engine's run_status first and resume from there.`
    : `onestop: a run is active in this repository ("${run.request}", at ${run.current || 'a gate'}). It does not affect this session; /onestop-resume continues it here.`;
  emit({ additionalContext: text, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } });
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
