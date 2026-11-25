# FOEMI assignment checklist

**Overall completion as of 23 November 2026: 92% (11 of 12 milestones, rounded).** This counts the seven numbered tasks, four submission items, and the live assessment once each. The numbered technical tasks are **7 of 7 complete** based on repository and deployment evidence. This is a progress estimate. The instructor determines the grade using the assignment's 100-point rubric.

The rubric below follows *End-to-End CI/CD Pipeline with GitHub, Docker, and Kubernetes*. The original assignment and requirements review are available in the [FOEMI assignment conversation](https://chatgpt.com/c/6b01fee8-32ec-83eb-bcac-d41216873e3a).

## Task 1. Application and GitHub management · 15 points

- [x] Deliver a functional, container-ready monitoring app with at least three business functions. Pongo runs scheduled checks, serves public incident and status dashboards, and computes per-monitor 24-hour availability.
- [x] Provide `/health` and `/version` endpoints and test them. The app also exposes database readiness at `/ready`. [Operational endpoint tests](src/app/operations.test.ts)
- [x] Include automated tests and a README with local run and deployment instructions. The documentation PR passed 106 unit tests and 37 browser tests locally. [README](README.md), [PR #6](https://github.com/gitongatonny/pongo-monitoring/pull/6)
- [x] Keep the source in GitHub and show development history through branches and PRs. [Repository](https://github.com/gitongatonny/pongo-monitoring), [release PRs and commits](docs/evidence/hosted-releases.md)

## Task 2. Docker containerization · 15 points

- [x] Use a functional Dockerfile and `.dockerignore`, pinned base images, environment-driven configuration, web port 3000, a non-root runtime, and a container health check. [Dockerfile](Dockerfile), [Docker ignore file](.dockerignore)
- [x] Build and run the image locally. Verify the application, status API, and operational endpoints. [Local rehearsal](docs/evidence/local-rehearsal.md)
- [x] Publish `v1.0.0`, `v1.1.0`, and `v1.2.0` to GHCR. Record unique version tags and deploy immutable digests. [Published release evidence](docs/evidence/hosted-releases.md)

## Task 3. Continuous integration · 20 points

- [x] Commit the GitHub Actions workflow and run validation on development-branch pushes and PRs. [Workflow](.github/workflows/ci.yml), [successful develop push](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45147388066)
- [x] Check out source and install locked dependencies. Run lint, TypeScript, unit tests, browser tests, the ARM64 Docker build, and a Trivy image scan that fails on high or critical findings. [Passing PR checks](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45179776078)
- [x] Gate publication on successful validation and an eligible version-changing PR merge into protected `main`. Verify a failed test blocks image publication and deployment. [Workflow](.github/workflows/ci.yml), [failure and recovery](docs/evidence/ci-failure.md)

## Task 4. Kubernetes deployment · 20 points

- [x] Run the application on local K3s with two web replicas behind a Service, a separate scheduler, and persistent PostgreSQL. Verify access through the web Service. [Hosted rollout evidence](docs/evidence/hosted-releases.md)
- [x] Store non-sensitive settings in a ConfigMap and inject credentials from a Kubernetes Secret. Commit a placeholder Secret example. [ConfigMap](k8s/configmap.yaml), [Secret example](k8s/secret.example.yaml)
- [x] Configure web readiness and liveness probes, CPU and memory requests and limits, and `RollingUpdate`. Commit Kubernetes manifests to GitHub. [Web manifests](k8s/web.yaml), [local rehearsal](docs/evidence/local-rehearsal.md)

## Task 5. Automated delivery and deployment · 15 points

- [x] Automatically queue deployment after an eligible approved update to `main` publishes the scanned versioned image. [Workflow](.github/workflows/ci.yml)
- [x] Deploy the exact GHCR digest, apply the matching configuration and migration Job, wait for web and scheduler rollouts, and verify health, readiness, version, and status over HTTP. Report the outcome to GitHub. [Deploy script](scripts/deploy.sh), [verification script](scripts/verify-release.sh), [hosted rollout evidence](docs/evidence/hosted-releases.md)
- [x] Protect deployment credentials. Hosted jobs use scoped GitHub tokens, and the local watcher uses a scoped Kubernetes service account and loopback API. GitHub deployment requests reach the target through outbound polling. [Watcher](scripts/watch-local-deployments.sh), [deployment runbook](docs/foemi-deployment.md)

## Task 6. Release updates and CI/CD demonstration · 10 points

- [x] Deploy `v1.0.0`, the first functional release, through the automated pipeline. [PR #3](https://github.com/gitongatonny/pongo-monitoring/pull/3)
- [x] Deploy `v1.1.0` through a feature PR and a Kubernetes rolling update. The release adds 24-hour availability per active monitor. [PR #4](https://github.com/gitongatonny/pongo-monitoring/pull/4)
- [x] Deploy `v1.2.0` with a documented fix for incorrect status API URLs and regression coverage. [PR #5](https://github.com/gitongatonny/pongo-monitoring/pull/5)
- [x] Show the intentionally failing browser test, the skipped image, publish, and deploy jobs, and the subsequent successful correction. The failing revision stayed out of the cluster. [Failure and recovery](docs/evidence/ci-failure.md)
- [x] Record the Git commit, CI run, image tag and digest, rollout outcome, and observed application version for all three releases. [Hosted release record](docs/evidence/hosted-releases.md)

## Task 7. Documentation and technical evaluation · 5 points

- [x] Document application architecture with diagrams, the pipeline stages and versioning strategy, and the Kubernetes components and their roles. [Project and pipeline guide](docs/project-pipeline-guide.md)
- [x] Document deployment, updates, testing, security, rollout verification, and troubleshooting. Include evidence of readiness failure, recovery, and rollback. [Deployment runbook](docs/foemi-deployment.md), [local rehearsal](docs/evidence/local-rehearsal.md)

## Submission deliverables

- [x] Repository URL ready to share with the instructor. [Pongo Monitoring](https://github.com/gitongatonny/pongo-monitoring)
- [x] Successful and failed workflow links, image digests, and deployment verification collected. [Release evidence](docs/evidence/hosted-releases.md), [failure evidence](docs/evidence/ci-failure.md)
- [x] Export the six-page [technical report](docs/submission/Pongo-Technical-Report.pdf).
- [x] Create the ten-slide [PowerPoint presentation](docs/submission/Pongo-Live-Presentation.pptx) with speaker notes.

## Live assessment

- [ ] Present the running Kubernetes app, Git and PR history, one successful pipeline, and the three releases. Then make and push a source change during the assessment, watch the automated rollout, and verify the new running version and image digest. [Live assessment guide](docs/live-assessment-guide.md)

## Public subdomain

The assignment accepts local Kubernetes. This deployment is a project follow-up outside the percentage above.

- [ ] Choose the public hostname and always-on target. Configure HTTPS and DNS, set `PONGO_PUBLIC_URL`, deploy a fresh image, and verify it from outside the hosting network. [Public deployment checklist](docs/project-pipeline-guide.md#deploying-to-a-subdomain)
