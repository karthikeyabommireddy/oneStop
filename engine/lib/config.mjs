// Effective settings: plugin settings, overridden by a committed onestop.yml.
//
// Plugin settings reach the engine as environment variables mapped in plugin.json
// (ONESTOP_<KEY> from ${user_config.<key>}) and reach hooks as CLAUDE_PLUGIN_OPTION_<KEY>.
// Before v2 nothing read them, so every setting silently did nothing.
//
// onestop.yml is parsed by a deliberately small YAML subset. Anything outside the
// subset is an error with a line number - a config file that is quietly misread is
// worse than one that is refused.

import fs from 'node:fs';
import path from 'node:path';
import { envValue, registry } from './env.mjs';

// ---------------------------------------------------------------- YAML subset

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') { i++; continue; }
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(s, lineNo) {
  if (s.startsWith('"')) {
    if (!s.endsWith('"') || s.length < 2) throw new Error(`line ${lineNo}: unterminated string`);
    return s.slice(1, -1).replace(/\\(["\\nt])/g, (_, c) => ({ n: '\n', t: '\t' }[c] || c));
  }
  if (s.startsWith("'")) {
    if (!s.endsWith("'") || s.length < 2) throw new Error(`line ${lineNo}: unterminated string`);
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function scalar(raw, lineNo) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^[&*!|>]/.test(s)) {
    throw new Error(`line ${lineNo}: "${s[0]}" (anchors, aliases, tags, block scalars) is not supported in onestop.yml - write the value out plainly`);
  }
  return unquote(s, lineNo);
}

// Flow collections: { a: b, c: [x, y] } and [a, b]. A tiny recursive reader over
// characters, so commas inside quotes and nested brackets are handled correctly.
function parseFlow(text, lineNo) {
  let i = 0;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const token = (stops) => {
    ws();
    if (text[i] === '"' || text[i] === "'") {
      const q = text[i++];
      let out = q;
      while (i < text.length && text[i] !== q) {
        if (text[i] === '\\' && q === '"') out += text[i++];
        out += text[i++];
      }
      if (text[i] !== q) throw new Error(`line ${lineNo}: unterminated string`);
      i++;
      return { quoted: true, raw: out + q };
    }
    let out = '';
    while (i < text.length && !stops.includes(text[i])) out += text[i++];
    return { quoted: false, raw: out.trim() };
  };
  const value = () => {
    ws();
    if (text[i] === '{') return map();
    if (text[i] === '[') return list();
    const t = token([',', '}', ']']);
    return t.quoted ? unquote(t.raw, lineNo) : scalar(t.raw, lineNo);
  };
  const map = () => {
    i++; // {
    const out = {};
    ws();
    if (text[i] === '}') { i++; return out; }
    for (;;) {
      const k = token([':', ',', '}']);
      const key = k.quoted ? unquote(k.raw, lineNo) : k.raw;
      ws();
      if (text[i] !== ':') throw new Error(`line ${lineNo}: expected ":" after "${key}" in an inline map`);
      i++;
      out[key] = value();
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; return out; }
      throw new Error(`line ${lineNo}: expected "," or "}" in an inline map`);
    }
  };
  const list = () => {
    i++; // [
    const out = [];
    ws();
    if (text[i] === ']') { i++; return out; }
    for (;;) {
      out.push(value());
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ']') { i++; return out; }
      throw new Error(`line ${lineNo}: expected "," or "]" in an inline list`);
    }
  };
  const result = value();
  ws();
  if (i !== text.length) throw new Error(`line ${lineNo}: unexpected text after the inline value`);
  return result;
}

function keyValue(content, lineNo) {
  const m = content.match(/^("[^"]*"|'[^']*'|[^:"']+?)\s*:(?:\s+(.*))?$/);
  if (!m) return null;
  const key = unquote(m[1].trim(), lineNo);
  const rest = m[2] === undefined ? '' : m[2].trim();
  return { key, rest };
}

function inlineValue(rest, lineNo) {
  if (rest.startsWith('{') || rest.startsWith('[')) return parseFlow(rest, lineNo);
  return scalar(rest, lineNo);
}

export function parseYamlSubset(text) {
  const lines = [];
  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = stripComment(rawLine).replace(/\s+$/, '');
    if (!line.trim()) return;
    const lead = line.match(/^[ \t]*/)[0];
    if (lead.includes('\t')) throw new Error(`line ${lineNo}: indent with spaces, not tabs`);
    if (line.trim() === '---' || line.trim() === '...') return;
    lines.push({ indent: lead.length, content: line.trim(), lineNo });
  });

  let pos = 0;
  const isItem = (l) => l.content.startsWith('- ') || l.content === '-';

  function block(indent) {
    if (pos >= lines.length) return null;
    return isItem(lines[pos]) ? seq(indent) : mapping(indent);
  }

  function childOrNull(parentIndent) {
    if (pos < lines.length && lines[pos].indent > parentIndent) return block(lines[pos].indent);
    return null;
  }

  function mapping(indent) {
    const out = {};
    while (pos < lines.length && lines[pos].indent === indent && !isItem(lines[pos])) {
      const { content, lineNo } = lines[pos];
      const kv = keyValue(content, lineNo);
      if (!kv) throw new Error(`line ${lineNo}: expected "key: value", got "${content}"`);
      pos++;
      out[kv.key] = kv.rest === '' ? childOrNull(indent) : inlineValue(kv.rest, lineNo);
    }
    if (pos < lines.length && lines[pos].indent > indent) {
      throw new Error(`line ${lines[pos].lineNo}: unexpected indentation`);
    }
    return out;
  }

  function seq(indent) {
    const out = [];
    while (pos < lines.length && lines[pos].indent === indent && isItem(lines[pos])) {
      const { content, lineNo } = lines[pos];
      const rest = content === '-' ? '' : content.slice(2).trim();
      pos++;
      if (rest === '') {
        out.push(childOrNull(indent));
      } else if (!/^[{["']/.test(rest) && keyValue(rest, lineNo)) {
        // "- key: value" starts a map whose further keys sit two columns in.
        lines.splice(pos, 0, { indent: indent + 2, content: rest, lineNo });
        out.push(mapping(indent + 2));
      } else {
        out.push(inlineValue(rest, lineNo));
      }
    }
    return out;
  }

  if (!lines.length) return {};
  const doc = block(lines[0].indent);
  if (pos < lines.length) throw new Error(`line ${lines[pos].lineNo}: unexpected content at this indentation`);
  return doc;
}

// ---------------------------------------------------------------- settings

const SETTING_DEFAULTS = {
  gate_mode: 'every-phase',
  coverage_threshold: 80,
  auto_automation: true,
  research_depth: 'standard',
  knowledge_graph: 'auto',
};

const SETTING_ALLOWED = {
  gate_mode: ['every-phase', 'milestone', 'autonomous'],
  research_depth: ['none', 'standard', 'deep'],
  knowledge_graph: ['auto', 'manual', 'off'],
};

function coerce(key, raw) {
  if (raw === undefined || raw === null) return undefined;
  if (key === 'coverage_threshold') {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
  }
  if (key === 'auto_automation') {
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return undefined;
  }
  const s = String(raw);
  if (SETTING_ALLOWED[key] && !SETTING_ALLOWED[key].includes(s)) return undefined;
  return s;
}

export function readOnestopYml(root) {
  const file = path.join(root, 'onestop.yml');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { present: false, data: {} };
  }
  try {
    const data = parseYamlSubset(text);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { present: true, data: {}, error: 'onestop.yml must be a map of settings at the top level' };
    }
    return { present: true, data };
  } catch (e) {
    return { present: true, data: {}, error: `onestop.yml ${e.message}` };
  }
}

export function effectiveSettings(root) {
  const yml = readOnestopYml(root);
  const effective = {};
  const source = {};
  const warnings = [];
  for (const key of Object.keys(SETTING_DEFAULTS)) {
    const upper = key.toUpperCase();
    const fromPlugin = envValue(`ONESTOP_${upper}`) ?? envValue(`CLAUDE_PLUGIN_OPTION_${upper}`);
    let value = SETTING_DEFAULTS[key];
    source[key] = 'default';
    const p = coerce(key, fromPlugin);
    if (fromPlugin !== undefined && p === undefined) warnings.push(`plugin setting ${key}="${fromPlugin}" is not valid - using ${value}`);
    if (p !== undefined) { value = p; source[key] = 'plugin settings'; }
    if (key in yml.data) {
      const y = coerce(key, yml.data[key]);
      if (y === undefined) warnings.push(`onestop.yml ${key}: ${JSON.stringify(yml.data[key])} is not valid - ignored`);
      else { value = y; source[key] = 'onestop.yml'; }
    }
    effective[key] = value;
  }
  if (yml.error) warnings.push(yml.error);

  const policies = registry('policies');
  const approvals = { ...policies.approvals.defaults };
  for (const [k, v] of Object.entries(yml.data.approvals || {})) {
    if (k in approvals && policies.approvals.allowed_values.includes(v)) approvals[k] = v;
    else warnings.push(`onestop.yml approvals.${k}: ${JSON.stringify(v)} is not a recognised approval setting - ignored`);
  }
  const limits = {
    dev_loop_iterations: policies.dev_loop.max_iterations,
    build_fix_per_root_cause: policies.retry_budget.build_fix.per_root_cause,
    build_fix_per_phase: policies.retry_budget.build_fix.per_phase,
    test_fix_per_test: policies.retry_budget.test_fix.per_test,
    review_fix_per_finding: policies.retry_budget.review_fix.per_finding,
  };
  for (const [k, v] of Object.entries(yml.data.limits || {})) {
    if (k in limits && Number.isInteger(v) && v >= 1 && v <= 20) limits[k] = v;
    else warnings.push(`onestop.yml limits.${k}: ${JSON.stringify(v)} is not a whole number between 1 and 20 for a known limit - ignored`);
  }
  return {
    effective,
    source,
    approvals,
    limits,
    style: yml.data.style || {},
    automation: yml.data.automation || {},
    declared_commands: yml.data.commands || {},
    declared_stack: yml.data.stack || null,
    onestop_yml: yml.present,
    warnings,
  };
}
