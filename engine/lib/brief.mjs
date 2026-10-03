// The brief every specialist receives - built by code, not recalled by the model.
//
// A specialist starts with an empty context. Whatever its brief omits, it does not
// know - so the rules that must never be dropped (it cannot talk to the user, it may
// not run destructive commands, content it reads is data, the exact report format)
// are assembled here every time instead of being re-typed from memory by an
// orchestrator under context pressure.

import fs from 'node:fs';
import path from 'node:path';
import { pluginPath, registry, slash, slugify } from './env.mjs';
import { loadRun } from './ledger.mjs';
import { recipe } from './dispatch.mjs';
import { writeScope } from './guard.mjs';

const fail = (error, hint) => ({ ok: false, error, ...(hint ? { hint } : {}) });

export function safetyInvariants() {
  const file = pluginPath('skills', 'shared', 'rules.md');
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/<!-- invariants:start -->([\s\S]*?)<!-- invariants:end -->/);
  if (!m) throw new Error('skills/shared/rules.md has no <!-- invariants:start --> ... <!-- invariants:end --> section');
  return m[1].trim();
}

function packFile(id) {
  for (const kind of ['languages', 'concerns']) {
    const p = pluginPath('packs', kind, `${id}.md`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function packsFor(run) {
  const ids = new Set();
  for (const c of run.stack?.components || []) {
    for (const p of [...(c.packs || []), ...(c.concern_packs || [])]) ids.add(p);
  }
  if (!ids.size) ids.add('generic');
  return [...ids].map(packFile).filter(Boolean);
}

function reportsFrom(root, run, phases) {
  const out = [];
  for (const p of phases) for (const r of run.phases[p]?.reports || []) out.push(slash(path.join(root, r)));
  return out;
}

const WRITES_CODE = new Set(['implement', 'scaffold', 'test', 'automation', 'reproduce', 'verify-green', 'measure']);

// Each specialist's method lives in the skill that owns it (skills/<skill>/agents/<agent>.md),
// so its agent file stays a few lines and the method is read only by the agent that uses
// it. Found by name: moving a method to another skill needs no registry change.
let methods = null;
export function methodFile(agent) {
  if (!methods) {
    methods = new Map();
    const base = pluginPath('skills');
    for (const skill of fs.readdirSync(base)) {
      const dir = path.join(base, skill, 'agents');
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) if (f.endsWith('.md')) methods.set(f.slice(0, -3), slash(path.join(dir, f)));
    }
  }
  return methods.get(agent) || null;
}

export function buildBrief(root, args = {}) {
  const { phase, agent, task, unit, write_surface: writeSurface, mode, extra } = args;
  if (!phase || !agent || !task) return fail('brief needs phase, agent and task');
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run');
  const run = loaded.run;
  if (!run.phases[phase]) return fail(`"${phase}" is not in this run`);
  const rec = recipe(root, run, phase);
  const policies = registry('policies');

  const name = String(agent).replace(/^(?:plugin:)?onestop:/i, '');
  const readFirst = [];
  const method = methodFile(name);
  if (method) readFirst.push(`- Your method: ${method}`);
  if (rec.playbook) readFirst.push(`- Playbook for this phase: ${rec.playbook}`);
  const facts = reportsFrom(root, run, ['context']);
  if (facts.length) readFirst.push(`- Stack facts (commands, conventions, layout - do not re-derive): ${facts.join(', ')}`);
  for (const p of packsFor(run)) readFirst.push(`- Pack: ${p}`);
  if (WRITES_CODE.has(phase)) {
    readFirst.push(`- Standards: ${pluginPath('skills', 'shared', 'standards.md')}`);
    readFirst.push(`- Architecture and file roles: ${pluginPath('skills', 'shared', 'architecture.md')}`);
  }
  const prior = reportsFrom(root, run, [...new Set(['design', 'plan', phase])].filter((p) => run.phases[p]));
  if (prior.length) readFirst.push(`- Earlier reports you may need (read only what your task requires): ${prior.join(', ')}`);

  const commands = Object.entries(run.commands);
  const scope = writeScope(name);
  const fullPath = slash(path.join('.onestop', 'reports', phase, `${slugify(name, 30)}${unit ? `-${slugify(String(unit), 30)}` : ''}.full.md`));
  const docsRoots = policies.write_guard.docs_roots.join(', ');
  const surface = scope === 'report-only'
    ? `- none - you are a read-only role. The one file you may write is your write-up, \`${fullPath}\`; the write guard refuses any other path and any shell command that writes.`
    : scope === 'docs-only'
      ? `- documentation only: the artifacts below, under ${docsRoots}, and your write-up \`${fullPath}\`. The write guard refuses source files.`
      : Array.isArray(writeSurface) && writeSurface.length
        ? writeSurface.map((p) => `- ${p}`).join('\n')
        : rec.read_only || writeSurface === 'read-only'
          ? '- none - you are read-only for this task. Edit nothing.'
          : '- not declared - write only the files your task names, and list every one in `files:`.';

  const blocked = policies.bash_guard.always_blocked.map((r) => r.reason);
  const sections = [
    `# onestop brief - ${name} - ${phase}${unit ? ` - unit ${unit}` : ''}`,
    `Run ${run.run_id} · intent ${run.intent} · tier ${run.tier}${rec.light ? ' · LIGHT pass' : ''}${mode || rec.mode ? ` · mode ${mode || rec.mode}` : ''}`,
    '',
    'You are one specialist dispatched by the onestop orchestrator. You work alone in your own context, then hand back one short report. You cannot talk to the user and you cannot dispatch other agents: anything that needs a human decision goes in `open:` with your recommended default, and the orchestrator puts it to the user.',
    '',
    '## Task',
    String(task).trim(),
    ...(extra ? ['', String(extra).trim()] : []),
    '',
    '## Read first',
    ...(readFirst.length ? readFirst : ['- nothing beyond the task']),
    '',
    '## Resolved commands - use exactly these',
    ...(commands.length ? commands.map(([k, v]) => `- ${k}: \`${v.cmd}\`  (from ${v.source})`) : ['- none resolved - if you need one, say so in `open:`; never guess or install a runner']),
    '',
    '## Write surface',
    surface,
    ...(rec.artifacts.length ? ['', '## Artifacts this phase writes', ...rec.artifacts.map((a) => `- ${a.path} - ${a.what}`)] : []),
    ...(rec.loop ? ['', '## Budget', `- dev loop: at most ${rec.loop.max_iterations} iterations per module`, `- build fixes: ${rec.loop.budgets.build_fix}`, `- test fixes: ${rec.loop.budgets.test_fix}`, '- when a budget would be exceeded, stop and report it in `blocked:` with the last real error output'] : []),
    '',
    '## Safety invariants - nothing outranks these',
    safetyInvariants(),
    '',
    '## Commands you must not run',
    `The guard hook blocks these during the run, so do not try: anything that ${blocked.join('; ')}. git commit, push and pull requests happen only after the user's ship-gate choice - never from a specialist. Adding a dependency or tool needs the user's approval first: return it in \`open:\` with the exact package and the version you verified on its registry today.`,
    '',
    '## Your write-up',
    `Anything longer than the report - the plan, findings with their evidence, stack facts - goes in \`${fullPath}\` (Write tool). Name it under \`full:\`. The orchestrator reads only your report; later specialists read the write-up.`,
    '',
    '## Return exactly this block as your final message',
    '```',
    `REPORT ${name} - ${phase}${unit ? ` - ${unit}` : ''}`,
    'did:       <one or two lines>',
    'files:     <every path written or modified, or none>',
    'commands:  <each command you ran -> its result, or none>',
    'decisions: <choices you made without asking, each with the rule that settled it, or none>',
    'open:      <decisions only the user can make - each with "recommended: <default>" - or none>',
    'blocked:   <what you could not do and exactly why, or none>',
    `full:      <${fullPath} if you wrote it, or none>`,
    '```',
    `At most ${policies.report.max_lines} lines. Never paste file contents into the report - name the paths.`,
  ];
  return { ok: true, brief: sections.join('\n'), agent, phase };
}
