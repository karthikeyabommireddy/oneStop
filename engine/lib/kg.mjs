// The knowledge graph: graphify, driven so it never surprises anyone.
//
// Three rules, each the fix for something that happened:
//  - Code-only by default. graphify's semantic mode sends repository text to whichever
//    LLM provider it finds a key for - often ANTHROPIC_API_KEY on a Claude Code machine,
//    billed to that key, with no notice. Semantic extraction is opt-in: ONESTOP_KG_SEMANTIC=1.
//  - No blocking first build on a huge repository. Past ONESTOP_KG_MAX_FILES files the
//    build is offered at gate zero instead; below it, it runs in the background.
//  - graphify-out/ ignores itself. The user's tracked .gitignore is never edited.

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { envValue, PLUGIN_ROOT } from './env.mjs';
import { ensureSelfIgnoringDir, statePath } from './store.mjs';
import { listFiles } from './stack.mjs';

const OUT = 'graphify-out';

function onPath(name) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const e of exts) {
      const p = path.join(dir, name + e);
      try { if (fs.statSync(p).isFile()) return p; } catch { /* not here */ }
    }
  }
  return null;
}

function dirtyCount(root) {
  try { return fs.readFileSync(statePath(root, 'kg-dirty'), 'utf8').split('\n').filter(Boolean).length; } catch { return 0; }
}

function lockDir(root, name) {
  return statePath(root, `${name}.lock`);
}

// A lock older than ten minutes belongs to a build that died; clear it.
function takeLock(root, name) {
  const dir = lockDir(root, name);
  try {
    const age = Date.now() - fs.statSync(dir).mtimeMs;
    if (age > 10 * 60 * 1000) fs.rmdirSync(dir);
  } catch { /* no lock */ }
  try { fs.mkdirSync(dir, { recursive: false }); return true; } catch { return false; }
}

function releaseLock(root, name) {
  try { fs.rmdirSync(lockDir(root, name)); } catch { /* already released */ }
}

export function kgStatus(root) {
  return {
    installed: Boolean(onPath('graphify')),
    graph: fs.existsSync(path.join(root, OUT, 'graph.json')),
    report: fs.existsSync(path.join(root, OUT, 'GRAPH_REPORT.md')),
    report_path: path.join(root, OUT, 'GRAPH_REPORT.md').split(path.sep).join('/'),
    dirty_files: dirtyCount(root),
    building: fs.existsSync(lockDir(root, 'kg-build')),
    semantic: envValue('ONESTOP_KG_SEMANTIC') === '1',
  };
}

function runGraphify(root, args, timeoutMs) {
  execFileSync(onPath('graphify') || 'graphify', args, { cwd: root, stdio: 'ignore', timeout: timeoutMs });
}

export function kgBuildSync(root) {
  if (!takeLock(root, 'kg-build')) return { ok: false, error: 'a build is already running' };
  try {
    ensureSelfIgnoringDir(path.join(root, OUT), 'onestop knowledge graph');
    const flags = envValue('ONESTOP_KG_SEMANTIC') === '1' ? [] : ['--code-only'];
    runGraphify(root, ['.', ...flags], 30 * 60 * 1000);
    runGraphify(root, ['cluster-only', '.', '--no-label', '--no-viz'], 10 * 60 * 1000);
    try { fs.writeFileSync(statePath(root, 'kg-dirty'), ''); } catch { /* state dir may not exist outside a run */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `graphify failed: ${String(e.message).split('\n')[0]}` };
  } finally {
    releaseLock(root, 'kg-build');
  }
}

export function kgRefreshSync(root) {
  if (!takeLock(root, 'kg-refresh')) return { ok: false, error: 'a refresh is already running' };
  try {
    runGraphify(root, ['update', '.'], 5 * 60 * 1000);
    fs.writeFileSync(statePath(root, 'kg-dirty'), '');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `graphify update failed: ${String(e.message).split('\n')[0]}` };
  } finally {
    releaseLock(root, 'kg-refresh');
  }
}

function background(root, sub) {
  fs.mkdirSync(statePath(root), { recursive: true });
  const log = fs.openSync(statePath(root, 'kg-build.log'), 'a');
  const child = spawn(process.execPath, [path.join(PLUGIN_ROOT, 'engine', 'cli.mjs'), 'kg', sub, '--project', root], {
    cwd: root, detached: true, stdio: ['ignore', log, log], windowsHide: true,
  });
  child.unref();
}

export function kgRefreshBackground(root) {
  const s = kgStatus(root);
  if (!s.installed || !s.graph || !s.dirty_files || s.building || fs.existsSync(lockDir(root, 'kg-refresh'))) return false;
  background(root, 'refresh-sync');
  return true;
}

export function kgEnsure(root, { setting = 'auto', build = false } = {}) {
  if (setting === 'off') return { ok: true, skipped: true, reason: 'knowledge_graph is off - phases read files directly' };
  const s = kgStatus(root);
  if (!s.installed) {
    return { ok: true, available: false, reason: 'graphify is not installed', hint: 'Mention once at gate zero: `pip install graphifyy==0.9.16` gives phases a code graph; onestop works without it by reading files.' };
  }
  if (s.graph) {
    if (s.dirty_files && !s.building) {
      const r = kgRefreshSync(root);
      return { ok: true, ...kgStatus(root), refreshed: r.ok, ...(r.ok ? {} : { warning: r.error }) };
    }
    return { ok: true, ...s };
  }
  if (s.building) return { ok: true, ...s, note: 'the first build is running in the background - continue without the graph until it finishes' };
  const max = Number(envValue('ONESTOP_KG_MAX_FILES') || 5000);
  const n = listFiles(root).files.length;
  if (n > max && !build) {
    return { ok: true, skipped: true, files: n, reason: `${n} files - a first build would be slow`, hint: 'Offer the build at gate zero ("build the code graph in the background"); call kg with action "build" only if the user says yes.' };
  }
  if (setting === 'manual' && !build) return { ok: true, skipped: true, reason: 'knowledge_graph is manual - build only when the user asks' };
  background(root, 'build-sync');
  return { ok: true, ...kgStatus(root), building: true, note: `first build started in the background (${s.semantic ? 'semantic - repository docs go to your LLM provider' : 'code-only, nothing leaves this machine'}); continue without it` };
}
