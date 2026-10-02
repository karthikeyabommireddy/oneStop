// Files under .onestop/: atomic JSON writes, append-only logs, and schema validation.
//
// The ledger is written only by engine code - the MCP server, and the hooks that store
// specialist reports - under withLock, and only ever by replacing the whole file. The
// model never writes it: a model writing JSON by hand produced half-written ledgers and three
// incompatible shapes across releases; a temp-file-then-rename write cannot leave a
// half-written file behind, and validation on every read and write means a bad ledger
// is reported instead of trusted.

import fs from 'node:fs';
import path from 'node:path';

export const STATE_DIR = '.onestop';

export function statePath(root, ...parts) {
  return path.join(root, STATE_DIR, ...parts);
}

// .onestop/ ignores itself. Writing "*" into its own .gitignore keeps run state out of
// every commit without ever editing the user's tracked .gitignore - which used to show
// up in their diff and get swept into a commit at ship.
export function ensureSelfIgnoringDir(dir, label = 'onestop run state') {
  fs.mkdirSync(dir, { recursive: true });
  const gi = path.join(dir, '.gitignore');
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, `# ${label} - never committed\n*\n`);
  return dir;
}

export function ensureStateDir(root) {
  return ensureSelfIgnoringDir(path.join(root, STATE_DIR));
}

export function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { ok: false, missing: true };
    return { ok: false, error: `cannot read ${file}: ${e.message}` };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, corrupt: true, error: `${path.basename(file)} is not valid JSON: ${e.message}` };
  }
}

// Windows refuses to rename over a file another process has open (EPERM/EBUSY), most
// often a virus scanner or an editor peeking at the file. A short retry clears it.
function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      const until = Date.now() + 20 * (attempt + 1);
      while (Date.now() < until) { /* brief spin; the engine is not latency-sensitive here */ }
    }
  }
}

export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  try {
    renameWithRetry(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* the rename error below is the one that matters */ }
    throw e;
  }
}

// Hooks run as separate processes: two specialists finishing together are two hooks
// storing two reports at once, while the engine may be recording a gate. Every
// read-modify-write of the ledger runs under this lock, or one writer silently drops
// the other's change. A lock older than staleMs belongs to a process that died.
export function withLock(root, name, fn, { timeoutMs = 20000, staleMs = 60000 } = {}) {
  ensureStateDir(root);
  const dir = statePath(root, `${name}.lock`);
  const started = Date.now();
  const nap = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    try {
      fs.mkdirSync(dir);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let age;
      try { age = Date.now() - fs.statSync(dir).mtimeMs; } catch { continue; }
      if (age > staleMs) {
        try { fs.rmdirSync(dir); } catch { /* another process cleared it first */ }
        continue;
      }
      if (Date.now() - started > timeoutMs) throw new Error(`${name} is locked by another onestop process - try again`);
      Atomics.wait(nap, 0, 0, 25);
    }
  }
  try {
    return fn();
  } finally {
    try { fs.rmdirSync(dir); } catch { /* already released */ }
  }
}

export function appendJsonl(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
}

export function readJsonl(file, limit = Infinity) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* a torn line from a killed hook - skip it */ }
  }
  return limit === Infinity ? out : out.slice(-limit);
}

// ---------------------------------------------------------------- schema validation
// The subset registry/run.schema.json uses: type (string or list), enum, required,
// properties, additionalProperties (false or a schema), items, minimum.

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function typeMatches(v, want) {
  const t = typeOf(v);
  if (want === 'number') return t === 'number' || t === 'integer';
  return t === want;
}

export function validate(schema, value, at = '$', errors = []) {
  if (schema.type !== undefined) {
    const wants = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!wants.some((w) => typeMatches(value, w))) {
      errors.push(`${at}: expected ${wants.join(' or ')}, got ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  }
  if (typeof schema.minimum === 'number' && typeof value === 'number' && value < schema.minimum) {
    errors.push(`${at}: ${value} is below the minimum ${schema.minimum}`);
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${at}: missing required field "${key}"`);
    }
    const props = schema.properties || {};
    for (const [key, v] of Object.entries(value)) {
      if (props[key]) validate(props[key], v, `${at}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unexpected field "${key}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validate(schema.additionalProperties, v, `${at}.${key}`, errors);
      }
    }
  }
  if (typeOf(value) === 'array' && schema.items) {
    value.forEach((item, i) => validate(schema.items, item, `${at}[${i}]`, errors));
  }
  return errors;
}
