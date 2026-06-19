#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

image_name="${IMAGE_NAME:-floor2plan-smoke-tests}"
target_url=""
target_urls=""
use_edge_profile=0
if [[ "$(uname -s)" == "Darwin" ]]; then
  edge_user_data_dir="${HOME}/Library/Application Support/Microsoft Edge"
else
  edge_user_data_dir="${HOME}/.config/microsoft-edge"
fi
edge_profile_directory="Default"
rebuild=0

usage() {
  cat <<'EOF'
Run the Floor2Plan smoke test through Podman.

Usage:
  ./run-smoke-podman.sh [options]

Options:
  --target-url URL              Run against one login URL.
  --target-urls URLS            Run against comma-separated login URLs.
  --use-edge-profile            Reuse an existing Microsoft Edge SSO profile.
  --edge-user-data-dir DIR      Host Edge user-data directory.
  --edge-profile DIRECTORY      Edge profile directory. Defaults to Default.
  --image NAME                  Container image name. Defaults to floor2plan-smoke-tests.
  --rebuild                     Rebuild the image before running.
  -h, --help                    Show this help.

TARGET_URL, TARGET_URLS, SMOKE_* settings, CYPRESS_VIEWPORT_WIDTH,
CYPRESS_VIEWPORT_HEIGHT, and CYPRESS_PAGE_LOAD_TIMEOUT are forwarded when set.
EOF
}

while (($#)); do
  case "$1" in
    --target-url)
      target_url="${2:?Missing value for --target-url}"
      shift 2
      ;;
    --target-urls)
      target_urls="${2:?Missing value for --target-urls}"
      shift 2
      ;;
    --use-edge-profile)
      use_edge_profile=1
      shift
      ;;
    --edge-user-data-dir)
      edge_user_data_dir="${2:?Missing value for --edge-user-data-dir}"
      shift 2
      ;;
    --edge-profile)
      edge_profile_directory="${2:?Missing value for --edge-profile}"
      shift 2
      ;;
    --image)
      image_name="${2:?Missing value for --image}"
      shift 2
      ;;
    --rebuild)
      rebuild=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is required but was not found on PATH." >&2
  exit 127
fi

if [[ "$rebuild" == "1" ]] || ! podman image exists "$image_name" >/dev/null 2>&1; then
  podman build -t "$image_name" "$script_dir"
fi

run_args=(run --rm)

forward_env() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    run_args+=(-e "${name}=${!name}")
  fi
}

for name in \
  SMOKE_LOGIN_MODE \
  SMOKE_SERVICE_USERNAME \
  SMOKE_SERVICE_PASSWORD \
  SMOKE_SERVICE_USERNAME_SELECTOR \
  SMOKE_SERVICE_PASSWORD_SELECTOR \
  SMOKE_SERVICE_SUBMIT_SELECTOR \
  SMOKE_HOME_TILE_SELECTOR \
  SMOKE_MIN_HOME_TILES \
  SMOKE_TILE_CLICK_LIMIT \
  SMOKE_MENU_CLICK_LIMIT \
  SMOKE_MENU_BUTTON_SELECTOR \
  SMOKE_MENU_ITEM_SELECTOR \
  SMOKE_FAIL_ON_CONSOLE_ERROR \
  SMOKE_VISUAL_SETTLE_MS \
  CYPRESS_VIEWPORT_WIDTH \
  CYPRESS_VIEWPORT_HEIGHT \
  CYPRESS_PAGE_LOAD_TIMEOUT; do
  forward_env "$name"
done

if [[ -n "$target_urls" ]]; then
  run_args+=(-e "TARGET_URLS=${target_urls}")
elif [[ -n "$target_url" ]]; then
  run_args+=(-e "TARGET_URL=${target_url}")
else
  forward_env TARGET_URLS
  forward_env TARGET_URL
fi

container_command=(--browser edge --headed --spec cypress/e2e/login_smoke.cy.js)

if [[ "$use_edge_profile" == "1" ]]; then
  if [[ ! -d "$edge_user_data_dir" ]]; then
    echo "Edge user-data directory not found: $edge_user_data_dir" >&2
    exit 1
  fi

  echo "Close Microsoft Edge before reusing this profile: $edge_user_data_dir" >&2
  run_args+=(
    -e "CYPRESS_EDGE_USER_DATA_DIR=/edge-profile"
    -e "CYPRESS_EDGE_PROFILE_DIRECTORY=${edge_profile_directory}"
    -v "${edge_user_data_dir}:/edge-profile"
  )
fi

podman "${run_args[@]}" "$image_name" "${container_command[@]}"
