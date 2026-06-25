import { describe, it, expect } from 'vitest';
import { DefaultTokenBudgetManager } from '../src/context/token-budget';

describe('DefaultTokenBudgetManager', () => {
  const mgr = new DefaultTokenBudgetManager();

  it('estimates tokens by character heuristic', () => {
    expect(mgr.estimateTokens('')).toBe(0);
    expect(mgr.estimateTokens('abcd')).toBe(1);
    expect(mgr.estimateTokens('abcde')).toBe(2);
  });

  it('allocates total = window - output - reserved, split by weight', () => {
    const budget = mgr.allocate(
      {
        contextWindowSize: 1000,
        maxOutputTokens: 200,
        reservedTokens: 100,
        layerWeights: { system: 3, history: 1 },
      },
      {},
    );
    expect(budget.total).toBe(700);
    expect(budget.reserved).toBe(100);
    expect(budget.allocations.system).toBe(525); // floor(700 * 3/4)
    expect(budget.allocations.history).toBe(175); // floor(700 * 1/4)
  });

  it('never reports negative headroom after subtracting current usage', () => {
    const budget = mgr.allocate(
      { contextWindowSize: 400, maxOutputTokens: 0, layerWeights: { a: 1 } },
      { a: 1000 },
    );
    expect(budget.allocations.a).toBe(0);
  });

  it('computes pressure thresholds', () => {
    const budget = { allocations: {}, reserved: 0, total: 100 };
    expect(mgr.computePressure(budget, 10)).toBe('normal');
    expect(mgr.computePressure(budget, 75)).toBe('warning');
    expect(mgr.computePressure(budget, 90)).toBe('critical');
    expect(mgr.computePressure({ allocations: {}, reserved: 0, total: 0 }, 0)).toBe('critical');
  });

  it('truncates to fit with a marker', () => {
    const long = 'x'.repeat(100);
    const out = mgr.truncateToFit(long, 5); // ~20 chars
    expect(mgr.estimateTokens(out)).toBeLessThanOrEqual(5);
    expect(out.endsWith('…')).toBe(true);
    expect(mgr.truncateToFit('short', 100)).toBe('short');
    expect(mgr.truncateToFit('anything', 0)).toBe('');
  });
});
