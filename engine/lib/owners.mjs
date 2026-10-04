// Which sessions own the active run, and which specialist is calling.
//
// The guard, the write guard and the Stop reminders apply to the owning sessions only. A
// run left open in a repository must never change a session that did not start or resume
// it - otherwise one abandoned run blocks `git commit` in every later session, which is the
// opposite of "installing onestop changes nothing until you use it".
//
// A session becomes an owner when it calls the engine's run_open (the PostToolUse hook
// records it). In Claude Code and VS Code a specialist works inside its owner's session
// and every hook payload names it (agent_type). GitHub Copilot CLI runs each specialist in
// a session of its own and names it only when it stops, so a Copilot specialist is linked
// to its owner two ways: the W3C trace it shares with the owner turn that dispatched it,
// and the owner's transcript, which records the agent each subagent session runs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { envValue, nowIso } from './env.mjs';
import { onestopAgent } from './guard.mjs';
import { ensureStateDir, statePath } from './store.mjs';

const SESSIONS = 'sessions';
const TRACES = 'traces';
const SUBAGENTS = 'subagents';

function rows(root, file) {
  try {
    return fs.readFileSync(statePath(root, file), 'utf8').split('\n').filter((l) => l.trim()).map((l) => l.split('\t'));
  } catch {
    return null;
  }
}

function append(root, file, cols) {
  ensureStateDir(root);
  fs.appendFileSync(statePath(root, file), `${cols.join('\t')}\n`);
}

export function owners(root) {
  return rows(root, SESSIONS)?.map((r) => r[0].trim()).filter(Boolean) ?? null;
}

// The trace id of a W3C traceparent (00-<trace>-<span>-<flags>). Copilot CLI sends one in
// every tool hook's payload and environment; a subagent's calls carry its parent's trace.
export function traceOf(payload = {}) {
  const m = String(payload.traceparent || envValue('COPILOT_TRACEPARENT') || '')
    .match(/^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i);
  return m ? m[1].toLowerCase() : null;
}

function noteTrace(root, payload) {
  const trace = traceOf(payload);
  if (trace && !rows(root, TRACES)?.some((r) => r[0] === trace)) append(root, TRACES, [trace, nowIso()]);
}

export function claim(root, payload = {}) {
  if (!payload.session_id) return false;
  noteTrace(root, payload);
  if ((owners(root) || []).includes(payload.session_id)) return false;
  append(root, SESSIONS, [payload.session_id, nowIso()]);
  return true;
}

// Copilot CLI writes each session's events to <home>/session-state/<id>/events.jsonl;
// "subagent.selected" carries the subagent's session id and the agent it runs.
function transcriptAgent(ownerIds, sid) {
  const home = envValue('COPILOT_HOME') || path.join(os.homedir(), '.copilot');
  const needle = `"agentId":"${sid}"`;
  for (const owner of ownerIds.filter((o) => /^[\w-]+$/.test(o))) {
    let text;
    try { text = fs.readFileSync(path.join(home, 'session-state', owner, 'events.jsonl'), 'utf8'); } catch { continue; }
    for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
      const end = text.indexOf('\n', at);
      try {
        const e = JSON.parse(text.slice(text.lastIndexOf('\n', at) + 1, end < 0 ? undefined : end));
        if (e.type === 'subagent.selected' && e.data?.agentName) return String(e.data.agentName);
      } catch { /* a line still being written */ }
    }
  }
  return undefined;
}

// An unknown session is an owner's specialist when it carries an owner's trace or an
// owner's transcript lists it. The answer is kept, so each transcript is read once per
// specialist, and a session with a trace that is not an owner's never pays for the read.
function subagentOf(root, sid, ownerIds, payload) {
  const kept = rows(root, SUBAGENTS)?.find((r) => r[0] === sid);
  if (kept) return { owner: true, agent: onestopAgent(kept[1]) };
  const trace = traceOf(payload);
  const traced = Boolean(trace && rows(root, TRACES)?.some((r) => r[0] === trace));
  if (trace && !traced) return null;
  const name = transcriptAgent(ownerIds, sid);
  if (!traced && name === undefined) return null;
  append(root, SUBAGENTS, [sid, name || '-', nowIso()]);
  return { owner: true, agent: onestopAgent(name) };
}

// { owner, agent }: whether the run is the caller's, and the onestop specialist calling,
// if any. Fails closed: with no session id to compare, or a run opened before ownership
// was recorded, every caller is an owner.
export function identify(root, payload = {}) {
  const agent = onestopAgent(payload.agent_type);
  if (agent) return { owner: true, agent };
  const sid = String(payload.session_id || '');
  const ownerIds = owners(root);
  if (!sid || !ownerIds) return { owner: true, agent: null };
  if (ownerIds.includes(sid)) {
    noteTrace(root, payload);
    return { owner: true, agent: null };
  }
  return subagentOf(root, sid, ownerIds, payload) || { owner: false, agent: null };
}

// Cleared with the run, so one run's owners never carry into the next.
export const OWNER_FILES = [SESSIONS, TRACES, SUBAGENTS];
