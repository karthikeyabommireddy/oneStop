// Where things are: the plugin's own files, the user's project, and the registries.
//
// The plugin root is derived from this file's own location rather than from
// ${CLAUDE_PLUGIN_ROOT}. Claude Code substitutes that variable in skill text, hook
// commands and MCP config, but it is not present in the Bash tool's environment - so
// anything that must work from every entry point (MCP server, CLI, hooks, tests)
// locates the plugin the one way that cannot fail.

import fs from 'node:fs';
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

// An env value that still contains "${" was never substituted - an older Claude Code,
// or the variable is undefined. Treat it as absent rather than as a literal path.
export function envValue(name) {
  const v = process.env[name];
  if (v === undefined || v === '' || v.includes('${')) return undefined;
  return v;
}

export function projectRoot(explicit) {
  const chosen = explicit || envValue('ONESTOP_PROJECT_DIR') || envValue('CLAUDE_PROJECT_DIR') || process.cwd();
  return path.resolve(chosen);
}

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
