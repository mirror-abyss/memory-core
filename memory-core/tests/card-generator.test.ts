import { describe, it, expect } from 'vitest';
import { HeuristicCardGenerator } from '../src/memory/card-generator';
import type { CardGeneratorInput } from '../src/types';

const gen = new HeuristicCardGenerator();

function input(): CardGeneratorInput {
  return {
    channel: 'web',
    purpose: 'task',
    context: { agentDid: 'did:example:agent-1', agentName: 'ReferenceAgent' },
    messages: [
      { role: 'user', content: 'We need to migrate the database schema this week.', ts: 1000, fromDid: 'did:example:peer-2' },
      { role: 'assistant', content: "Let's decide on the migration order. We will start with the users table.", ts: 2000, fromDid: 'did:example:agent-1' },
      { role: 'user', content: 'Agreed. See https://example.com/migration-plan for details.', ts: 3000, fromDid: 'did:example:peer-2' },
    ],
  };
}

describe('HeuristicCardGenerator', () => {
  it('produces a correctly-shaped card', async () => {
    const r = await gen.generate(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const card = r.value;
    expect(card.startTs).toBe(1000);
    expect(card.endTs).toBe(3000);
    expect(card.sourceMessageCount).toBe(3);
    expect(card.participants).toContain('did:example:agent-1');
    expect(card.participants).toContain('did:example:peer-2');
    expect(card.channel).toBe('web');
    expect(card.purpose).toBe('task');
    expect(card.protocolVersion).toBe('0.2.0');
    expect(card.schemaVersion).toBe('0.1.0');
    expect(card.keywords.length).toBeGreaterThan(0);
    expect(card.archivePath).toBe(`cards/${card.id}.json`);
  });

  it('extracts decisions and artifacts heuristically', async () => {
    const r = await gen.generate(input());
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.decisions.length).toBeGreaterThan(0);
    expect(r.value.artifacts).toContain('https://example.com/migration-plan');
  });

  it('is deterministic for identical input', async () => {
    const a = await gen.generate(input());
    const b = await gen.generate(input());
    if (!a.ok || !b.ok) throw new Error('expected ok');
    expect(a.value.id).toBe(b.value.id);
  });

  it('fails closed on empty input', async () => {
    const r = await gen.generate({ ...input(), messages: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('invalid_input');
  });
});
