# Mirror Abyss Protocol

[![ci](https://github.com/mirror-abyss/memory-core/actions/workflows/ci.yml/badge.svg)](https://github.com/mirror-abyss/memory-core/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/mirror-abyss/memory-core)](LICENSE)
[![Release](https://img.shields.io/github/v/release/mirror-abyss/memory-core?include_prereleases&label=release)](https://github.com/mirror-abyss/memory-core/releases/tag/v0.1.0-draft)
[![Status](https://img.shields.io/badge/status-Draft-orange)](CHANGELOG.md)

**Open specifications and reference implementations for long-lived AI agents.**

The Mirror Abyss Protocol (镜渊协议) defines how agents capture episodic memory, assemble layered context, and maintain continuity across process restarts and vehicle changes. This repository is the public home for those specs and runnable reference code.

> **Status: Draft.** Everything here is published for review and implementation feedback—not as frozen production APIs. We label Draft honestly because credibility is the first thing a protocol spends.

---

## Start here (demo-first)

Independent developers: **clone → run → see memory survive a restart** before you read the spec.

```bash
git clone https://github.com/mirror-abyss/memory-core.git
cd memory-core/examples
npm install
npm start
```

You should see an agent learn a deployment preference, restart with zero in-memory state, and recall the fact from disk alone. That loop is [MA-1 (Memory Continuity)](spec/MA-1.md) in one script.

| Path | What it is |
|---|---|
| [`spec/MA-1.md`](spec/MA-1.md) | MA-1 protocol spec — **Draft `protocolVersion` 0.2.0**, `schemaVersion` 0.1.0 |
| [`memory-core/`](memory-core/) | `@mirror-abyss/memory-core` — reference implementation (§3–§5) |
| [`examples/`](examples/) | Runnable quickstart — the community entry point |

---

## Version honesty

| Axis | Value | Meaning |
|---|---|---|
| **Protocol** | `0.2.0` (Draft) | Interface shapes in the spec; §4.3 errata resolved in 0.2.0 |
| **Schema** | `0.1.0` | Serialized card/anchor data shape — unchanged in 0.2.0 |
| **Package** | `0.1.0` | First public reference-impl release tag |

We do **not** call this Stable. Draft is a feature: you can build against it and argue with it before we freeze `1.0.0`.

---

## What's open vs. what's not (read this)

**Open (this repo):**

- Protocol RFC documents
- Reference implementation that proves the interfaces work
- Demos you can run in five minutes

**Closed (implementer's moat):**

- Production-grade card generation tuning, personalization, and self-model feedback
- Advanced memory eviction, attention governance, and constitutional caching
- Runtime-specific awakening, bridge, and fleet orchestration

The reference `HeuristicCardGenerator` ships **no LLM prompt** on purpose. It produces correctly-*shaped*, reasonable-quality cards with no model call. Production quality is where you differentiate—the interface stays open so everything interoperates.

See [`memory-core/README.md`](memory-core/README.md) § "The open/closed line" for the full boundary.

---

## Research context

MA-1 is the memory engine behind the three-layer self architecture described in our preprint:

**[From Wounds to Architecture: Independent Convergence of the Three-Layer Self in a Production-Grade Agent Operating System](https://zenodo.org/records/20182206)** (PT-002 · Zenodo DOI [`10.5281/zenodo.20182206`](https://doi.org/10.5281/zenodo.20182206))

The paper reports what emerged in a production multi-agent OS; MA-1 is the protocol we extracted so others can build compatible memory without our runtime.

---

## Roadmap (honest)

| Layer | Status |
|---|---|
| **MA-1 §3–§5** (capture, index, recall, assemble) | Reference impl in this repo |
| **MA-1 §6** (anchor / verify / sync continuity) | Draft spec only — ref impl pending, depends on MA-0 identity primitives |
| **MA-0** (DID / signature verification) | Minimal Draft follow-on |
| **LLM-backed CardGenerator + prompt** | Separate release, independently reviewed |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes. Current tag: [`v0.1.0-draft`](https://github.com/mirror-abyss/memory-core/releases/tag/v0.1.0-draft).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every PR is reviewed for spec alignment and open/closed boundary hygiene. [Code of Conduct](CODE_OF_CONDUCT.md) · [Security policy](SECURITY.md)

---

## License

Apache-2.0. See [LICENSE](LICENSE).

**Originated by** Archi Hive — initiator and first implementer. Mirror Abyss is offered to the agent ecosystem; Archi Hive remains the origin and best reference deployment.
