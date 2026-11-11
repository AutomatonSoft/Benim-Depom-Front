#!/usr/bin/env bash
set -Eeuo pipefail

: "${DEPLOY_DIR:?}" "${PROJECT_NAME:?}" "${IMAGE_TAG:?}" "${APP_BIND_PORT:?}" "${BACKEND_URL:?}"
cd "$DEPLOY_DIR"

compose_command=()
if docker compose version >/dev/null 2>&1; then
  compose_command=(docker compose)
else
  for candidate in docker-compose /usr/libexec/docker/cli-plugins/docker-compose /usr/lib/docker/cli-plugins/docker-compose; do
    if "$candidate" version >/dev/null 2>&1; then
      compose_command=("$candidate")
      break
    fi
  done
fi
if ((${#compose_command[@]} == 0)); then
  echo 'Docker Compose is unavailable for the deployment user.' >&2
  exit 1
fi
echo "Using Compose: ${compose_command[*]}"
"${compose_command[@]}" version
# Check required flags before changing the running service.
if ! "${compose_command[@]}" up --help | grep -q -- '--wait-timeout'; then
  echo 'Docker Compose must support up --wait and --wait-timeout. Update Compose on this server.' >&2
  exit 1
fi

printf 'IMAGE_TAG=%s\nAPP_BIND_PORT=%s\nBACKEND_URL=%s\n' "$IMAGE_TAG" "$APP_BIND_PORT" "$BACKEND_URL" > .deploy.env.tmp
chmod 600 .deploy.env.tmp
mv .deploy.env.tmp .deploy.env

compose() {
  "${compose_command[@]}" --project-name "$PROJECT_NAME" --env-file .deploy.env -f docker-compose.prod.yml "$@"
}

compose config --quiet
compose pull
compose up -d --force-recreate --wait --wait-timeout 120 web
curl --fail --silent --show-error "http://127.0.0.1:${APP_BIND_PORT}/"
compose ps
