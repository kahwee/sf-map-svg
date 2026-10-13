# GitHub Actions maintenance

This guide describes the checked-in workflows. Follow each linked YAML file for branch filters, job dependencies, permissions, and release conditions.

## Workflows

| Workflow | Events | Jobs |
| --- | --- | --- |
| [check.yml](workflows/check.yml) | `push`, `pull_request`, `workflow_dispatch` | `check`, `bun`, `browsers`, `stories` |
| [maintenance.yml](workflows/maintenance.yml) | `schedule`, `workflow_dispatch` | `audit` |
| [pages.yml](workflows/pages.yml) | `push`, `workflow_run`, `workflow_dispatch` | `package-ready`, `build`, `deploy` |
| [publish.yml](workflows/publish.yml) | `release`, `workflow_dispatch` | `publish` |

## Parallel steps

Independent checks use GitHub Actions [native parallel steps](https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel/). The following groups run concurrently within a job:

- [check.yml](workflows/check.yml), job `stories`: `pnpm exec playwright install --with-deps chromium`; `pnpm build-storybook`.
- [pages.yml](workflows/pages.yml), job `build`: `pnpm check`; `pnpm exec playwright install --with-deps chromium`.
- [publish.yml](workflows/publish.yml), job `publish`: `Validate and build package, demo and Storybook`; `Install browser`.

Steps after a group wait for it to finish. Keep prerequisites before the group and dependent build, package, or deployment work afterward. Do not run commands that overwrite the same build directory or coverage output together. Parallel steps share the job workspace; they do not provide separate machines.

## Action versions

Versions below match the current workflow and composite-action references. SHA-pinned actions remain pinned; compare their commit with the upstream stable release when updating.

| Action | Reference |
| --- | --- |
| [actions/checkout](https://github.com/actions/checkout) | `v7.0.1` |
| [actions/configure-pages](https://github.com/actions/configure-pages) | `v6.0.0` |
| [actions/deploy-pages](https://github.com/actions/deploy-pages) | `v5.0.1` |
| [actions/setup-node](https://github.com/actions/setup-node) | `v7.1.0` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact) | `v7.0.2` |
| [actions/upload-pages-artifact](https://github.com/actions/upload-pages-artifact) | `v5.0.0` |
| [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) | `0c5077e51419868618aeaa5fe8019c62421857d6` (`v2.2.0`) |
| [pnpm/action-setup](https://github.com/pnpm/action-setup) | `v6.1.0` |

## Greenkeeping

The `bun` job reads Bun 1.4.3 from `.bun-version` and checks compiled ESM/JSON imports, static rendering, and projection. The build and full test workflows continue to use Node and pnpm.

The `browsers` job checks a production bundle in Chromium, Firefox, and WebKit at desktop and phone widths. It also records a 2,000-marker Chromium benchmark as an artifact. Timings describe that runner; they do not impose a hardware-independent performance threshold. Failed browser checks retain Playwright traces.

[Dependabot configuration](dependabot.yml) checks GitHub Actions weekly and groups their updates. Review the upstream release notes, runtime requirements, permissions, and changes to inputs or artifact behavior before merging. Update SHA pins to the release commit, retaining the version comment where present.

1. Update every reference to the affected action, including local composite actions under `.github/actions/`.
2. Keep frozen dependency installation and the repository’s declared toolchain versions aligned. Cache package downloads with a lockfile-based key; a cache hit does not replace installation or verification.
3. Check workflow YAML and review shell commands. Older workflow linters may not understand native `parallel`; GitHub execution must verify those groups.
4. Run the affected checks and inspect the resulting Actions run. Preserve matrix coverage, build dependencies, artifact paths, and release gates.
5. Refresh this guide when workflows, action references, or parallel groups change.

Use workflow concurrency to cancel superseded check runs where appropriate. Deployment and release cancellation have different consequences: preserve the workflow’s existing policy rather than copying check-run settings blindly. Repository permissions and job-level overrides are defined in the linked YAML files.
