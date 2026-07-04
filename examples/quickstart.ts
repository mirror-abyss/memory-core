/**
 * Mirror Abyss MA-1 — quickstart: memory that survives a restart.
 *
 * The whole point of MA-1 in 60 lines: an agent learns a fact in one session,
 * the session is compressed to an episodic card and written to disk, the process
 * "restarts" (all in-memory state is dropped), and in a fresh session the agent
 * recalls the fact from disk and assembles it back into its context.
 *
 * Run:  (cd ../memory-core && npm run build) && npm install && npm start
 */
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  HeuristicCardGenerator,
  KeywordCardIndex,
  FilesystemStorageBackend,
  DefaultRecallEngine,
  DefaultContextAssembler,
  TimeAnchorProvider,
  EpisodicProvider,
  type ContextProfile,
} from '@mirror-abyss/memory-core';

const AGENT = 'did:example:agent-1';
const PEER = 'did:example:peer-2';
const INDEX_KEY = 'memory/cards.jsonl';

/** A neutral five-layer-style profile; only the episodic config matters for this demo. */
const profile: ContextProfile = {
  name: 'agent-5-layer',
  identityLayer: { path: 'identity', label: 'Identity', required: true },
  experienceLayer: { path: 'experience', label: 'Experience', required: false, sections: [] },
  episodicConfig: { recentCardCount: 5, maxEpisodicTokens: 1000 },
};

export interface QuickstartResult {
  cardId: string;
  recalledCardIds: string[];
  systemPrompt: string;
  /** true when the fact learned in session 1 survived the restart into session 2's context. */
  rememberedAcrossRestart: boolean;
}

/**
 * Runs the full capture → persist → restart → recall → assemble loop.
 * Returns a structured result so it can be asserted in tests as well as printed.
 */
export async function runQuickstart(storageDir: string, log: (s: string) => void = () => {}): Promise<QuickstartResult> {
  const storage = new FilesystemStorageBackend(storageDir);

  // ── Session 1 — the agent learns something ────────────────────────────────
  log('① Session 1 — a conversation happens, and the agent learns a fact.');
  const conversation = [
    { role: 'user', content: 'For deployments, I always prefer Cloudflare Workers over a VM.', ts: Date.now(), fromDid: PEER },
    { role: 'assistant', content: 'Got it — Cloudflare Workers is your preferred deployment target. I will remember that.', ts: Date.now() + 1000, fromDid: AGENT },
  ];

  const generator = new HeuristicCardGenerator();
  const gen = await generator.generate({
    channel: 'web',
    purpose: 'conversation',
    context: { agentDid: AGENT, agentName: 'ReferenceAgent' },
    messages: conversation,
  });
  if (!gen.ok) throw new Error(`card generation failed: ${gen.error.message}`);
  const card = gen.value;
  log(`   → compressed into card ${card.id}`);
  log(`     topic: "${card.topic}"`);
  log(`     keywords: [${card.keywords.join(', ')}]`);

  // ── Persist to disk ───────────────────────────────────────────────────────
  const writeIndex = new KeywordCardIndex();
  writeIndex.append(card);
  await storage.write(INDEX_KEY, writeIndex.toJsonl());
  log(`② Persisted the card to disk at ${path.join(storageDir, INDEX_KEY)}`);

  // ── 💥 Restart — drop everything in memory ────────────────────────────────
  log('③ 💥 Process restart. All in-memory state is gone. Only the disk remains.');

  // ── Session 2 — a fresh process rebuilds from disk and recalls ────────────
  log('④ Session 2 — a new question arrives in a brand-new process.');
  const fromDisk = await storage.read(INDEX_KEY);
  if (fromDisk === null) throw new Error('no persisted memory found on disk');
  const restoredIndex = KeywordCardIndex.fromJsonl(fromDisk);
  log(`   → rebuilt the index from disk: ${restoredIndex.count()} card(s), nothing else carried over.`);

  const recall = new DefaultRecallEngine(restoredIndex);
  const recalled = await recall.recall({ keywords: ['deployment', 'cloudflare'], maxResults: 3 });
  log(`   → recalled ${recalled.cards.length} relevant card(s) for the new turn.`);

  // ── Assemble context for the next model call ──────────────────────────────
  const assembler = new DefaultContextAssembler({
    agentDid: AGENT,
    profile,
    contextWindowSize: 8000,
    providers: [new TimeAnchorProvider(), new EpisodicProvider(restoredIndex)],
  });
  const assembled = await assembler.assemble({
    purpose: 'conversation',
    operationalContext: 'New question: "Where should we deploy the new service?"',
    conversationHistory: [{ role: 'user', content: 'Where should we deploy the new service?', ts: Date.now() }],
  });

  log('⑤ Assembled context for the next model call. System prompt:');
  log('   ┌────────────────────────────────────────────');
  for (const line of assembled.systemPrompt.split('\n')) log(`   │ ${line}`);
  log('   └────────────────────────────────────────────');

  const remembered = /cloudflare/i.test(assembled.systemPrompt);
  return {
    cardId: card.id,
    recalledCardIds: recalled.cards.map((c) => c.id),
    systemPrompt: assembled.systemPrompt,
    rememberedAcrossRestart: remembered,
  };
}

async function main(): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ma1-quickstart-'));
  try {
    console.log('Mirror Abyss MA-1 — quickstart (Draft 0.2.0)\n');
    const result = await runQuickstart(dir, (s) => console.log(s));
    console.log('');
    if (result.rememberedAcrossRestart) {
      console.log('✅ The agent remembered its deployment preference across a full restart.');
      console.log('   The memory lived on disk, not in the process — that is MA-1 continuity.');
    } else {
      console.log('❌ The fact did not survive the restart (this should not happen).');
      process.exitCode = 1;
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  void main();
}
