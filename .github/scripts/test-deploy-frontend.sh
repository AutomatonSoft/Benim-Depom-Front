#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
export DEPLOY_DIR="$test_dir" IMAGE_TAG=sha-test BACKEND_URL=https://example.invalid
export CALL_LOG="$test_dir/calls"

mock_compose() {
  if [[ "$*" == version ]]; then return 0; fi
  if [[ "$*" == 'up --help' ]]; then
    if [[ "$MODE" != old ]]; then echo '--wait --wait-timeout'; fi
    return 0
  fi
  printf '%s\n' "$*" >> "$CALL_LOG"
}
docker() {
  [[ "$MODE" == plugin || "$MODE" == old ]] || return 1
  [[ "$1" == compose ]] || return 1
  shift
  mock_compose "$@"
}
docker-compose() {
  [[ "$MODE" == standalone ]] || return 1
  mock_compose "$@"
}
curl() { printf 'curl %s\n' "$*" >> "$CALL_LOG"; }
export -f mock_compose docker docker-compose curl

for environment in stage production; do
  export PROJECT_NAME="frontend-$environment"
  if [[ "$environment" == stage ]]; then export APP_BIND_PORT=18084; else export APP_BIND_PORT=18083; fi
  for MODE in plugin standalone; do
    export MODE
    : > "$CALL_LOG"
    bash "$script_dir/deploy-frontend.sh" > "$test_dir/output"
    prefix="--project-name $PROJECT_NAME --env-file .deploy.env -f docker-compose.prod.yml"
    grep -Fxq -- "$prefix config --quiet" "$CALL_LOG"
    grep -Fxq -- "$prefix pull" "$CALL_LOG"
    grep -Fxq -- "$prefix up -d --force-recreate --wait --wait-timeout 120 web" "$CALL_LOG"
    grep -Fxq -- "$prefix ps" "$CALL_LOG"
    grep -Fq "http://127.0.0.1:$APP_BIND_PORT/" "$CALL_LOG"
    grep -Fxq "APP_BIND_PORT=$APP_BIND_PORT" "$test_dir/.deploy.env"
  done
done
export MODE=old
: > "$CALL_LOG"
if bash "$script_dir/deploy-frontend.sh" > "$test_dir/output" 2>&1; then
  echo 'Expected unsupported Compose to fail' >&2
  exit 1
fi
grep -q 'must support' "$test_dir/output"
[[ ! -s "$CALL_LOG" ]]
echo 'Deployment checks passed: stage and production, plugin and standalone, unsupported version.'
