#!/usr/bin/env bash
#
# Generate GLB models from OpenSCAD sources for the web configurator.
#
# Prerequisites:
#   - OpenSCAD installed (via scadm in the homeracker repo)
#   - Python 3 with trimesh: pip install trimesh numpy
#
# Usage:
#   ./scripts/generate-models.sh [path-to-homeracker-repo]
#
# Environment:
#   MAX_JOBS=N   Override parallelism (default: nproc)
#
# The homeracker repo path defaults to ../homeracker (sibling directory).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOMERACKER_REPO="${1:-$(cd "${PROJECT_ROOT}/../homeracker" && pwd)}"

OPENSCAD="${HOMERACKER_REPO}/bin/openscad/openscad"
OPENSCADPATH="${HOMERACKER_REPO}/bin/openscad/libraries"
MANIFEST="${PROJECT_ROOT}/src/data/model-manifest.json"
STL_DIR="${PROJECT_ROOT}/tmp-stl"
GLB_DIR="${PROJECT_ROOT}/public/models"

MAX_JOBS="${MAX_JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
if [[ ! -f "${OPENSCAD}" ]]; then
    log_error "OpenSCAD not found at ${OPENSCAD}"
    log_info "Run 'scadm install' in the homeracker repo first."
    exit 1
fi

if ! python3 -c "import trimesh" 2>/dev/null; then
    log_error "Python trimesh not found. Install with: pip install trimesh numpy"
    exit 1
fi

if ! command -v jq &>/dev/null; then
    log_error "jq not found. Install with: apt install jq"
    exit 1
fi

# Create output directories
mkdir -p "${STL_DIR}" "${GLB_DIR}"

# Determine if we need xvfb-run (headless Linux)
OPENSCAD_CMD="${OPENSCAD}"
if [[ "$(uname -s)" == "Linux" ]] && command -v xvfb-run &>/dev/null; then
    OPENSCAD_CMD="xvfb-run -a ${OPENSCAD}"
fi

# Results tracking via temp directory (background jobs can't modify parent vars)
RESULTS_DIR=$(mktemp -d)
trap 'rm -rf "${RESULTS_DIR}" "${STL_DIR}"' EXIT

# ---------------------------------------------------------------------------
# Render a single OpenSCAD item to STL then GLB
# Args: id scad_file category d_args...
# ---------------------------------------------------------------------------
render_scad_item() {
    local id="$1" scad_file="$2" category="$3"
    shift 3
    local d_args="$*"
    local stl_file="${STL_DIR}/${id}.stl"
    local glb_file="${GLB_DIR}/${id}.glb"
    local log_file="${RESULTS_DIR}/log-${id}.txt"

    if eval OPENSCADPATH="${OPENSCADPATH}" "${OPENSCAD_CMD}" \
        -o "${stl_file}" \
        "${d_args}" \
        "${scad_file}" \
        --export-format=binstl 2>"${log_file}"; then

        if [[ -f "${stl_file}" ]]; then
            if python3 "${SCRIPT_DIR}/stl-to-glb.py" "${stl_file}" "${glb_file}" "${category}" 2>>"${log_file}"; then
                if [[ -f "${glb_file}" ]]; then
                    local file_size
                    file_size=$(stat -c%s "${glb_file}" 2>/dev/null || stat -f%z "${glb_file}" 2>/dev/null)
                    log_success "${id}.glb (${file_size} bytes)"
                    touch "${RESULTS_DIR}/ok-${id}"
                    return 0
                fi
            fi
            log_error "GLB conversion failed for ${id}"
        else
            log_error "No STL output for ${id}"
        fi
    else
        log_error "OpenSCAD render failed for ${id}"
    fi

    [[ -f "${log_file}" && -s "${log_file}" ]] && cat "${log_file}" >&2
    touch "${RESULTS_DIR}/fail-${id}"
    return 0  # Don't let set -e kill the parent
}

# ---------------------------------------------------------------------------
# Job scheduling: run up to MAX_JOBS background processes
# ---------------------------------------------------------------------------
running_pids=()

wait_for_slot() {
    while [[ ${#running_pids[@]} -ge ${MAX_JOBS} ]]; do
        wait -n 2>/dev/null || true
        # Rebuild list of still-running PIDs
        local new_pids=()
        for pid in "${running_pids[@]}"; do
            if kill -0 "$pid" 2>/dev/null; then
                new_pids+=("$pid")
            fi
        done
        running_pids=("${new_pids[@]}")
    done
}

# ---------------------------------------------------------------------------
# Phase 1: OpenSCAD renders (parallelized)
# ---------------------------------------------------------------------------
total_items=0
for category in supports connectors lockpins; do
    total_items=$((total_items + $(jq ".${category} | length" "${MANIFEST}")))
done

log_info "Rendering ${total_items} OpenSCAD models (up to ${MAX_JOBS} parallel jobs)..."

for category in supports connectors lockpins; do
    items=$(jq -r ".${category}[] | @base64" "${MANIFEST}")

    for item_b64 in ${items}; do
        item=$(echo "${item_b64}" | base64 --decode)
        id=$(echo "${item}" | jq -r '.id')
        scad_file="${HOMERACKER_REPO}/$(echo "${item}" | jq -r '.scad')"

        # Build -D parameter string
        params_json=$(echo "${item}" | jq -c '.params')
        d_args=""
        for key in $(echo "${params_json}" | jq -r 'keys[]'); do
            value=$(echo "${params_json}" | jq -r ".${key}")
            if echo "${params_json}" | jq -e ".${key} | type == \"string\"" >/dev/null 2>&1; then
                d_args="${d_args} -D ${key}=\"${value}\""
            else
                d_args="${d_args} -D ${key}=${value}"
            fi
        done

        wait_for_slot
        render_scad_item "${id}" "${scad_file}" "${category}" "${d_args}" &
        running_pids+=($!)
    done
done

# Wait for all remaining OpenSCAD jobs
wait
running_pids=()

# Count OpenSCAD results
render_count=$(find "${RESULTS_DIR}" -name 'ok-*' 2>/dev/null | wc -l)
fail_count=$(find "${RESULTS_DIR}" -name 'fail-*' 2>/dev/null | wc -l)

log_info "OpenSCAD phase done: ${render_count} succeeded, ${fail_count} failed"

# ---------------------------------------------------------------------------
# Phase 2: Convert raw models (STL, 3MF, OBJ, etc.) from raw-models/
# Multi-geometry files (e.g. 3MF) are split into individual GLBs, grouped
# under the source filename in the manifest.
# ---------------------------------------------------------------------------
RAW_MODELS_DIR="${PROJECT_ROOT}/raw-models"
RAW_MANIFEST="${PROJECT_ROOT}/src/data/raw-models-manifest.json"

# ---------------------------------------------------------------------------
# Convert a single raw model file, write manifest JSON to RESULTS_DIR
# Args: raw_file
# ---------------------------------------------------------------------------
convert_raw_model() {
    local raw_file="$1"
    local filename
    filename=$(basename "${raw_file}")
    local name_no_ext="${filename%.*}"
    local display_name
    display_name=$(echo "${name_no_ext}" | sed 's/+-+/ - /g; s/+/ /g; s/  */ /g; s/^ //; s/ $//')
    local id_base
    id_base="other-$(echo "${name_no_ext}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//')"
    local log_file="${RESULTS_DIR}/rawlog-${id_base}.txt"

    local split_json
    if ! split_json=$(python3 "${SCRIPT_DIR}/stl-to-glb.py" --split "${raw_file}" "${GLB_DIR}/${id_base}" "other" 2>"${log_file}"); then
        log_error "Failed to convert ${filename}"
        [[ -f "${log_file}" && -s "${log_file}" ]] && cat "${log_file}" >&2
        touch "${RESULTS_DIR}/fail-raw-${id_base}"
        return 0
    fi

    local num_parts
    num_parts=$(echo "${split_json}" | jq 'length')

    if [[ "${num_parts}" -le 0 ]]; then
        log_error "No geometries found in ${filename}"
        touch "${RESULTS_DIR}/fail-raw-${id_base}"
        return 0
    fi

    # Write per-part manifest entries and track results
    for idx in $(seq 0 $((num_parts - 1))); do
        local part_file part_index part_id full_path
        part_file=$(echo "${split_json}" | jq -r ".[$idx].file")
        part_index=$(echo "${split_json}" | jq -r ".[$idx].index")
        part_id="${id_base}-${part_index}"
        full_path="${GLB_DIR}/${part_file}"

        if [[ -f "${full_path}" ]]; then
            local file_size
            file_size=$(stat -c%s "${full_path}" 2>/dev/null || stat -f%z "${full_path}" 2>/dev/null)
            log_success "${part_file} (${file_size} bytes)"
            touch "${RESULTS_DIR}/ok-raw-${part_id}"

            # Write manifest entry to a temp file for collection
            if [[ "${num_parts}" -gt 1 ]]; then
                echo "{\"id\":\"${part_id}\",\"name\":\"${display_name} - Part ${part_index}\",\"file\":\"${part_file}\",\"group\":\"${display_name}\"}" \
                    > "${RESULTS_DIR}/manifest-${part_id}.json"
            else
                echo "{\"id\":\"${part_id}\",\"name\":\"${display_name}\",\"file\":\"${part_file}\"}" \
                    > "${RESULTS_DIR}/manifest-${part_id}.json"
            fi
        else
            log_error "Expected output ${part_file} not found"
            touch "${RESULTS_DIR}/fail-raw-${part_id}"
        fi
    done
    return 0
}

if [[ -d "${RAW_MODELS_DIR}" ]]; then
    log_info "Processing raw models from ${RAW_MODELS_DIR} (up to ${MAX_JOBS} parallel jobs)..."

    for raw_file in "${RAW_MODELS_DIR}"/*.{stl,STL,3mf,3MF,obj,OBJ,ply,PLY,off,OFF}; do
        [[ -f "${raw_file}" ]] || continue

        wait_for_slot
        convert_raw_model "${raw_file}" &
        running_pids+=($!)
    done

    # Wait for all raw model jobs
    wait
    running_pids=()

    # Collect manifest entries from temp files (sorted for deterministic output)
    manifest_entries=()
    for mf in $(find "${RESULTS_DIR}" -name 'manifest-*.json' 2>/dev/null | sort); do
        manifest_entries+=("$(cat "${mf}")")
    done

    # Write manifest JSON
    if [[ ${#manifest_entries[@]} -gt 0 ]]; then
        printf "[\n" > "${RAW_MANIFEST}"
        for i in "${!manifest_entries[@]}"; do
            if [[ $i -lt $((${#manifest_entries[@]} - 1)) ]]; then
                printf "  %s,\n" "${manifest_entries[$i]}" >> "${RAW_MANIFEST}"
            else
                printf "  %s\n" "${manifest_entries[$i]}" >> "${RAW_MANIFEST}"
            fi
        done
        printf "]\n" >> "${RAW_MANIFEST}"
        log_success "Raw models manifest: ${RAW_MANIFEST} (${#manifest_entries[@]} entries)"
    else
        printf "[]\n" > "${RAW_MANIFEST}"
    fi

    # Count raw model results
    raw_ok=$(find "${RESULTS_DIR}" -name 'ok-raw-*' 2>/dev/null | wc -l)
    raw_fail=$(find "${RESULTS_DIR}" -name 'fail-raw-*' 2>/dev/null | wc -l)
    render_count=$((render_count + raw_ok))
    fail_count=$((fail_count + raw_fail))

    if [[ ${raw_ok} -gt 0 ]]; then
        log_success "${raw_ok} raw model(s) converted"
    fi
else
    # No raw-models directory — write empty manifest
    printf "[]\n" > "${RAW_MANIFEST}"
fi

echo ""
if [[ ${fail_count} -gt 0 ]]; then
    log_error "${fail_count} model(s) failed, ${render_count} succeeded"
    exit 1
else
    log_success "All ${render_count} models generated successfully in ${GLB_DIR}/"
fi
