# Extending MA-1

MA-1 is built as a set of small, frozen interfaces with pluggable implementations. The reference package (`@mirror-abyss/memory-core`) ships one correct implementation of each; the protocol is designed so that **most real-world differentiation happens by implementing these interfaces, not by forking the spec**. This doc lists the extension points, the contract each one carries, and a worked example.

If you are looking for what is in scope for the reference vs. what is yours to build, also read the *open/closed line* in [`../memory-core/README.md`](../memory-core/README.md).

---

## Extension points at a glance

| Interface | Spec | What you plug in | Reference ships |
|---|---|---|---|
| `ContextProvider` | §4.1 | Anything that injects text into the assembled context. | 4 standard providers. |
| `RecallStrategy` | §5.3 | How relevant cards are selected from the index. | `KeywordRecallStrategy`. |
| `StorageBackend` | §5.2 | Where cards / handoff blobs live. | `FilesystemStorageBackend`, `InMemoryStorageBackend`. |
| `CardGenerator` | §5.1 | How raw messages become a card. | `HeuristicCardGenerator` (no-LLM baseline). |
| `Purpose` / `ChannelHint` | §3.1 | New open-ended enum values. | Core set + `string & {}` extension. |

Two design principles recur across all of them (spec §9):

- **Providers over branches.** Prefer adding a `ContextProvider` over adding conditional branches inside the assembler. `shouldRender` + `priority` + `layer` are enough to express most packing logic.
- **Recall is pluggable.** The reference keyword strategy is a floor, not a ceiling; swap in a vector or hybrid `RecallStrategy` without touching the rest of the engine.

---

## 1. ContextProvider — the primary hook

This is the main way MA-1 stays open to extension. Anything you want injected into the model's context — user preferences, tool state, external knowledge, retrieved documents — is a `ContextProvider`, not a method on the assembler.

```typescript
type ContextLayer = 'L0' | 'L1' | 'L2' | 'L3';

interface ContextProvider {
  readonly providerId: string;
  readonly priority: number;        // 0 = highest
  readonly layer: ContextLayer;
  shouldRender(ctx: AssemblyContext): boolean;
  render(ctx: AssemblyContext): Promise<string | null>;
}
```

The assembler calls `shouldRender` to decide whether to call `render` for the current `AssemblyContext` (purpose, token pressure, etc.). Providers are supplied at construction and **immutable at runtime** — there is no order-of-call dependency between providers, only the `priority` + `layer` packing order.

### Worked example: a user-preferences provider

A provider that injects a small block of long-lived user preferences, only for `conversation` purpose, and only while token pressure is normal.

```typescript
import type { AssemblyContext, ContextProvider } from '@mirror-abyss/memory-core';

export class UserPreferencesProvider implements ContextProvider {
  readonly providerId = 'user-preferences';
  readonly priority = 15;
  readonly layer = 'L1' as const;

  constructor(private readonly prefs: () => Promise<string | null>) {}

  shouldRender(ctx: AssemblyContext): boolean {
    return ctx.purpose === 'conversation' && ctx.pressureLevel === 'normal';
  }

  async render(): Promise<string | null> {
    return this.prefs();
  }
}
```

Wire it in alongside the standard providers:

```typescript
import {
  DefaultContextAssembler,
  TimeAnchorProvider,
  EpisodicProvider,
  FilesystemStorageBackend,
  KeywordCardIndex,
} from '@mirror-abyss/memory-core';

const index = KeywordCardIndex.fromJsonl(/* ... */);
const assembler = new DefaultContextAssembler({
  agentDid: 'did:example:agent-1',
  providers: [
    new TimeAnchorProvider(),
    new UserPreferencesProvider(() => loadPreferences()),
    new EpisodicProvider(index, 5),
  ],
  contextWindowSize: 32_000,
});
```

### Layer convention

The reference providers follow a loose convention; you can map your own:

| Layer | Typical content | Reference example |
|---|---|---|
| `L0` | Always-on anchors (time, identity). | `TimeAnchorProvider` |
| `L1` | Stable, slow-changing context (handoff, prefs). | `SessionHandoffProvider` |
| `L2` | Retrieved episodic memory. | `EpisodicProvider` |
| `L3` | Optional, environment-specific. | `PhysicalEnvProvider` (no-op in reference) |

### `PhysicalEnvProvider` is intentionally a no-op

Per spec §7.1, the reference implementation MUST NOT inspect the host or spawn a shell, so `PhysicalEnvProvider` returns `null`. Hosts that need environment context (working dir, git branch, deploy target) supply **their own** provider. This is by design, not a gap.

---

## 2. RecallStrategy — pluggable retrieval

```typescript
export type RecallStrategyType = 'keyword' | 'vector' | 'hybrid';

export interface RecallStrategy {
  readonly type: RecallStrategyType;
  search(index: CardIndex, query: RecallQuery): EpisodicCard[];
}
```

`KeywordRecallStrategy` is the deterministic floor. To add semantic recall, implement `RecallStrategy` with `type: 'vector'` or `'hybrid'` and hand it to `DefaultRecallEngine`:

```typescript
import { DefaultRecallEngine, KeywordCardIndex } from '@mirror-abyss/memory-core';

class MyVectorRecallStrategy implements RecallStrategy /* ... */ {
  readonly type = 'vector' as const;
  search(index, query) { /* embed query, score cards, return ranked */ }
}

const engine = new DefaultRecallEngine(index, {
  strategy: new MyVectorRecallStrategy(),
  tokenBudget: 2000,
});
```

The engine handles token budgeting and formatting; your strategy only decides **which cards** match. The card shape is frozen (`schemaVersion` 0.1.0), so a vector strategy can store embeddings alongside cards without breaking interop.

---

## 3. StorageBackend — where cards live

```typescript
export interface StorageBackend {
  read(key: string): Promise<string | null>;
  write(key: string, content: string): Promise<void>;
  append(key: string, line: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}
```

Five methods, all async. The reference ships filesystem (JSONL) and in-memory backends. Implement this to back cards with S3, D1, Redis, or anything else — `KeywordCardIndex.toJsonl()` / `fromJsonl()` give you a portable serialization, or you can store cards individually under `list`-able keys.

---

## 4. CardGenerator — the open/closed line

```typescript
export interface CardGenerator {
  generate(input: CardGeneratorInput): Promise<ProtocolResult<EpisodicCard>>;
}
```

`HeuristicCardGenerator` produces **correctly-shaped, reasonable-quality** cards with no model call and ships **no generation prompt**. Production-grade card quality — personalization, self-model feedback, domain tuning — is yours to build by implementing `CardGenerator` with your own model + prompt. This is the open/closed boundary (spec §5.1): **the reference proves the shape works; production tuning is where you differentiate.**

Your generator only has to return an `EpisodicCard` matching the frozen schema; everything downstream (indexing, recall, assembly) interops unchanged.

---

## 5. New `Purpose` / `ChannelHint` values

Both are open-ended via `string & {}`:

```typescript
import type { ContextProvider } from '@mirror-abyss/memory-core';

// Your domain-specific purpose, brandless.
type CodeReview = 'code_review' & {};
```

A provider can gate on it via `shouldRender`. For interop with the core set, map your purpose onto a core value (`conversation` / `task` / `exploration` / `proactive_thinking` / `auto_execute`) when interacting with code that only knows the core set.

---

## Conventions for contributions

- Use `did:example:*` in any example. Never real DIDs from any deployment.
- Keep provider ids lowercase-kebab-case (`user-preferences`, not `UserPrefs`).
- A new `ContextProvider` belongs in your own package; the reference bundles only the four standard providers. If you think one belongs in the reference, open an issue first.
- Reference code MUST NOT spawn subprocesses or inspect the host (spec §7.1). A provider that does either belongs in your host package, not here.

See [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for the PR process and schema-freeze rules.
