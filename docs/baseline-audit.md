# FOEMI baseline audit

Baseline commit `3384c483bc1358318267ec68719fd96cf89669f3` (`chore: ignore generated social content`). The working tree was clean when the audit began. Baseline runtime checks used disposable copies of this commit on 23 November 2026.

## Repository and tools

- The fork is public, the authenticated GitHub account has admin access, and the default branch is `main`. GitHub reported that `main` is unprotected, listed zero rulesets, and returned no Actions runs. The live fork and upstream both reported the baseline SHA on `main`. The fork had no `develop` ref.
- Local tools are Bun `1.3.14`, Node.js `24.22.2`, Docker `29.9.3` (Linux ARM64 daemon), Docker Compose `5.7.0`, and kubectl `1.37.2`. The inherited CI uses Bun `1.3.5`. The locked application dependencies include Next.js `16.4.4`, Playwright `1.64.1`, and Drizzle Kit `0.31.11`.
- The fork retains its upstream MIT license and release history. The upstream `1.0.0`, `1.1.0`, and `1.2.0` tags already exist without a `v` prefix.

## Checks

| Status | Check | Evidence |
| --- | --- | --- |
| PASS | `git ls-remote --symref` for both remotes | Both default branches are `main` at the baseline SHA. |
| PASS | `bun install --frozen-lockfile` with Bun `1.3.5` | Installed 754 packages. The checked-out lockfile matched the recorded commit afterward. |
| PASS | `bun run lint` | Biome reported 11 existing CSS warnings and no errors. |
| PASS | `bun run tsc --noEmit` | Exited 0. |
| PASS | `bun run test` | 103 passed, zero failed. |
| PASS | `docker exec <postgres-container> pg_isready -U pongo -d pongo` | Disposable PostgreSQL `16.14` accepted connections. The host port was bound to loopback. |
| PASS | `bun run db:pg:migrate` and `bun run db:sqlite:migrate` | Both applied successfully with their respective disposable database URLs. |
| PASS | `bun src/scheduler/index.ts`, scheduler `GET /monitors/baseline`, and `SELECT` from `pongo_check_results` | A two-second loopback HTTP monitor recorded `baseline / up` in PostgreSQL. Notifications were disabled. |
| PASS | `GET /api/status.json`, `GET /shared/status`, and `GET /shared/status/status.json` against `next dev` | Both status endpoints returned JSON, the dashboard rendered the local monitor, and the recorded row persisted after the web process restarted. |
| FAIL | `DATABASE_URL=file:./pongo/baseline.db bun run build` | Invoked `db:pg:migrate` and exited 1 before reaching Next.js. The explicit SQLite migration succeeded. |
| FAIL | `env -u DATABASE_URL bun next build` | Compiled and generated 12 pages, then exited 1 with a Next.js security advisory. |
| FAIL | `CI=true bun run test:e2e --reporter=line` with Chromium from Playwright | Next.js exited with the security advisory while starting Playwright's web server. |
| PASS | `docker build --tag pongo-baseline:3384c48 .` and loopback container smoke | Compiled without a database URL. The running web container returned `200` for `/api/status.json` with explicit PostgreSQL configuration and its scheduler disabled. |
| FAIL | Inspect baseline image and request `GET /health` | Docker reported no health check or configured runtime user, and the web route returned `404`. The exploratory image measured about 1.8 GB including a temporary tool cache present in the build context. |
| PASS | Build fix branch, `env -u DATABASE_URL bun run build` | Next.js `16.4.5` compiled, type-checked, generated 12 pages, and exited 0 without a database URL. |

## Findings from source inspection

- The package build script invokes a migration before `next build`. Its SQLite condition expects a `sqlite` prefix, while the documented local SQLite URL uses `file:`. The Dockerfile instead invokes Next.js compile mode and the entrypoint performs page generation when the web container starts.
- The Dockerfile uses a floating Bun base tag and declares neither a runtime user nor an image health check. The entrypoint can start background workers alongside the web application when their flags are enabled.
- The web proxy exempts `/api` from dashboard session authentication. The cron route has its own credential check. The scheduler has separate bearer authentication that is enabled when `SCHEDULER_SECRET` is set. The scheduler and PostgreSQL should stay private in the cluster, and scheduler triggers should use a configured secret.
- The web app lacks dedicated liveness, readiness, and version endpoints. The scheduler already provides its own `/health` route.
- The inherited workflow targets `main` pushes and PRs into `main`. It defines lint, TypeScript, unit, and browser checks. Registry publication, image scanning, and deployment jobs are absent.

## First pull request

Use `next build` for the package build and run the documented SQLite or PostgreSQL migration explicitly before starting production. Pin Next.js to `16.4.5`, the first patch listed for the November 2026 advisories, and retain the inherited package version and unrelated lockfile entries. [Next.js November 2026 security release](https://nextjs.org/blog/november-2026-security-release)
