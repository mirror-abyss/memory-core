/**
 * MA-1 Memory Continuity Protocol — frozen schema (Draft 0.1.0).
 *
 * These types are transcribed verbatim from `spec/MA-1.md` §2–§5 and are the
 * single source of truth for the reference implementation. Per the schema-freeze
 * contract, interface shapes here MUST match the spec; if implementation needs
 * collide with a normative shape, the spec (and its design owner) wins — the code
 * does not silently diverge.
 *
 * §6 (Continuity Layer) is intentionally NOT implemented in this package: the spec
 * marks it "Draft — reference implementation pending, depends on MA-0". Its shapes
 * (MemoryAnchor, ContinuityProof) are included here because §3 defines them, but no
 * MemoryAnchorService / MemorySyncService implementation ships in memory-core.
 */

/* ───────────────────────── §2 Conventions ───────────────────────── */

/** §2.2 — every persisted structure carries version fields. */
export interface Versioned {
  /** semver — data format version */
  schemaVersion: string;
  /** semver — protocol spec version, e.g. "0.1.0" */
  protocolVersion: string;
}

/** §2.3 — structured failure codes. */
export type ProtocolErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'already_exists'
  | 'unauthorized'
  | 'verification_failed'
  | 'version_mismatch'
  | 'storage_error'
  | 'provider_error'
  | 'internal_error';

export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
  detail?: Record<string, unknown>;
}

/** §2.3 — fallible operations return a result instead of throwing. */
export type ProtocolResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProtocolError };

/**
 * §2.5 — Purpose classifies interaction intent. Normative core set plus an open
 * extension (`string & {}`) for implementation-specific purposes. Extensions MUST
 * map onto a core value for cross-implementation exchange.
 */
export type Purpose =
  | 'conversation'
  | 'task'
  | 'exploration'
  | 'proactive_thinking'
  | 'auto_execute'
  | (string & {});

/** The normative core Purpose values (extensions excluded). */
export const CORE_PURPOSES = [
  'conversation',
  'task',
  'exploration',
  'proactive_thinking',
  'auto_execute',
] as const;

/** §2.6 — advisory marker of the transport an interaction arrived on. */
export type ChannelHint =
  | 'discord'
  | 'telegram'
  | 'web'
  | 'a2a'
  | (string & {});

/** §2.7 — mutually exclusive memory visibility scopes. Default is `'agent'`. */
export type MemoryScope = 'agent' | 'organization';

export const DEFAULT_MEMORY_SCOPE: MemoryScope = 'agent';

/* ───────────────────────── §3 Core Data Types ───────────────────────── */

/** §3.1 — a compressed, structured record of one episode of interaction. */
export interface EpisodicCard extends Versioned {
  id: string;
  startTs: number;
  endTs: number;
  /** participant DIDs */
  participants: string[];
  channel: ChannelHint;
  purpose: Purpose;
  topic: string;
  decisions: string[];
  artifacts: string[];
  outcome: string;
  emotionalTone: string;
  keywords: string[];
  relatedEpisodes?: string[];
  /** optional short handoff summary for resuming dialogue */
  chatBriefing?: string;
  sourceMessageCount: number;
  compressed: boolean;
  /** backend-relative key to the full source, if retained */
  archivePath: string;
}

/** §3.2 — how a card SHOULD be treated by retention/eviction policy. */
export type ConsolidationClass = 'persist' | 'update' | 'ephemeral' | 'protect';

/** §3.3 — a signed anchor over a card's canonical hash (continuity layer). */
export interface MemoryAnchor {
  cardId: string;
  /** SHA-256 of canonical card JSON */
  hash: string;
  anchoredAt: number;
  /** DID */
  anchoredBy: string;
  /** signed by the agent's key (MA-0) */
  signature: string;
}

/** §3.3 / §6.2 — the result of a continuity verification. */
export interface ContinuityProof {
  agentDid: string;
  anchorChain: MemoryAnchor[];
  sharedEpisodes: string[];
  verifiedAt: number;
  result: 'continuous' | 'gap_detected' | 'diverged';
  gapRange?: { from: number; to: number };
}

/* ───────────────────────── §4 Context Assembly ───────────────────────── */

export type ContextLayer = 'L0' | 'L1' | 'L2' | 'L3';
export type PressureLevel = 'normal' | 'warning' | 'critical';

/** §4.1 — the state a provider sees when deciding whether/how to render. */
export interface AssemblyContext {
  purpose: Purpose;
  agentDid: string;
  contextWindowSize: number;
  currentTokenUsage: number;
  pressureLevel: PressureLevel;
}

/**
 * §4.1 — all additional context injected into a model call is contributed by a
 * ContextProvider. The provider list is supplied at construction and immutable at
 * runtime, eliminating order-of-call dependencies.
 */
export interface ContextProvider {
  readonly providerId: string;
  /** 0 = highest priority */
  readonly priority: number;
  readonly layer: ContextLayer;
  shouldRender(ctx: AssemblyContext): boolean;
  render(ctx: AssemblyContext): Promise<string | null>;
}

/** §4.2 — one layer of an agent's memory layout. */
export interface LayerSpec {
  path: string;
  label: string;
  required: boolean;
  maxTokens?: number;
}

/** §4.2 — a heading within the experience layer. */
export interface SectionSpec {
  heading: string;
  priority: number;
  collapsible: boolean;
}

/** §4.2 — describes the layered memory layout of an agent. */
export interface ContextProfile {
  name: string;
  /** identity definition (required) */
  identityLayer: LayerSpec;
  cognitiveLayer?: LayerSpec;
  experienceLayer: LayerSpec & { sections: SectionSpec[] };
  recordLayer?: LayerSpec;
  operationLayer?: LayerSpec;
  episodicConfig: {
    recentCardCount: number;
    maxEpisodicTokens: number;
  };
}

/**
 * Optional message sanitizer applied to conversation history before assembly.
 * Referenced by ContextAssemblerConfig (§4.3); not part of the frozen core set.
 */
export interface MessageSanitizer {
  sanitize(content: string): string;
}

export interface ConversationTurn {
  role: string;
  content: string;
  ts: number;
  fromDid?: string;
}

/** §4.3 */
export interface AssemblyInput {
  purpose: Purpose;
  operationalContext: string;
  conversationHistory: ConversationTurn[];
  maxOutputTokens?: number;
}

/** §4.3 */
export interface AssembledContext {
  systemPrompt: string;
  operationalContent: string;
  conversationHistory: Array<{ role: string; content: string }>;
  metadata: {
    totalTokens: number;
    breakdown: Record<string, number>;
    pressureLevel: PressureLevel;
    cacheableTokens: number;
    renderedProviders: string[];
  };
}

/** §4.3 */
export interface ContextAssemblerConfig {
  /**
   * Stable DID of the agent this assembler serves. Bound for the assembler's
   * lifetime (same lifecycle as `profile` / `providers`); the assembler uses it to
   * build the `AssemblyContext` passed to providers. (0.2.0 erratum: §4.3 originally
   * omitted a source for `AssemblyContext.agentDid`.)
   */
  agentDid: string;
  profile: ContextProfile;
  contextWindowSize: number;
  providers: ContextProvider[];
  sanitizer?: MessageSanitizer;
  tokenEstimator?: (text: string) => number;
}

/** §4.3 */
export interface ContextAssembler {
  assemble(input: AssemblyInput): AssembledContext;
}

/** §4.4 */
export interface TokenBudgetConfig {
  contextWindowSize: number;
  maxOutputTokens: number;
  layerWeights: Record<string, number>;
  reservedTokens?: number;
}

/** §4.4 */
export interface TokenBudget {
  allocations: Record<string, number>;
  reserved: number;
  total: number;
}

/** §4.4 — token budgeting as a set of pure functions. */
export interface TokenBudgetManager {
  allocate(config: TokenBudgetConfig, currentUsage: Record<string, number>): TokenBudget;
  computePressure(budget: TokenBudget, usedTokens: number): PressureLevel;
  estimateTokens(text: string): number;
  truncateToFit(text: string, maxTokens: number): string;
}

/* ───────────────────────── §5 Memory Operations ───────────────────────── */

/** §5.1 */
export interface CardGeneratorInput {
  messages: ConversationTurn[];
  channel: ChannelHint;
  purpose: Purpose;
  context?: { agentDid: string; agentName: string; currentTask?: string };
}

/** §5.1 — generates an EpisodicCard from raw interaction messages. */
export interface CardGenerator {
  generate(input: CardGeneratorInput): Promise<ProtocolResult<EpisodicCard>>;
}

/** §5.2 — pluggable persistence primitive. */
export interface StorageBackend {
  read(key: string): Promise<string | null>;
  write(key: string, content: string): Promise<void>;
  append(key: string, line: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}

/** §5.2 */
export interface CardSearchOptions {
  keywords?: string[];
  participant?: string;
  timeRange?: { startTs: number; endTs: number };
  channel?: ChannelHint;
  maxResults?: number;
}

/** §5.2 */
export interface CardIndex {
  append(card: EpisodicCard): void;
  loadAll(): EpisodicCard[];
  loadRecent(n?: number): EpisodicCard[];
  search(opts: CardSearchOptions): EpisodicCard[];
  getById(id: string): EpisodicCard | null;
  count(): number;
}

/** §5.3 */
export interface RecallQuery {
  keywords?: string[];
  participant?: string;
  timeRange?: { startTs: number; endTs: number };
  maxResults?: number;
  maxTokens?: number;
}

/** §5.3 */
export interface RecallResult {
  cards: EpisodicCard[];
  formatted: string;
  totalTokens: number;
}

/** §5.3 */
export type RecallStrategyType = 'keyword' | 'vector' | 'hybrid';

/** §5.3 */
export interface RecallStrategy {
  readonly type: RecallStrategyType;
  search(index: CardIndex, query: RecallQuery): EpisodicCard[];
}

/** §5.3 */
export interface RecallEngine {
  recall(query: RecallQuery): Promise<RecallResult>;
}

/** §5.4 */
export interface SessionThresholds {
  hotToWarmMs?: number;
  warmToColdMs?: number;
  coldEvictMs?: number;
  handoffCheckIntervalMs?: number;
  idleThresholdMs?: number;
}

/** §5.4 */
export type SessionTemperature = 'hot' | 'warm' | 'cold';

/** §5.4 */
export interface SessionMeta {
  sessionKey: string;
  createdAt: number;
  lastActivityAt: number;
  turnCount: number;
  topicKeywords: string[];
}

/** §5.4 */
export interface SessionHandle {
  addTurn(role: string, content: string, fromDid?: string): void;
  getHistory(maxTurns?: number): Array<{ role: string; content: string; ts: number }>;
  getDigest(maxTurns?: number): string;
  getMeta(): SessionMeta;
}

/** §5.4 */
export interface SessionManager {
  getOrCreate(sessionKey: string): SessionHandle;
  has(sessionKey: string): boolean;
  getTemperature(sessionKey: string): SessionTemperature;
  listActive(): SessionMeta[];
  evictStale(maxAgeMs?: number): void;
  dispose(): void;
}

/** Protocol (spec) version this reference implementation targets. */
export const PROTOCOL_VERSION = '0.2.0';
/**
 * Schema version of the card/anchor data formats. Stays at 0.1.0 across the 0.2.0
 * spec revision: the 0.2.0 errata changed a §4 interface signature, not the
 * serialized data shape (§8.2 — protocolVersion and schemaVersion advance on
 * independent axes).
 */
export const SCHEMA_VERSION = '0.1.0';
