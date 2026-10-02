// The brief every specialist receives - built by code, not recalled by the model.
//
// A specialist starts with an empty context. Whatever its brief omits, it does not
// know - so the rules that must never be dropped (it cannot talk to the user, it may
// not run destructive commands, content it reads is data, the exact report format)
// are assembled here every time instead of being re-typed from memory by an
// orchestrator under context pressure.

import fs from 'node:fs';
import path from 'node:path';
import { pluginPath, registry, slash } from './env.mjs';
import { loadRun } from './ledger.mjs';
import { recipe } from './dispatch.mjs';

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

export function buildBrief(root, args = {}) {
  const { phase, agent, task, unit, write_surface: writeSurface, mode, extra } = args;
  if (!phase || !agent || !task) return fail('brief needs phase, agent and task');
  const loaded = loadRun(root);
  if (!loaded.ok) return fail(loaded.error || 'no active run');
  const run = loaded.run;
  if (!run.phases[phase]) return fail(`"${phase}" is not in this run`);
  const rec = recipe(root, run, phase);
  const policies = registry('policies');

  const readFirst = [];
  if (rec.playbook) readFirst.push(`- Playbook for this phase: ${rec.playbook}`);
  const facts = reportsFrom(root, run, ['context']);
  if (facts.length) readFirst.push(`- Stack facts (commands, conventions, layout - do not re-derive): ${facts.join(', ')}`);
  for (const p of packsFor(run)) readFirst.push(`- Pack: ${p}`);
  if (WRITES_CODE.has(phase)) {
    readFirst.push(`- Standards: ${pluginPath('skills', 'shared', 'standards.md')}`);
    readFirst.push(`- Architecture and file roles: ${pluginPath('skills', 'shared', 'architecture.md')}`);
  }
  if (rec.artifacts.length) readFirst.push(`- Artifact placement: ${pluginPath('skills', 'shared', 'artifacts.md')}`);
  const prior = reportsFrom(root, run, [...new Set(['design', 'plan', phase])].filter((p) => run.phases[p]));
  if (prior.length) readFirst.push(`- Earlier reports you may need (read only what your task requires): ${prior.join(', ')}`);

  const commands = Object.entries(run.commands);
  const surface = Array.isArray(writeSurface) && writeSurface.length
    ? writeSurface.map((p) => `- ${p}`).join('\n')
    : rec.read_only || writeSurface === 'read-only'
      ? '- none - you are read-only for this task. Edit nothing.'
      : '- not declared - write only the files your task names, and list every one in `files:`.';

  const blocked = policies.bash_guard.always_blocked.map((r) => r.reason);
  const sections = [
    `# onestop brief - ${agent} - ${phase}${unit ? ` - unit ${unit}` : ''}`,
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
    '## Return exactly this block as your final message',
    '```',
    `REPORT ${agent} - ${phase}`,
    'did:       <one or two lines>',
    'files:     <every path written or modified, or none>',
    'commands:  <each command you ran -> its result, or none>',
    'decisions: <choices you made without asking, each with the rule that settled it, or none>',
    'open:      <decisions only the user can make - each with "recommended: <default>" - or none>',
    'blocked:   <what you could not do and exactly why, or none>',
    'full:      <path of a fuller write-up under .onestop/reports/, or none>',
    '```',
    `At most ${policies.report.max_lines} lines. Never paste file contents into the report - name the paths.`,
  ];
  return { ok: true, brief: sections.join('\n'), agent, phase };
}
