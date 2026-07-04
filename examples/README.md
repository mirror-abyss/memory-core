# Mirror Abyss MA-1 — Examples

Runnable examples for [`@mirror-abyss/memory-core`](../memory-core), the reference implementation of the **Mirror Abyss Protocol — MA-1 (Memory Continuity)**, Draft `0.2.0`.

## `quickstart` — memory that survives a restart

The one thing MA-1 is about, in a single runnable script: an agent learns a fact, the session is compressed to an episodic card and written to disk, **the process restarts and all in-memory state is dropped**, and in a fresh session the agent recalls the fact from disk and assembles it back into its context.

### Run it

```bash
# 1. build memory-core's dist once (examples depends on the built package via file:../memory-core)
cd ../memory-core && npm install && npm run build && cd ../examples
# 2. install + run
npm install
npm start
```

### What you'll see

```
① Session 1 — a conversation happens, and the agent learns a fact.
   → compressed into card card-...-........
     topic: "For deployments, I always prefer Cloudflare Workers over a VM."
     keywords: [deployments, prefer, cloudflare, workers, ...]
② Persisted the card to disk at /tmp/ma1-quickstart-.../memory/cards.jsonl
③ 💥 Process restart. All in-memory state is gone. Only the disk remains.
④ Session 2 — a new question arrives in a brand-new process.
   → rebuilt the index from disk: 1 card(s), nothing else carried over.
   → recalled 1 relevant card(s) for the new turn.
⑤ Assembled context for the next model call. System prompt:
   ┌────────────────────────────────────────────
   │ Current time: 2026-...T...Z (Saturday)
   │
   │ [2026-...] For deployments, I always prefer Cloudflare Workers... (conversation/web)
   │   keywords: deployments, prefer, cloudflare, workers, ...
   └────────────────────────────────────────────

✅ The agent remembered its deployment preference across a full restart.
   The memory lived on disk, not in the process — that is MA-1 continuity.
```

### The loop, mapped to the spec

| Step | API | Spec |
|---|---|---|
| Compress a conversation into a card | `HeuristicCardGenerator.generate` | §5.1 |
| Persist / rebuild the index (JSONL on disk) | `FilesystemStorageBackend`, `KeywordCardIndex.toJsonl` / `fromJsonl` | §5.2 |
| Recall the relevant card | `DefaultRecallEngine.recall` | §5.3 |
| Assemble it back into context | `DefaultContextAssembler.assemble` + providers | §4 |

## Honest boundaries

- **This is a Draft** (`protocolVersion` 0.2.0, `schemaVersion` 0.1.0). Interfaces are frozen at 0.2.0, but this is not yet a stable 1.0.
- **The card generator here is the reference baseline.** `HeuristicCardGenerator` is deterministic and uses no model call — it produces correctly-*shaped*, reasonable-quality cards. Production-grade card quality (personalization, model tuning) is where implementers differentiate; it is intentionally out of scope for the reference (spec §5.1). The interface is open so anything interoperates; quality is your moat.
- **No shell, no surprises.** Per spec §7.1 the implementation uses only `node:fs`; the demo writes to a temporary directory and cleans up after itself.

## License

Apache-2.0.
