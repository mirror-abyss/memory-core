# Releasing @mirror-abyss/memory-core

This repo publishes one npm package: `@mirror-abyss/memory-core`. Releases are **tag-driven** — pushing a version tag triggers the [`publish`](.github/workflows/publish.yml) workflow, which builds and publishes to npm.

## Three version axes (do not conflate)

| Axis | Lives in | Meaning | Example |
|---|---|---|---|
| **Package version** | `memory-core/package.json` `version` | The npm tarball version. Tag must match `v<this>`. | `0.1.0` |
| **`protocolVersion`** | `spec/MA-1.md` §0 + §8.1 | Spec interface version. Bumps only when interfaces change. | `0.2.0` |
| **`schemaVersion`** | `spec/MA-1.md` §8.1 | Serialized card/anchor data shape. Bumps only when on-disk data shape changes. | `0.1.0` |

The package version and the spec versions advance **independently**. A package release does not require a spec bump unless the spec itself changed.

## How to cut a release

1. Ensure `memory-core/package.json` `version` is the version you want to publish.
2. On `main`, after the relevant PRs are merged, tag and push:
   ```bash
   git tag -a v0.1.0 -m "Release @mirror-abyss/memory-core 0.1.0"
   git push origin v0.1.0
   ```
3. The `publish` workflow runs: install → typecheck → test → build → verify dist → `npm publish --access public --provenance`. It verifies `v<package version>` matches the tag before publishing; a mismatched tag fails the build.
4. Confirm: `npm view @mirror-abyss/memory-core version` returns the new version (no longer 404).

Tagging is a deployment action. Whoever cuts the tag owns the release; the workflow never decides to publish on its own.

## Provenance

Publishes use `--provenance` (npm Sigstore). This repo is public, so GitHub Actions OIDC can sign the publish. Consumers can verify the tarball came from this repo+workflow+commit via `npm view --json` provenance fields.

## Scoped package access

`@mirror-abyss/*` is a scoped org. Scoped packages default to private on npm; the workflow passes `--access public` so releases are public without per-release configuration.

## What is NOT published

- `examples/` — a runnable demo, not a package. Consumers `git clone` and run it.
- `spec/`, `docs/` — reference material, read in-repo.
- `memory-core/src/` — kept in the repo for readability/contributors, but the published tarball ships only `dist/` + `README.md` + `LICENSE` (per `package.json` `files`).
