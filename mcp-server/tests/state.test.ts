import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CARDS_KEY, loadState, persistIndex, summarizeCard } from '../src/state.js';

async function tmpDataDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ma1-mcp-test-'));
}

describe('MA-1 MCP state', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await tmpDataDir();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('loads with an empty store when no cards are persisted', async () => {
    const state = await loadState({ dataDir: dir, agentDid: 'did:example:agent-1' });
    expect(state.index.count()).toBe(0);
    expect(await state.storage.read(CARDS_KEY)).toBeNull();
  });

  it('round-trips a captured card through persist → reload → recall', async () => {
    const state = await loadState({ dataDir: dir, agentDid: 'did:example:agent-1' });

    const result = await state.generator.generate({
      channel: 'web',
      purpose: 'conversation',
      context: { agentDid: 'did:example:agent-1', agentName: 'TestAgent' },
      messages: [
        { role: 'user', content: 'My preferred deployment target is Cloudflare Workers.', ts: Date.now() },
        { role: 'assistant', content: 'Noted — Cloudflare Workers it is.', ts: Date.now() },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    state.index.append(result.value);
    await persistIndex(state);

    // Reload from disk in a fresh process simulation.
    const reloaded = await loadState({ dataDir: dir, agentDid: 'did:example:agent-1' });
    expect(reloaded.index.count()).toBe(1);

    const recall = await reloaded.recall.recall({
      keywords: ['cloudflare', 'deployment'],
      maxResults: 5,
    });
    expect(recall.cards.length).toBe(1);
    expect(recall.formatted.toLowerCase()).toContain('cloudflare');
  });

  it('assembles a system prompt containing the time anchor and episodic memory', async () => {
    const state = await loadState({ dataDir: dir, agentDid: 'did:example:agent-1' });

    const result = await state.generator.generate({
      channel: 'web',
      purpose: 'conversation',
      context: { agentDid: 'did:example:agent-1', agentName: 'TestAgent' },
      messages: [
        { role: 'user', content: 'Always answer in British English.', ts: Date.now() },
        { role: 'assistant', content: 'Understood.', ts: Date.now() },
      ],
    });
    if (!result.ok) throw new Error('generate failed');
    state.index.append(result.value);
    await persistIndex(state);

    const reloaded = await loadState({ dataDir: dir, agentDid: 'did:example:agent-1' });
    const assembled = await reloaded.assembler.assemble({
      purpose: 'conversation',
      operationalContext: 'Answering a follow-up question.',
      conversationHistory: [{ role: 'user', content: 'Cheers?', ts: Date.now() }],
    });
    expect(assembled.systemPrompt).toContain('Current time:');
    expect(assembled.systemPrompt.toLowerCase()).toContain('british english');
  });

  it('summarizeCard includes id, topic, and keywords', () => {
    const card = {
      id: 'card-test',
      topic: 'deploy preference',
      keywords: ['cloudflare', 'workers'],
      purpose: 'conversation',
      channel: 'web',
      startTs: Date.now(),
      endTs: Date.now(),
      participants: [],
      decisions: [],
      outcome: null,
      rawMessageIds: [],
      schemaVersion: '0.1.0' as const,
    };
    const summary = summarizeCard(card as never);
    expect(summary).toContain('card-test');
    expect(summary).toContain('deploy preference');
    expect(summary).toContain('cloudflare');
  });
});
