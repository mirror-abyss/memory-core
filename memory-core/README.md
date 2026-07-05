# @mirror-abyss/memory-core

Reference implementation of the **Mirror Abyss Protocol — MA-1 (Memory Continuity Protocol)**, Beta `0.2.0`.

MA-1 gives an agent a memory that survives the vehicle it runs in: interactions are compressed into structured **episodic cards**, indexed, recalled on demand, and assembled into a layered context for the next model call. This package is the functional reference for spec **§3–§5**.

> **Status: Beta 0.2.0.** The §3 schema and §4–§5 interface shapes are **frozen** — safe to build on, and any breaking change will increment the major version (semver). What is **not** frozen is behavior (recall ranking, card generation quality, eviction policy), which remains tunable per implementation. Published to invite review and implementation feedback; not yet Stable (`1.0.0`).

**Building on MA-1?** The protocol is designed to be extended by implementing interfaces — `ContextProvider`, `RecallStrategy`, `StorageBackend`, `CardGenerator`. See [`docs/extending-ma1.md`](../docs/extending-ma1.md) for contracts and worked examples.

## What's in the box (§3–§5)

| Area | Export | Notes |
|---|---|---|
| §3 Schema | `types` | Frozen card / anchor / context / session shapes, transcribed from the spec. |
| §4 Context | `DefaultContextAssembler`, `DefaultTokenBudgetManager` | Layered assembly (L0–L3), pure-function token budgeting. |
| §4 Providers | `TimeAnchorProvider`, `EpisodicProvider`, `SessionHandoffProvider`, `PhysicalEnvProvider` | The four standard providers. |
| §5 Capture | `HeuristicCardGenerator` | Deterministic, no-LLM baseline (see *open/closed line* below). |
| §5 Storage | `FilesystemStorageBackend`, `InMemoryStorageBackend`, `KeywordCardIndex` | JSONL filesystem backend + keyword-inverted index. |
| §5 Recall | `DefaultRecallEngine`, `KeywordRecallStrategy` | Scored keyword recall with a token budget. |
| §5.4 Sessions | `InMemorySessionManager` | Hot/warm/cold temperature, explicit eviction. |

## Quick start

```ts
import {
  HeuristicCardGenerator,
  KeywordCardIndex,
  DefaultRecallEngine,
} from '@mirror-abyss/memory-core';

// 1. Compress an interaction into an episodic card.
const generator = new HeuristicCardGenerator();
const result = await generator.generate({
  channel: 'web',
  purpose: 'conversation',
  context: { agentDid: 'did:example:agent-1', agentName: 'ReferenceAgent' },
  messages: [
    { role: 'user', content: 'My preferred deployment target is Cloudflare Workers.', ts: Date.now() },
    { role: 'assistant', content: 'Noted — Cloudflare Workers it is.', ts: Date.now() },
  ],
});
if (!result.ok) throw new Error(result.error.message);

// 2. Index it (persist via index.toJsonl() to any StorageBackend).
const index = new KeywordCardIndex();
index.append(result.value);

// 3. After a restart, rebuild from JSONL and recall.
const restored = KeywordCardIndex.fromJsonl(index.toJsonl());
const recall = await new DefaultRecallEngine(restored).recall({
  keywords: ['cloudflare', 'deployment'],
});
console.log(recall.formatted);
```

## The open/closed line (read this)

The reference `HeuristicCardGenerator` produces **correctly-shaped, reasonable-quality** cards with no model call and ships **no generation prompt**. That is deliberate. *Production-grade* card quality — personalization, self-model feedback, domain tuning — comes from an implementer's own generation strategy and is **out of scope** for the reference implementation.

This is the honest open/closed boundary the protocol draws (spec §5.1): **the reference proves the shape works; production tuning is where implementers differentiate.** The interface is open so anything can interoperate; the quality is where you build your moat.

## Not implemented here

- **§6 Continuity Layer** (`MemoryAnchorService`, `MemorySyncService`, `verifyContinuity`). The spec marks §6 *Draft — reference implementation pending*; it depends on MA-0 for signature/identity primitives.
- **LLM-backed card generation + its prompt.** Ships separately and independently reviewed.
- **No shell / process inspection.** Per spec §7.1, this package uses only `node:fs`; `PhysicalEnvProvider` intentionally contributes nothing.

## Spec version & §4.3 errata (resolved in 0.2.0)

This package targets spec **`protocolVersion` 0.2.0** (`../spec/MA-1.md`). Building the reference implementation against the frozen interfaces surfaced two §4.3 inconsistencies; both were ruled and fixed in the 0.2.0 revision (no data-schema change):

1. **§4.3 `ContextAssembler.assemble` is async** — `assemble(input): Promise<AssembledContext>`. It must `await` the frozen async §4.1 `ContextProvider.render`; the async provider hook is load-bearing by design, so a synchronous assembler is not possible.
2. **`agentDid` is sourced from `ContextAssemblerConfig`** (construction-time) — it is a stable per-assembler identity, not a per-call input.

`schemaVersion` stays `0.1.0`: the 0.2.0 errata changed a §4 interface signature, not the serialized card/anchor data shape (spec §8.2 — the two version axes advance independently).

## License

Apache-2.0.
