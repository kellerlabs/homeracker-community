#!/usr/bin/env bash
# Render PNG previews of OpenSCAD models
#
# For each .scad file, renders a preview.png in the model's directory.
#
# Usage:
#   ./cmd/export/render-previews.sh file1.scad file2.scad ...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=../lib/common.sh disable=SC1091
source "${SCRIPT_DIR}/../lib/common.sh"

PLATFORM="$(uname -s)"

render_preview() {
    local scad_file="$1"
    local openscad_exe="$2"
    local libraries_dir="$3"
    local model_dir
    model_dir="$(dirname "$scad_file")"
    local output_file="${model_dir}/preview.png"

    log_info "Rendering preview: ${scad_file} -> ${output_file}"

    local openscad_cmd=(
        "${openscad_exe}"
        -o "${output_file}"
        "--imgsize=800,600"
        --viewall
        --autocenter
        "${scad_file}"
    )

    if [[ -n "${libraries_dir}" && -d "${libraries_dir}" ]]; then
        openscad_cmd=(env "OPENSCADPATH=${libraries_dir}" "${openscad_cmd[@]}")
    fi

    if [[ "${PLATFORM}" == Linux* ]] && command -v xvfb-run &> /dev/null; then
        if xvfb-run -a "${openscad_cmd[@]}" 2>&1; then
            log_success "Preview rendered: ${output_file}"
            return 0
        fi
    else
        if "${openscad_cmd[@]}" 2>&1; then
            log_success "Preview rendered: ${output_file}"
            return 0
        fi
    fi

    log_error "Preview render failed: ${scad_file}"
    return 1
}

main() {
    local openscad_exe
    local libraries_dir=""

    if ! openscad_exe=$(find_openscad "${WORKSPACE_ROOT}"); then
        exit 1
    fi

    libraries_dir=$(find_libraries_dir "${WORKSPACE_ROOT}" 2>/dev/null || echo "")

    if [[ $# -eq 0 ]]; then
        log_info "No files specified"
        exit 0
    fi

    local failed=0
    for file in "$@"; do
        if ! render_preview "${file}" "${openscad_exe}" "${libraries_dir}"; then
            failed=$((failed + 1))
        fi
    done

    if [[ ${failed} -gt 0 ]]; then
        log_error "${failed} preview(s) failed to render"
        exit 1
    fi

    log_success "All previews rendered"
}

main "$@"
