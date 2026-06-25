import { describe, it, expect } from 'vitest';
import {
  TimeAnchorProvider,
  EpisodicProvider,
  SessionHandoffProvider,
  PhysicalEnvProvider,
} from '../src/context/providers';
import { DefaultContextAssembler } from '../src/context/assembler';
import { KeywordCardIndex } from '../src/memory/card-index';
import { InMemoryStorageBackend } from '../src/memory/storage';
import type { AssemblyContext, ContextProfile, EpisodicCard } from '../src/types';

const ctx: AssemblyContext = {
  purpose: 'conversation',
  agentDid: 'did:example:agent-1',
  contextWindowSize: 8000,
  currentTokenUsage: 0,
  pressureLevel: 'normal',
};

function sampleCard(): EpisodicCard {
  return {
    schemaVersion: '0.1.0',
    protocolVersion: '0.1.0',
    id: 'card-1',
    startTs: 1000,
    endTs: 2000,
    participants: ['did:example:agent-1'],
    channel: 'web',
    purpose: 'task',
    topic: 'database migration plan',
    decisions: ['start with users table'],
    artifacts: [],
    outcome: 'plan agreed',
    emotionalTone: 'neutral',
    keywords: ['database', 'migration'],
    sourceMessageCount: 3,
    compressed: true,
    archivePath: 'cards/card-1.json',
  };
}

const profile: ContextProfile = {
  name: 'agent-5-layer',
  identityLayer: { path: 'identity', label: 'Identity', required: true },
  experienceLayer: { path: 'experience', label: 'Experience', required: false, sections: [] },
  episodicConfig: { recentCardCount: 5, maxEpisodicTokens: 1000 },
};

describe('standard providers', () => {
  it('TimeAnchorProvider renders deterministic injected time', async () => {
    const p = new TimeAnchorProvider(() => new Date('2026-06-13T04:00:00.000Z'));
    expect(p.shouldRender()).toBe(true);
    const out = await p.render();
    expect(out).toContain('2026-06-13T04:00:00.000Z');
    expect(out).toContain('Saturday');
  });

  it('EpisodicProvider renders recent cards, skips when empty', async () => {
    const empty = new EpisodicProvider(new KeywordCardIndex());
    expect(empty.shouldRender()).toBe(false);

    const idx = new KeywordCardIndex();
    idx.append(sampleCard());
    const p = new EpisodicProvider(idx);
    expect(p.shouldRender()).toBe(true);
    const out = await p.render(ctx);
    expect(out).toContain('database migration plan');
  });

  it('SessionHandoffProvider reads the configured key', async () => {
    const storage = new InMemoryStorageBackend();
    const p = new SessionHandoffProvider(storage, 'handoff/agent-1.md');
    expect(await p.render()).toBeNull();
    await storage.write('handoff/agent-1.md', 'Last session: discussed migration.');
    expect(await p.render()).toContain('migration');
  });

  it('PhysicalEnvProvider contributes nothing (no shell, §7.1)', async () => {
    const p = new PhysicalEnvProvider();
    expect(p.shouldRender()).toBe(false);
    expect(await p.render()).toBeNull();
  });
});

describe('DefaultContextAssembler', () => {
  it('assembles ordered provider output and metadata', async () => {
    const idx = new KeywordCardIndex();
    idx.append(sampleCard());
    const storage = new InMemoryStorageBackend();
    await storage.write('handoff/a.md', 'previous handoff note');

    const assembler = new DefaultContextAssembler({
      agentDid: 'did:example:agent-1',
      profile,
      contextWindowSize: 8000,
      providers: [
        new EpisodicProvider(idx), // L2
        new TimeAnchorProvider(() => new Date('2026-06-13T04:00:00.000Z')), // L0
        new SessionHandoffProvider(storage, 'handoff/a.md'), // L1
        new PhysicalEnvProvider(), // L3, renders null
      ],
    });

    const result = await assembler.assemble({
      purpose: 'conversation',
      operationalContext: 'Current task: review migration.',
      conversationHistory: [{ role: 'user', content: 'hello', ts: 1 }],
    });

    // L0 time anchor must precede the L2 episodic block.
    const timeIdx = result.systemPrompt.indexOf('2026-06-13');
    const epIdx = result.systemPrompt.indexOf('database migration plan');
    expect(timeIdx).toBeGreaterThanOrEqual(0);
    expect(epIdx).toBeGreaterThan(timeIdx);

    expect(result.metadata.renderedProviders).toEqual([
      'time-anchor',
      'session-handoff',
      'episodic',
    ]);
    expect(result.metadata.renderedProviders).not.toContain('physical-env');
    expect(result.metadata.totalTokens).toBeGreaterThan(0);
    expect(result.metadata.cacheableTokens).toBeGreaterThan(0);
    expect(result.conversationHistory).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('applies a sanitizer to operational content and history', async () => {
    const assembler = new DefaultContextAssembler({
      agentDid: 'did:example:agent-1',
      profile,
      contextWindowSize: 8000,
      providers: [],
      sanitizer: { sanitize: (s) => s.replace(/secret/gi, '[redacted]') },
    });
    const result = await assembler.assemble({
      purpose: 'task',
      operationalContext: 'this is secret',
      conversationHistory: [{ role: 'user', content: 'the secret is out', ts: 1 }],
    });
    expect(result.operationalContent).toBe('this is [redacted]');
    expect(result.conversationHistory[0]?.content).toBe('the [redacted] is out');
  });
});
