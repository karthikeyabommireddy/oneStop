// The engine's tool table - one definition shared by the MCP server and the CLI, so
// what the orchestrator calls and what the tests call cannot drift apart.

import { projectRoot } from './env.mjs';
import * as ledger from './ledger.mjs';
import { classify } from './classify.mjs';
import { planPhases } from './plan.mjs';
import { detectStack, resolveCommands } from './stack.mjs';
import { schedule } from './schedule.mjs';
import { buildBrief } from './brief.mjs';
import { kgEnsure, kgStatus } from './kg.mjs';
import { effectiveSettings } from './config.mjs';

const PROJECT = { project_dir: { type: 'string', description: 'Absolute project root. Omit to use the session project.' } };
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const obj = (properties, required = []) => ({ type: 'object', properties: { ...properties, ...PROJECT }, required });

export const TOOLS = [
  {
    name: 'run_open',
    description: 'Open the run ledger for a request, or resume the active run. Call this first. It never overwrites an active run - on a different request it returns conflict with options to put to the user.',
    inputSchema: obj({ request: str('The user request, verbatim. Empty to resume.'), on_conflict: str('The user\'s answer to a conflict.', { enum: ['resume', 'archive', 'stop'] }) }),
    handler: (a, root) => ledger.openRun(root, a),
  },
  {
    name: 'run_status',
    description: 'The run as it stands: progress line, current phase, pending gate, open questions, decisions, commands and recent events.',
    inputSchema: obj({ events: { type: 'integer', description: 'How many recent events to include (default 10).' } }),
    handler: (a, root) => ledger.status(root, { events: a.events ?? 10 }),
  },
  {
    name: 'run_close',
    description: 'Close the run as complete (every phase done or skipped) or stopped, and archive it.',
    inputSchema: obj({ status: str('complete or stopped', { enum: ['complete', 'stopped'] }), note: str('Optional closing note.') }, ['status']),
    handler: (a, root) => ledger.closeRun(root, a),
  },
  {
    name: 'run_note',
    description: 'Record something on the ledger: a decision settled without asking (choice, rule, evidence), an open question, the resolution of one, a user approval (dependency, version, tool, delete, ci), an amendment, the resolved commands, the detected stack, or flow units.',
    inputSchema: obj({
      kind: str('What to record.', { enum: ['decision', 'open', 'resolve', 'approval', 'amendment', 'commands', 'stack', 'units'] }),
      choice: str('decision: what was chosen'), rule: str('decision: the rule that settled it'), evidence: str('decision: path:line or source'),
      question: str('open / resolve: the question'), recommended: str('open: the recommended default'), answer: str('resolve: the user\'s answer'), index: { type: 'integer' },
      approval_kind: str('approval: what was approved', { enum: ['dependency', 'version', 'tool', 'delete', 'ci', 'skip'] }), item: str('approval: e.g. "npm:zod@3.23.8"'),
      note: str('amendment / approval note'), commands: { type: 'object', description: 'commands: { build, test, coverage, lint, format, typecheck } -> command string' }, source: str('commands: where they came from'),
      stack: { type: 'object', description: 'stack: the detect_stack result' }, units: { type: 'array', items: { type: 'object' }, description: 'units: flow steps [{ id, title, criterion, inferred }]' },
    }, ['kind']),
    handler: (a, root) => ledger.addNote(root, a),
  },
  {
    name: 'classify',
    description: 'Classify the request into an intent by deterministic signal scoring, with the signals that fired, the runner-up, whether it is genuinely ambiguous, and a tier hint. An empty folder classifies as mvp.',
    inputSchema: obj({ request: str('The user request (or the fetched ticket text).') }, ['request']),
    handler: (a, root) => classify(a.request, { greenfield: detectStack(root).greenfield }),
  },
  {
    name: 'phase_plan',
    description: 'Preview the phase list for an intent and tier: which phases run, which are skipped and why, which boundaries stop in the gate mode, and which gate authorises implementation. Read-only - gate_record on intake commits it.',
    inputSchema: obj({ intent: str('The intent.'), tier: str('trivial, small, standard or large'), gate_mode: str('every-phase, milestone or autonomous'), skip: { type: 'array', items: { type: 'string' } } }, ['intent']),
    handler: (a, root) => {
      const s = effectiveSettings(root).effective;
      return planPhases({ intent: a.intent, tier: a.tier || 'standard', gateMode: a.gate_mode || s.gate_mode, settings: s, skip: a.skip || [] });
    },
  },
  {
    name: 'detect_stack',
    description: 'Detect components and stacks from the project\'s own files: markers, weak markers, dependencies and an extension census. Reports greenfield, existing automation frameworks and genuine ambiguities.',
    inputSchema: obj({}),
    handler: (a, root) => detectStack(root),
  },
  {
    name: 'resolve_commands',
    description: 'Resolve build, test, coverage, lint, format and typecheck commands from the project itself: onestop.yml, then CI, then the task runner (scripts with the lockfile\'s package manager, Makefile, wrappers, uv/poetry), then a registry default only if its tools are installed. Lists what must be asked.',
    inputSchema: obj({}),
    handler: (a, root) => resolveCommands(root),
  },
  {
    name: 'phase_start',
    description: 'Start a phase. Refuses if an earlier phase is unfinished or awaiting its gate, or - for implement - if the authorising gate is not approved. Returns the recipe: who to dispatch, how, the playbook, artifacts, and for review the panel decided from evidence.',
    inputSchema: obj({ phase: str('The phase id.'), mode: str('delegated (default) or inline', { enum: ['delegated', 'inline'] }), note: str('Why, if inline.') }, ['phase']),
    handler: (a, root) => ledger.startPhase(root, a),
  },
  {
    name: 'phase_finish',
    description: 'Finish the active phase with a one-paragraph summary and the artifact paths. Returns whether its boundary stops for a gate, the gate options, and the progress line. An unresolved open question from this phase stops it in every gate mode - put the open_questions to the user at that gate.',
    inputSchema: obj({ phase: str('The phase id.'), summary: str('What the phase produced, in at most 400 characters.'), artifacts: { type: 'array', items: { type: 'string' } } }, ['phase']),
    handler: (a, root) => ledger.finishPhase(root, a),
  },
  {
    name: 'gate_record',
    description: 'Record the user\'s answer at a gate. Gate zero (phase intake) commits the intent, tier and phase plan. skip_next on review after security surfaces, or on test after a behaviour change, needs confirmed:true after the warning is shown. The ship gate needs ship_choice.',
    inputSchema: obj({
      phase: str('The phase whose gate this is.'),
      decision: str('The user\'s answer.', { enum: ['approved', 'adjusted', 'skip_next', 'rerun', 'stopped'] }),
      note: str('The user\'s words when they adjusted or skipped.'),
      intent: str('Gate zero: the accepted intent.'), tier: str('Gate zero: the accepted tier.'), gate_mode: str('Gate zero: override the gate mode.'),
      skip: { type: 'array', items: { type: 'string' }, description: 'Gate zero: phases the user removed.' },
      ship_choice: str('Ship gate: the user\'s choice.', { enum: ['local-commit', 'commit-push', 'commit-push-pr', 'leave-uncommitted'] }),
      confirmed: { type: 'boolean', description: 'True only after showing a skip warning and the user still chose to skip.' },
    }, ['phase', 'decision']),
    handler: (a, root) => ledger.recordGate(root, a),
  },
  {
    name: 'report_store',
    description: 'Store a specialist\'s returned report on disk and get back its digest. Keep only the digest in the conversation; later specialists read the stored file. Open questions in the report are added to the run.',
    inputSchema: obj({ phase: str('The phase.'), agent: str('The specialist that produced it.'), report: str('The report text, verbatim.') }, ['phase', 'agent', 'report']),
    handler: (a, root) => ledger.storeReport(root, a),
  },
  {
    name: 'loop_attempt',
    description: 'Ask for one more attempt in a fix loop before taking it. Returns allowed:false and blocks the phase when the budget is spent - then present the blocked gate instead of looping.',
    inputSchema: obj({ loop: str('What this attempt is for: module, test, finding or lane.'), kind: str('The loop kind.', { enum: ['build_fix', 'test_fix', 'review_fix', 'dev_loop', 'lane_retry'] }), root_cause: str('build_fix: a short name for the root cause.') }, ['loop', 'kind']),
    handler: (a, root) => ledger.loopAttempt(root, a),
  },
  {
    name: 'checkpoint',
    description: 'Snapshot the working tree (tracked and new files) into a private checkpoint without touching the user\'s index, branches or files. Take one before the first slice and after each slice.',
    inputSchema: obj({ label: str('e.g. "pre-implement" or "slice 2"') }),
    handler: (a, root) => ledger.checkpoint(root, a),
  },
  {
    name: 'checkpoint_revert',
    description: 'Undo the last slice or the whole run by reverse-applying exactly the run\'s own checkpoint delta. Without confirm it only previews. It refuses, changing nothing, if the files moved on since.',
    inputSchema: obj({ scope: str('last or whole-run', { enum: ['last', 'whole-run'] }), confirm: { type: 'boolean' } }),
    handler: (a, root) => ledger.checkpointRevert(root, a),
  },
  {
    name: 'schedule_waves',
    description: 'Group tasks into waves that can run at the same time. Tasks sharing a write path never share a wave; migrations, manifests and registration files run alone.',
    inputSchema: obj({ tasks: { type: 'array', items: { type: 'object' }, description: '[{ id, writes: [paths], depends_on: [ids], kind?: migration|manifest|git|destructive|registration }]' } }, ['tasks']),
    handler: (a) => schedule(a.tasks),
  },
  {
    name: 'brief',
    description: 'Build the brief for one specialist dispatch: task, playbook, stack facts, packs, resolved commands, write surface, artifacts, budget, the safety invariants and the exact report format. Pass the returned brief as the agent prompt, unchanged.',
    inputSchema: obj({
      phase: str('The phase.'), agent: str('The specialist.'), task: str('This dispatch\'s task and acceptance criteria.'), unit: str('Flow step or lane id, if any.'),
      write_surface: { type: 'array', items: { type: 'string' }, description: 'Paths this specialist may write; omit or empty for read-only phases.' },
      mode: str('A mode the phase defines, e.g. design or scaffold.'), extra: str('Anything else this specialist needs, e.g. the user\'s adjustment.'),
    }, ['phase', 'agent', 'task']),
    handler: (a, root) => buildBrief(root, a),
  },
  {
    name: 'kg',
    description: 'The code knowledge graph: status, or ensure (refresh if stale; start a background first build unless the repository is very large). Code-only unless ONESTOP_KG_SEMANTIC=1.',
    inputSchema: obj({ action: str('status, ensure or build', { enum: ['status', 'ensure', 'build'] }) }),
    handler: (a, root) => {
      const setting = effectiveSettings(root).effective.knowledge_graph;
      if (a.action === 'status') return { ok: true, ...kgStatus(root) };
      return kgEnsure(root, { setting, build: a.action === 'build' });
    },
  },
];

export function callTool(name, args = {}) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `unknown tool "${name}" - one of: ${TOOLS.map((t) => t.name).join(', ')}` };
  try {
    return tool.handler(args, projectRoot(args.project_dir));
  } catch (e) {
    return { ok: false, error: `engine error in ${name}: ${e.message}`, engine_error: true };
  }
}
