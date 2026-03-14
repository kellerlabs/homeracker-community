#!/usr/bin/env bash
#
# OpenSCAD Renderer - Core Testing Tool
#
# Renders .scad files to validate syntax and geometry.
# Supports scadm-installed OpenSCAD or system OpenSCAD.
#
# Usage:
#   ./cmd/test/openscad-render.sh                 # No-op (no default file)
#   ./cmd/test/openscad-render.sh file1.scad ...   # Test specific files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source common functions
# shellcheck source=../lib/common.sh disable=SC1091
source "${SCRIPT_DIR}/../lib/common.sh"

# Detect platform
detect_platform() {
    case "$(uname -s)" in
        Linux*|Darwin*)          echo "linux";;
        CYGWIN*|MINGW*|MSYS*)   echo "windows";;
        *)                       echo "unknown";;
    esac
}

PLATFORM=$(detect_platform)

# Test a single model file
test_model() {
    local model_file="$1"
    local openscad_exe="$2"
    local libraries_dir="$3"
    local output_file
    output_file="/tmp/$(basename "${model_file}" .scad)-test.stl"

    log_info "Testing: ${model_file}"

    if [[ ! -f "${model_file}" ]]; then
        log_error "Model file not found: ${model_file}"
        return 1
    fi

    rm -f "${output_file}"

    local render_success
    local openscad_cmd=("${openscad_exe}" -o "${output_file}" "${model_file}" --export-format=binstl)

    # Set OPENSCADPATH if libraries exist
    if [[ -n "${libraries_dir}" && -d "${libraries_dir}" ]]; then
        openscad_cmd=(env "OPENSCADPATH=${libraries_dir}" "${openscad_cmd[@]}")
    fi

    # Use xvfb-run on Linux if available (needed for headless rendering in CI)
    if [[ "${PLATFORM}" == "linux" ]] && command -v xvfb-run &> /dev/null; then
        if xvfb-run -a "${openscad_cmd[@]}" 2>&1 | tee /tmp/openscad-test.log; then
            render_success=true
        else
            render_success=false
        fi
    else
        if "${openscad_cmd[@]}" 2>&1 | tee /tmp/openscad-test.log; then
            render_success=true
        else
            render_success=false
        fi
    fi

    if [[ "${render_success}" == true ]]; then
        if [[ -f "${output_file}" ]]; then
            local file_size
            file_size=$(stat -c%s "${output_file}" 2>/dev/null || stat -f%z "${output_file}" 2>/dev/null)
            log_success "Test passed! Generated STL: ${file_size} bytes"
            rm -f "${output_file}" /tmp/openscad-test.log
            return 0
        else
            log_error "Test failed: No output file generated"
            cat /tmp/openscad-test.log
            return 1
        fi
    else
        log_error "Test failed: OpenSCAD rendering error"
        cat /tmp/openscad-test.log
        return 1
    fi
}

main() {
    local openscad_exe
    local libraries_dir=""

    log_info "Running OpenSCAD tests..."

    if ! openscad_exe=$(find_openscad "${WORKSPACE_ROOT}"); then
        exit 1
    fi

    libraries_dir=$(find_libraries_dir "${WORKSPACE_ROOT}" 2>/dev/null || echo "")

    local openscad_version
    openscad_version=$("${openscad_exe}" --version 2>&1 | awk '/OpenSCAD version/ {print $3}')
    log_info "Using OpenSCAD version: ${openscad_version}"
    if [[ -n "${libraries_dir}" ]]; then
        log_info "Using libraries from: ${libraries_dir}"
    fi

    local test_files=()
    if [[ $# -gt 0 ]]; then
        test_files=("$@")
    else
        log_info "No files specified"
        exit 0
    fi

    local failed=0
    for file in "${test_files[@]}"; do
        if ! test_model "${file}" "${openscad_exe}" "${libraries_dir}"; then
            failed=$((failed + 1))
        fi
        echo ""
    done

    if [[ ${failed} -gt 0 ]]; then
        log_error "${failed} test(s) failed"
        exit 1
    else
        log_success "All tests passed!"
    fi
}

main "$@"
