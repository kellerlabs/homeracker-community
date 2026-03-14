#!/usr/bin/env bash
#
# HomeRacker Community Common Shell Functions
#
# Shared utilities for build and test scripts.
# Usage: source "${SCRIPT_DIR}/../lib/common.sh"
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*"
}

# Find OpenSCAD executable (scadm-installed or system)
find_openscad() {
    local project_root="$1"

    # Check scadm-installed location first
    local scadm_openscad="${project_root}/bin/openscad/OpenSCAD.AppImage"
    if [[ -x "${scadm_openscad}" ]]; then
        echo "${scadm_openscad}"
        return 0
    fi
    scadm_openscad="${project_root}/bin/openscad/openscad"
    if [[ -x "${scadm_openscad}" ]]; then
        echo "${scadm_openscad}"
        return 0
    fi

    # Fall back to system OpenSCAD
    if command -v openscad &> /dev/null; then
        command -v openscad
        return 0
    fi

    log_error "OpenSCAD not found. Run 'scadm install' or install OpenSCAD manually."
    return 1
}

# Find scadm library directory
find_libraries_dir() {
    local project_root="$1"

    local scadm_libs="${project_root}/bin/openscad/libraries"
    if [[ -d "${scadm_libs}" ]]; then
        echo "${scadm_libs}"
        return 0
    fi

    return 1
}
