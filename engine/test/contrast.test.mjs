// WCAG contrast from the forms the palettes are written in.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { contrast, parseColor } from '../lib/contrast.mjs';
import { PLUGIN } from './helpers.mjs';

test('the extremes: black on white is 21:1', () => {
  assert.equal(contrast('#000', '#ffffff').ratio, 21);
  assert.equal(contrast('#fff', '#fff').ratio, 1);
});

test('the classic boundary: #767676 passes AA on white, #777777 does not', () => {
  const pass = contrast('#767676', '#ffffff');
  const fail = contrast('#777777', '#ffffff');
  assert.equal(pass.aa_text, true, String(pass.ratio));
  assert.equal(fail.aa_text, false, String(fail.ratio));
  assert.equal(fail.aa_large, true);
});

test('oklch reads the way browsers render it', () => {
  assert.equal(contrast('oklch(1 0 0)', '#ffffff').ratio, 1);
  assert.equal(contrast('oklch(0 0 0)', '#000000').ratio, 1);
  assert.equal(contrast('oklch(100% 0 0)', 'oklch(0% 0 0)').ratio, 21);
  // A mid-blue: the exact ratio matters less than landing where its sRGB rendering does.
  const viaOklch = contrast('oklch(0.62 0.19 260)', '#ffffff').ratio;
  assert.ok(viaOklch > 3 && viaOklch < 5, String(viaOklch));
});

test('rgb() is accepted; nonsense is refused, not guessed', () => {
  assert.equal(contrast('rgb(0, 0, 0)', 'rgb(255 255 255)').ratio, 21);
  assert.equal(parseColor('papayawhip-ish'), null);
  assert.equal(contrast('blue-ish', '#fff').ok, false);
});

test('the CLI checks pairs and lists the ones failing body text', () => {
  const r = spawnSync(process.execPath, [path.join(PLUGIN, 'engine', 'cli.mjs'), 'contrast', '#777777', '#ffffff', '#000000', '#ffffff'], { encoding: 'utf8' });
  const out = JSON.parse(r.stdout);
  assert.equal(out.pairs.length, 2);
  assert.equal(out.failing_body_text.length, 1);
});
