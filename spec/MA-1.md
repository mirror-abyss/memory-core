# Mirror Abyss Protocol — MA-1: Memory Continuity Protocol

**Status:** Draft (interface freeze)
**Version:** 0.2.0 (`protocolVersion`)
**Layer:** MA-1 (depends on MA-0 for signature/identity primitives)
**License:** Apache-2.0
**Originated by:** Archi Hive (initiator and first implementer)

---

## §0 Status of This Document

This document is a **Draft (0.2.0)**. It is published to invite review and implementation feedback. It is **not** a stable specification: interface shapes, enums, and semantics MAY change in response to feedback before `1.0.0`. At `0.2.0` the interfaces are frozen and the §3–§5 reference implementation is usable (see §8.1); a full changelog is in Appendix C.

We label this Draft honestly and deliberately. A protocol that calls itself Stable before it has earned it spends credibility it has not yet banked. Where the reference implementation for a capability does not yet exist, this document says so explicitly rather than implying completeness.

Feedback, issues, and proposals are welcome via the `mirror-abyss` project.

---

## §1 Introduction

### 1.1 The problem

An agent's usefulness compounds with memory. But agents lose memory at the seams: process restarts, host migrations, context-window overflow, and changes of execution vehicle all threaten the continuity of what an agent knows and who an agent is. Two instances of "the same" agent, or two cooperating agents, also need a way to confirm they share a history rather than merely asserting it.

MA-1 (Memory Continuity Protocol) defines the interfaces an agent system needs to:

- **Capture** episodic memory from interaction (`CardGenerator`, `EpisodicCard`).
- **Store and index** that memory behind a pluggable backend (`StorageBackend`, `CardIndex`).
- **Recall** relevant memory within a token budget (`RecallEngine`, `TokenBudgetManager`).
- **Assemble** context for a model call from layered providers (`ContextProvider`, `ContextAssembler`, `ContextProfile`).
- **Anchor and verify continuity** of memory across time and across agents (`MemoryAnchorService`, `MemorySyncService` — Draft; depend on MA-0 signatures).

### 1.2 What MA-1 is and is not

MA-1 defines **public interfaces** and a **functional reference implementation**. It does **not** prescribe production tuning. Two compliant implementations may differ enormously in quality of recall, card generation, and eviction strategy — those are where implementers compete. MA-1 standardizes the *shape*, not the *secret sauce*.

### 1.3 Relationship to MA-0

MA-1 depends on **MA-0 (Agent Identity Protocol)** only for signature and DID-resolution primitives, used by the continuity layer (§6). The capture / index / recall / assembly layers (§3–§5) do **not** require MA-0 and can be used standalone. Appendix A states the minimal MA-0 surface MA-1 consumes.

---

## §2 Conventions and Terminology

### 2.1 Requirement keywords

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119 / RFC 8174.

### 2.2 Versioning

All persisted data structures carry version fields:

```typescript
interface Versioned {
  schemaVersion: string;   // semver — data format version
  protocolVersion: string; // semver — protocol spec version, e.g. "0.1.0"
}
```

- `schemaVersion` increments on data-format change. A reader MUST check it and either downgrade-parse or reject with an explicit error.
- `protocolVersion` increments on spec change. Implementations exchange it during handshake.

### 2.3 Failure semantics

All fallible operations return a structured result rather than throwing:

```typescript
type ProtocolErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'already_exists'
  | 'unauthorized'
  | 'verification_failed'
  | 'version_mismatch'
  | 'storage_error'
  | 'provider_error'
  | 'internal_error';

interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
  detail?: Record<string, unknown>;
}

type ProtocolResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProtocolError };
```

Methods marked as fallible return `Promise<ProtocolResult<T>>`. Pure functions MAY return values directly.

### 2.4 Type conventions

- Enum values are lower-case (`'agent'`, not `'AGENT'`).
- Timestamps are Unix milliseconds (`number`).
- DIDs are `string`; format validation is MA-0's responsibility.

### 2.5 Purpose

`Purpose` classifies the intent of an interaction for memory and context decisions. The normative core set:

```typescript
type Purpose =
  | 'conversation'        // bidirectional or multi-party dialogue
  | 'task'                // work with a defined deliverable
  | 'exploration'         // self-directed inquiry with no preset deliverable
  | 'proactive_thinking'  // introspection / curiosity with no external trigger
  | 'auto_execute'        // autonomous execution with tool side effects
  | (string & {});        // implementation-specific extension
```

Implementations MAY define additional purposes via the open extension (`string & {}`). Implementation-specific purposes **MUST NOT** appear in normative examples or be required for interoperability; they MUST map onto a core value for any cross-implementation exchange.

### 2.6 ChannelHint

`ChannelHint` is an advisory marker of the transport an interaction arrived on:

```typescript
type ChannelHint =
  | 'discord'
  | 'telegram'
  | 'web'
  | 'a2a'           // agent-to-agent
  | (string & {});  // open for extension
```

`web` SHOULD be implemented by general-purpose hosts. Implementation-specific channels use the open extension and are not required for interoperability.

### 2.7 MemoryScope

```typescript
type MemoryScope =
  | 'agent'         // memory private to a single agent (DID)
  | 'organization'; // memory shared across multiple agents within one organization
```

`'agent'` and `'organization'` are mutually exclusive scopes. Recall and compaction operations MUST declare a scope; the default is `'agent'`.

---

## §3 Core Data Types

### 3.1 EpisodicCard

An `EpisodicCard` is a compressed, structured record of one episode of interaction.

```typescript
interface EpisodicCard extends Versioned {
  id: string;
  startTs: number;
  endTs: number;
  participants: string[];      // DIDs
  channel: ChannelHint;
  purpose: Purpose;
  topic: string;
  decisions: string[];
  artifacts: string[];
  outcome: string;
  emotionalTone: string;
  keywords: string[];
  relatedEpisodes?: string[];
  chatBriefing?: string;       // optional short handoff summary for resuming dialogue
  sourceMessageCount: number;
  compressed: boolean;
  archivePath: string;         // backend-relative key to the full source, if retained
}
```

### 3.2 ConsolidationClass

How a card SHOULD be treated by retention/eviction policy:

```typescript
type ConsolidationClass = 'persist' | 'update' | 'ephemeral' | 'protect';
```

- `persist` — retain under normal policy.
- `update` — supersedes/merges into an existing card.
- `ephemeral` — short-lived; eligible for early eviction.
- `protect` — MUST NOT be evicted by automatic policy.

### 3.3 MemoryAnchor and ContinuityProof

```typescript
interface MemoryAnchor {
  cardId: string;
  hash: string;        // SHA-256 of canonical card JSON
  anchoredAt: number;
  anchoredBy: string;  // DID
  signature: string;   // signed by the agent's key (MA-0)
}

interface ContinuityProof {
  agentDid: string;
  anchorChain: MemoryAnchor[];
  sharedEpisodes: string[];
  verifiedAt: number;
  result: 'continuous' | 'gap_detected' | 'diverged';
  gapRange?: { from: number; to: number };
}
```

The semantics of `result` are normative and defined in §6.2.

---

## §4 Context Assembly

### 4.1 ContextProvider (hook model)

All additional context injected into a model call is contributed by `ContextProvider`s. This keeps the assembler open to extension without growing a monolithic method.

```typescript
type ContextLayer = 'L0' | 'L1' | 'L2' | 'L3';
type PressureLevel = 'normal' | 'warning' | 'critical';

interface AssemblyContext {
  purpose: Purpose;
  agentDid: string;
  contextWindowSize: number;
  currentTokenUsage: number;
  pressureLevel: PressureLevel;
}

interface ContextProvider {
  readonly providerId: string;
  readonly priority: number;   // 0 = highest
  readonly layer: ContextLayer;
  shouldRender(ctx: AssemblyContext): boolean;
  render(ctx: AssemblyContext): Promise<string | null>;
}
```

A `ContextProvider` decides for itself whether to render under the current `Purpose` (`shouldRender`). The provider list is supplied at construction and is immutable at runtime, eliminating order-of-call dependencies.

Implementations MAY register any number of providers. The reference implementation bundles the following standard providers:

| Provider | Purpose | Reference behavior |
|---|---|---|
| `TimeAnchorProvider` | Inject absolute time (ISO 8601 + weekday + TZ) | `new Date().toISOString()` |
| `EpisodicProvider` | Inject recent cards | Pull most-recent N from `CardIndex` |
| `SessionHandoffProvider` | Inject prior-session handoff summary | Read configured handoff key |
| `PhysicalEnvProvider` | Inject environment state | Returns `null` (see §7.1) |

### 4.2 ContextProfile

A `ContextProfile` describes the layered memory layout of an agent. The five-layer pattern below is one well-trodden arrangement; implementations MAY map these layers onto their own file layout. Public examples use neutral names.

```typescript
interface LayerSpec {
  path: string;
  label: string;
  required: boolean;
  maxTokens?: number;
}

interface SectionSpec {
  heading: string;
  priority: number;
  collapsible: boolean;
}

interface ContextProfile {
  name: string;                  // e.g. "agent-5-layer", "commercial-agent-4+1"
  identityLayer: LayerSpec;      // identity definition (required)
  cognitiveLayer?: LayerSpec;    // reasoning/cognitive profile
  experienceLayer: LayerSpec & { sections: SectionSpec[] }; // long-term memory
  recordLayer?: LayerSpec;       // work ledger
  operationLayer?: LayerSpec;    // task stack
  episodicConfig: {
    recentCardCount: number;
    maxEpisodicTokens: number;
  };
}
```

A profile MAY mark `identityLayer.required = true`; see §7.3 for the immutability requirement on required identity layers.

### 4.3 ContextAssembler

```typescript
interface AssemblyInput {
  purpose: Purpose;
  operationalContext: string;
  conversationHistory: Array<{ role: string; content: string; ts: number; fromDid?: string }>;
  maxOutputTokens?: number;
}

interface AssembledContext {
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

interface ContextAssemblerConfig {
  agentDid: string;            // stable DID of the agent this assembler serves
  profile: ContextProfile;
  contextWindowSize: number;
  providers: ContextProvider[];
  sanitizer?: MessageSanitizer;
  tokenEstimator?: (text: string) => number;
}

interface ContextAssembler {
  assemble(input: AssemblyInput): Promise<AssembledContext>;
}
```

`assemble` is asynchronous: it MUST `await` the providers' `render` (§4.1), which is itself asynchronous because providers perform I/O. `agentDid` is supplied via `ContextAssemblerConfig` (construction-time) rather than `AssemblyInput`, because it is a stable per-assembler identity, not a per-call input; the assembler uses it to populate the `AssemblyContext` it passes to each provider. (Both points are 0.2.0 corrections — see Appendix C.)

### 4.4 TokenBudget

Token budgeting is a set of pure functions; the reference implementation uses fixed layer weights.

```typescript
interface TokenBudgetConfig {
  contextWindowSize: number;
  maxOutputTokens: number;
  layerWeights: Record<string, number>;
  reservedTokens?: number;
}

interface TokenBudget {
  allocations: Record<string, number>;
  reserved: number;
  total: number;
}

interface TokenBudgetManager {
  allocate(config: TokenBudgetConfig, currentUsage: Record<string, number>): TokenBudget;
  computePressure(budget: TokenBudget, usedTokens: number): PressureLevel;
  estimateTokens(text: string): number;
  truncateToFit(text: string, maxTokens: number): string;
}
```

---

## §5 Memory Operations

### 5.1 CardGenerator

Generates an `EpisodicCard` from raw interaction messages.

```typescript
interface CardGeneratorInput {
  messages: Array<{ role: string; content: string; ts: number; fromDid?: string }>;
  channel: ChannelHint;
  purpose: Purpose;
  context?: { agentDid: string; agentName: string; currentTask?: string };
}

interface CardGenerator {
  generate(input: CardGeneratorInput): Promise<ProtocolResult<EpisodicCard>>;
}
```

> **On generation quality.** The reference implementation ships a general-purpose generation prompt that produces correctly-shaped, reasonable-quality cards. *Production-grade* card quality — personalization, self-model feedback, domain tuning — comes from an implementer's own generation strategy and is explicitly out of scope for the reference implementation. This is the open/closed line drawn honestly: the reference shows the shape works; production tuning is where implementers differentiate.

### 5.2 StorageBackend and CardIndex

```typescript
interface StorageBackend {
  read(key: string): Promise<string | null>;
  write(key: string, content: string): Promise<void>;
  append(key: string, line: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}

interface CardSearchOptions {
  keywords?: string[];
  participant?: string;
  timeRange?: { startTs: number; endTs: number };
  channel?: ChannelHint;
  maxResults?: number;
}

interface CardIndex {
  append(card: EpisodicCard): void;
  loadAll(): EpisodicCard[];
  loadRecent(n?: number): EpisodicCard[];
  search(opts: CardSearchOptions): EpisodicCard[];
  getById(id: string): EpisodicCard | null;
  count(): number;
}
```

The reference implementation provides a JSONL/filesystem `StorageBackend` and a keyword-inverted-index `CardIndex` with scored ranking.

### 5.3 RecallEngine and RecallStrategy

```typescript
interface RecallQuery {
  keywords?: string[];
  participant?: string;
  timeRange?: { startTs: number; endTs: number };
  maxResults?: number;
  maxTokens?: number;
}

interface RecallResult {
  cards: EpisodicCard[];
  formatted: string;
  totalTokens: number;
}

type RecallStrategyType = 'keyword' | 'vector' | 'hybrid';

interface RecallStrategy {
  readonly type: RecallStrategyType;
  search(index: CardIndex, query: RecallQuery): EpisodicCard[];
}

interface RecallEngine {
  recall(query: RecallQuery): Promise<RecallResult>;
}
```

The reference implementation provides `KeywordRecallStrategy`. `vector` and `hybrid` strategies are optional, advanced capabilities.

### 5.4 SessionManager

```typescript
interface SessionThresholds {
  hotToWarmMs?: number;
  warmToColdMs?: number;
  coldEvictMs?: number;
  handoffCheckIntervalMs?: number;
  idleThresholdMs?: number;
}

type SessionTemperature = 'hot' | 'warm' | 'cold';

interface SessionMeta {
  sessionKey: string;
  createdAt: number;
  lastActivityAt: number;
  turnCount: number;
  topicKeywords: string[];
}

interface SessionHandle {
  addTurn(role: string, content: string, fromDid?: string): void;
  getHistory(maxTurns?: number): Array<{ role: string; content: string; ts: number }>;
  getDigest(maxTurns?: number): string;
  getMeta(): SessionMeta;
}

interface SessionManager {
  getOrCreate(sessionKey: string): SessionHandle;
  has(sessionKey: string): boolean;
  getTemperature(sessionKey: string): SessionTemperature;
  listActive(): SessionMeta[];
  evictStale(maxAgeMs?: number): void;
  dispose(): void;
}
```

---

## §6 Continuity Layer (Draft — reference implementation pending)

> **Status of this section.** The interface shapes and semantic contracts below are **normative in Draft 0.1.0**. A reference implementation is **pending** and depends on MA-0 for signature verification. Implementers SHOULD treat §6 as a stable target to build against, not as shipped code.

### 6.1 MemoryAnchorService

```typescript
interface MemoryAnchorService {
  anchor(
    cardId: string,
    agentDid: string,
    signFn: (payload: string) => Promise<string>,
  ): Promise<ProtocolResult<MemoryAnchor>>;

  // Symmetric: order of agentA / agentB MUST NOT affect result semantics.
  verifyContinuity(agentA: string, agentB: string): Promise<ContinuityProof>;

  getAnchorChain(agentDid: string, since?: number): Promise<MemoryAnchor[]>;
}
```

### 6.2 verifyContinuity — result semantics (normative)

| Result | Condition |
|---|---|
| `continuous` | Within the intersecting time window of both anchor chains, every shared `cardId` has an identical `hash`, and there is no unanchored episodic gap. |
| `gap_detected` | Both parties acknowledge the same lineage (`sharedEpisodes` is non-empty, or chain-head hashes match), but a time-ordered unanchored interval exists. The proof MUST populate `gapRange: { from, to }` (Unix ms). |
| `diverged` | The same `cardId` carries a different `hash`, OR an anchor signature fails verification, OR no common ancestor can be established between chain heads. An implementation MUST NOT silently downgrade `diverged` to `gap_detected`. |

`gapRange` computation: within the intersecting time window of both `getAnchorChain` results, take the earliest missing-anchor timestamp through the latest missing-anchor timestamp. If only one side lacks the chain, that side is the gap-bearing party.

Symmetry: `verifyContinuity(A, B).result === verifyContinuity(B, A).result`; `sharedEpisodes` is the intersection of both parties' episodic ids.

> The `diverged` rule encodes a discipline this protocol takes seriously: when the same fact appears with two different hashes, that is a divergence to surface and resolve — never to quietly paper over. Memory must track reality.

### 6.3 MemorySyncService (G1)

Computes and applies the difference between two agents' anchored memory states.

```typescript
interface MemorySyncDelta {
  cardsToPush: EpisodicCard[];   // present in source, absent in target
  cardsToPull: EpisodicCard[];   // present in target, absent in source
  anchorUpdates: MemoryAnchor[]; // new anchors produced this round
  conflicts?: SyncConflict[];
}

interface SyncConflict {
  cardId: string;
  sourceHash: string;
  targetHash: string;
  resolution: 'prefer_source' | 'prefer_target' | 'manual';
}

interface MemorySyncService {
  computeDelta(input: {
    sourceDid: string;
    targetDid: string;
    sourceAnchor?: MemoryAnchor;
    targetAnchor?: MemoryAnchor;
    since?: number;
  }): Promise<ProtocolResult<MemorySyncDelta>>;

  applyDelta(input: {
    targetDid: string;
    delta: MemorySyncDelta;
    signFn: (payload: string) => Promise<string>;
  }): Promise<ProtocolResult<MemoryAnchor[]>>;
}
```

Normative semantics:

- Sync is **symmetric**: the delta of A→B is the inverse of B→A, modulo conflict policy.
- The comparison key is `cardId` + content `hash` (SHA-256 of canonical card JSON).
- Conflict resolution defaults to `prefer_source` and is configurable; when `resolution` is `manual`, `applyDelta` MUST fail-closed until resolved.
- A full bidirectional sync is `computeDelta(A, B)` + `applyDelta(B, …)` plus one reverse round; a single one-way round is valid on its own.

*Reference implementation pending; depends on MA-0 for signature verification.*

---

## §7 Security Requirements (normative)

### 7.1 No shell in the reference implementation

A reference implementation MUST NOT invoke `child_process`, `exec`, `spawn`, or any shell command. Providers that would require process inspection (e.g. an environment provider) MUST return `null` in the reference implementation; hosts MAY supply their own provider for such needs.

### 7.2 Privileged identity requires cryptographic verification

Any DID claiming special authority (e.g. governance or deployment control) MUST be verified cryptographically via MA-0 (`ChallengeAuth`). Implementations MUST NOT grant privilege by DID string matching alone.

### 7.3 Immutable identity layer

For any layer marked `required: true` in a `ContextProfile.identityLayer`, the `StorageBackend.write()` operation targeting that layer's path MUST reject with `ProtocolError('unauthorized')`. Identity layers are not runtime-writable.

---

## §8 Versioning and Extensibility

### 8.1 Version ladder

| Stage | `protocolVersion` | Meaning |
|---|---|---|
| Initial draft | `0.1.0` | First published draft; interfaces invited feedback. |
| Interface freeze (current) | `0.2.0` | Interfaces frozen; §3–§5 reference implementation usable. |
| Stable | `1.0.0` | Interfaces stable; `schemaVersion` guarantees backward compatibility. |

`schemaVersion` remains `0.1.0` at `protocolVersion` `0.2.0`: the 0.2.0 changes were interface signatures (§4.3), not the serialized data shape. The two versions advance on independent axes (§8.2).

### 8.2 Backward compatibility

- While `schemaVersion` major is unchanged, newer readers can read older data.
- A minor `protocolVersion` bump adds interfaces without breaking existing ones.
- A major `protocolVersion` bump MAY break compatibility but MUST ship a migration guide.

### 8.3 Extension points

| Extension | Mechanism |
|---|---|
| New `ContextProvider` | Implement the interface; add to the `providers` list. |
| New `RecallStrategy` | Implement the `RecallStrategy` interface. |
| New `Purpose` | Use the `string & {}` open extension; map onto a core value for interop. |
| New `ChannelHint` | Use the `string & {}` open extension. |

---

## §9 Implementation Notes (non-normative)

These notes are guidance for implementers and carry no normative weight.

- **Start standalone.** §3–§5 (capture / index / recall / assembly) work without MA-0. Add §6 (anchoring / continuity) only when you need cross-instance or cross-agent proofs.
- **Token budget first.** Decide your context window and layer weights before wiring providers; pressure-aware truncation is easier when budgeting is explicit from the start.
- **Providers over branches.** Prefer adding a `ContextProvider` over adding conditional branches inside the assembler. `shouldRender` + `priority` + `layer` are enough to express most packing logic.
- **Anchor canonically.** Hash a canonical (stably-serialized) form of the card so that two implementations agree on the same hash for the same content.
- **Recall is pluggable.** The reference keyword strategy is a floor, not a ceiling; swap in a vector or hybrid `RecallStrategy` without touching the rest.

---

## §10 Reference Implementation and Examples

- **`@mirror-abyss/memory-core`** — the functional reference implementation of §3–§5: capture (`HeuristicCardGenerator`), storage/index (`FilesystemStorageBackend`, `KeywordCardIndex`), recall (`DefaultRecallEngine`, `KeywordRecallStrategy`), context assembly (`DefaultContextAssembler`, four standard providers, `DefaultTokenBudgetManager`), and sessions (`InMemorySessionManager`). §6 (continuity) lands when its reference implementation does. *Landed in WP-2.*
- **`examples/`** — a minimal runnable demo: from a short dialogue, generate a card, recall it after a simulated restart, and assemble context. *Coming with WP-3.*

---

## Appendix A — Minimal MA-0 dependency surface

The continuity layer (§6) consumes only the following from MA-0:

- A `signFn(payload: string) => Promise<string>` bound to the agent's signing key.
- Signature verification sufficient to validate a `MemoryAnchor.signature` against the anchoring agent's DID.

§3–§5 consume nothing from MA-0.

## Appendix B — Theoretical background

The layered-memory and three-layer-self framing that informs this protocol is described in the preprint *From Wounds to Architecture: Independent Convergence of the Three-Layer Self in a Production-Grade Agent Operating System* (Zenodo, DOI `10.5281/zenodo.20182206`). MA-1 is the engineering counterpart: the paper provides the "why," this specification provides the "how."

## Appendix C — Changelog

### 0.2.0 — Interface freeze (2026-06-13)

Interfaces frozen; the §3–§5 reference implementation (`@mirror-abyss/memory-core`) landed and is usable. Two §4.3 interface corrections, both surfaced while building the reference implementation against the frozen interfaces. **No data-schema change** — `schemaVersion` stays `0.1.0` (§8.2).

- **§4.3 `ContextAssembler.assemble` is now asynchronous**: `assemble(input): Promise<AssembledContext>`. A synchronous assembler could not `await` the (intentionally) asynchronous §4.1 `ContextProvider.render`, which performs I/O. The async provider hook is load-bearing, so the assembler must be async.
- **§4.3 `ContextAssemblerConfig` gains `agentDid: string`**: `AssemblyContext` (§4.1) requires `agentDid` but `0.1.0` provided no source for it. It is bound at construction (stable per-assembler identity), not per call.

Neither change touches a frozen data shape (`EpisodicCard`, `MemoryAnchor`, `ContinuityProof`, `MemoryScope`, `AssemblyContext`, `RecallQuery`/`RecallResult` are unchanged).

### 0.1.0 — Initial draft (2026-06-10)

First published draft. Defined §2–§5 interfaces and the §6 continuity layer (interface shapes normative; reference implementation pending, MA-0-dependent).

---

*MA-1 is a Draft (0.2.0). It is published to be built against and argued with. Originated by Archi Hive; offered to the agent ecosystem under Apache-2.0.*
