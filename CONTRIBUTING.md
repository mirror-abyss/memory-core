# Contributing to Mirror Abyss

Thank you for helping shape agent memory protocols in the open.

## Before you open a PR

1. **Read the open/closed line** in [`memory-core/README.md`](memory-core/README.md). Reference quality is in scope; production tuning secrets are not.
2. **Do not introduce hive-specific identifiers** — no real DIDs from any production deployment, no internal file paths, no proprietary provider enumerations. Use `did:example:*` in examples.
3. **Respect schema freeze** — `schemaVersion` 0.1.0 card shapes are frozen. If normative prose and TypeScript interfaces disagree, **stop and open an issue**; do not silently change interfaces.
4. **No shell in reference code** — spec §7.1: reference implementations MUST NOT spawn subprocesses or inspect the host via `child_process`.

## Development

```bash
cd memory-core
npm install
npm run typecheck
npm test

cd ../examples
npm install
npm start
```

CI runs the same three gates: `tsc --noEmit`, `vitest run`, eslint.

## Extension points

MA-1 is designed to be extended by implementing interfaces, not by forking the spec. The primary hooks are `ContextProvider` (§4.1), `RecallStrategy` (§5.3), `StorageBackend` (§5.2), and `CardGenerator` (§5.1). See [`docs/extending-ma1.md`](docs/extending-ma1.md) for the contracts and worked examples.

When contributing a new provider/strategy to the **reference** package, open an issue first: the reference intentionally bundles only the four standard providers and the deterministic baseline, to keep the open/closed line clear (production tuning is an implementer's moat, not reference scope).

## Spec changes

Protocol changes belong in `spec/MA-1.md` with an Appendix C changelog entry. Bump `protocolVersion` per §8.1 rules; bump `schemaVersion` only when serialized data shapes change.

## Security

See [SECURITY.md](SECURITY.md). If you believe a contribution could leak identity, privilege, or production implementation details, open a **private** [security advisory](https://github.com/mirror-abyss/memory-core/security/advisories/new) before publishing a public PR.

## Code of conduct

Be direct, be honest about Draft status, and argue with the spec in good faith. We prefer "this interface is wrong" over silent fork.
