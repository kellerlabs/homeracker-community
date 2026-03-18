import type { Direction } from "../types";

/**
 * Connector arm configuration lookup table.
 * Mirrored from models/core/lib/connector.scad CONNECTOR_CONFIGS.
 *
 * Arms array format: [+z, -z, +x, -x, +y, -y] (matching OpenSCAD source).
 * GLB models preserve OpenSCAD coordinates (trimesh does not swap axes),
 * so the DIRECTION_MAP is an identity mapping — no Z↔Y conversion needed.
 */

interface ConnectorConfig {
  dimensions: number;
  directions: number;
  /** Arms active: [+z, -z, +x, -x, +y, -y] (matches OpenSCAD and GLB coords) */
  arms: [boolean, boolean, boolean, boolean, boolean, boolean];
}

export const CONNECTOR_CONFIGS: Record<string, ConnectorConfig> = {
  // 1D configurations (Z-axis only — vertical in OpenSCAD, depth in Three.js)
  "1d1w": { dimensions: 1, directions: 1, arms: [true, false, false, false, false, false] },
  "1d2w": { dimensions: 1, directions: 2, arms: [true, true, false, false, false, false] },

  // 2D configurations (Z + X axes — flat on XZ ground plane)
  "2d2w": { dimensions: 2, directions: 2, arms: [true, false, true, false, false, false] },
  "2d3w": { dimensions: 2, directions: 3, arms: [true, true, true, false, false, false] },
  "2d4w": { dimensions: 2, directions: 4, arms: [true, true, true, true, false, false] },

  // 3D configurations (all three axes)
  "3d3w": { dimensions: 3, directions: 3, arms: [true, false, true, false, true, false] },
  "3d4w": { dimensions: 3, directions: 4, arms: [true, true, true, false, true, false] },
  "3d5w": { dimensions: 3, directions: 5, arms: [true, true, true, true, true, false] },
  "3d6w": { dimensions: 3, directions: 6, arms: [true, true, true, true, true, true] },
};

// Identity mapping: arms array index → direction (no axis conversion needed)
const DIRECTION_MAP: Direction[] = ["+z", "-z", "+x", "-x", "+y", "-y"];

/** Get active arm directions for a connector config */
export function getArmDirections(configId: string): Direction[] {
  const config = CONNECTOR_CONFIGS[configId];
  if (!config) return [];
  return config.arms
    .map((active, i) => (active ? DIRECTION_MAP[i] : null))
    .filter((d): d is Direction => d !== null);
}
