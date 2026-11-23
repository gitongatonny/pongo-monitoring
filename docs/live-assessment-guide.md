# FOEMI live assessment guide

Demonstrate that a visible source change goes through tests, image scanning, publication, and Kubernetes deployment. Finish by matching the observed version and commit to the merged PR and the running image digest.

The latest verified starting point is `v1.2.0`. Use `v1.2.1` for the demo if it is still unused when you present. The deployment can run on the existing local K3s target. If the subdomain is live by then, use it for the final external check as well. [Hosted release record](evidence/hosted-releases.md)

## Before the session

- Confirm the cluster's PostgreSQL StatefulSet and application Deployments are ready. Open the local dashboard and verify the actual starting version. Have the dashboard access code available without displaying it.
- Confirm the watcher has a valid scoped kubeconfig and `gh` is authenticated with Deployments write and Actions read access. Start the watcher before merging a release. The [deployment runbook](foemi-deployment.md) has the credential and cluster setup.
- Check which version is unused in [GHCR](https://github.com/gitongatonny/pongo-monitoring/pkgs/container/pongo-monitoring). Settle on a small visible change. For example, change the dashboard name in `pongo/dashboards/status.ts` from `Status` to `Service Status`, keeping the slug `status` so the page URL stays stable.
- Open GitHub Actions, the public dashboard, and two terminals. Keep the previous release, the intentional red run, and the corrected green run available in case hosted checks take longer than the session allows. [Failure and recovery](evidence/ci-failure.md)

Start the watcher and the dashboard port-forward in separate shells with the respective kubeconfig paths from setup.

```bash
KUBECONFIG="$KUBECONFIG_DEMO" bash scripts/watch-local-deployments.sh
```

```bash
KUBECONFIG="$PONGO_ADMIN_KUBECONFIG" kubectl -n pongo port-forward \
  --address 127.0.0.1 svc/pongo-web 8080:80
```

In another terminal, record the baseline version and open `http://127.0.0.1:8080/shared/status`.

```bash
curl -fsS http://127.0.0.1:8080/version | jq
```

## During the assessment

1. **Show the starting state.** Display the dashboard, the baseline version output, and the prior release record. Explain that the two web replicas serve the UI, the scheduler writes check results, and PostgreSQL holds the history.
2. **Make and push the change.** Start from current `origin/main`. Edit the dashboard name and set the selected version in `release.json`. Review the diff, commit the two files, and push a feature branch.

   ```bash
   git fetch origin
   git switch -c demo/foemi-live-release origin/main
   # Edit pongo/dashboards/status.ts and release.json.
   git diff -- pongo/dashboards/status.ts release.json
   git add pongo/dashboards/status.ts release.json
   git commit -m "feat: update the public status dashboard title"
   git push -u origin demo/foemi-live-release
   gh pr create --base main --head demo/foemi-live-release --fill
   ```

3. **Show the PR checks.** Open the PR Checks tab or run `gh pr checks --watch`. Point out the quality checks, browser tests, and Trivy scan. The PR validates the change. Publishing and deployment follow the eligible merge to `main`.
4. **Merge and follow the main run.** Once the required checks pass, merge through GitHub. Watch the resulting push run. In the publish job, capture the release tag and digest. In the deployment job and watcher terminal, show the request ID, migration result, and web and scheduler rollout.
5. **Prove the change is running.** Refresh the public dashboard and show the new title. Compare `/version` with the merged commit, and compare the Kubernetes image reference with the GHCR digest. Restart the port-forward if the web Pod it was attached to rotated during rollout.

   ```bash
   curl -fsS http://127.0.0.1:8080/health
   curl -fsS http://127.0.0.1:8080/ready
   curl -fsS http://127.0.0.1:8080/version | jq
   curl -fsS http://127.0.0.1:8080/shared/status/status.json | jq '.page.name'
   KUBECONFIG="$PONGO_ADMIN_KUBECONFIG" kubectl -n pongo get \
     deploy/pongo-web deploy/pongo-scheduler -o wide
   ```

6. **Show the failure gate.** Open the recorded failing run and point to the browser assertion and the skipped image, publish, and deploy jobs. Open the corrected run and the successful `v1.2.0` deployment record. This gives a red-to-green example without introducing a failure to the live release. [Failure and recovery](evidence/ci-failure.md)

If the subdomain is already routed to the assessment target, repeat the external checks over HTTPS with the actual hostname. Confirm that `/version` shows the demo release and that both status APIs return the public origin in `page.url`. [Public deployment checklist](project-pipeline-guide.md#deploying-to-a-subdomain)

## Evidence to keep

Keep the demo PR URL, merged SHA, main Actions run and Trivy job, GHCR tag and digest, deployment request ID and watcher log, and before/after `/version` output. Capture the visible page change and the Kubernetes rollout status. The watcher prints its log directory when it starts and writes a file named after each deployment request ID.

## If a step fails

| Symptom | What to show and how to recover |
| --- | --- |
| PR check or Trivy scan fails | Open the failing job and fix the source or build on the demo branch. Push the correction and wait for the required checks before merging. |
| Release tag already exists | Choose an unused version in a follow-up PR. Keep the existing tag and digest intact. |
| Deployment stays queued | Check the watcher terminal, credentials, cluster connectivity, and laptop sleep. If the deployment job times out after publication, rerun only that job to create a fresh deployment request for the published digest. |
| Migration or rollout fails | Read the watcher log and inspect the Job or Pod events. Use the [deployment runbook](foemi-deployment.md#troubleshoot-and-collect-evidence) for migration retry and compatible rollback. Verify the actual running version after recovery. |
| Hosted runners are slow | Show the PR or main-run link and walk through the existing release evidence while the new run continues. Report the live release as pending until its verified deployment succeeds. |
