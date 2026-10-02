// Which Claude Code sessions own the active run.
//
// The guard, the write guard and the Stop reminders apply to those sessions only. A run
// left open in a repository must never change a session that did not start or resume it
// - otherwise one abandoned run blocks `git commit` in every later session, which is the
// opposite of "installing onestop changes nothing until you use it".
//
// A session becomes an owner when it calls the engine's run_open (the PostToolUse hook
// records it). onestop specialists always count as owned: they only ever run inside one.

import fs from 'node:fs';
import { nowIso } from './env.mjs';
import { ensureStateDir, statePath } from './store.mjs';

const FILE = 'sessions';

export function owners(root) {
  try {
    return fs.readFileSync(statePath(root, FILE), 'utf8')
      .split('\n')
      .map((l) => l.split('\t')[0].trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

export function claim(root, sessionId) {
  if (!sessionId) return false;
  const list = owners(root) || [];
  if (list.includes(sessionId)) return false;
  ensureStateDir(root);
  fs.appendFileSync(statePath(root, FILE), `${sessionId}\t${nowIso()}\n`);
  return true;
}

// Fails closed: with no session id to compare, or a run opened before ownership was
// recorded, every session is treated as an owner.
export function isOwner(root, payload = {}) {
  if (/^(?:plugin:)?onestop:/i.test(String(payload.agent_type || ''))) return true;
  if (!payload.session_id) return true;
  const list = owners(root);
  return !list || list.includes(payload.session_id);
}
