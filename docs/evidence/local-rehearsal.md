# Local K3s rehearsal

23 November 2026, Europe/Budapest. This rehearsal used an image built on the development machine and imported by k3d. The initial image had a fixture commit value to test metadata propagation. GitHub Actions publication and deployment require separate release evidence.

| Check | Observed result |
| --- | --- |
| Application | 105 unit tests and 36 Chromium tests passed. |
| Container startup | The local image started as an unprivileged user. `/health`, `/ready`, `/version`, and `/api/status.json` responded. Unauthenticated `/settings` redirected to login. |
| Kubernetes | One K3s `v1.35.5+k3s1` node ready. PostgreSQL StatefulSet `1/1` with a bound `5Gi` PVC. |
| Fresh migration | `job/pongo-migrate-local-smoke` completed and printed `PostgreSQL migrations applied`. |
| Kubernetes rollouts | `deployment/pongo-web` reached `2/2`. `deployment/pongo-scheduler` reached `1/1`. |
| Service smoke | A loopback port-forward returned the expected `v1.0.0` rehearsal metadata and a business status response. |
| First image scan | Trivy `0.76.2` exited 1 with 50 high-severity findings against the inherited Debian OS runtime. The image was excluded from release. |
| Pinned runtime scan | Trivy `0.76.2` reported zero high or critical findings for `pongo-foemi:v1.0.0-local`, built from `39813aca8fbed5d3580f29908783e5772307bb25`. Local image index `sha256:6d7d175cae6ca1d6da81476efeb1676be4c136c9b23ea7b977b1c26d1b81ebcb`. |
| Scoped rollout | With the `pongo-deployer` ServiceAccount, the replacement image ran its migration Job, rolled the web Deployment to `2/2` and started one scheduler. The Service returned `v1.0.0` and the exact image build commit. |
| Database outage | With PostgreSQL stopped, `/health` stayed at `200` and `/ready` returned `503`. After restoring PostgreSQL, readiness returned `200` and all eight prior check records remained. |
| Failed rollout and rollback | An unreachable readiness port blocked the rollout while the two previous web replicas stayed available. The scoped deployer restored the previous revision, and `kubectl rollout status` confirmed `2/2` ready. |
| Hosted CI during rehearsal | GitHub returned zero registered workflows and zero runs after the `develop` push. An explicit workflow enable request returned `404`. The [hosted release record](hosted-releases.md) covers the later successful runs and deployments. |
