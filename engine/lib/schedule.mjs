// Wave scheduling: which tasks can run at the same time.
//
// The binding constraint is never the dependency graph - it is the write surface. Two
// agents editing one file corrupt it in a way that looks plausible. This is the rule
// registry/parallel.json describes and its original Python specification used, now used at
// run time instead of being re-derived by the model from prose.

import { registry } from './env.mjs';

// Shapes serialised regardless of what the graph allows.
const SERIAL_KINDS = new Set(['migration', 'manifest', 'git', 'destructive', 'registration']);

export function schedule(taskList) {
  if (!Array.isArray(taskList) || !taskList.length) return { ok: false, error: 'tasks must be a non-empty list of { id, writes, depends_on, kind? }' };
  const maxWidth = registry('parallel').scheduling.max_width;
  const tasks = new Map();
  for (const t of taskList) {
    if (!t || !t.id) return { ok: false, error: 'every task needs an id' };
    if (tasks.has(t.id)) return { ok: false, error: `duplicate task id ${t.id}` };
    tasks.set(t.id, { id: String(t.id), writes: t.writes || [], depends_on: t.depends_on || [], kind: t.kind || null });
  }
  for (const t of tasks.values()) {
    for (const d of t.depends_on) if (!tasks.has(d)) return { ok: false, error: `task ${t.id} depends on unknown task ${d}` };
  }

  const depth = new Map();
  const longest = (id) => {
    if (depth.has(id)) return depth.get(id);
    const children = [...tasks.values()].filter((t) => t.depends_on.includes(id));
    const d = 1 + Math.max(0, ...children.map((c) => longest(c.id)));
    depth.set(id, d);
    return d;
  };
  const collides = (a, b) => a.writes.some((w) => b.writes.includes(w));

  const done = new Set();
  const waves = [];
  const deferred = [];
  while (done.size < tasks.size) {
    const ready = [...tasks.values()].filter((t) => !done.has(t.id) && t.depends_on.every((d) => done.has(d)));
    if (!ready.length) return { ok: false, error: 'the task graph has a cycle or an unsatisfiable dependency' };
    // Critical path first: the wave is only as fast as its slowest lane.
    ready.sort((a, b) => longest(b.id) - longest(a.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const wave = [];
    for (const t of ready) {
      if (t.kind && SERIAL_KINDS.has(t.kind)) {
        if (!wave.length) wave.push(t);
        break;
      }
      if (wave.length >= maxWidth) break;
      if (wave.some((w) => collides(t, w))) {
        deferred.push({ task: t.id, wave: waves.length + 1, reason: `shares a write path with ${wave.filter((w) => collides(t, w)).map((w) => w.id).join(', ')}` });
        continue;
      }
      wave.push(t);
    }
    waves.push(wave.map((t) => t.id));
    for (const t of wave) done.add(t.id);
  }
  const parallel = waves.some((w) => w.length > 1);
  return {
    ok: true,
    waves,
    max_width: maxWidth,
    deferred,
    note: parallel
      ? 'Dispatch every lane of a wave in ONE message - separate messages run one after another. Join through merge-coordinator before the next wave.'
      : 'No two tasks can run together here - every wave is one lane. Run serially and say so plainly.',
  };
}
