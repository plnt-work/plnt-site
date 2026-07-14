#!/usr/bin/env bash
# deploy/do-playground.sh
#
# Create the plnt-playground app on DigitalOcean App Platform via doctl.
# Reads secrets from env — never from disk, never from git.
#
# Usage:
#   export DIGITALOCEAN_TOKEN=dop_v1_...
#   export UPSTREAM_API_KEY=sk-...            # OpenAI or OpenAI-compat provider key
#   # Optional (defaults shown):
#   #   export UPSTREAM_URL=https://api.openai.com
#   #   export UPSTREAM_MODEL=gpt-4o-mini
#   #   export DO_REGION=nyc
#   #   export APP_NAME=plnt-playground
#   ./deploy/do-playground.sh
#
# Prereqs: doctl >= 1.100 (brew install doctl)

set -euo pipefail

: "${DIGITALOCEAN_TOKEN:?export DIGITALOCEAN_TOKEN first (create at https://cloud.digitalocean.com/account/api/tokens)}"
: "${UPSTREAM_API_KEY:?export UPSTREAM_API_KEY first (OpenAI-compatible provider key)}"

UPSTREAM_URL="${UPSTREAM_URL:-https://api.openai.com}"
UPSTREAM_MODEL="${UPSTREAM_MODEL:-gpt-4o-mini}"
DO_REGION="${DO_REGION:-nyc}"
APP_NAME="${APP_NAME:-plnt-playground}"
REPO="plnt-work/plnt"
BRANCH="main"

command -v doctl >/dev/null 2>&1 || {
  echo "error: doctl not on PATH — install with 'brew install doctl'"
  exit 1
}

# Auth. doctl reads DIGITALOCEAN_ACCESS_TOKEN (not DIGITALOCEAN_TOKEN) for non-interactive auth.
export DIGITALOCEAN_ACCESS_TOKEN="$DIGITALOCEAN_TOKEN"

echo "==> verifying doctl auth"
doctl account get --format Email,Status --no-header || {
  echo "error: doctl auth failed. Check DIGITALOCEAN_TOKEN scope."
  exit 1
}

# Build the workflow registry JSON (all four workflows proxied to the upstream).
MODELS_JSON=$(cat <<JSON
[
  {"id":"review-responder","backend":"http","runtime":"microagent","upstream_url":"${UPSTREAM_URL}","upstream_model":"${UPSTREAM_MODEL}","api_key_env":"UPSTREAM_API_KEY"},
  {"id":"post-generator","backend":"http","runtime":"microagent","upstream_url":"${UPSTREAM_URL}","upstream_model":"${UPSTREAM_MODEL}","api_key_env":"UPSTREAM_API_KEY"},
  {"id":"booking-triage","backend":"http","runtime":"microagent","upstream_url":"${UPSTREAM_URL}","upstream_model":"${UPSTREAM_MODEL}","api_key_env":"UPSTREAM_API_KEY"},
  {"id":"competitor-monitor","backend":"http","runtime":"microagent","upstream_url":"${UPSTREAM_URL}","upstream_model":"${UPSTREAM_MODEL}","api_key_env":"UPSTREAM_API_KEY"}
]
JSON
)

SPEC_FILE=$(mktemp -t plnt-playground-spec.XXXXXX.yaml)
trap 'rm -f "$SPEC_FILE"' EXIT

cat > "$SPEC_FILE" <<YAML
name: ${APP_NAME}
region: ${DO_REGION}
services:
  - name: api
    dockerfile_path: docker/playground-api.Dockerfile
    source_dir: /
    github:
      repo: ${REPO}
      branch: ${BRANCH}
      deploy_on_push: true
    http_port: 8080
    instance_size_slug: basic-xxs
    instance_count: 1
    health_check:
      http_path: /healthz
      initial_delay_seconds: 10
      period_seconds: 15
    envs:
      - key: UPSTREAM_API_KEY
        scope: RUN_TIME
        type: SECRET
        value: "${UPSTREAM_API_KEY}"
      - key: PLNT_PLAYGROUND_MODELS
        scope: RUN_TIME
        type: SECRET
        value: '${MODELS_JSON}'
      - key: PLNT_PLAYGROUND_CORS_ORIGINS
        scope: RUN_TIME
        value: "https://plnt.work,https://www.plnt.work,https://play.plnt.work,https://playground.plnt.work"
YAML

echo "==> creating app '${APP_NAME}' in region '${DO_REGION}'"
APP_ID=$(doctl apps create --spec "$SPEC_FILE" --format ID --no-header)
echo "    app id: ${APP_ID}"

echo "==> polling until deployment is ACTIVE (up to ~8 min)"
for i in $(seq 1 48); do
  PHASE=$(doctl apps get "$APP_ID" --format ActiveDeployment.Phase --no-header 2>/dev/null | tr -d '[:space:]' || true)
  URL=$(doctl apps get "$APP_ID" --format DefaultIngress --no-header 2>/dev/null | tr -d '[:space:]' || true)
  printf "    [%02d/48] phase=%s\n" "$i" "${PHASE:-UNKNOWN}"
  if [ "$PHASE" = "ACTIVE" ]; then
    echo ""
    echo "✓ deploy complete"
    echo "  app id:   ${APP_ID}"
    echo "  live url: ${URL}"
    echo ""
    echo "==> smoke test"
    if curl -sf --max-time 8 "${URL}/v1/models" | head -c 400; then
      echo ""
      echo "✓ /v1/models responded"
    else
      echo "! /v1/models did not respond yet — check 'doctl apps logs ${APP_ID}'"
    fi
    echo ""
    echo "==> next: attach playground.plnt.work"
    echo "  1. doctl apps update ${APP_ID} --spec deploy/do-playground.spec.attached.yaml   # (see below)"
    echo "  2. add CNAME  playground.plnt.work  →  ${URL#https://}"
    echo "  3. verify:  curl -sI https://playground.plnt.work/v1/models"
    exit 0
  fi
  if [ "$PHASE" = "ERROR" ] || [ "$PHASE" = "CANCELED" ] || [ "$PHASE" = "FAILED" ]; then
    echo ""
    echo "✗ deploy failed with phase=${PHASE}"
    echo "  build logs: doctl apps logs ${APP_ID} --type build"
    echo "  deploy logs: doctl apps logs ${APP_ID} --type deploy"
    exit 1
  fi
  sleep 10
done

echo ""
echo "! deploy still building after 8 minutes. Check status manually:"
echo "  doctl apps get ${APP_ID}"
echo "  doctl apps logs ${APP_ID} --type build --follow"
exit 1
