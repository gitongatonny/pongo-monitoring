# Pongo Monitoring

Pongo is a self-hosted uptime monitor and status page. Its scheduler checks services and stores results. The operator dashboard shows check history, latency, and alerts, and public dashboards share service health, incidents, and availability. Monitor definitions and dashboards live in TypeScript alongside the app.

This fork adds a FOEMI delivery pipeline that tests and scans a Linux ARM64 image in GitHub Actions, publishes the scanned image to GitHub Container Registry (GHCR), and deploys it by digest to a local K3s cluster. The latest verified release is **v1.2.0**. [Release evidence](https://github.com/gitongatonny/pongo-monitoring/blob/main/docs/evidence/hosted-releases.md)

![Pongo operator overview](public/readme/overview-dark.png)

[Quick Start](#quick-start) · [Assessment](#assessment-reproduction) · [Configuration](#configure-pongo) · [Deployment](#deploy-through-github-actions) · [Documentation](#documentation-and-license)

## Quick Start

Install [Bun](https://bun.sh/). This example uses local SQLite.

```bash
git clone https://github.com/gitongatonny/pongo-monitoring.git
cd pongo-monitoring
cp .env.example .env
bun install --frozen-lockfile
bun run db:sqlite:migrate
bun run dev
```

In a second terminal in the repository, run `bun run scheduler` to collect measurements. Open `http://localhost:3000` for the operator dashboard and `http://localhost:3000/shared/status` for the bundled public page. The page can show unknown availability until the scheduler records checks.

For PostgreSQL, set `DATABASE_URL` in `.env` and use `bun run db:pg:migrate`. For a local production build, run `bun run build` and `bun run start` after applying the database migrations. See the [example environment file](https://github.com/gitongatonny/pongo-monitoring/blob/main/.env.example).

## Configure Pongo

| Location | What to configure |
| --- | --- |
| `pongo/monitors/` | Service names, check intervals, and TypeScript check functions |
| `pongo/dashboards/` | Dashboard names, slugs, visibility, and monitor membership |
| `pongo/channels.ts` | Notification channels |
| `pongo/incidents/` and `pongo/announcements/` | Markdown incident reports and public updates |
| `.env` or Kubernetes Secrets | Database connection, operator access code, session secret, and scheduler secret |

The built-in example monitors Vercel, Hacker News, and Wikipedia. Replace those definitions and the dashboard membership with the services you want to track. [Monitor examples](https://github.com/gitongatonny/pongo-monitoring/tree/main/pongo/monitors)

## Deploy through GitHub Actions

1. Set up a Linux ARM64 K3s target using Docker, k3d, kubectl, GitHub CLI, and jq. Create the namespace and app Secret, start PostgreSQL, and configure GHCR access and the scoped watcher kubeconfig. The [deployment runbook](https://github.com/gitongatonny/pongo-monitoring/blob/main/docs/foemi-deployment.md) has the commands.
2. Start the watcher from the repository with `KUBECONFIG="$KUBECONFIG_DEMO" bash scripts/watch-local-deployments.sh`. Keep the target and watcher running through the release.
3. Push a branch and open a PR into `main` or `develop` to trigger CI. Direct pushes to `develop` also run validation. For a release, include an unused `vX.Y.Z` in `release.json` and open the PR into `main`.
4. Wait for **Quality and unit tests**, **Browser tests**, and **Build and scan image**. Merge the release PR into `main` once those pass. The merge triggers a new run that validates the merged commit, publishes the scanned image, and queues deployment.
5. Watch the deployment job in [GitHub Actions](https://github.com/gitongatonny/pongo-monitoring/actions). The watcher runs a PostgreSQL migration Job, rolls out two web replicas and one scheduler, then checks the app and reports the result to GitHub.

A merge that leaves `release.json` at the same version validates the source without publishing or deploying. The FOEMI workflow takes its version from `release.json`.

For local verification, forward the web Service in one terminal and check the endpoints in another.

```bash
kubectl -n pongo port-forward --address 127.0.0.1 svc/pongo-web 8080:80
```

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
curl -fsS http://127.0.0.1:8080/version
```

| Endpoint | What it shows |
| --- | --- |
| `/health` | Web process liveness |
| `/ready` | Database connectivity |
| `/version` | Release version and image source commit |
| `/api/status.json` | System status |
| `/shared/status/status.json` | Bundled public dashboard status |
| `/shared/status/availability.json` | Measured 24-hour availability and check counts per active public monitor |

## Assessment reproduction

Use a Linux ARM64 Docker engine, or Docker Desktop on Apple Silicon, for the published images. Install Git, Docker, k3d, kubectl, curl, OpenSSL and jq. GitHub CLI is needed for the automated update. For an x86-64 machine, use the SQLite quick start above to inspect the app and an ARM64 host for the Kubernetes exercise.

### Run the verified baseline

Clone this repository. In Bash, follow [Create and configure a local cluster](docs/foemi-deployment.md#create-and-configure-a-local-cluster) through the PostgreSQL readiness check and GHCR setup if package credentials are required. A read-only assessor can install the published baseline with the admin kubeconfig. The command uses the manifests from the corresponding release commit.

```bash
baseline_commit=7e6e0915aa9d00cdeb457e0ae03b00fa45d40121
baseline_image=ghcr.io/gitongatonny/pongo-monitoring@sha256:b75e4168b3db475be8ff352ed7d4d257af137e7654eec15c1c31c0d1635fcb1d
baseline_files=$(mktemp -d)
git archive "$baseline_commit" k8s | tar -xf - -C "$baseline_files"
PONGO_MANIFEST_DIR="$baseline_files/k8s" bash scripts/deploy.sh \
  "$baseline_image" v1.2.0 "$baseline_commit"
```

Keep the web Service port-forward shown above running in a separate terminal with the same admin kubeconfig. Open `http://127.0.0.1:8080/shared/status` and check the baseline.

```bash
bash scripts/verify-release.sh http://127.0.0.1:8080 v1.2.0 \
  7e6e0915aa9d00cdeb457e0ae03b00fa45d40121
```

### Reproduce an automated version update

Use this repository with merge access, or fork it and use your fork's Actions and GHCR package. Clone the fork or set `origin` to it before pushing. Enable Actions, allow merge commits, and ensure the workflow can publish packages and create deployment requests. Create the scoped watcher kubeconfig using the runbook. Authenticate `gh` with Actions read and Deployments write access for the selected repository. Run one watcher for the target.

```bash
# Set this to the lowercase owner/repo for your fork if you use one.
export PONGO_GITHUB_REPO=gitongatonny/pongo-monitoring
KUBECONFIG="$KUBECONFIG_DEMO" bash scripts/watch-local-deployments.sh
```

In the checkout, branch from current `main`. Change the display name in `pongo/dashboards/status.ts` from `Status` to `Service Status`, keeping the slug. Set `release.json` to an unused release tag such as `v1.2.1`. Choose another version if that tag is already published. Use the same chosen version during verification.

```bash
git fetch origin main
git switch -c demo/assessment-update origin/main
# Edit pongo/dashboards/status.ts and release.json as described above.
git add pongo/dashboards/status.ts release.json
git commit -m "Update the public status dashboard title"
git push -u origin demo/assessment-update
gh pr create --base main --fill
```

Wait for the PR's quality, browser, and image scan jobs. Use GitHub's **Create a merge commit** option. On the resulting `main` run, record the merge SHA, the published GHCR digest and the deployment result. If the port-forward exits during the rollout, start it again. Verify the endpoint against the actual merge SHA and release version.

```bash
merge_sha=$(gh pr view demo/assessment-update --json mergeCommit --jq '.mergeCommit.oid')
bash scripts/verify-release.sh http://127.0.0.1:8080 v1.2.1 "$merge_sha"
curl -fsS http://127.0.0.1:8080/shared/status/status.json | jq -r '.page.name'
kubectl -n pongo get deployment pongo-web pongo-scheduler \
  -o 'custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,IMAGE:.spec.template.spec.containers[0].image'
```

Expect the new dashboard name, two ready web replicas, one ready scheduler, and the digest from the main workflow on both Deployments. For historical evidence, open the [three release runs](docs/evidence/hosted-releases.md) and the [failed test and successful correction](docs/evidence/ci-failure.md).

### Deploy on a subdomain

The verified setup is local K3s. For an ongoing public instance, choose the hostname and an always-on target, then route HTTPS to the `pongo-web` Service on port 80 through an ingress, reverse proxy, or outbound tunnel. Point DNS at that HTTPS endpoint. Keep PostgreSQL, the scheduler, and the Kubernetes API private, and configure the dashboard access code before exposing the web app.

Set the GitHub Actions repository variable `PONGO_PUBLIC_URL` to the final HTTPS origin before building the public release. CI passes it to the Docker build as `NEXT_PUBLIC_URL`. Publish a fresh release and check both status JSON endpoints for the public hostname. See the [public deployment checklist](https://github.com/gitongatonny/pongo-monitoring/blob/main/docs/project-pipeline-guide.md#deploying-to-a-subdomain).

## Development checks

```bash
bun run lint
bun run tsc --noEmit
bun run test
bun run test:e2e:install
bun run test:e2e
bun run build
```

CI uses a frozen lockfile. Playwright starts its own test server.

## Create a status page with an agent

The [agent setup guide](https://github.com/gitongatonny/pongo-monitoring/blob/main/docs/agent-setup.md) and the [create-pongo skill](public/skills/create-pongo/SKILL.md) cover configuring monitors and public pages from a list of services.

## Documentation and license

- [Assessment checklist](TASKS.MD), [technical report](docs/submission/Pongo-Technical-Report.pdf), [presentation](docs/submission/Pongo-Live-Presentation.pptx), and [defense guide](docs/submission/Pongo-Defense-Guide.pdf).
- [Project and pipeline guide](https://github.com/gitongatonny/pongo-monitoring/blob/main/docs/project-pipeline-guide.md) explains the architecture, release history, and public deployment decisions.
- [Live assessment guide](https://github.com/gitongatonny/pongo-monitoring/blob/main/docs/live-assessment-guide.md) gives a walkthrough, evidence checklist, and recovery steps.
- [Original README](https://github.com/gitongatonny/pongo-monitoring/blob/main/OLD_README.md) preserves the inherited documentation and configuration examples.

MIT licensed. Based on [Tim Mikeladze’s Pongo](https://github.com/TimMikeladze/pongo). [License](https://github.com/gitongatonny/pongo-monitoring/blob/main/LICENSE)
