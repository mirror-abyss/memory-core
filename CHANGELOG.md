# Changelog

All notable changes to this repository are documented here. The project uses [Semantic Versioning](https://semver.org/) for packages and explicit Draft labels for protocol maturity.

## [v0.1.0-draft] — 2026-06-25

First public release of the Mirror Abyss Protocol lighthouse: runnable proof that agent memory survives process restarts, plus the Draft spec for compatible implementations.

**This is not Stable.** Draft labeling is deliberate — honest maturity is our first credit with the community.

### Included

| Artifact | Version | Notes |
|---|---|---|
| `spec/MA-1.md` | protocol `0.2.0` / schema `0.1.0` | §3–§5 normative; §6 Draft placeholder |
| `@mirror-abyss/memory-core` | npm `0.1.0` | §3–§5 reference implementation |
| `examples/quickstart` | — | Cross-restart memory demo (`npm start`) |

### Highlights

- **Demo-first entry:** `examples/` quickstart — conversation → card → disk → restart → recall → assembled context
- **§4.3 errata resolved in spec 0.2.0:** async `assemble()` + `agentDid` from assembler config (no schema break)
- **Open/closed line documented:** reference card generator is shape-correct, not production-tuned; no prompt shipped
- **Clean-room reference:** no production identifiers or internal paths in public artifacts

### Not included (by design)

- §6 Continuity Layer reference implementation (anchor / verify / sync) — Draft spec only
- LLM-backed `CardGenerator` + prompt — separate, independently reviewed release
- MA-0 identity primitives — minimal Draft follow-on
- npm publish — initial release is **GitHub source + tag**; registry publish is a follow-up decision

### Links

- **GitHub Release:** [v0.1.0-draft](https://github.com/mirror-abyss/memory-core/releases/tag/v0.1.0-draft)
- **Research:** [PT-002 preprint on Zenodo](https://zenodo.org/records/20182206)

### Compatibility

- `schemaVersion` 0.1.0 card JSONL on disk is stable across this release
- `protocolVersion` 0.2.0 may receive Draft revisions before `1.0.0`; watch Appendix C in the spec
