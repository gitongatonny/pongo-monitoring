# Failing CI test and recovery

- The [failing hosted run](https://github.com/gitongatonny/pongo-monitoring/actions/runs/45136419677) tested `80225f5d94a0eef33aa50e66a4b6755e90051f1b` on the `v1.2.0` draft PR. The status API returned `http://localhost:3100` despite the configured `https://status.example.test` origin.
- The browser test failed. The build and image scan, GHCR publication, and K3s deployment were skipped. The local rehearsal still reported `v1.0.0` at `39813aca8fbed5d3580f29908783e5772307bb25`.
- Both status endpoints now use the configured public origin and fall back to the request origin when it is absent. The corrected code passed 106 unit tests and 37 browser tests locally. See the [PR checks](https://github.com/gitongatonny/pongo-monitoring/pull/5/checks) for the hosted follow-up.
