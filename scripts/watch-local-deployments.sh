#!/usr/bin/env bash
set -euo pipefail

: "${KUBECONFIG:?Set KUBECONFIG to the dedicated local K3s kubeconfig}"
repo=gitongatonny/pongo-monitoring
endpoint="repos/$repo/deployments"
root=$(cd "$(dirname "$0")/.." && pwd)
log_dir=${PONGO_DEPLOY_LOG_DIR:-${TMPDIR:-/tmp}/pongo-local-deployments}
once=${1:-}
[[ -z "$once" || "$once" == --once ]]

server=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
if [[ ! "$server" =~ ^https://(127\.0\.0\.1|localhost):[0-9]+$ ]]; then
  echo "The watcher requires a kubeconfig for a loopback Kubernetes API." >&2
  exit 1
fi

umask 077
mkdir -p "$log_dir"
lock="$log_dir/.watcher-lock"
if ! mkdir "$lock"; then
  echo "Another watcher is already using $log_dir." >&2
  exit 1
fi
trap 'rmdir "$lock"' EXIT

record_status() {
  gh api "$endpoint/$1/statuses" -f "state=$2" -f "description=$3" \
    -f "log_url=https://github.com/$repo/actions/runs/$4" -F auto_inactive=false >/dev/null
}

roll_out() (
  set -euo pipefail
  commit=$1
  image=$2
  version=$3
  scratch=$(mktemp -d)
  forward_pid=
  trap 'if [[ -n "$forward_pid" ]]; then kill "$forward_pid" 2>/dev/null || true; fi; rm -rf "$scratch"' EXIT

  git -C "$root" fetch --no-tags "https://github.com/$repo.git" refs/heads/main
  git -C "$root" merge-base --is-ancestor "$commit" FETCH_HEAD
  git -C "$root" archive "$commit" release.json k8s | tar -xf - -C "$scratch"
  [[ "$(jq -er .version "$scratch/release.json")" == "$version" ]]
  PONGO_MANIFEST_DIR="$scratch/k8s" bash "$root/scripts/deploy.sh" "$image" "$version" "$commit"

  kubectl -n pongo port-forward --address 127.0.0.1 service/pongo-web :80 > "$scratch/port" 2>&1 &
  forward_pid=$!
  for attempt in {1..30}; do
    port=$(sed -n 's/^Forwarding from 127\.0\.0\.1:\([0-9]*\) -> .*/\1/p' "$scratch/port")
    if [[ -n "$port" ]]; then
      bash "$root/scripts/verify-release.sh" "http://127.0.0.1:$port" "$version" "$commit"
      exit
    fi
    kill -0 "$forward_pid"
    sleep 1
  done
  cat "$scratch/port"
  exit 1
)

echo "Watching $repo for local K3s deployments. Logs are in $log_dir."
while true; do
  if ! deployments=$(gh api "$endpoint?environment=foemi-local&task=deploy%3Ak3s&per_page=5" |
    jq -c '.[] | select(.creator.login == "github-actions[bot]") |
      .payload |= (if type == "string" then (try fromjson catch null) else . end)'); then
    [[ "$once" == --once ]] && exit 1
    sleep 10
    continue
  fi
  while IFS= read -r deployment; do
    [[ -n "$deployment" ]] || continue
    IFS=$'\t' read -r id commit version image run <<< "$(jq -r '[.id, .sha, .payload.version, .payload.image, .payload.run] | @tsv' <<< "$deployment")"
    [[ "$id" =~ ^[0-9]+$ && "$run" =~ ^[0-9]+$ && "$commit" =~ ^[a-f0-9]{40}$ ]] || continue
    [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
    [[ "$image" =~ ^ghcr\.io/gitongatonny/pongo-monitoring@sha256:[a-f0-9]{64}$ ]] || continue
    state=$(gh api "$endpoint/$id/statuses" --jq '.[0].state') || continue
    [[ "$state" == queued ]] || continue
    if ! gh api "repos/$repo/actions/runs/$run" |
      jq -e --arg sha "$commit" --arg repo "$repo" '
        .event == "push" and .head_branch == "main" and .head_sha == $sha
        and .head_repository.full_name == $repo and .status == "in_progress"
        and (.path | split("@")[0]) == ".github/workflows/ci.yml"
      ' >/dev/null; then
      continue
    fi

    record_status "$id" in_progress "Applying $version to local K3s" "$run"
    # Capture the subshell status while retaining errexit inside it.
    set +e
    roll_out "$commit" "$image" "$version" > "$log_dir/$id.log" 2>&1
    result=$?
    set -e
    if (( result == 0 )); then
      record_status "$id" success "Verified $version on local K3s" "$run"
    else
      record_status "$id" failure "Migration, rollout, or HTTP verification failed" "$run"
    fi
    cat "$log_dir/$id.log"
  done <<< "$deployments"

  [[ "$once" == --once ]] && break
  sleep 10
done
