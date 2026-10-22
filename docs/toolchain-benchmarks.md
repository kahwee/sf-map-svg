# Toolchain benchmarks

## Reusing completed library builds

The Node CI job now compiles the library once before generating demos, Storybook,
and Pages. The previous command chain compiled the same source four times.
Standalone commands still build first, and archive prepack retains its fresh build.

On the Linux x64 executor, the library compilation portion took **77% less time**:
**15.715s → 3.655s** at the median of three samples per case. All emitted
files had identical SHA-256 digests across all six cases.

| Compilation phase | Build calls | Median | Range |
| --- | ---: | ---: | ---: |
| Previous repeated builds | 4 | 15.715s | 13.490–18.386s |
| Reuse completed build | 1 | 3.655s | 3.399–4.537s |

[Raw samples](benchmarks/toolchain-build-reuse-2026-10-22.json) record each result,
the command, runtime versions, baseline commit, and modified-worktree status.
Runtime: Node v26.11.1, Bun 1.4.4, pnpm 12.6.0, linux 6.18.55 x64.

This isolates library compilation. It excludes unchanged demo, Storybook, Pages,
archive-packing, browser-installation, and test time. It is not a whole-CI speedup
measurement. The command count describes the compilation path optimized in the
Node job; archive prepack is a separate fresh build. Earlier native-checker timings
in the README measure a different stage and must not be multiplied into this gain.

## Reproduce

Install the pinned tools and dependencies, then run from the repository root:

```sh
pnpm install --frozen-lockfile
node scripts/benchmark-toolchain.mjs --samples=3 > /tmp/sf-map-toolchain.json
```

The default is three samples per case. Odd samples run repeated builds first;
even samples reverse the order. Each call uses the normal `pnpm build`, which
replaces `dist`; it does not reuse stale compiled output. The script compares every
emitted file's content across cases and fails on any build error or output change.
Keep other build/test workloads stopped during comparisons. Use the complete JSON,
including the ranges, when reporting results. Dependency and filesystem caches
remain enabled, so these are ordinary local runs rather than a cold-machine test.

## Build ownership

| Command | Library build |
| --- | --- |
| `pnpm demo`, `pnpm build-storybook`, `pnpm build:pages` | Builds current source first |
| `pnpm test:stories`, `pnpm test:stories:coverage` | Builds current source first |
| Corresponding `:built` command | Requires a successful current build in this job |
| `pnpm pack` | Runs the fresh-build prepack hook |

The stories job builds through `build-storybook` once. Pages and publishing finish
`pnpm check` before using built variants. Preserve those dependencies and keep
builds that replace `dist` out of parallel groups with readers of `dist`.
