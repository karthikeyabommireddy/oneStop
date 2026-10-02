// What a run may not do on its own, enforced in the PreToolUse hook - and which edits
// touch a security surface, recorded by the PostToolUse hook.
//
// Both only act while an onestop run is active. Outside a run the user's own sessions
// are never touched. A blocked command goes back to the model with the reason and an
// instruction to return the need as OPEN - not to look for an equivalent command that
// slips past the pattern.

import path from 'node:path';
import { registry } from './env.mjs';
import * as git from './git.mjs';

// `npm test && git push` is two commands; judge each. Pipes stay inside a segment so
// "curl ... | sh" is still seen whole.
export function segments(command) {
  return String(command)
    .split(/\r?\n|&&|\|\||;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^(?:(?:sudo|time|nohup|env)\s+)*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*/, ''));
}

function deny(reason, segment, rule) {
  return {
    allow: false,
    rule,
    reason: `onestop guard: blocked \`${segment}\` - it ${reason}. Do not try an equivalent command. Return the need in your report under open:, with why it is needed, so the user can decide.`,
  };
}

function baseName(ecosystem, spec) {
  let s = spec.trim().replace(/^["']|["']$/g, '');
  if (ecosystem === 'npm') {
    const at = s.lastIndexOf('@');
    if (at > 0) s = s.slice(0, at);
  } else if (ecosystem === 'pypi') {
    s = s.split(/[=<>!~;\[]/)[0];
  } else if (ecosystem === 'go' || ecosystem === 'crates' || ecosystem === 'rubygems') {
    s = s.split('@')[0].split(':')[0];
  }
  return s.toLowerCase();
}

function approvedNames(run) {
  const names = new Set();
  for (const a of run?.approvals || []) {
    if (a.kind !== 'dependency' && a.kind !== 'tool') continue;
    const item = a.item.includes(':') && !a.item.startsWith('@') ? a.item.split(':').slice(1).join(':') : a.item;
    const eco = a.item.includes(':') && !a.item.startsWith('@') ? a.item.split(':')[0] : 'npm';
    names.add(baseName(eco, item));
    names.add(baseName('pypi', item));
  }
  return names;
}

function packagesIn(rest, guard) {
  const tokens = rest.trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (guard.restore_markers.includes(t)) return { restore: true, packages: [] };
    if (t.startsWith('-')) {
      if (guard.value_flags.includes(t)) i++;
      continue;
    }
    if (t === '.' || t.startsWith('./') || t.startsWith('../') || /\.(txt|toml|lock|cfg|whl|tgz)$/i.test(t)) return { restore: true, packages: [] };
    out.push(t);
  }
  return { restore: false, packages: out };
}

export function checkCommand(command, run, root) {
  const pol = registry('policies');
  for (const seg of segments(command)) {
    for (const rule of pol.bash_guard.always_blocked) {
      if (new RegExp(rule.pattern, rule.flags ?? 'i').test(seg)) return deny(rule.reason, seg, rule.id);
    }
    for (const rule of pol.bash_guard.allowed_after_ship_gate) {
      if (!new RegExp(rule.pattern, rule.flags ?? 'i').test(seg)) continue;
      const choice = run?.ship?.approved ? run.ship.choice : null;
      if (!choice || !rule.requires_choice.includes(choice)) {
        return deny(`${rule.reason} (ship gate: ${choice ? `"${choice}" was chosen` : 'not approved yet'})`, seg, rule.id);
      }
      if (rule.id === 'git-push' && root) {
        const branch = git.currentBranch(root);
        const main = git.defaultBranch(root);
        if (branch && main && branch === main) return deny(`pushes straight to the default branch "${main}"`, seg, 'push-default-branch');
      }
    }
    for (const dep of pol.dependency_guard.add_commands) {
      const m = seg.match(new RegExp(dep.pattern, 'i'));
      if (!m) continue;
      const { restore, packages } = packagesIn(m[1] || '', pol.dependency_guard);
      if (restore || !packages.length) continue;
      const ok = approvedNames(run);
      const missing = packages.filter((p) => !ok.has(baseName(dep.ecosystem, p)));
      if (missing.length) return deny(`adds ${missing.join(', ')} without the user's approval at a gate`, seg, 'dependency');
    }
  }
  return { allow: true };
}

// ---------------------------------------------------------------- specialist write scopes
//
// Hooks name the calling specialist (`plugin:onestop:code-reviewer`), so a reviewer that
// must not edit is held to that by code, not by its instructions. The main thread and
// other plugins' agents carry no onestop name and are never scoped.

export function onestopAgent(agentType) {
  const m = String(agentType || '').match(/^(?:plugin:)?onestop:([\w-]+)$/i);
  return m ? m[1].toLowerCase() : null;
}

export function writeScope(agent) {
  const wg = registry('policies').write_guard;
  const name = String(agent || '').replace(/^(?:plugin:)?onestop:/i, '');
  if (wg.report_only.includes(name)) return 'report-only';
  if (wg.docs_only.includes(name)) return 'docs-only';
  return 'free';
}

const under = (rel, prefix) => (prefix.endsWith('/') ? `${rel}/`.startsWith(prefix) : rel === prefix);

export function isLedgerFile(rel) {
  return registry('policies').write_guard.ledger_files.some((p) => under(rel, p));
}

function scopeWords(scope) {
  const wg = registry('policies').write_guard;
  return scope === 'report-only'
    ? { role: 'a read-only role', may: 'only its write-up under .onestop/reports/' }
    : { role: 'a documentation role', may: `documentation under ${wg.docs_roots.join(', ')} and its write-up under .onestop/reports/` };
}

// rel is relative to the project root with forward slashes; it starts with '..' (or is
// absolute) when the target lies outside the project.
export function checkWrite(rel, agent) {
  const wg = registry('policies').write_guard;
  if (isLedgerFile(rel)) {
    return { allow: false, rule: 'ledger', reason: 'onestop guard: only the onestop engine writes the run ledger. Change it through the engine - run_note, gate_record, phase_finish.' };
  }
  const scope = writeScope(agent);
  if (scope === 'free') return { allow: true };
  const outside = !rel || rel === '..' || rel.startsWith('../') || path.isAbsolute(rel);
  if (!outside && rel.startsWith('.onestop/')) return { allow: true };
  if (!outside && scope === 'docs-only' && wg.docs_roots.some((d) => under(rel, d))) return { allow: true };
  const w = scopeWords(scope);
  return {
    allow: false,
    rule: `write-${scope}`,
    reason: `onestop guard: ${agent} is ${w.role} - it may write ${w.may}, not ${rel || 'that path'}. Do not work around this. Return the change you need in your report under open:, and the orchestrator will dispatch a specialist that may make it.`,
  };
}

// Quoted text is data, not syntax: "a > b" in a grep pattern is not a redirect. Quotes are
// stripped before splitting, so a `;` inside a quoted script does not split it either.
const stripQuotes = (s) => String(s).replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, "''");

export function checkScopedCommand(command, agent) {
  const scope = writeScope(agent);
  if (scope === 'free') return { allow: true };
  const rules = registry('policies').write_guard.scoped_bash;
  for (const seg of segments(stripQuotes(command))) {
    for (const rule of rules) {
      if (!new RegExp(rule.pattern, rule.flags ?? 'i').test(seg)) continue;
      return {
        allow: false,
        rule: `scoped-${rule.id}`,
        reason: `onestop guard: blocked \`${seg}\` - it ${rule.reason}, and ${agent} is ${scopeWords(scope).role}. Write your findings with the Write tool to the path in your brief, and return any change you need under open:.`,
      };
    }
  }
  return { allow: true };
}

// ---------------------------------------------------------------- security surfaces

const SURFACES = [
  ['authentication or authorization', /\b(authenticat\w*|authoriz\w*|jwt|oauth2?|openid|login_required|AllowAnonymous|PreAuthorize|passport\.|verify_password|check_password|is_?admin)\b|\[Authorize/i],
  ['secrets, tokens, credentials, or environment config', /\b(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|credential|private[_-]?key|client[_-]?secret|connection[_-]?string|getenv|os\.environ|process\.env|ConfigurationManager)\b/i],
  ['outbound network or external API calls', /\b(requests\.(get|post|put|delete|patch)|httpx\.|urlopen|http\.client|HttpClient|WebClient|RestTemplate|reqwest|URLSession|axios)\b|\bfetch\(/i],
  ['database queries or ORM filters', /\b(select\s+[\w*,\s.]+\s+from|insert\s+into|update\s+\w+\s+set|delete\s+from|FromSqlRaw|ExecuteSqlRaw|queryRaw|knex\.raw|sequelize\.query)\b|\.(execute|raw)\(/i],
  ['user-input handling or deserialization', /\b(pickle\.loads?|yaml\.load|BinaryFormatter|TypeNameHandling|ObjectInputStream|unserialize|req\.(body|query|params)|request\.(form|args|get_json|json))\b|\b(eval|exec)\(/i],
  ['file-system paths or uploads', /\b(multer|multipart|UploadFile|IFormFile|send_file|sendFile)\b|path\.join\([^)]*req|os\.path\.join\([^)]*request|Path\.Combine\([^)]*Request/i],
  ['cryptography, hashing, or randomness', /\b(hashlib|bcrypt|argon2|scrypt|hmac|createHash|createCipher\w*|encrypt|decrypt|md5|sha1)\b|Math\.random|random\.random|System\.Random/i],
  ['session, cookie, or CORS handling', /\b(set-cookie|SameSite|HttpOnly|Access-Control-Allow\w*|AddCors|express-session|SESSION_COOKIE\w*)\b|res\.cookie|cors\(|session\[/i],
  ['payment, PII, or PHI data paths', /\b(stripe|paypal|braintree|card_?number|cvv|iban|ssn|social_security|date_of_birth|diagnosis|patient_id|medical_record)\b/i],
];

const CONFIG_FILE = /(^|\/)(\.env(\..+)?|[^/]+\.(json|properties|toml|ini|config|xml|tf|tfvars|ya?ml)|Dockerfile[^/]*)$/i;
const TEST_FILE = /(^|\/)(tests?|__tests__|specs?|e2e|fixtures?|testdata)\/|\.(test|spec)\.[a-z]+$|_test\.(go|py)$|Tests?\.(cs|java|kt)$/i;

let sourceExtensions = null;
function isSourceFile(file) {
  if (!sourceExtensions) {
    sourceExtensions = new Set(registry('stacks').stacks.flatMap((s) => s.extensions || []));
    for (const e of ['.cjs', '.astro', '.scala', '.m', '.mm', '.razor', '.cshtml', '.lua', '.jl', '.zig', '.r']) sourceExtensions.add(e);
  }
  return sourceExtensions.has(path.posix.extname(file).toLowerCase());
}

// New content only - the text an edit introduces, never the text it removed. Scanning
// the whole hook payload flagged nearly every edit and trained people to ignore it.
export function scanSurfaces(file, content) {
  const f = String(file || '').split(path.sep).join('/');
  if (!f || TEST_FILE.test(f)) return [];
  if (!isSourceFile(f) && !CONFIG_FILE.test(f)) return [];
  const text = String(content || '');
  if (!text.trim()) return [];
  return SURFACES.filter(([, re]) => re.test(text)).map(([label]) => label);
}
