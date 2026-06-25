import { describe, it, expect } from 'vitest';
import { InMemorySessionManager } from '../src/session/session-manager';

describe('InMemorySessionManager', () => {
  it('creates and reuses session handles', () => {
    const mgr = new InMemorySessionManager();
    const a = mgr.getOrCreate('s1');
    const b = mgr.getOrCreate('s1');
    expect(a).toBe(b);
    expect(mgr.has('s1')).toBe(true);
    expect(mgr.has('s2')).toBe(false);
  });

  it('records turns, history, digest, and topic keywords', () => {
    const mgr = new InMemorySessionManager();
    const s = mgr.getOrCreate('s1');
    s.addTurn('user', 'discuss the database migration schedule');
    s.addTurn('assistant', 'migration scheduled for the database next week');
    const meta = s.getMeta();
    expect(meta.turnCount).toBe(2);
    expect(meta.topicKeywords).toContain('database');
    expect(s.getHistory(1)).toHaveLength(1);
    expect(s.getDigest()).toContain('user:');
    expect(s.getDigest()).toContain('assistant:');
  });

  it('derives temperature from idle time against thresholds', () => {
    let now = 0;
    const mgr = new InMemorySessionManager(
      { hotToWarmMs: 100, warmToColdMs: 1000 },
      () => now,
    );
    mgr.getOrCreate('s1').addTurn('user', 'hi');
    expect(mgr.getTemperature('s1')).toBe('hot');
    now = 200;
    expect(mgr.getTemperature('s1')).toBe('warm');
    now = 2000;
    expect(mgr.getTemperature('s1')).toBe('cold');
    expect(mgr.getTemperature('missing')).toBe('cold');
  });

  it('evicts stale sessions and disposes all', () => {
    let now = 0;
    const mgr = new InMemorySessionManager({ coldEvictMs: 500 }, () => now);
    mgr.getOrCreate('s1').addTurn('user', 'hi');
    now = 1000;
    mgr.getOrCreate('s2').addTurn('user', 'later');
    mgr.evictStale();
    expect(mgr.has('s1')).toBe(false);
    expect(mgr.has('s2')).toBe(true);
    expect(mgr.listActive()).toHaveLength(1);
    mgr.dispose();
    expect(mgr.listActive()).toHaveLength(0);
  });
});
