# FOEMI release and deployment

Pongo is an MIT-licensed monitoring application inherited from [Tim Mikeladze's Pongo repository](https://github.com/TimMikeladze/pongo). The fork adds operational endpoints, a non-root container, and a release pipeline for the FOEMI assignment. The application still supports local SQLite and PostgreSQL. The cluster uses shared PostgreSQL.

```mermaid
flowchart LR
  PR[Development branch or PR] --> CI[Quality, tests, image build and Trivy]
  Main[Approved release merge to main] --> CI
  CI --> Image[GHCR version and digest]
  Image --> Request[GitHub deployment request]
  Request --> Watcher[Outbound local deployment watcher]
  Watcher --> Migration[One PostgreSQL migration Job]
  Migration --> Web[Two web replicas behind a Service]
  Migration --> Scheduler[One private scheduler]
  Web --> Db[(PostgreSQL with PVC)]
  Scheduler --> Db
  Watcher --> Outcome[Verified deployment status]
```

## Workflows and image identity

Development pushes and PRs into `develop` or `main` run the quality, browser, Docker and Trivy jobs. The image jobs build for Linux ARM64 to match the local K3s cluster. Review all checks before merging an assignment release through a PR into `main`. Change `release.json` in each release PR. CI refuses publication if the version tag already exists. It publishes the scanned image to GHCR and gives deployment the resulting digest. High and critical Trivy findings fail validation.

The hosted deployment job creates a GitHub deployment request. The local watcher verifies that the request comes from the workflow for a push to `main`, fetches the exact reviewed manifests, applies the digest and reports success only after rollout and HTTP verification. The cluster API stays on loopback. The laptop must be awake, Docker and K3s running, and the watcher active during releases. A single node supports rolling upgrades and still has a single point of failure.

Before the first release, confirm the [fork’s Actions page](https://github.com/gitongatonny/pongo-monitoring/actions) shows the `CI` workflow and a successful development run. Require the quality, browser, and image checks on the protected `main` branch. Complete GHCR pull setup and start the watcher before merging the initial version.

## Create and configure a local cluster

Install Docker, k3d, kubectl, gh and jq. Use Bash for the examples. Create a cluster with a dedicated kubeconfig and a loopback API. Use the same shell for subsequent commands.

```bash
k3d cluster create pongo-foemi-local --api-port 127.0.0.1:16443 \
  --kubeconfig-update-default=false --kubeconfig-switch-context=false --wait
umask 077
export KUBECONFIG="$(mktemp)"
k3d kubeconfig get pongo-foemi-local > "$KUBECONFIG"
kubectl apply -f k8s/namespace.yaml -f k8s/deployer-rbac.yaml
```

Create the application Secret once. Keep the access code in your password manager for the demo. The database password must match the password embedded in its connection URL. Use existing Secrets and the same persistent volume when restarting the cluster.

```bash
db_password="$(openssl rand -hex 24)"
read -r -s -p "Dashboard access code: " access_code
printf '\n'
kubectl -n pongo create secret generic pongo-secrets \
  --from-literal="POSTGRES_PASSWORD=$db_password" \
  --from-literal="DATABASE_URL=postgres://pongo:$db_password@postgres:5432/pongo" \
  --from-literal="ACCESS_CODE=$access_code" \
  --from-literal="SESSION_SECRET=$(openssl rand -hex 32)" \
  --from-literal="SCHEDULER_SECRET=$(openssl rand -hex 32)"
unset db_password access_code
kubectl apply -f k8s/postgres.yaml
kubectl -n pongo rollout status statefulset/postgres --timeout=240s
```

For private GHCR packages, create `pongo-ghcr` with a pull-only credential before the first release. Use a GitHub classic PAT with `read:packages` and access to the package. Keep its value in your password manager. The publish job uses its own short-lived `GITHUB_TOKEN`.

```bash
read -r -p "GHCR username: " ghcr_user
read -r -s -p "GHCR pull token: " ghcr_token
printf '\n'
docker_config="$(mktemp)"
printf '%s:%s' "$ghcr_user" "$ghcr_token" | openssl base64 -A |
  jq -Rs '{auths:{"ghcr.io":{auth:.}}}' > "$docker_config"
kubectl -n pongo create secret generic pongo-ghcr \
  --type=kubernetes.io/dockerconfigjson --from-file=".dockerconfigjson=$docker_config"
rm -f "$docker_config"
unset ghcr_token
```

Use a dedicated kubeconfig with the `pongo-deployer` ServiceAccount identity for the watcher. Issue a time-limited token from the local admin kubeconfig before the release window. This copies only the API URL and CA and adds the scoped token. Keep both kubeconfig files private.

```bash
export PONGO_ADMIN_KUBECONFIG="$KUBECONFIG"
export KUBECONFIG_DEMO="$(mktemp)"
pongo_server="$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
pongo_ca="$(mktemp)"
kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' | openssl base64 -d -A > "$pongo_ca"
kubectl --kubeconfig "$KUBECONFIG_DEMO" config set-cluster pongo-local \
  --server="$pongo_server" --certificate-authority="$pongo_ca" --embed-certs
kubectl --kubeconfig "$KUBECONFIG_DEMO" config set-credentials pongo-deployer \
  --token="$(kubectl -n pongo create token pongo-deployer --duration=8h)"
kubectl --kubeconfig "$KUBECONFIG_DEMO" config set-context pongo-local \
  --cluster=pongo-local --user=pongo-deployer --namespace=pongo
kubectl --kubeconfig "$KUBECONFIG_DEMO" config use-context pongo-local
rm -f "$pongo_ca"
```

Authenticate `gh` with repository Deployments write and Actions read access. Start the watcher in a terminal before merging the release PR.

```bash
KUBECONFIG="$KUBECONFIG_DEMO" bash scripts/watch-local-deployments.sh
```

To view the deployed dashboard, use another terminal.

```bash
KUBECONFIG="$PONGO_ADMIN_KUBECONFIG" kubectl -n pongo port-forward --address 127.0.0.1 svc/pongo-web 8080:80
```

Open `http://127.0.0.1:8080`. Check `/health`, `/ready`, `/version`, and `/api/status.json`. The scheduler uses one replica with Recreate to avoid overlapping scheduled checks. Web uses RollingUpdate with two replicas and waits for the database readiness query.

## Troubleshoot and collect evidence

- Failed Trivy or tests. Open the failed workflow job and capture its result and the skipped publish/deploy jobs. Verify the previous `/version` independently.
- ImagePullBackOff. Inspect Pod events and verify the package read credential and published digest.
- Migration timeout. Read the migration Job logs and verify PostgreSQL readiness and the Secret. Before retrying the deploy job, remove the failed Job after resolving the cause. A successful Job is reusable for the same release.
- Rollout timeout. Inspect Pod events and logs. Roll back compatible web and scheduler versions using `kubectl -n pongo rollout undo deployment/pongo-web` and the same command for `deployment/pongo-scheduler`. Verify both rollouts and the restored `/version`. Back up PostgreSQL before schema changes and verify rollback compatibility.
- Readiness rehearsals. Use an unreachable probe port to force a failure. A protected path can redirect to the login page, and Kubernetes counts HTTP redirects as successful probes.
- Watcher timeout. Check the local terminal, kubeconfig expiry, and the restricted service account. Rerun the deployment job after recovery so it creates a fresh request for the published digest.

For each graded release, keep the PR and commit, CI run and Trivy output, GHCR tag and digest, watcher log with Pod and rollout status, and the running `/version`. Preserve the intentional red and corrected green CI runs and record the verified version before and after. Prepare a separate source change and version bump for the live assessment.
