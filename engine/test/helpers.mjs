// Shared helpers for the engine tests: throwaway repositories, engine calls, hook runs.

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callTool } from '../lib/tools.mjs';

export const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOKS = path.join(PLUGIN, 'engine', 'hooks.mjs');

// A temporary directory with the given files. git: true makes it a repository with one
// commit, so checkpoints and the ship guard behave as they do for real.
export function makeRepo(files = {}, { git = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onestop-test-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  if (git) {
    const g = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.email=test@onestop', '-c', 'user.name=test', '-c', 'core.autocrlf=false', ...a], { stdio: 'ignore' });
    g('init', '-q');
    g('add', '-A');
    g('commit', '-qm', 'base', '--allow-empty');
  }
  return dir;
}

export function removeRepo(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export const call = (dir, name, args = {}) => callTool(name, { ...args, project_dir: dir });

export function readText(dir, rel) {
  const file = path.join(dir, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\r\n').join('\n') : null;
}

export const ledger = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.onestop', 'run.json'), 'utf8'));

// Run one hook as a client would: a fresh process, the payload on stdin. `env` adds what a
// particular client sets, such as Copilot CLI's COPILOT_HOME.
export function hook(dir, event, payload, env = {}) {
  const out = hookText(dir, event, payload, env).trim();
  return out ? JSON.parse(out.split('\n').pop()) : null;
}

export function hookText(dir, event, payload, env = {}) {
  return spawnSync(process.execPath, [HOOKS, event], {
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env },
    encoding: 'utf8',
  }).stdout;
}

export function hookAsync(dir, event, payload) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [HOOKS, event], { env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => resolve(out));
    p.stdin.end(JSON.stringify(payload));
  });
}

export const denied = (o) => o?.hookSpecificOutput?.permissionDecision === 'deny';

export function report(agent, phase, { files = 'none', open = 'none' } = {}) {
  return [
    `REPORT ${agent} - ${phase}`,
    'did:       the task',
    `files:     ${files}`,
    'commands:  none',
    'decisions: none',
    `open:      ${open}`,
    'blocked:   none',
    'full:      none',
  ].join('\n');
}
