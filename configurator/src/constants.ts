// HomeRacker grid constants — mirrored from models/core/lib/constants.scad

/** Base unit for all measurements in mm */
export const BASE_UNIT = 15;

/** Wall thickness in mm */
export const BASE_STRENGTH = 2;

/** Chamfer size in mm */
export const BASE_CHAMFER = 1;

/** Fitting tolerance between mating parts in mm */
export const TOLERANCE = 0.2;

/** Square lock pin hole side length in mm */
export const LOCKPIN_SIDE = 4;

/** Lock pin hole chamfer in mm */
export const LOCKPIN_CHAMFER = 0.8;

/** Connector outer side length (BASE_UNIT + 2*BASE_STRENGTH + TOLERANCE) */
export const CONNECTOR_OUTER = BASE_UNIT + BASE_STRENGTH * 2 + TOLERANCE;

/** Standard rackmount unit height (1U = 44.45mm) */
export const RACK_UNIT_HEIGHT = 44.45;

// Grid configurator settings
/** Number of grid cells visible in each direction from origin */
export const GRID_EXTENT = 20;

/** Grid line color */
export const GRID_COLOR = "#444444";

/** Grid line color for major lines (every 5 units) */
export const GRID_MAJOR_COLOR = "#666666";

// Part colors for the 3D viewer
export const PART_COLORS = {
  support: "#f7b600",    // HR_YELLOW
  connector: "#2196f3",  // HR_BLUE (brightened for dark UI contrast)
  lockpin: "#c41e3a",    // HR_RED
  ghost_valid: "#44ff44",
  ghost_invalid: "#ff4444",
  ghost_snapped: "#00ffcc",
  selected: "#00aaff",
  other: "#4a9e4a",      // HR_GREEN (misc/other parts)
  custom: "#6b3a7d",
  collision: "#ff0000",
} as const;
