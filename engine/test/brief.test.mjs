// What specialists and the orchestrator are told to read - and only when they need it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { methodFile } from '../lib/brief.mjs';
import { PLUGIN, call, makeRepo, removeRepo, report } from './helpers.mjs';

function started(intent = 'feature') {
  const dir = makeRepo({ 'package.json': '{"name":"x"}', 'src/a.ts': 'export const a = 1;' }, { git: true });
  const opened = call(dir, 'run_open', { request: 'add CSV export' });
  call(dir, 'gate_record', { phase: 'intake', decision: 'approved', intent, tier: 'standard' });
  return { dir, opened };
}

test('every agent has a method file in the skill that owns it', () => {
  for (const f of fs.readdirSync(new URL('../../agents/', import.meta.url))) {
    const name = f.replace(/\.md$/, '');
    const m = methodFile(name);
    assert.ok(m && fs.existsSync(m), `${name} has no method file`);
    assert.match(m, /\/skills\/[^/]+\/agents\//);
  }
});

test('the brief names the method first and leaves out what the brief already says', () => {
  const { dir } = started();
  try {
    call(dir, 'phase_start', { phase: 'context' });
    const b = call(dir, 'brief', { phase: 'context', agent: 'onestop:stack-adapter', task: 'Confirm the stack.' }).brief;
    const readFirst = b.split('## Read first')[1].split('##')[0].trim().split('\n');
    assert.match(readFirst[0], /^- Your method: .*skills\/phase-context\/agents\/stack-adapter\.md$/);
    assert.doesNotMatch(b, /artifacts\.md/);
    // Method files cite `${CLAUDE_PLUGIN_ROOT}/...`, which no client expands in a file read with a tool.
    assert.ok(b.includes(`\`\${CLAUDE_PLUGIN_ROOT}\` stands for ${PLUGIN.split(path.sep).join('/')}`));
  } finally { removeRepo(dir); }
});

test('the orchestrator is handed each guide when its step arrives', () => {
  const { dir, opened } = started();
  try {
    assert.ok(fs.existsSync(opened.guide) && opened.guide.endsWith('start.md'));
    const ctx = call(dir, 'phase_start', { phase: 'context' });
    assert.ok(fs.existsSync(ctx.recipe.guide) && ctx.recipe.guide.endsWith('context.md'));
    call(dir, 'report_store', { phase: 'context', agent: 'stack-adapter', report: report('stack-adapter', 'context') });
    const fin = call(dir, 'phase_finish', { phase: 'context', summary: 'facts' });
    assert.ok(fin.needs_gate && fs.existsSync(fin.gate.guide) && fin.gate.guide.endsWith('gates.md'));
    call(dir, 'gate_record', { phase: 'context', decision: 'approved' });
    const req = call(dir, 'phase_start', { phase: 'requirements' });
    assert.equal(req.recipe.guide, undefined, 'phases with nothing extra to know get no guide');
  } finally { removeRepo(dir); }
});
