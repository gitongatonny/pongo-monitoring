# Hosted releases and local K3s deployment

On 23 November 2026, GitHub Actions validated and published all three FOEMI releases from `main`. Trivy passed the high and critical severity gate for each image. The local watcher recorded success after the database migration, web and scheduler rollouts, and HTTP checks. The verification times below are in Budapest local time.

| Release | PR and CI | Trivy | K3s verification |
| --- | --- | --- | --- |
| `v1.0.0` | [PR #3](https://github.com/gitongatonny/pongo-monitoring/pull/3), [CI run](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45139120909) | [Scan log](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45139120909/job/137592107395) | [Deployment job](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45139120909/job/137592106306), request `7994702525`, verified at 10:15:36 |
| `v1.1.0` | [PR #4](https://github.com/gitongatonny/pongo-monitoring/pull/4), [CI run](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45145461565) | [Scan log](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45145461565/job/137596947458) | [Deployment job](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45145461565/job/137598379109), request `7994949841`, verified at 10:28:02 |
| `v1.2.0` | [PR #5](https://github.com/gitongatonny/pongo-monitoring/pull/5), [CI run](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45147300788) | [Scan log](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45147300788/job/137603045554) | [Deployment job](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45147300788/job/137604519301), request `7995192901`, verified at 10:40:20 |

The watcher checked the version and commit returned by `/version` for each deployment. The tags below are under `ghcr.io/gitongatonny/pongo-monitoring`. Kubernetes used the corresponding digest.

| GHCR tag | Commit verified through `/version` | GHCR digest |
| --- | --- | --- |
| `v1.0.0` | `6cbbc9abf1fee4e334bc088f7f7651b3d9b78fce` | `sha256:3a338e2b9851caaa5549fb1f599671aadaca11cfe1502e7f89a4540957d4237c` |
| `v1.1.0` | `92292c03d71c3760b6de4a8fef53bcd1703529a9` | `sha256:ef98d749840ecedc1868532cc8869c15f59738c85b29f9a7ea0c0bddbb417486` |
| `v1.2.0` | `7e6e0915aa9d00cdeb457e0ae03b00fa45d40121` | `sha256:b75e4168b3db475be8ff352ed7d4d257af137e7654eec15c1c31c0d1635fcb1d` |

A later check found all three release migration jobs complete. The cluster had two ready web replicas and one ready scheduler replica on the `v1.2.0` digest. The web Service returned `{"status":"ok"}` from `/health`, `{"status":"ready"}` from `/ready`, and the following from `/version`.

```json
{"version":"v1.2.0","commit":"7e6e0915aa9d00cdeb457e0ae03b00fa45d40121"}
```

See [the failing CI test and recovery](ci-failure.md) for the intentional failure and corrected run.
