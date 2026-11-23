#!/usr/bin/env bash
set -euo pipefail

image=${1:?Provide the published image digest}
version=${2:?Provide the release version}
commit=${3:?Provide the source commit}

[[ "$image" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+@sha256:[a-f0-9]{64}$ ]]
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
[[ "$commit" =~ ^[a-f0-9]{40}$ ]]

manifest_dir=${PONGO_MANIFEST_DIR:-$(dirname "$0")/../k8s}
cd "$manifest_dir"
job="pongo-migrate-${version//./-}-${commit:0:12}"

if ! kubectl -n pongo get "job/$job" --ignore-not-found -o name | grep -q .; then
  sed -e "s|pongo-app:release|$image|" -e "s|pongo-migrate-release|$job|" \
    migration-job.yaml | kubectl create -f -
fi

if ! kubectl -n pongo wait --for=condition=complete "job/$job" --timeout=195s; then
  kubectl -n pongo describe "job/$job" || true
  kubectl -n pongo logs "job/$job" --tail=100 || true
  exit 1
fi
kubectl -n pongo logs "job/$job" --tail=100

kubectl kustomize . | sed "s|pongo-app:release|$image|g" | kubectl apply -f -
kubectl -n pongo rollout status deployment/pongo-web --timeout=200s
kubectl -n pongo rollout status deployment/pongo-scheduler --timeout=200s
kubectl -n pongo get deployment,pods -o wide

for workload in web scheduler; do
  deployed=$(kubectl -n pongo get "deployment/pongo-$workload" -o jsonpath='{.spec.template.spec.containers[0].image}')
  [[ "$deployed" == "$image" ]]
done
