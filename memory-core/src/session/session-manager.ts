import type {
  SessionHandle,
  SessionManager,
  SessionMeta,
  SessionTemperature,
  SessionThresholds,
} from '../types';
import { topKeywords } from '../util/text';

const DEFAULTS: Required<Pick<SessionThresholds, 'hotToWarmMs' | 'warmToColdMs' | 'coldEvictMs'>> = {
  hotToWarmMs: 30 * 60 * 1000, // 30 min
  warmToColdMs: 2 * 60 * 60 * 1000, // 2 h
  coldEvictMs: 24 * 60 * 60 * 1000, // 24 h
};

interface Turn {
  role: string;
  content: string;
  ts: number;
  fromDid?: string;
}

class InMemorySession implements SessionHandle {
  private readonly turns: Turn[] = [];
  private readonly meta: SessionMeta;

  constructor(
    sessionKey: string,
    private readonly now: () => number,
  ) {
    const t = this.now();
    this.meta = {
      sessionKey,
      createdAt: t,
      lastActivityAt: t,
      turnCount: 0,
      topicKeywords: [],
    };
  }

  addTurn(role: string, content: string, fromDid?: string): void {
    const turn: Turn = fromDid
      ? { role, content, ts: this.now(), fromDid }
      : { role, content, ts: this.now() };
    this.turns.push(turn);
    this.meta.lastActivityAt = turn.ts;
    this.meta.turnCount = this.turns.length;
    this.meta.topicKeywords = topKeywords(this.turns.map((x) => x.content).join('\n'), 6);
  }

  getHistory(maxTurns?: number): Array<{ role: string; content: string; ts: number }> {
    const slice = maxTurns === undefined ? this.turns : this.turns.slice(-Math.max(0, maxTurns));
    return slice.map((t) => ({ role: t.role, content: t.content, ts: t.ts }));
  }

  getDigest(maxTurns?: number): string {
    return this.getHistory(maxTurns)
      .map((t) => `${t.role}: ${t.content}`)
      .join('\n');
  }

  getMeta(): SessionMeta {
    return { ...this.meta, topicKeywords: [...this.meta.topicKeywords] };
  }
}

/**
 * §5.4 — an in-memory SessionManager. Temperature and eviction are derived from
 * timestamps against configured thresholds; no background timers are used (eviction
 * is explicit via `evictStale`), keeping the manager pure and testable.
 */
export class InMemorySessionManager implements SessionManager {
  private readonly sessions = new Map<string, InMemorySession>();
  private readonly thresholds: typeof DEFAULTS;
  private readonly now: () => number;

  constructor(thresholds: SessionThresholds = {}, clock: () => number = () => Date.now()) {
    this.thresholds = {
      hotToWarmMs: thresholds.hotToWarmMs ?? DEFAULTS.hotToWarmMs,
      warmToColdMs: thresholds.warmToColdMs ?? DEFAULTS.warmToColdMs,
      coldEvictMs: thresholds.coldEvictMs ?? DEFAULTS.coldEvictMs,
    };
    this.now = clock;
  }

  getOrCreate(sessionKey: string): SessionHandle {
    let session = this.sessions.get(sessionKey);
    if (!session) {
      session = new InMemorySession(sessionKey, this.now);
      this.sessions.set(sessionKey, session);
    }
    return session;
  }

  has(sessionKey: string): boolean {
    return this.sessions.has(sessionKey);
  }

  getTemperature(sessionKey: string): SessionTemperature {
    const session = this.sessions.get(sessionKey);
    if (!session) return 'cold';
    const idle = this.now() - session.getMeta().lastActivityAt;
    if (idle < this.thresholds.hotToWarmMs) return 'hot';
    if (idle < this.thresholds.warmToColdMs) return 'warm';
    return 'cold';
  }

  listActive(): SessionMeta[] {
    return [...this.sessions.values()].map((s) => s.getMeta());
  }

  evictStale(maxAgeMs: number = this.thresholds.coldEvictMs): void {
    const cutoff = this.now() - maxAgeMs;
    for (const [key, session] of this.sessions) {
      if (session.getMeta().lastActivityAt < cutoff) this.sessions.delete(key);
    }
  }

  dispose(): void {
    this.sessions.clear();
  }
}
