#!/usr/bin/env bash
# Export community models for MakerWorld
#
# Processes configured model paths, exports each via export_makerworld.py,
# then validates exports with test-models.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Configurable array of paths to export
# Can contain:
#   - Directories: auto-discover all .scad files
#   - Files: export specific .scad file
EXPORT_PATHS=(
    "models/temp_locking_pin/temp_pin.scad"
    "models/patch_panel/patch_panel.scad"
    "models/blank_panel/blank_panel.scad"
    "models/rackmount_ears/rackmount_ears_homeracker.scad"
)

if [ ${#EXPORT_PATHS[@]} -eq 0 ]; then
    echo "No export paths configured yet."
    exit 0
fi

echo "Exporting community models for MakerWorld..."

# Collect all files to export
FILES_TO_EXPORT=()

for path in "${EXPORT_PATHS[@]}"; do
    full_path="${PROJECT_ROOT}/${path}"

    if [ -d "$full_path" ]; then
        while IFS= read -r -d '' scad_file; do
            FILES_TO_EXPORT+=("$scad_file")
        done < <(find "$full_path" -maxdepth 1 -name "*.scad" -type f -print0)
    elif [ -f "$full_path" ]; then
        FILES_TO_EXPORT+=("$full_path")
    else
        echo "ERROR: Path not found: $path"
        exit 1
    fi
done

if [ ${#FILES_TO_EXPORT[@]} -eq 0 ]; then
    echo "ERROR: No files found to export"
    exit 1
fi

echo "Found ${#FILES_TO_EXPORT[@]} model(s) to export"

FAILED=0
for file in "${FILES_TO_EXPORT[@]}"; do
    echo "Exporting: $file"
    if ! python3 "${SCRIPT_DIR}/export_makerworld.py" "$file"; then
        echo "ERROR: Export failed for $file"
        FAILED=1
    fi
done

if [ $FAILED -eq 1 ]; then
    echo "ERROR: One or more exports failed"
    exit 1
fi

echo ""
echo "Rendering preview images..."
if ! "${SCRIPT_DIR}/render-previews.sh" "${FILES_TO_EXPORT[@]}"; then
    echo ""
    echo "ERROR: Preview rendering failed"
    exit 1
fi

echo ""
echo "Validating exported models..."
if ! "${PROJECT_ROOT}/cmd/test/test-models.sh"; then
    echo ""
    echo "ERROR: Validation failed"
    echo ""
    echo "To run tests manually:"
    echo "  ./cmd/test/test-models.sh"
    exit 1
fi

echo ""
echo "All exports completed and validated successfully"
