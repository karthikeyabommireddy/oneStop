// The wave scheduler - the six scenarios that replaced scripts/test_parallel.py.

import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule } from '../lib/schedule.mjs';

const SCENARIOS = [
  {
    name: 'a contract unlocks frontend and backend at once',
    tasks: [
      { id: 'T1', writes: ['openapi.yaml'], depends_on: [] },
      { id: 'T2', writes: ['src/api/orders.ts'], depends_on: ['T1'] },
      { id: 'T3', writes: ['src/ui/OrderList.tsx'], depends_on: ['T1'] },
      { id: 'T4', writes: ['src/ui/OrderDetail.tsx'], depends_on: ['T1'] },
    ],
    expect: [['T1'], ['T2', 'T3', 'T4']],
  },
  {
    name: 'a hidden barrel-file collision serialises',
    tasks: [
      { id: 'A', writes: ['src/f/a.ts', 'src/index.ts'], depends_on: [] },
      { id: 'B', writes: ['src/f/b.ts', 'src/index.ts'], depends_on: [] },
      { id: 'C', writes: ['src/f/c.ts', 'src/index.ts'], depends_on: [] },
    ],
    expect: [['A'], ['B'], ['C']],
  },
  {
    name: 'deferred registration recovers the parallelism',
    tasks: [
      { id: 'A', writes: ['src/f/a.ts'], depends_on: [] },
      { id: 'B', writes: ['src/f/b.ts'], depends_on: [] },
      { id: 'C', writes: ['src/f/c.ts'], depends_on: [] },
      { id: 'REG', writes: ['src/index.ts'], depends_on: ['A', 'B', 'C'], kind: 'registration' },
    ],
    expect: [['A', 'B', 'C'], ['REG']],
  },
  {
    name: 'a migration never shares a wave',
    tasks: [
      { id: 'M', writes: ['db/migrations/003.sql'], depends_on: [], kind: 'migration' },
      { id: 'X', writes: ['src/x.ts'], depends_on: [] },
      { id: 'Y', writes: ['src/y.ts'], depends_on: [] },
    ],
    expect: [['M'], ['X', 'Y']],
  },
  {
    name: 'the maximum width caps a wave',
    tasks: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: `T${i}`, writes: [`src/${i}.ts`], depends_on: [] })),
    expect: [['T1', 'T2', 'T3', 'T4', 'T5'], ['T6', 'T7']],
  },
  {
    name: 'a pure chain gains nothing and says so',
    tasks: [
      { id: 'S1', writes: ['a.ts'], depends_on: [] },
      { id: 'S2', writes: ['b.ts'], depends_on: ['S1'] },
      { id: 'S3', writes: ['c.ts'], depends_on: ['S2'] },
    ],
    expect: [['S1'], ['S2'], ['S3']],
  },
];

for (const s of SCENARIOS) {
  test(s.name, () => {
    const r = schedule(s.tasks);
    assert.equal(r.ok, true, r.error);
    assert.deepEqual(r.waves, s.expect);
  });
}

test('a cycle is refused, not scheduled', () => {
  const r = schedule([
    { id: 'A', writes: ['a'], depends_on: ['B'] },
    { id: 'B', writes: ['b'], depends_on: ['A'] },
  ]);
  assert.equal(r.ok, false);
});

test('an unknown dependency is refused', () => {
  assert.equal(schedule([{ id: 'A', writes: ['a'], depends_on: ['Z'] }]).ok, false);
});
