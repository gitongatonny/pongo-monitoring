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
