// What the orchestrator dispatches for a phase: the recipe phase_start hands back.
//
// The recipe names the specialists, the dispatch shape, the playbook each specialist
// reads, the artifact paths, and - for the review panel - which reviewers bind. Panel
// membership is decided here from evidence (security flags the hook recorded, the files
// in the change surface), not by the model's judgement of what "looks" security-relevant.

import { guidePath, pluginPath, registry } from './env.mjs';
import { readJsonl, statePath } from './store.mjs';
import { changeSurface } from './git.mjs';

const UI_FILE = /\.(tsx|jsx|vue|svelte|astro|html|css|scss|less|razor|cshtml|xaml|swift|dart)$/i;
const DATA_FILE = /(^|\/)(migrations?|alembic|flyway|liquibase|prisma|db\/schema|schema\.(sql|rb|prisma))(\/|$)|\.sql$/i;

function artifactsFor(phase, slug) {
  const entry = registry('artifacts').by_phase.find((e) => e.phase === phase);
  if (!entry) return [];
  return entry.artifacts.map((a) => ({ path: a.path.replace(/<slug>/g, slug), what: a.what }));
}

function concernPacks(run) {
  const out = new Set();
  for (const c of run.stack?.components || []) for (const p of c.concern_packs || []) out.add(p);
  return out;
}

function panelFor(root, run, spec) {
  const flags = readJsonl(statePath(root, 'security-flags.jsonl'));
  const surface = run.git ? changeSurface(root).files : [];
  const concerns = concernPacks(run);
  return Object.keys(spec.panel).map((agent) => {
    switch (agent) {
      case 'code-reviewer':
        return { agent, bind: true, why: 'always' };
      case 'security-reviewer': {
        const surfaces = [...new Set(flags.map((f) => f.surface))];
        const bind = surfaces.length > 0 || run.intent === 'security';
        return { agent, bind, why: bind ? (surfaces.length ? `security surfaces touched: ${surfaces.join(', ')}` : 'security intent') : 'no security surface touched' };
      }
      case 'data-reviewer': {
        const hit = surface.filter((f) => DATA_FILE.test(f));
        return { agent, bind: hit.length > 0, why: hit.length ? `data files changed: ${hit.slice(0, 3).join(', ')}` : 'no migration, schema or query file changed' };
      }
      case 'a11y-agent': {
        const ui = surface.filter((f) => UI_FILE.test(f));
        const bind = ui.length > 0 && (concerns.size === 0 || concerns.has('accessibility'));
        return { agent, bind, why: bind ? `UI files changed: ${ui.slice(0, 3).join(', ')}` : 'no UI file changed' };
      }
      case 'performance-agent':
        return { agent, bind: run.intent === 'perf', why: run.intent === 'perf' ? 'performance intent' : 'not a performance run' };
      default:
        return { agent, bind: false, why: 'unknown panel member' };
    }
  });
}

function automationTargets(run) {
  const wanted = run.settings?.automation || {};
  const components = run.stack?.components || [];
  const web = components.filter((c) => c.web_automation).map((c) => ({ component: c.path, framework: c.web_automation }));
  const app = components.filter((c) => c.app_automation).map((c) => ({ component: c.path, framework: c.app_automation }));
  return {
    web: wanted.web === 'off' ? [] : web,
    app: wanted.app === 'off' ? [] : app,
    note: components.length ? undefined : 'stack not recorded yet - read the stack facts report to decide the targets',
  };
}

// Phases whose orchestration needs more than the core loop - the guide is read only then.
const GUIDES = { context: 'context', implement: 'dev-loop', ship: 'ship' };

export function recipe(root, run, phase) {
  const reg = registry('phases');
  const spec = reg.phases[phase];
  if (!spec) return { phase, dispatch: 'unknown', note: `${phase} has no entry in registry/phases.json` };
  const overrides = (reg.intent_overrides[run.intent] || {})[phase] || {};
  const out = {
    phase,
    purpose: spec.purpose,
    dispatch: spec.dispatch,
    how: reg.dispatch_shapes[spec.dispatch],
    playbook: spec.playbook ? pluginPath('skills', spec.playbook, 'SKILL.md') : null,
    lead: spec.lead,
    mode: spec.mode || null,
    also: spec.also || [],
    then: spec.then || [],
    read_only: Boolean(spec.read_only),
    light: Boolean(run.phases[phase]?.light),
    stops: run.stops.includes(phase),
    artifacts: artifactsFor(phase, run.slug),
    ...(GUIDES[phase] ? { guide: guidePath(GUIDES[phase]) } : {}),
  };
  if (spec.roles) out.roles = { ...spec.roles, ...overrides };
  if (spec.panel) out.panel = panelFor(root, run, spec);
  if (spec.dispatch === 'per-unit') out.units = run.units.length ? run.units : [{ id: 1, title: run.request }];
  if (phase === 'automation') out.targets = automationTargets(run);
  if (spec.dispatch === 'dev-loop') {
    const limits = run.settings.limits;
    out.loop = {
      steps: registry('policies').dev_loop.steps,
      max_iterations: limits.dev_loop_iterations,
      budgets: {
        build_fix: `${limits.build_fix_per_root_cause} per root cause, ${limits.build_fix_per_phase} per phase`,
        test_fix: `${limits.test_fix_per_test} per failing test`,
        review_fix: `${limits.review_fix_per_finding} per finding`,
      },
      checkpoints: 'call checkpoint before the first slice ("pre-implement") and after each slice ("slice <n>")',
      schedule: 'pass the partition to schedule_waves; dispatch each wave in ONE message',
    };
  }
  return out;
}
