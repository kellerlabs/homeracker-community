import type { GridPosition, Axis, Direction, Rotation3, RotationStep } from "../types";
import type { AssemblyState } from "./AssemblyState";
import { getPartDefinition } from "../data/catalog";
import {
  getAdjacentPosition,
  directionToAxis,
  getWorldCells,
  rotateGridCells,
  rotateDirection,
  rotateAxis,
} from "./grid-utils";

export interface SnapCandidate {
  /** Grid position where the part origin should be placed */
  position: GridPosition;
  /** Orientation the part should have to align with the socket */
  orientation: Axis;
  /** The instance ID of the part providing this snap point */
  connectorInstanceId: string;
  /** The socket/connection direction */
  socketDirection: Direction;
  /** Sort distance (smallest of XZ / ray distance, with 3D tiebreaker) */
  distance: number;
  /** Auto-computed rotation that best aligns connector arms with nearby supports */
  autoRotation?: Rotation3;
}

/** A ray in grid-space coordinates (origin and direction) */
export interface GridRay {
  origin: [number, number, number];
  direction: [number, number, number];
}

/** Closest distance from a ray to a point in 3D */
function rayToPointDistance(ray: GridRay, point: GridPosition): number {
  const ox = point[0] - ray.origin[0];
  const oy = point[1] - ray.origin[1];
  const oz = point[2] - ray.origin[2];
  const dx = ray.direction[0];
  const dy = ray.direction[1];
  const dz = ray.direction[2];
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq === 0) return Math.sqrt(ox * ox + oy * oy + oz * oz);
  const t = Math.max(0, (ox * dx + oy * dy + oz * dz) / lenSq);
  const cx = ray.origin[0] + t * dx - point[0];
  const cy = ray.origin[1] + t * dy - point[1];
  const cz = ray.origin[2] + t * dz - point[2];
  return Math.sqrt(cx * cx + cy * cy + cz * cz);
}

/** Compute sort distance: best of XZ cursor distance and ray distance */
function snapDistance(
  cursorGridPos: GridPosition,
  targetCell: GridPosition,
  ray?: GridRay,
): { distance: number; filterDist: number } {
  const dx = cursorGridPos[0] - targetCell[0];
  const dy = cursorGridPos[1] - targetCell[1];
  const dz = cursorGridPos[2] - targetCell[2];
  const distance3d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const distanceXZ = Math.sqrt(dx * dx + dz * dz);

  // filterDist: minimum of XZ ground-plane distance and ray proximity
  const rayDist = ray ? rayToPointDistance(ray, targetCell) : Infinity;
  const filterDist = Math.min(distanceXZ, rayDist);

  return { distance: filterDist + distance3d * 0.01, filterDist };
}

/**
 * Find all available snap points for a given support definition,
 * based on connectors currently in the assembly.
 *
 * Accounts for connector rotation when computing socket directions.
 * Only snaps to OPEN sockets.
 */
export function findSnapPoints(
  assembly: AssemblyState,
  supportDefId: string,
  cursorGridPos: GridPosition,
  maxDistance: number = 3,
  ray?: GridRay,
): SnapCandidate[] {
  const supportDef = getPartDefinition(supportDefId);
  if (!supportDef || supportDef.category !== "support") return [];

  const candidates: SnapCandidate[] = [];
  const supportLength = supportDef.gridCells.length;

  for (const part of assembly.getAllParts()) {
    const partDef = getPartDefinition(part.definitionId);
    if (!partDef || partDef.category !== "connector") continue;

    const partRotation: Rotation3 = part.rotation ?? [0, 0, 0];

    for (const cp of partDef.connectionPoints) {
      if (cp.type !== "female") continue;

      // Rotate socket offset and direction by connector's rotation
      const rotatedOffset = rotateGridCells([cp.offset as GridPosition], partRotation)[0];
      const rotatedDir = rotateDirection(cp.direction, partRotation);

      // World position of the socket
      const socketWorldPos: GridPosition = [
        part.position[0] + rotatedOffset[0],
        part.position[1] + rotatedOffset[1],
        part.position[2] + rotatedOffset[2],
      ];

      // The cell adjacent to the connector in this socket's direction
      const adjacentCell = getAdjacentPosition(socketWorldPos, rotatedDir);

      // Determine the axis the support needs to span
      const orientation = directionToAxis(rotatedDir);

      // Skip if this socket is already occupied — don't snap onto filled cells
      if (assembly.isOccupied(adjacentCell)) continue;

      // Compute the support origin position.
      let originPos: GridPosition;

      if (rotatedDir.startsWith("+")) {
        // +axis socket: support origin enters here, extends away
        originPos = adjacentCell;
      } else {
        // -axis socket: support far end enters here, origin is offset back
        originPos = [...adjacentCell] as GridPosition;
        const axisIndex = orientation === "x" ? 0 : orientation === "y" ? 1 : 2;
        originPos[axisIndex] -= supportLength - 1;
      }

      const { distance, filterDist } = snapDistance(cursorGridPos, adjacentCell, ray);
      if (filterDist > maxDistance) continue;

      candidates.push({
        position: originPos,
        orientation,
        connectorInstanceId: part.instanceId,
        socketDirection: rotatedDir,
        distance,
      });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

/**
 * Find all available snap points for a connector definition,
 * based on supports (male endpoints) currently in the assembly.
 *
 * Computes actual world-space endpoints of supports (accounting for
 * both rotation and orientation) and finds where connectors can attach.
 */
export function findConnectorSnapPoints(
  assembly: AssemblyState,
  connectorDefId: string,
  cursorGridPos: GridPosition,
  maxDistance: number = 3,
  ray?: GridRay,
  connectorRotation?: Rotation3,
): SnapCandidate[] {
  const connectorDef = getPartDefinition(connectorDefId);
  if (!connectorDef) return [];

  const candidates: SnapCandidate[] = [];

  // For pull-through connectors, also snap to mid-support positions
  if (connectorDef.pullThroughAxis && connectorRotation) {
    const effectivePtAxis = rotateAxis(connectorDef.pullThroughAxis, connectorRotation);
    for (const part of assembly.getAllParts()) {
      const partDef = getPartDefinition(part.definitionId);
      if (!partDef || partDef.category !== "support") continue;
      const supportOrientation: Axis = part.orientation ?? "y";
      if (supportOrientation !== effectivePtAxis) continue;

      const partRotation: Rotation3 = part.rotation ?? [0, 0, 0];
      const rotatedCells = rotateGridCells(partDef.gridCells, partRotation);
      const worldCells = getWorldCells(rotatedCells, part.position, supportOrientation);

      for (const cell of worldCells) {
        if (cell[1] < 0) continue;
        const { distance, filterDist } = snapDistance(cursorGridPos, cell, ray);
        if (filterDist > maxDistance) continue;
        candidates.push({
          position: cell,
          orientation: "y",
          connectorInstanceId: part.instanceId,
          socketDirection: `+${effectivePtAxis}` as Direction,
          distance,
        });
      }
    }
  }

  for (const part of assembly.getAllParts()) {
    const partDef = getPartDefinition(part.definitionId);
    if (!partDef) continue;

    // Only look at parts with male connection points
    const malePoints = partDef.connectionPoints.filter((cp) => cp.type === "male");
    if (malePoints.length === 0) continue;

    // Compute actual world cells (rotation + orientation aware)
    const partRotation: Rotation3 = part.rotation ?? [0, 0, 0];
    const partOrientation: Axis = part.orientation ?? "y";
    const rotatedCells = rotateGridCells(partDef.gridCells, partRotation);
    const worldCells = getWorldCells(rotatedCells, part.position, partOrientation);

    if (worldCells.length < 2) continue;

    // Find the two endpoints and their outward directions
    // by looking at the first/last cells and the direction they extend
    const first = worldCells[0];
    const second = worldCells[1];
    const last = worldCells[worldCells.length - 1];
    const secondLast = worldCells[worldCells.length - 2];

    const endpoints: [GridPosition, GridPosition][] = [
      [first, [first[0] - second[0], first[1] - second[1], first[2] - second[2]]],
      [last, [last[0] - secondLast[0], last[1] - secondLast[1], last[2] - secondLast[2]]],
    ];

    for (const [endpoint, dirVec] of endpoints) {
      // Convert direction vector to Direction type
      let dir: Direction;
      if (dirVec[0] >= 1) dir = "+x";
      else if (dirVec[0] <= -1) dir = "-x";
      else if (dirVec[1] >= 1) dir = "+y";
      else if (dirVec[1] <= -1) dir = "-y";
      else if (dirVec[2] >= 1) dir = "+z";
      else dir = "-z";

      // The connector goes at the adjacent cell past the support end
      const connectorPos = getAdjacentPosition(endpoint, dir);

      // Skip below-ground
      if (connectorPos[1] < 0) continue;

      // Skip if position is already occupied — don't snap onto filled cells
      if (assembly.isOccupied(connectorPos)) continue;

      const { distance, filterDist } = snapDistance(cursorGridPos, connectorPos, ray);
      if (filterDist > maxDistance) continue;

      candidates.push({
        position: connectorPos,
        orientation: "y",
        connectorInstanceId: part.instanceId,
        socketDirection: dir,
        distance,
      });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

/**
 * Find the best snap point for a support near a cursor position.
 */
export function findBestSnap(
  assembly: AssemblyState,
  supportDefId: string,
  cursorGridPos: GridPosition,
  snapRadius: number = 3,
  ray?: GridRay,
): SnapCandidate | null {
  const candidates = findSnapPoints(assembly, supportDefId, cursorGridPos, snapRadius, ray);
  return candidates.length > 0 ? candidates[0] : null;
}

/** Flip a direction to its opposite */
function oppositeDir(dir: Direction): Direction {
  const sign = dir[0] === "+" ? "-" : "+";
  return `${sign}${dir[1]}` as Direction;
}

/**
 * Compute the best rotation for a connector so its arms align with
 * the given needed directions (directions toward adjacent support endpoints).
 *
 * Tries all 64 rotation combinations (4^3), scores by:
 *   1. Coverage count (higher is better)
 *   2. Fewest total rotation steps from identity (prefer simpler rotations)
 */
export function computeAutoRotation(
  connectorDefId: string,
  neededDirections: Direction[],
  fallbackRotation: Rotation3,
): Rotation3 {
  if (neededDirections.length === 0) return fallbackRotation;

  const def = getPartDefinition(connectorDefId);
  if (!def) return fallbackRotation;

  // Get base arm directions from connection points
  const baseArmDirs = def.connectionPoints
    .filter(cp => cp.type === "female")
    .map(cp => cp.direction);

  if (baseArmDirs.length === 0) return fallbackRotation;

  const STEPS: RotationStep[] = [0, 90, 180, 270];
  let bestRotation: Rotation3 = fallbackRotation;
  let bestScore = -1;
  let bestDist = Infinity;

  // Distance between two rotations (minimum steps to go from one to the other)
  const rotDist = (a: Rotation3, b: Rotation3) => {
    const d = (v1: number, v2: number) => { const diff = ((v1 - v2) % 360 + 360) % 360; return Math.min(diff, 360 - diff) / 90; };
    return d(a[0], b[0]) + d(a[1], b[1]) + d(a[2], b[2]);
  };

  for (const rx of STEPS) {
    for (const ry of STEPS) {
      for (const rz of STEPS) {
        const rotation: Rotation3 = [rx, ry, rz];

        // Rotate all arm directions by this rotation
        const rotatedArms = baseArmDirs.map(d => rotateDirection(d, rotation));

        // Count how many needed directions are covered
        let coverage = 0;
        for (const needed of neededDirections) {
          if (rotatedArms.includes(needed)) coverage++;
        }

        // Prefer rotations closest to the user's current rotation
        const dist = rotDist(rotation, fallbackRotation);

        if (coverage > bestScore || (coverage === bestScore && dist < bestDist)) {
          bestScore = coverage;
          bestDist = dist;
          bestRotation = rotation;
        }
      }
    }
  }

  return bestRotation;
}

/**
 * Find the best snap point for a connector near a cursor position.
 */
export function findBestConnectorSnap(
  assembly: AssemblyState,
  connectorDefId: string,
  cursorGridPos: GridPosition,
  snapRadius: number = 3,
  ray?: GridRay,
  connectorRotation?: Rotation3,
): SnapCandidate | null {
  const candidates = findConnectorSnapPoints(assembly, connectorDefId, cursorGridPos, snapRadius, ray, connectorRotation);
  if (candidates.length === 0) return null;

  const best = candidates[0];

  // Collect needed arm directions from all candidates at the same position.
  // socketDirection is the outward direction of the support endpoint;
  // the connector arm needs to point in the opposite direction (toward the endpoint).
  const seen = new Set<Direction>();
  const neededDirs: Direction[] = [];
  for (const c of candidates) {
    if (c.position[0] === best.position[0] && c.position[1] === best.position[1] && c.position[2] === best.position[2]) {
      const opp = oppositeDir(c.socketDirection);
      if (!seen.has(opp)) {
        seen.add(opp);
        neededDirs.push(opp);
      }
    }
  }

  best.autoRotation = computeAutoRotation(connectorDefId, neededDirs, connectorRotation ?? [0, 0, 0]);
  return best;
}
