// Git, read-only, plus checkpoints that never touch the user's index or working tree.
//
// A checkpoint is a snapshot of the whole working tree - tracked, modified and new
// untracked files - written through a PRIVATE index (GIT_INDEX_FILE under .onestop/)
// into a dangling commit. The user's staging area, branches and files are untouched.
// Reverting one slice later means reverse-applying exactly the delta between two
// checkpoints, after `git apply --check` proves it still applies - never `git checkout
// -- <file>` or `git reset`, which destroy uncommitted work the run did not make.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { statePath } from './store.mjs';

const IDENTITY = {
  GIT_AUTHOR_NAME: 'onestop',
  GIT_AUTHOR_EMAIL: 'onestop@localhost',
  GIT_COMMITTER_NAME: 'onestop',
  GIT_COMMITTER_EMAIL: 'onestop@localhost',
};

function git(root, args, { env, input } = {}) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, ...env },
  }).replace(/\s+$/, '');
}

function tryGit(root, args, opts) {
  try { return git(root, args, opts); } catch { return null; }
}

export function isRepo(root) {
  return tryGit(root, ['rev-parse', '--is-inside-work-tree']) === 'true';
}

// null in a repository that has no commits yet.
export function headCommit(root) {
  return tryGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
}

export function currentBranch(root) {
  const b = tryGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return b && b !== 'HEAD' ? b : null;
}

export function defaultBranch(root) {
  const ref = tryGit(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (ref) return ref.replace(/^origin\//, '');
  for (const name of ['main', 'master', 'trunk', 'develop']) {
    if (tryGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])) return name;
  }
  return null;
}

// Every changed path: staged, unstaged and untracked. `git diff --stat` alone misses
// staged changes and new files - exactly what someone about to commit has.
export function changeSurface(root) {
  const out = tryGit(root, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (out === null) return { git: false, files: [], untracked: [] };
  const files = [];
  const untracked = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    let file = line.slice(3);
    if (file.includes(' -> ')) file = file.split(' -> ')[1];
    file = file.replace(/^"|"$/g, '');
    files.push(file);
    if (code === '??') untracked.push(file);
  }
  return { git: true, files, untracked };
}

export function snapshot(root, label) {
  if (!isRepo(root)) return { ok: false, error: 'not a git repository - checkpoints need git' };
  const dir = statePath(root, 'checkpoints');
  fs.mkdirSync(dir, { recursive: true });
  const env = { ...IDENTITY, GIT_INDEX_FILE: statePath(root, 'checkpoints', 'index') };
  const head = headCommit(root);
  try {
    if (head) git(root, ['read-tree', head], { env });
    else git(root, ['read-tree', '--empty'], { env });
    git(root, ['add', '-A'], { env });
    const tree = git(root, ['write-tree'], { env });
    const args = ['commit-tree', tree, '-m', `onestop checkpoint: ${label}`];
    if (head) args.splice(2, 0, '-p', head);
    const commit = git(root, args, { env });
    return { ok: true, commit, base: head };
  } catch (e) {
    return { ok: false, error: `checkpoint failed: ${String(e.stderr || e.message).trim()}` };
  }
}

export function diffStat(root, from, to) {
  return tryGit(root, ['diff', '--stat', from, to]) ?? '';
}

// Reverse-apply exactly the delta from `from` to `to` in the working tree. Refuses -
// and changes nothing - unless the reverse patch applies cleanly, which it does only
// while the affected files still look the way the run left them.
export function revertBetween(root, from, to) {
  let patch;
  try {
    patch = git(root, ['diff', '--binary', from, to]);
  } catch (e) {
    return { ok: false, error: `cannot compute the delta: ${String(e.stderr || e.message).trim()}` };
  }
  if (!patch) return { ok: true, files: [], note: 'nothing changed between these checkpoints' };
  const files = (tryGit(root, ['diff', '--name-only', from, to]) || '').split('\n').filter(Boolean);
  try {
    git(root, ['apply', '--check', '-R', '--whitespace=nowarn'], { input: `${patch}\n` });
  } catch (e) {
    return {
      ok: false,
      files,
      error: 'the reverse patch no longer applies - those files have changed since the checkpoint. Nothing was modified.',
      detail: String(e.stderr || e.message).trim().split('\n').slice(0, 6).join('\n'),
    };
  }
  git(root, ['apply', '-R', '--whitespace=nowarn'], { input: `${patch}\n` });
  return { ok: true, files };
}
