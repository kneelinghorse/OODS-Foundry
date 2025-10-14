#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d -t oods-release-XXXXXX)"
RUN1_DIR="${TMP_DIR}/run1"
RUN2_DIR="${TMP_DIR}/run2"
mkdir -p "${RUN1_DIR}" "${RUN2_DIR}"

PACKAGES=(
  "@oods/tokens packages/tokens"
  "@oods/tw-variants packages/tw-variants"
  "@oods/a11y-tools packages/a11y-tools"
)

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

info() {
  printf '%s\n' "$1"
}

for package in "${PACKAGES[@]}"; do
  IFS=' ' read -r package_name package_path <<<"${package}"
  info "==> Verifying ${package_name}"
  pushd "${WORKSPACE_ROOT}/${package_path}" >/dev/null

  pnpm run build >/dev/null
  NPM_CONFIG_USERCONFIG=/dev/null npm pack --pack-destination "${RUN1_DIR}" >/dev/null
  tar_one="${RUN1_DIR}/$(node -p "const pkg=require('./package.json'); const name=String(pkg.name).replace(/^@/, '').replace(/\\//g, '-'); \`\${name}-\${pkg.version}.tgz\`;")"

  pnpm run build >/dev/null
  NPM_CONFIG_USERCONFIG=/dev/null npm pack --pack-destination "${RUN2_DIR}" >/dev/null
  tar_two="${RUN2_DIR}/$(node -p "const pkg=require('./package.json'); const name=String(pkg.name).replace(/^@/, '').replace(/\\//g, '-'); \`\${name}-\${pkg.version}.tgz\`;")"

  diff <(tar -tf "${tar_one}") <(tar -tf "${tar_two}") >/dev/null
  cmp --silent "${tar_one}" "${tar_two}"

  rm -f "${tar_one}" "${tar_two}"
  popd >/dev/null
  info "✓ ${package_name} tarballs are identical"
  info ""
done

info "All packages passed reproducibility checks."
