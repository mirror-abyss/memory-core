import { promises as fs } from 'node:fs';
import {
  DefaultContextAssembler,
  DefaultRecallEngine,
  EpisodicProvider,
  FilesystemStorageBackend,
  HeuristicCardGenerator,
  KeywordCardIndex,
  TimeAnchorProvider,
  type ContextProfile,
  type EpisodicCard,
} from '@mirror-abyss/memory-core';

/** Key under which cards are persisted as JSONL inside the data dir. */
export const CARDS_KEY = 'memory/cards.jsonl';

/** Neutral five-layer-style profile (spec §4.2). Only episodic config is load-bearing here. */
const DEFAULT_PROFILE: ContextProfile = {
  name: 'agent-5-layer',
  identityLayer: { path: 'identity', label: 'Identity', required: true },
  experienceLayer: { path: 'experience', label: 'Experience', required: false, sections: [] },
  episodicConfig: { recentCardCount: 5, maxEpisodicTokens: 1000 },
};

export interface Ma1State {
  dataDir: string;
  index: KeywordCardIndex;
  storage: FilesystemStorageBackend;
  generator: HeuristicCardGenerator;
  recall: DefaultRecallEngine;
  assembler: DefaultContextAssembler;
}

export interface LoadStateOptions {
  dataDir: string;
  agentDid: string;
  contextWindowSize?: number;
}

/**
 * Build MA-1 state hydrated from disk. The index is rebuilt from the persisted
 * JSONL on startup so the process is stateless across restarts (spec §5.2).
 */
export async function loadState(opts: LoadStateOptions): Promise<Ma1State> {
  await fs.mkdir(opts.dataDir, { recursive: true });

  const storage = new FilesystemStorageBackend(opts.dataDir);

  let index = new KeywordCardIndex();
  const persisted = await storage.read(CARDS_KEY);
  if (persisted && persisted.trim().length > 0) {
    index = KeywordCardIndex.fromJsonl(persisted);
  }

  const generator = new HeuristicCardGenerator();
  const recall = new DefaultRecallEngine(index);
  const assembler = new DefaultContextAssembler({
    agentDid: opts.agentDid,
    profile: DEFAULT_PROFILE,
    providers: [new TimeAnchorProvider(), new EpisodicProvider(index, 5)],
    contextWindowSize: opts.contextWindowSize ?? 32_000,
  });

  return { dataDir: opts.dataDir, index, storage, generator, recall, assembler };
}

/** Persist the full index back to disk (small-scale, append-only store). */
export async function persistIndex(state: Ma1State): Promise<void> {
  await state.storage.write(CARDS_KEY, state.index.toJsonl());
}

/** Compact card summary for tool responses. */
export function summarizeCard(card: EpisodicCard): string {
  const kw = card.keywords.slice(0, 8).join(', ');
  return `id: ${card.id}\ntopic: ${card.topic}\nkeywords: ${kw}`;
}
