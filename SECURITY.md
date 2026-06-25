# Security Policy

Mirror Abyss publishes **protocol specifications and reference code** for agent memory. We take reports about identity leakage, privilege escalation, unsafe defaults, and production-deployment exposure seriously — especially where reference code could be mistaken for hardened production paths.

## Supported versions

| Version | Supported |
|---|---|
| `v0.1.0-draft` (current) | ✅ security reports accepted |
| Pre-release Draft tags | ✅ best-effort |
| Unreleased `main` | ✅ best-effort |

This project is **Draft**, not Stable. We fix genuine security issues promptly; we do not promise frozen API behavior until a Stable release.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security-sensitive reports.**

1. **Preferred:** [Open a private security advisory](https://github.com/mirror-abyss/memory-core/security/advisories/new) on this repository.
2. **Alternative:** If you cannot use GitHub advisories, describe the issue in minimal form in a Discussion titled `[security]` and ask a maintainer to move it to a private advisory — **do not paste exploit details publicly**.

We aim to acknowledge reports within **72 hours** and provide a remediation timeline when confirmed.

## Out of scope (please use public issues instead)

- Disagreements with Draft protocol design (open a Discussion or spec issue)
- Feature requests for production tuning inside the reference implementation
- Reports that reference **non-public deployments** — we cannot verify or patch private systems; please describe the **public artifact** concern instead

## Safe harbor

We appreciate good-faith research. Do not test against systems you do not own. Do not exfiltrate real user or agent identity material in your report — use synthetic `did:example:*` data.

## Disclosure

We prefer coordinated disclosure. We will credit reporters in the advisory or release notes unless you request anonymity.
