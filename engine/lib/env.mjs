// Where things are: the plugin's own files, the user's project, and the registries.
//
// The plugin root is derived from this file's own location rather than from
// ${CLAUDE_PLUGIN_ROOT}. Claude Code substitutes that variable in skill text, hook
// commands and MCP config, but it is not present in the Bash tool's environment - so
// anything that must work from every entry point (MCP server, CLI, hooks, tests)
// locates the plugin the one way that cannot fail.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PLUGIN_ROOT = path.resolve(HERE, '..', '..');

// Forward slashes everywhere: the model, the Read tool and git all accept them on
// Windows, and one spelling means paths compare equal in the ledger and in tests.
export function slash(p) {
  return p.split(path.sep).join('/');
}

export function pluginPath(...parts) {
  return slash(path.join(PLUGIN_ROOT, ...parts));
}

// The orchestrator's on-demand guides. The engine hands over the path at the moment a step
// needs it, so the orchestrator's own skill stays small and no client has to expand a
// plugin-root token in markdown.
export function guidePath(name) {
  return pluginPath('skills', 'orchestrate', 'references', `${name}.md`);
}

// An env value that still contains "${" was never substituted - an older Claude Code,
// or the variable is undefined. Treat it as absent rather than as a literal path.
export function envValue(name) {
  const v = process.env[name];
  if (v === undefined || v === '' || v.includes('${')) return undefined;
  return v;
}

// The project the engine works on. Each client says it differently: Claude Code fills in
// CLAUDE_PROJECT_DIR; VS Code names its workspace folders as MCP roots (the server passes
// them to setClientRoot); GitHub Copilot CLI starts a plugin's MCP servers in the plugin's
// own folder and passes no project at all - only the session id, whose working directory
// it records in its state folder. A project_dir the orchestrator passes is pinned for the
// rest of the session, so one correction is enough.
let pinned = null;
let clientRoot = null;

export function pinProjectRoot(dir) {
  pinned = path.resolve(dir);
}

export function setClientRoot(dir) {
  clientRoot = dir ? path.resolve(dir) : null;
}

const realPath = (p) => {
  try { return fs.realpathSync.native(p); } catch { return path.resolve(p); }
};

function insidePlugin(dir) {
  const rel = path.relative(realPath(PLUGIN_ROOT), realPath(dir));
  return !rel || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Copilot CLI keeps <home>/session-state/<session id>/workspace.yaml with a `cwd:` line.
export function copilotSessionDir() {
  const id = envValue('COPILOT_AGENT_SESSION_ID');
  if (!id || !/^[\w-]+$/.test(id)) return undefined;
  const home = envValue('COPILOT_HOME') || path.join(os.homedir(), '.copilot');
  try {
    const yaml = fs.readFileSync(path.join(home, 'session-state', id, 'workspace.yaml'), 'utf8');
    const value = yaml.match(/^cwd:(.*)$/m)?.[1].trim();
    if (!value) return undefined;
    if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
    if (value.startsWith('"')) return JSON.parse(value);
    return value;
  } catch {
    return undefined;
  }
}

// null when nothing names a project - the caller asks for project_dir instead of guessing.
export function projectRoot(explicit) {
  const named = explicit || pinned || envValue('ONESTOP_PROJECT_DIR') || envValue('CLAUDE_PROJECT_DIR') || clientRoot;
  if (named) return path.resolve(named);
  const found = [copilotSessionDir(), process.cwd(), envValue('PWD')]
    .find((d) => d && fs.existsSync(d) && !insidePlugin(d));
  return found ? path.resolve(found) : null;
}

export const NO_PROJECT = {
  ok: false,
  error: 'onestop cannot tell which project this session is working in.',
  hint: 'Call the tool again with project_dir set to the absolute path of the user\'s project. The engine keeps it for the rest of the session.',
};

const registryCache = new Map();

export function registry(name) {
  if (!registryCache.has(name)) {
    const file = path.join(PLUGIN_ROOT, 'registry', `${name}.json`);
    registryCache.set(name, JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  return registryCache.get(name);
}

export function nowIso() {
  return new Date().toISOString();
}

// kebab-case, ascii only, bounded - the slug names directories under docs/ and .onestop/.
export function slugify(text, max = 40) {
  const s = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (s.slice(0, max).replace(/-+$/, '') || 'run');
}
