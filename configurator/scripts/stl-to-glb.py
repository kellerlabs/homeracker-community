#!/usr/bin/env python3
"""Convert 3D model files to GLB (glTF binary) with category-based material colors.

Supports STL, 3MF, OBJ, PLY, OFF, and other trimesh-compatible formats.

Usage:
  stl-to-glb.py <input> <output.glb> [category]           # single GLB
  stl-to-glb.py --split <input> <output-prefix> [category] # one GLB per geometry
"""

import json
import os
import sys
import trimesh
import numpy as np

# Part category colors (matching PART_COLORS in constants.ts)
CATEGORY_COLORS = {
    "supports": [0.969, 0.714, 0.0, 1.0],    # #f7b600 (HR_YELLOW)
    "connectors": [0.0, 0.337, 0.702, 1.0],   # #0056b3 (HR_BLUE)
    "lockpins": [0.769, 0.118, 0.227, 1.0],   # #c41e3a (HR_RED)
    "other": [0.290, 0.620, 0.290, 1.0],      # #4a9e4a (HR_GREEN)
}


def _apply_color(mesh, category: str):
    """Apply category color to a mesh."""
    color = CATEGORY_COLORS.get(category, [0.5, 0.5, 0.5, 1.0])
    color_rgba = (np.array(color) * 255).astype(np.uint8)
    mesh.visual = trimesh.visual.ColorVisuals(
        mesh=mesh,
        face_colors=np.tile(color_rgba, (len(mesh.faces), 1))
    )


def convert(input_path: str, glb_path: str, category: str = "supports"):
    """Convert an entire model file to a single GLB."""
    mesh = trimesh.load(input_path)

    if isinstance(mesh, trimesh.Scene):
        for geometry in mesh.geometry.values():
            _apply_color(geometry, category)
    else:
        _apply_color(mesh, category)

    mesh.export(glb_path, file_type="glb")


def split_convert(input_path: str, output_prefix: str, category: str = "supports"):
    """Split a multi-geometry file into individual GLBs.

    Prints a JSON array of {"index": i, "name": name, "file": filename} to stdout.
    """
    mesh = trimesh.load(input_path)
    results = []

    if isinstance(mesh, trimesh.Scene) and len(mesh.geometry) > 1:
        for i, (name, geometry) in enumerate(mesh.geometry.items(), start=1):
            _apply_color(geometry, category)
            filename = f"{output_prefix}-{i}.glb"
            geometry.export(filename, file_type="glb")
            results.append({
                "index": i,
                "name": name,
                "file": os.path.basename(filename),
            })
    else:
        # Single geometry — export as one file
        if isinstance(mesh, trimesh.Scene):
            for geometry in mesh.geometry.values():
                _apply_color(geometry, category)
        else:
            _apply_color(mesh, category)
        filename = f"{output_prefix}.glb"
        mesh.export(filename, file_type="glb")
        results.append({
            "index": 1,
            "name": os.path.basename(input_path),
            "file": os.path.basename(filename),
        })

    print(json.dumps(results))


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--split":
        if len(sys.argv) < 4:
            print(f"Usage: {sys.argv[0]} --split <input> <output-prefix> [category]", file=sys.stderr)
            sys.exit(1)
        input_path = sys.argv[2]
        output_prefix = sys.argv[3]
        category = sys.argv[4] if len(sys.argv) > 4 else "supports"
        split_convert(input_path, output_prefix, category)
    else:
        if len(sys.argv) < 3:
            print(f"Usage: {sys.argv[0]} <input> <output.glb> [category]", file=sys.stderr)
            sys.exit(1)
        input_path = sys.argv[1]
        glb_path = sys.argv[2]
        category = sys.argv[3] if len(sys.argv) > 3 else "supports"
        convert(input_path, glb_path, category)
