// Intent routing, phase plans and stack bindings - the executable specification that
// replaced scripts/test_routing.py.

import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../lib/classify.mjs';
import { authorisingPhase, planPhases } from '../lib/plan.mjs';
import { registry } from '../lib/env.mjs';

const CASES = [
  ['user signs in with Google, then they land on the dashboard and see recent orders', 'flow'],
  ['walk through the checkout journey step by step and build it', 'flow'],
  ['add support for CSV export on the reports page', 'feature'],
  ['implement a new billing webhook endpoint', 'feature'],
  ['the login button throws a null pointer exception on mobile', 'defect'],
  ['checkout is broken, payment fails with a 500 error', 'defect'],
  ['refactor the auth module, clean up the duplicate token logic', 'refactor'],
  ['simplify and restructure the reporting service', 'refactor'],
  ['bootstrap a new project from scratch with a REST API', 'mvp'],
  ['review this PR for correctness', 'review'],
  ['audit my changes before I merge', 'review'],
  ['write tests for the order service, we need coverage', 'test'],
  ['add e2e automation test for the signup page', 'test'],
  ['how does the session middleware work', 'investigate'],
  ['explain why does the cache invalidate on write', 'investigate'],
  ['the dashboard is slow, optimize the query latency', 'perf'],
  ['check for owasp vulnerability in the upload handler', 'security'],
  ['the ci pipeline build fails on the docker step', 'ops'],
  ['update the readme and document the api', 'docs'],
  ['design the architecture for multi-tenant support, decide between two approaches', 'design'],
  ['change the date format to ISO instead of US format', 'change'],
  ['write playwright e2e tests for the checkout flow', 'test'],
  ['automate the login journey', 'test'],
  ['add a regression suite for the orders API', 'test'],
  ['set up cypress and cover the signup page', 'test'],
  ['write appium tests for the mobile app', 'test'],
  ['the checkout page crashes on submit', 'defect'],
  ['upgrade react to 19', 'upgrade'],
  ['bump EF Core to the next major', 'upgrade'],
  ['migrate to vitest from jest', 'upgrade'],
];

test('every routing case reaches its intent', () => {
  const misses = CASES.filter(([request, want]) => classify(request, {}).intent !== want)
    .map(([request, want]) => `${want} <- "${request}" (got ${classify(request, {}).intent})`);
  assert.deepEqual(misses, []);
});

test('every intent example in the registry routes to its own intent', () => {
  for (const intent of registry('intents').intents) {
    assert.ok(intent.example, `${intent.id} has no example request`);
    const got = classify(intent.example, { greenfield: intent.id === 'mvp' }).intent;
    assert.equal(got, intent.id, `"${intent.example}"`);
  }
});

test('an empty folder is greenfield: a build request becomes mvp', () => {
  assert.equal(classify('build a todo API with user accounts', { greenfield: true }).intent, 'mvp');
  assert.equal(classify('build a todo API with user accounts', { greenfield: false }).intent, 'feature');
});

test('signals match whole words only', () => {
  // "changes" must not fire the `change` signal.
  assert.equal(classify('audit my changes before I merge', {}).intent, 'review');
});

test('implementation is authorised by exactly one gate, chosen by the mask', () => {
  const masks = Object.fromEntries(registry('intents').intents.map((i) => [i.id, i.phase_mask]));
  assert.equal(authorisingPhase(masks.feature), 'plan');
  assert.equal(authorisingPhase(masks.defect), 'reproduce');
  assert.equal(authorisingPhase(masks.refactor), 'verify-green');
  assert.equal(authorisingPhase(masks.upgrade), 'upgrade-plan');
  assert.equal(authorisingPhase(masks.security), 'review');
  assert.equal(authorisingPhase(masks.investigate), null);
});

test('design runs before plan, so the plan approved is the plan built', () => {
  for (const id of ['feature', 'flow', 'mvp']) {
    const mask = registry('intents').intents.find((i) => i.id === id).phase_mask;
    assert.ok(mask.indexOf('design') < mask.indexOf('plan'), id);
  }
});

test('every intent that changes files reaches ship', () => {
  for (const i of registry('intents').intents) {
    if (['review', 'investigate'].includes(i.id)) continue;
    assert.ok(i.phase_mask.includes('ship'), i.id);
  }
});

test('gate modes: intake and ship always stop; milestone adds the authoriser', () => {
  const auto = planPhases({ intent: 'defect', gateMode: 'autonomous' });
  assert.deepEqual(auto.stops, ['intake', 'ship']);
  assert.equal(auto.authorising_phase, 'intake');
  const milestone = planPhases({ intent: 'defect', gateMode: 'milestone' });
  assert.ok(milestone.stops.includes('reproduce'));
  assert.deepEqual(planPhases({ intent: 'feature' }).stops, planPhases({ intent: 'feature' }).mask);
});

test('the trivial tier lightens the plan gate instead of removing it', () => {
  const p = planPhases({ intent: 'feature', tier: 'trivial' });
  assert.ok(p.mask.includes('plan'));
  assert.ok(p.light.includes('plan'));
});

test('intake and ship can never be removed', () => {
  const p = planPhases({ intent: 'feature', skip: ['intake', 'ship', 'research'] });
  assert.ok(p.mask.includes('intake') && p.mask.includes('ship'));
  assert.ok(!p.mask.includes('research'));
});

test('stack bindings: evidence-gated automation, no npm tooling at non-JS roots', () => {
  const byId = Object.fromEntries(registry('stacks').stacks.map((s) => [s.id, s]));
  for (const id of ['go', 'rust', 'php', 'ruby', 'elixir', 'flutter', 'generic']) {
    assert.equal(byId[id].web_automation, null, id);
  }
  assert.equal(byId.csharp.app_automation, null);
  assert.ok(byId.csharp.app_automation_when.flaui.length);
  assert.equal(byId.kotlin.app_automation, null);
  assert.ok(byId.kotlin.app_automation_when.espresso.includes('com.android.application'));
  assert.equal(byId['react-native'].app_automation, 'detox');
  assert.equal(byId.react.web_automation, 'playwright');
});
