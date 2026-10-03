// Stack detection and command resolution - from the project's own files.
//
// "Works for any stack" used to mean a hard-coded test and coverage command per
// language: `npx vitest run --coverage` in a jest repo, `mvn test` in a Gradle repo,
// bare `pytest` outside the virtualenv. The project already knows how it is built and
// tested - in onestop.yml, in CI, in its task runner - so those are read first, and a
// registry default is used only when every tool it needs is already installed.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { registry } from './env.mjs';
import { effectiveSettings } from './config.mjs';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'target', 'bin', 'obj', '.venv', 'venv',
  '__pycache__', '.next', '.nuxt', 'vendor', 'Pods', '.gradle', 'graphify-out', '.onestop', 'coverage', '.idea',
  '.dart_tool', '.pytest_cache', '.mypy_cache', '.terraform', '.svelte-kit', '.angular']);

const NOT_SOURCE = /^(readme|license|licence|changelog|contributing|code_of_conduct|security)(\.[a-z]+)?$|^\.(gitignore|gitattributes|editorconfig)$|^onestop\.yml$/i;

function read(root, rel) {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; }
}

export function listFiles(root, limit = 50000) {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard'], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const files = out.split('\n').filter(Boolean).filter((f) => !f.startsWith('.onestop/') && !f.startsWith('graphify-out/'));
    return { files: files.slice(0, limit), via: 'git', truncated: files.length > limit };
  } catch { /* not a git repository - walk instead */ }
  const files = [];
  const walk = (rel, depth) => {
    if (files.length >= limit || depth > 8) return;
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(child, depth + 1); } else files.push(child);
      if (files.length >= limit) return;
    }
  };
  walk('', 0);
  return { files, via: 'walk', truncated: files.length >= limit };
}

function markerMatcher(marker) {
  if (marker.endsWith('/')) {
    const dir = marker.slice(0, -1);
    return (f) => f.startsWith(`${dir}/`) || f.includes(`/${dir}/`);
  }
  if (marker.includes('*')) {
    const re = new RegExp(`^${marker.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
    return (f) => re.test(path.posix.basename(f));
  }
  if (marker.includes('/')) return (f) => f === marker || f.endsWith(`/${marker}`);
  return (f) => path.posix.basename(f) === marker;
}

// The directory a marker hit belongs to. A directory marker such as `migrations/` names
// the component above it, not a component of its own.
function componentOf(file, marker) {
  if (marker.endsWith('/')) {
    const dir = marker.slice(0, -1);
    const idx = file.startsWith(`${dir}/`) ? 0 : file.indexOf(`/${dir}/`) + 1;
    return idx <= 0 ? '.' : file.slice(0, idx - 1);
  }
  const d = path.posix.dirname(file);
  return d === '' ? '.' : d;
}

const MANIFESTS = /(^|\/)(package\.json|pyproject\.toml|requirements[^/]*\.txt|Pipfile|setup\.py|setup\.cfg|[^/]+\.csproj|[^/]+\.fsproj|Directory\.Packages\.props|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|pom\.xml|Gemfile|composer\.json|go\.mod|Cargo\.toml|pubspec\.yaml|mix\.exs|Package\.swift)$/;

function manifestText(root, files, comp) {
  const inComp = (f) => comp === '.' ? !f.includes('/') : path.posix.dirname(f) === comp;
  return files.filter((f) => MANIFESTS.test(f) && inComp(f)).map((f) => read(root, f) || '').join('\n');
}

function npmDeps(root, comp) {
  const text = read(root, comp === '.' ? 'package.json' : `${comp}/package.json`);
  if (!text) return new Set();
  try {
    const pkg = JSON.parse(text);
    return new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {}), ...Object.keys(pkg.peerDependencies || {})]);
  } catch { return new Set(); }
}

// A nested list is "any one of these" - rspec or rspec-rails, either vitest coverage provider.
function depHit(dep, text, npm) {
  if (Array.isArray(dep)) return dep.some((d) => depHit(d, text, npm));
  if (npm.has(dep)) return true;
  const esc = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_.@/-])${esc}([^A-Za-z0-9_-]|$)`, 'im').test(text);
}

// onestop.yml `stack.components` is the user's word. A declared component replaces the
// detected one at the same path, or is added; whatever it leaves out keeps the detected
// value, else the registry's value for its first stack.
function applyDeclared(root, components, existing) {
  const declared = effectiveSettings(root).declared_stack;
  const list = Array.isArray(declared?.components) ? declared.components : [];
  if (!list.length) return;
  const byId = Object.fromEntries(registry('stacks').stacks.map((s) => [s.id, s]));
  const strings = (v) => (Array.isArray(v) ? v.map(String) : null);
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    const at = String(d.path || '.').replace(/^\.\/+/, '').replace(/\/+$/, '') || '.';
    const prior = components.find((c) => c.path === at);
    const named = (strings(d.stacks) || []).filter((id) => byId[id]);
    const ids = named.length ? named : prior ? prior.stacks.map((s) => s.id) : ['generic'];
    const fromRegistry = (field) => ids.map((id) => byId[id][field]).find(Boolean) || null;
    const comp = {
      path: at,
      primary: ids[0],
      stacks: ids.map((id) => ({ id, score: 1, evidence: ['declared in onestop.yml'] })),
      packs: strings(d.packs) || [...new Set(ids.flatMap((id) => byId[id].packs || []))],
      concern_packs: strings(d.concerns) || [...new Set(ids.flatMap((id) => byId[id].concern_packs || []))],
      web_automation: d.web_automation ?? prior?.web_automation ?? fromRegistry('web_automation'),
      app_automation: d.app_automation ?? prior?.app_automation ?? fromRegistry('app_automation'),
      declared: true,
    };
    for (const target of ['web', 'app']) {
      const found = existing.find((e) => e.target === target);
      if (found && comp[`${target}_automation`] && d[`${target}_automation`] === undefined) comp[`${target}_automation`] = found.framework;
    }
    if (prior) components.splice(components.indexOf(prior), 1, comp);
    else components.push(comp);
  }
}

export function detectStack(root) {
  const reg = registry('stacks');
  const { files, via, truncated } = listFiles(root);
  const extOf = (f) => path.posix.extname(f).toLowerCase();
  const allExts = new Set(reg.stacks.flatMap((s) => s.extensions || []));

  // Candidate components: every directory holding a strong marker.
  const hits = new Map(); // comp -> Map(stackId -> [markers])
  for (const s of reg.stacks) {
    for (const m of s.markers || []) {
      const match = markerMatcher(m);
      for (const f of files) {
        if (!match(f)) continue;
        const comp = componentOf(f, m);
        if (!hits.has(comp)) hits.set(comp, new Map());
        const forComp = hits.get(comp);
        if (!forComp.has(s.id)) forComp.set(s.id, []);
        if (!forComp.get(s.id).includes(m)) forComp.get(s.id).push(m);
      }
    }
  }
  // A marker several stacks claim (build.gradle.kts: Java and Kotlin) names the family,
  // not the stack, so its weight is shared and the source files decide.
  const claims = new Map();
  for (const s of reg.stacks) for (const m of s.markers || []) claims.set(m, (claims.get(m) || 0) + 1);
  // Build scripts are configuration, not product source: a Java project's build.gradle.kts
  // must not count as Kotlin code in the census.
  const sourceFiles = files.filter((f) => allExts.has(extOf(f)) && !/\.gradle\.kts$/i.test(f));
  const greenfield = hits.size === 0 && sourceFiles.length === 0 && files.filter((f) => !NOT_SOURCE.test(path.posix.basename(f)) && !f.startsWith('docs/')).length === 0;
  if (!hits.size && sourceFiles.length) hits.set('.', new Map());

  const comps = [...hits.keys()].sort((a, b) => b.length - a.length);
  const owner = (f) => comps.find((c) => c === '.' || f === c || f.startsWith(`${c}/`)) || '.';

  const components = [];
  for (const comp of [...hits.keys()].sort()) {
    const mine = sourceFiles.filter((f) => owner(f) === comp);
    const text = manifestText(root, files, comp);
    const npm = npmDeps(root, comp);
    const scored = [];
    for (const s of reg.stacks) {
      if (s.id === 'generic') continue;
      const evidence = [];
      let score = 0;
      const strong = hits.get(comp).get(s.id) || [];
      if (strong.length) {
        score += Math.max(...strong.map((m) => 1 / (claims.get(m) || 1)));
        evidence.push(`marker ${strong.join(', ')}`);
      }
      const exts = new Set(s.extensions || []);
      const share = mine.length ? mine.filter((f) => exts.has(extOf(f))).length / mine.length : 0;
      const weak = (s.weak_markers || []).filter((m) => files.some((f) => markerMatcher(m)(f) && owner(f) === comp));
      if (weak.length && share > 0.3) { score += 0.3; evidence.push(`weak marker ${weak.join(', ')}`); }
      const deps = (s.dependency_markers || []).filter((d) => depHit(d, text, npm));
      if (deps.length) { score += 1.0; evidence.push(`dependency ${deps.join(', ')}`); }
      if (share > 0.6) { score += 0.7; evidence.push(`${Math.round(share * 100)}% of source files`); } else if (share > 0) { score += 0.3; evidence.push(`${Math.round(share * 100)}% of source files`); }
      // A framework binds only on a real dependency - vite.config.ts alone is not React.
      if (s.dependency_markers && s.dependency_markers.length && !deps.length) continue;
      if (score >= 0.7) scored.push({ id: s.id, score: Number(score.toFixed(2)), evidence });
    }
    scored.sort((a, b) => b.score - a.score);
    const byId = Object.fromEntries(reg.stacks.map((s) => [s.id, s]));
    const bound = scored.length ? scored : [{ id: 'generic', score: 0, evidence: ['no stack matched - the generic pack applies'] }];
    const packs = [];
    const concern = [];
    for (const b of bound) {
      for (const p of byId[b.id].packs || []) if (!packs.includes(p)) packs.push(p);
      for (const p of byId[b.id].concern_packs || []) if (!concern.includes(p)) concern.push(p);
    }
    const pick = (field, cond) => {
      for (const b of bound) {
        const s = byId[b.id];
        const when = s[`${field}_when`];
        if (when) {
          for (const [fw, signals] of Object.entries(when)) if (signals.some((sig) => text.includes(sig))) return fw;
          continue;
        }
        if (s[field] && (!cond || cond(s))) return s[field];
      }
      return null;
    };
    const ambiguous = scored.length >= 2
      && scored[0].score - scored[1].score < 0.2
      && !(byId[scored[0].id].packs || []).some((p) => (byId[scored[1].id].packs || []).includes(p));
    components.push({
      path: comp,
      primary: bound[0].id,
      stacks: bound,
      packs,
      concern_packs: concern,
      web_automation: pick('web_automation'),
      app_automation: pick('app_automation'),
      ...(ambiguous ? { ambiguous_between: [scored[0].id, scored[1].id] } : {}),
    });
  }

  // An automation framework already in the repository always wins over a default.
  const existing = [];
  for (const [target, list] of [['web', reg.automation_frameworks.web], ['app', reg.automation_frameworks.app]]) {
    for (const fw of list) {
      // A file marker, or a package in any manifest - FlaUI in a .csproj is as real as
      // @playwright/test in package.json.
      const found = (fw.markers || []).filter((m) => files.some((f) => markerMatcher(m)(f))
        || [...hits.keys()].some((c) => depHit(m, manifestText(root, files, c), npmDeps(root, c))));
      if (found.length) existing.push({ target, framework: fw.id, evidence: found });
    }
  }
  for (const c of components) {
    const web = existing.find((e) => e.target === 'web');
    const app = existing.find((e) => e.target === 'app');
    if (web && c.web_automation) c.web_automation = web.framework;
    if (app && c.app_automation) c.app_automation = app.framework;
  }

  applyDeclared(root, components, existing);

  return {
    ok: true,
    greenfield,
    files_scanned: files.length,
    via,
    truncated,
    components,
    existing_automation: existing,
    ambiguous: components.filter((c) => c.ambiguous_between).map((c) => ({ component: c.path, between: c.ambiguous_between })),
  };
}

// ---------------------------------------------------------------- commands

const COMMAND_NAMES = ['build', 'test', 'coverage', 'lint', 'format', 'typecheck'];

export function classifyCommand(cmd) {
  const c = ` ${cmd.toLowerCase()} `;
  if (/(--cov\b|--coverage|\bcoverage\b|jacoco|llvm-cov|\bcover\b|-coverprofile|collect:"?xplat)/.test(c)) return 'coverage';
  if (/\b(pytest|jest|vitest|mocha|rspec|phpunit|ctest|tox|nox)\b|\b(go|cargo|dotnet|mix|flutter|swift|deno|bun)\s+test\b|\bmvnw?\s+(-\S+\s+)*test\b|\bgradlew?(\.bat)?\s+(\S+\s+)*test\b|\b(npm|pnpm|yarn)\s+(run\s+)?test\b|\bmake\s+test\b|\bjust\s+test\b|\bxcodebuild\b.*\btest\b/.test(c)) return 'test';
  if (/\b(eslint|ruff\s+check|flake8|pylint|clippy|golangci-lint|go\s+vet|rubocop|phpcs|ktlint|detekt|swiftlint|biome\s+(lint|check))\b|\b(npm|pnpm|yarn)\s+(run\s+)?lint\b|\bmake\s+lint\b/.test(c)) return 'lint';
  if (/(prettier\s+(--check|-c)\b|fmt\s+(--check|-check)|format\s+--verify-no-changes|\bgofmt\s+-l\b|black\s+--check|ruff\s+format\s+--check|spotlesscheck|swiftformat\s+--lint|dart\s+format\s+--set-exit-if-changed)/.test(c)) return 'format';
  if (/\b(tsc|vue-tsc|mypy|pyright|typecheck|type-check|check-types)\b/.test(c)) return 'typecheck';
  if (/\b(build|compile|assemble)\b|\bmake\b(?!\s+\w)/.test(c)) return 'build';
  return null;
}

const SETUP = /^(npm\s+(ci|install)|pnpm\s+install|yarn(\s+install)?$|bun\s+install|pip\s+install|uv\s+sync|poetry\s+install|bundle\s+install|composer\s+install|dotnet\s+restore|go\s+mod\s+download|cd\s|echo\s|export\s|set\s|mkdir\s|curl\s|wget\s|apt|brew|choco|sudo\s)/i;

function ciRunLines(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)-?\s*(run|script|sh|bat)\s*:\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const val = m[3].trim();
    if (val && !/^[|>]/.test(val)) { out.push(val.replace(/^["']|["']$/g, '')); continue; }
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim()) continue;
      const ind = l.match(/^\s*/)[0].length;
      if (ind <= indent) break;
      out.push(l.trim().replace(/^-\s+/, '').replace(/^["']|["']$/g, ''));
    }
  }
  return out;
}

function ciCommands(root, files) {
  const ciFiles = files.filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$|^\.gitlab-ci\.yml$|^azure-pipelines\.ya?ml$|^bitbucket-pipelines\.yml$|^\.circleci\/config\.yml$|(^|\/)Jenkinsfile$/.test(f));
  const out = [];
  for (const f of ciFiles) {
    const text = read(root, f);
    if (!text) continue;
    const lines = /Jenkinsfile$/.test(f)
      ? [...text.matchAll(/\b(?:sh|bat)\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
      : ciRunLines(text);
    for (const line of lines) {
      for (const part of line.split(/\s*&&\s*/)) {
        const cmd = part.trim();
        if (cmd && !SETUP.test(cmd) && !cmd.includes('${{')) out.push({ cmd, file: f });
      }
    }
  }
  return out;
}

function packageManager(root, comp) {
  const at = (f) => fs.existsSync(path.join(root, comp === '.' ? f : `${comp}/${f}`)) || fs.existsSync(path.join(root, f));
  if (at('pnpm-lock.yaml')) return { pm: 'pnpm', run: (s) => (s === 'test' ? 'pnpm test' : `pnpm run ${s}`) };
  if (at('yarn.lock')) return { pm: 'yarn', run: (s) => (s === 'test' ? 'yarn test' : `yarn ${s}`) };
  if (at('bun.lock') || at('bun.lockb')) return { pm: 'bun', run: (s) => `bun run ${s}` };
  return { pm: 'npm', run: (s) => (s === 'test' ? 'npm test' : `npm run ${s}`) };
}

const SCRIPT_NAMES = {
  test: ['test', 'test:unit', 'unit'],
  build: ['build', 'compile'],
  lint: ['lint', 'lint:check'],
  format: ['format:check', 'fmt:check', 'prettier:check', 'check-format', 'format-check'],
  typecheck: ['typecheck', 'type-check', 'check-types', 'tsc', 'types'],
  coverage: ['coverage', 'test:coverage', 'test:cov', 'cov'],
};

function taskRunnerCommands(root, files, comp) {
  const out = {};
  const rel = (f) => (comp === '.' ? f : `${comp}/${f}`);
  const has = (f) => files.includes(rel(f));
  const pkgText = read(root, rel('package.json'));
  if (pkgText) {
    try {
      const scripts = JSON.parse(pkgText).scripts || {};
      const { pm, run } = packageManager(root, comp);
      for (const [name, aliases] of Object.entries(SCRIPT_NAMES)) {
        const s = aliases.find((a) => scripts[a]);
        if (s && !/no test specified/.test(scripts[s])) out[name] = { cmd: run(s), source: `${rel('package.json')} scripts.${s} (${pm})` };
      }
    } catch { /* malformed package.json - other sources still apply */ }
  }
  const targetsOf = (f, re) => { const t = read(root, rel(f)); return t ? [...t.matchAll(re)].map((m) => m[1]) : []; };
  const make = has('Makefile') ? targetsOf('Makefile', /^([A-Za-z0-9_.-]+)\s*:(?!=)/gm) : [];
  const just = has('justfile') ? targetsOf('justfile', /^([A-Za-z0-9_-]+)\s*:/gm) : [];
  for (const [runner, targets, prefix] of [['Makefile', make, 'make'], ['justfile', just, 'just']]) {
    for (const [name, aliases] of Object.entries({ ...SCRIPT_NAMES, format: ['format-check', 'fmt-check', 'check-format'] })) {
      if (out[name]) continue;
      const t = aliases.find((a) => targets.includes(a));
      if (t) out[name] = { cmd: `${prefix} ${t}`, source: `${rel(runner)} target ${t}` };
    }
  }
  const win = process.platform === 'win32';
  if (has('gradlew') || has('gradlew.bat')) {
    const g = win ? 'gradlew.bat' : './gradlew';
    out.test ??= { cmd: `${g} test`, source: `${rel('gradlew')} wrapper` };
    out.build ??= { cmd: `${g} build -x test`, source: `${rel('gradlew')} wrapper` };
  }
  if (has('mvnw') || has('mvnw.cmd')) {
    const m = win ? 'mvnw.cmd' : './mvnw';
    out.test ??= { cmd: `${m} test`, source: `${rel('mvnw')} wrapper` };
    out.build ??= { cmd: `${m} -DskipTests package`, source: `${rel('mvnw')} wrapper` };
  }
  const py = read(root, rel('pyproject.toml')) || '';
  const pyRunner = has('uv.lock') ? 'uv run' : has('poetry.lock') ? 'poetry run' : null;
  if (pyRunner) {
    if (/\bpytest\b/.test(py)) out.test ??= { cmd: `${pyRunner} pytest`, source: `${rel(has('uv.lock') ? 'uv.lock' : 'poetry.lock')} + pytest in pyproject.toml` };
    if (/\bpytest-cov\b/.test(py)) out.coverage ??= { cmd: `${pyRunner} pytest --cov --cov-report=term-missing`, source: 'pytest-cov in pyproject.toml' };
    if (/\bruff\b/.test(py)) out.lint ??= { cmd: `${pyRunner} ruff check .`, source: 'ruff in pyproject.toml' };
    if (/\bmypy\b/.test(py)) out.typecheck ??= { cmd: `${pyRunner} mypy .`, source: 'mypy in pyproject.toml' };
  }
  if (has('tox.ini')) out.test ??= { cmd: 'tox', source: rel('tox.ini') };
  if (has('noxfile.py')) out.test ??= { cmd: 'nox', source: rel('noxfile.py') };
  return out;
}

// A registry default is used only when everything it needs is already in the project.
// Installing a runner to make a default work is a new dependency - the user's call.
// {x} is the package runner the lockfile implies, {py} the virtualenv runner, {pm} the
// package manager - so a default runs the way the project runs everything else.
function fillPlaceholders(root, comp, cmd) {
  const at = (f) => fs.existsSync(path.join(root, comp === '.' ? f : `${comp}/${f}`)) || fs.existsSync(path.join(root, f));
  const { pm } = packageManager(root, comp);
  const x = { npm: 'npx', pnpm: 'pnpm exec', yarn: 'yarn', bun: 'bunx' }[pm] || 'npx';
  const py = at('uv.lock') ? 'uv run ' : at('poetry.lock') ? 'poetry run ' : '';
  return cmd.replace(/\{x\}/g, x).replace(/\{py\}/g, py).replace(/\{pm\}/g, pm);
}

function stackDefaults(root, files, comp, stackId) {
  const s = registry('stacks').stacks.find((x) => x.id === stackId);
  if (!s) return { resolved: {}, candidates: {} };
  const defaults = { ...(s.commands_default || {}) };
  if (!defaults.test && s.test_runner?.default) defaults.test = s.test_runner.default;
  if (!defaults.coverage && s.coverage_cmd) defaults.coverage = s.coverage_cmd;
  for (const [name, cmd] of Object.entries(defaults)) if (cmd) defaults[name] = fillPlaceholders(root, comp, cmd);
  const text = manifestText(root, files, comp);
  const npm = npmDeps(root, comp);
  const resolved = {};
  const candidates = {};
  for (const [name, cmd] of Object.entries(defaults)) {
    if (!cmd) continue;
    const needs = (s.requires && s.requires[name]) || [];
    const missing = needs.filter((d) => !depHit(d, text, npm));
    if (missing.length || !s.requires) {
      candidates[name] = { cmd, missing: missing.length ? missing : ['not verified - this stack declares no requirements'] };
    } else {
      resolved[name] = { cmd, source: `registry default for ${stackId} (requirements present: ${needs.map((d) => [].concat(d).join(' or ')).join(', ') || 'toolchain only'})` };
    }
  }
  return { resolved, candidates };
}

const COMPILED = new Set(['csharp', 'fsharp', 'java', 'kotlin', 'rust', 'go', 'cpp', 'swift', 'typescript', 'angular', 'react', 'vue', 'svelte']);

export function resolveCommands(root, { detection } = {}) {
  const settings = effectiveSettings(root);
  const det = detection || detectStack(root);
  const { files } = listFiles(root);
  const commands = {};
  const candidates = {};
  for (const name of COMMAND_NAMES) {
    const cmd = settings.declared_commands[name];
    if (typeof cmd === 'string' && cmd.trim()) commands[name] = { cmd: cmd.trim(), source: 'onestop.yml', confidence: 'declared' };
  }
  const ci = ciCommands(root, files);
  for (const name of COMMAND_NAMES) {
    if (commands[name]) continue;
    const hit = ci.find((c) => classifyCommand(c.cmd) === name);
    if (hit) commands[name] = { cmd: hit.cmd, source: hit.file, confidence: 'ci' };
  }
  for (const comp of det.components.map((c) => c.path)) {
    const tr = taskRunnerCommands(root, files, comp);
    for (const name of COMMAND_NAMES) if (!commands[name] && tr[name]) commands[name] = { ...tr[name], confidence: 'task-runner' };
  }
  // Every bound stack may supply a default - a React component is also TypeScript, and a
  // Django one also Python - first resolvable default wins.
  for (const c of det.components) {
    for (const s of c.stacks) {
      const d = stackDefaults(root, files, c.path, s.id);
      for (const name of COMMAND_NAMES) {
        if (!commands[name] && d.resolved[name]) commands[name] = { ...d.resolved[name], confidence: 'stack-default' };
        else if (!commands[name] && d.candidates[name]) (candidates[name] ||= []).push({ component: c.path, ...d.candidates[name] });
      }
    }
  }
  const compiled = det.components.some((c) => COMPILED.has(c.primary));
  const ask = ['test', ...(compiled ? ['build'] : [])].filter((n) => !commands[n]);
  return {
    ok: true,
    commands,
    unknown: COMMAND_NAMES.filter((n) => !commands[n]),
    ask,
    candidates,
    hint: ask.length
      ? `Ask the user once how to ${ask.join(' and ')} this project, offering the candidates found (with where each came from) plus "I'll type them". Never proceed to implement without a known test command. Record the answer with run_note kind "commands".`
      : 'Record these with run_note kind "commands" and use them verbatim in every brief.',
  };
}
