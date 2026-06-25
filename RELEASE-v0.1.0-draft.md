# Release: v0.1.0-draft — MA-1 Memory Continuity (first public)

**Date:** 2026-06-24 (target — pending WP-5 repo migration)
**Tag:** `v0.1.0-draft`
**Audience:** Independent developers (demo-first funnel)

---

## What this release is

The **first public lighthouse** for the Mirror Abyss Protocol: a runnable proof that agent memory can survive process restarts, plus the Draft spec to build compatible implementations.

This is **not** Stable. It is deliberately labeled Draft because honest maturity labeling is our first credit with the community.

---

## Included

| Artifact | Version | Notes |
|---|---|---|
| `spec/MA-1.md` | protocol `0.2.0` / schema `0.1.0` | §3–§5 normative; §6 Draft placeholder |
| `@mirror-abyss/memory-core` | npm `0.1.0` | §3–§5 reference implementation |
| `examples/quickstart` | — | Cross-restart memory demo (`npm start`) |

---

## Highlights

- **Demo-first entry:** `examples/` quickstart — conversation → card → disk → restart → recall → assembled context
- **§4.3 errata resolved in spec 0.2.0:** async `assemble()` + `agentDid` from assembler config (no schema break)
- **Open/closed line documented:** reference card generator is shape-correct, not production-tuned; no prompt shipped
- **Clean-room reference:** no production identifiers or internal paths in public artifacts

---

## Not included (by design)

- §6 Continuity Layer reference implementation (anchor / verify / sync) — Draft spec only
- LLM-backed `CardGenerator` + prompt — separate, independently reviewed release
- MA-0 identity primitives — minimal Draft follow-on
- npm publish — initial release is **GitHub source + tag**; registry publish is a follow-up decision

---

## Cross-links

- **Research:** [PT-002 preprint on Zenodo](https://zenodo.org/records/20182206) — three-layer self architecture in production
- **Originating implementation:** Archi Hive (first implementer, not the only valid one)

---

## Upgrade / compatibility

- `schemaVersion` 0.1.0 card JSONL on disk is stable across this release
- `protocolVersion` 0.2.0 may receive Draft revisions before `1.0.0`; watch Appendix C in the spec

---

## Verification checklist (maintainers)

- [ ] `memory-core`: `npm run typecheck && npm test`
- [ ] `examples`: `npm start` prints cross-restart success line
- [ ] identifier hygiene: no production identifiers in public artifacts
- [ ] GitHub Release attached to tag `v0.1.0-draft` with this note
- [ ] README ↔ PT-002 bidirectional links live
