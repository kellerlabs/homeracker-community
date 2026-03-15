#!/usr/bin/env bash
# Automated Test Suite - Community Models
#
# Discovers and tests all .scad files in:
#   - models/*/test/       - Unit tests for model components
#   - models/*/makerworld/ - Exported parametric models

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh disable=SC1091
source "${SCRIPT_DIR}/../lib/common.sh"

cd "${SCRIPT_DIR}/../.."

# Verify scadm dependencies are installed
if [ ! -d "bin/openscad/libraries" ]; then
    log_error "OpenSCAD libraries not found."
    echo ""
    echo "Run the following to install dependencies:"
    echo "  pip install scadm"
    echo "  scadm install"
    echo ""
    echo "See CONTRIBUTING.md for full setup instructions."
    exit 1
fi

MODELS=()

while IFS= read -r -d '' model; do
  MODELS+=("${model}")
done < <(find models -path "*/test/*.scad" -type f -print0 2>/dev/null || true)

while IFS= read -r -d '' model; do
  MODELS+=("${model}")
done < <(find models -path "*/makerworld/*.scad" -type f -print0 2>/dev/null || true)

if [ ${#MODELS[@]} -eq 0 ]; then
  log_info "No test models found in models/*/test/ or models/*/makerworld/ directories"
  exit 0
fi

echo "Found ${#MODELS[@]} test models to validate"

"${SCRIPT_DIR}/openscad-render.sh" "${MODELS[@]}"
