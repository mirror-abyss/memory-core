import { describe, it, expect } from 'vitest';
import { KeywordCardIndex } from '../src/memory/card-index';
import { DefaultRecallEngine, KeywordRecallStrategy } from '../src/memory/recall';
import { HeuristicCardGenerator } from '../src/memory/card-generator';
import type { EpisodicCard } from '../src/types';

function card(over: Partial<EpisodicCard>): EpisodicCard {
  return {
    schemaVersion: '0.1.0',
    protocolVersion: '0.1.0',
    id: over.id ?? 'card-x',
    startTs: over.startTs ?? 1000,
    endTs: over.endTs ?? 2000,
    participants: over.participants ?? ['did:example:agent-1'],
    channel: over.channel ?? 'web',
    purpose: over.purpose ?? 'task',
    topic: over.topic ?? 'topic',
    decisions: over.decisions ?? [],
    artifacts: over.artifacts ?? [],
    outcome: over.outcome ?? '',
    emotionalTone: over.emotionalTone ?? 'neutral',
    keywords: over.keywords ?? [],
    sourceMessageCount: over.sourceMessageCount ?? 1,
    compressed: true,
    archivePath: over.archivePath ?? 'cards/card-x.json',
    ...over,
  };
}

describe('KeywordCardIndex', () => {
  it('appends, counts, gets by id', () => {
    const idx = new KeywordCardIndex();
    idx.append(card({ id: 'a', keywords: ['database', 'migration'] }));
    idx.append(card({ id: 'b', keywords: ['frontend', 'ui'] }));
    expect(idx.count()).toBe(2);
    expect(idx.getById('a')?.id).toBe('a');
    expect(idx.getById('missing')).toBeNull();
  });

  it('loadRecent sorts by endTs descending', () => {
    const idx = new KeywordCardIndex();
    idx.append(card({ id: 'old', endTs: 100 }));
    idx.append(card({ id: 'new', endTs: 900 }));
    expect(idx.loadRecent(1).map((c) => c.id)).toEqual(['new']);
  });

  it('scores keyword search and excludes non-matches', () => {
    const idx = new KeywordCardIndex();
    idx.append(card({ id: 'a', keywords: ['database', 'migration'], endTs: 1 }));
    idx.append(card({ id: 'b', keywords: ['database'], endTs: 2 }));
    idx.append(card({ id: 'c', keywords: ['unrelated'], endTs: 3 }));
    const hits = idx.search({ keywords: ['database', 'migration'] });
    expect(hits.map((c) => c.id)).toEqual(['a', 'b']); // a scores 2, b scores 1
  });

  it('filters by participant, channel, and time range', () => {
    const idx = new KeywordCardIndex();
    idx.append(card({ id: 'a', participants: ['did:example:x'], channel: 'discord', startTs: 10, endTs: 20 }));
    idx.append(card({ id: 'b', participants: ['did:example:y'], channel: 'web', startTs: 100, endTs: 200 }));
    expect(idx.search({ participant: 'did:example:x' }).map((c) => c.id)).toEqual(['a']);
    expect(idx.search({ channel: 'web' }).map((c) => c.id)).toEqual(['b']);
    expect(idx.search({ timeRange: { startTs: 0, endTs: 50 } }).map((c) => c.id)).toEqual(['a']);
  });
});

describe('DefaultRecallEngine', () => {
  it('recalls formatted cards and respects token budget', async () => {
    const idx = new KeywordCardIndex();
    idx.append(card({ id: 'a', keywords: ['database'], topic: 'db migration', endTs: 2 }));
    idx.append(card({ id: 'b', keywords: ['database'], topic: 'db indexing', endTs: 1 }));
    const engine = new DefaultRecallEngine(idx, new KeywordRecallStrategy());
    const all = await engine.recall({ keywords: ['database'] });
    expect(all.cards.length).toBe(2);
    expect(all.formatted).toContain('db migration');
    expect(all.totalTokens).toBeGreaterThan(0);

    const tiny = await engine.recall({ keywords: ['database'], maxTokens: 1 });
    expect(tiny.cards.length).toBeLessThan(2);
  });
});

describe('cross-restart continuity (the core promise)', () => {
  it('an agent remembers an episode after a simulated restart', async () => {
    // Session 1: generate a card and persist the index as JSONL.
    const gen = new HeuristicCardGenerator();
    const r = await gen.generate({
      channel: 'web',
      purpose: 'conversation',
      context: { agentDid: 'did:example:agent-1', agentName: 'ReferenceAgent' },
      messages: [
        { role: 'user', content: 'My favorite deployment target is Cloudflare Workers.', ts: 1000 },
        { role: 'assistant', content: 'Noted — Cloudflare Workers is your preferred deployment target.', ts: 2000 },
      ],
    });
    if (!r.ok) throw new Error('expected ok');
    const before = new KeywordCardIndex();
    before.append(r.value);
    const jsonl = before.toJsonl();

    // Session 2 (new process): rebuild the index from JSONL — nothing else carried over.
    const after = KeywordCardIndex.fromJsonl(jsonl);
    const engine = new DefaultRecallEngine(after);
    const recalled = await engine.recall({ keywords: ['cloudflare', 'deployment'] });

    expect(recalled.cards.length).toBe(1);
    expect(recalled.cards[0]?.id).toBe(r.value.id);
    expect(recalled.formatted.toLowerCase()).toContain('deployment');
  });
});
