#!/usr/bin/env bash
set -euo pipefail

url=${1:?Provide the application base URL}
version=${2:?Provide the expected release version}
commit=${3:?Provide the expected source commit}
url=${url%/}

curl --fail --silent --show-error --max-time 10 "$url/health" | jq -e '.status == "ok"'
curl --fail --silent --show-error --max-time 10 "$url/ready" | jq -e '.status == "ready"'
curl --fail --silent --show-error --max-time 10 "$url/version" |
  jq -e --arg version "$version" --arg commit "$commit" 'select(.version == $version and .commit == $commit)'
curl --fail --silent --show-error --max-time 10 "$url/api/status.json" | jq -e 'select(.status.indicator != null)'
