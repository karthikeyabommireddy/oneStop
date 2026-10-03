#!/usr/bin/env bash
# A small TypeScript project with a real defect: the discount is computed but never applied.
set -euo pipefail
mkdir -p src
cat > package.json <<'EOF'
{ "name": "shop", "private": true, "scripts": { "test": "vitest run" }, "devDependencies": { "vitest": "2.1.9", "typescript": "5.6.3" } }
EOF
cat > src/cart.ts <<'EOF'
export interface Line { price: number; qty: number }

export function total(lines: Line[], discountPercent = 0): number {
  const gross = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const discount = (gross * discountPercent) / 100;
  return gross; // the discount is computed but never applied
}
EOF
cat > src/cart.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { total } from './cart';

describe('total', () => {
  it('adds line totals', () => {
    expect(total([{ price: 10, qty: 2 }, { price: 5, qty: 1 }])).toBe(25);
  });
});
EOF
git init -q
git add -A
git -c user.email=eval@onestop -c user.name=eval commit -qm "shop"
