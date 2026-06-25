/**
 * @mirror-abyss/memory-core — reference implementation of MA-1 (Memory Continuity
 * Protocol), Draft 0.1.0. Implements spec §3–§5 (capture, index, recall, context
 * assembly). §6 (continuity layer) is not implemented here — see spec §6.
 */

// Frozen schema (types + protocol/schema version constants).
export * from './types';

// Result helpers.
export { ok, err, isOk } from './result';

// §4 Context assembly.
export { DefaultTokenBudgetManager } from './context/token-budget';
export {
  TimeAnchorProvider,
  EpisodicProvider,
  SessionHandoffProvider,
  PhysicalEnvProvider,
  formatCard,
} from './context/providers';
export { DefaultContextAssembler } from './context/assembler';

// §5 Memory operations.
export { FilesystemStorageBackend, InMemoryStorageBackend } from './memory/storage';
export { KeywordCardIndex } from './memory/card-index';
export { HeuristicCardGenerator } from './memory/card-generator';
export { KeywordRecallStrategy, DefaultRecallEngine } from './memory/recall';

// §5.4 Session management.
export { InMemorySessionManager } from './session/session-manager';

// Text utilities.
export { tokenize, topKeywords } from './util/text';
