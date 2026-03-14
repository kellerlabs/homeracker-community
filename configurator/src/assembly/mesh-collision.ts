import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import type { PlacedPart, GridPosition, Axis, Rotation3 } from "../types";
import type { AssemblyState } from "./AssemblyState";
import { getPartDefinition } from "../data/catalog";
import { getCustomPartGeometry, isCustomPart } from "../data/custom-parts";
import { getRegisteredGeometry } from "./geometry-registry";
import { orientationToRotation, rotateGridCells, transformCell, rotateAxis } from "./grid-utils";
import { BASE_UNIT } from "../constants";

// BVH cache keyed by definitionId
const bvhCache = new Map<string, MeshBVH>();

function getGeometryForPart(definitionId: string): THREE.BufferGeometry | undefined {
  if (isCustomPart(definitionId)) return getCustomPartGeometry(definitionId);
  return getRegisteredGeometry(definitionId);
}

function ensureBVH(definitionId: string): MeshBVH | undefined {
  let bvh = bvhCache.get(definitionId);
  if (bvh) return bvh;
  const geometry = getGeometryForPart(definitionId);
  if (!geometry) return undefined;
  bvh = new MeshBVH(geometry);
  bvhCache.set(definitionId, bvh);
  // Attach to geometry so intersectsGeometry uses dual-BVH traversal
  (geometry as any).boundsTree = bvh;
  return bvh;
}

/** Clear cached BVH (call when a custom part geometry changes) */
export function clearBVHCache(definitionId?: string): void {
  if (definitionId) {
    bvhCache.delete(definitionId);
  } else {
    bvhCache.clear();
  }
}

function gridToWorld(pos: GridPosition): [number, number, number] {
  return [pos[0] * BASE_UNIT, pos[1] * BASE_UNIT + BASE_UNIT / 2, pos[2] * BASE_UNIT];
}

function modelCenterOffset(gridCells: GridPosition[], orientation: Axis = "y"): [number, number, number] {
  const cells = gridCells.map((c) => transformCell(c, orientation));
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const minZ = Math.min(...cells.map((c) => c[2]));
  const maxX = Math.max(...cells.map((c) => c[0]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const maxZ = Math.max(...cells.map((c) => c[2]));
  return [
    ((minX + maxX) / 2) * BASE_UNIT,
    ((minY + maxY) / 2) * BASE_UNIT,
    ((minZ + maxZ) / 2) * BASE_UNIT,
  ];
}

/**
 * Compute world matrix for a part, matching the Three.js scene graph nesting:
 *   Custom: group(worldPos) > group(offset) > group(partEuler) > mesh
 *   GLB:    group(worldPos) > group(offset) > group(partEuler) > group(orientEuler) > scene
 */
function getPartWorldMatrix(part: PlacedPart): THREE.Matrix4 | undefined {
  const def = getPartDefinition(part.definitionId);
  if (!def) return undefined;

  const custom = isCustomPart(part.definitionId);
  const rotation: Rotation3 = part.rotation ?? [0, 0, 0];
  const orient: Axis = part.orientation ?? "y";

  // Compute offset matching ViewportCanvas
  let offset: [number, number, number];
  if (custom) {
    const rotatedCells = rotateGridCells(def.gridCells, rotation);
    offset = modelCenterOffset(rotatedCells);
  } else {
    const orientedCells = def.gridCells.map((c) => transformCell(c, orient));
    const rotatedCells = rotateGridCells(orientedCells, rotation);
    offset = modelCenterOffset(rotatedCells);
  }

  const worldPos = gridToWorld(part.position);

  const partEuler = new THREE.Euler(
    (rotation[0] * Math.PI) / 180,
    (rotation[1] * Math.PI) / 180,
    (rotation[2] * Math.PI) / 180,
    "XYZ",
  );

  // Build matrix from innermost to outermost
  const mat = new THREE.Matrix4();

  if (!custom) {
    const orientRot = orientationToRotation(orient);
    const orientEuler = new THREE.Euler(
      (orientRot[0] * Math.PI) / 180,
      (orientRot[1] * Math.PI) / 180,
      (orientRot[2] * Math.PI) / 180,
      "XYZ",
    );
    mat.makeRotationFromEuler(orientEuler);
  }

  const partRotMat = new THREE.Matrix4().makeRotationFromEuler(partEuler);
  mat.premultiply(partRotMat);

  const offsetMat = new THREE.Matrix4().makeTranslation(offset[0], offset[1], offset[2]);
  mat.premultiply(offsetMat);

  const worldMat = new THREE.Matrix4().makeTranslation(worldPos[0], worldPos[1], worldPos[2]);
  mat.premultiply(worldMat);

  return mat;
}

/**
 * Check if a pair of parts is a valid pull-through connection (connector + support
 * along matching axis, properly aligned). These intentionally overlap and should
 * not be flagged.
 *
 * The connector must be positionally aligned with the support in the plane
 * perpendicular to the PT axis — otherwise the support doesn't actually pass
 * through the connector's tunnel.
 */
function isValidPullThroughPair(partA: PlacedPart, partB: PlacedPart): boolean {
  const defA = getPartDefinition(partA.definitionId);
  const defB = getPartDefinition(partB.definitionId);
  if (!defA || !defB) return false;

  let connector: PlacedPart, support: PlacedPart;
  let ptAxisRaw: Axis | undefined;
  let connRotation: Rotation3;

  if (defA.category === "connector" && defA.pullThroughAxis && defB.category === "support") {
    connector = partA; support = partB;
    ptAxisRaw = defA.pullThroughAxis;
    connRotation = partA.rotation ?? [0, 0, 0];
  } else if (defB.category === "connector" && defB.pullThroughAxis && defA.category === "support") {
    connector = partB; support = partA;
    ptAxisRaw = defB.pullThroughAxis;
    connRotation = partB.rotation ?? [0, 0, 0];
  } else {
    return false;
  }

  const ptAxis = rotateAxis(ptAxisRaw, connRotation);
  const supportOrientation = support.orientation ?? "y";
  if (ptAxis !== supportOrientation) return false;

  // Check positional alignment in the plane perpendicular to PT axis.
  // If the connector is offset too far, the support doesn't go through the hole.
  const ALIGN_TOLERANCE = 0.35; // grid units (~5mm)
  const cp = connector.position;
  const sp = support.position;

  switch (ptAxis) {
    case "x":
      if (Math.abs(cp[1] - sp[1]) > ALIGN_TOLERANCE) return false;
      if (Math.abs(cp[2] - sp[2]) > ALIGN_TOLERANCE) return false;
      break;
    case "y":
      if (Math.abs(cp[0] - sp[0]) > ALIGN_TOLERANCE) return false;
      if (Math.abs(cp[2] - sp[2]) > ALIGN_TOLERANCE) return false;
      break;
    case "z":
      if (Math.abs(cp[0] - sp[0]) > ALIGN_TOLERANCE) return false;
      if (Math.abs(cp[1] - sp[1]) > ALIGN_TOLERANCE) return false;
      break;
  }

  return true;
}

/** Compute world-space AABB for a part */
function getPartWorldAABB(
  part: PlacedPart,
  mat: THREE.Matrix4,
): THREE.Box3 | undefined {
  const geo = getGeometryForPart(part.definitionId);
  if (!geo) return undefined;
  geo.computeBoundingBox();
  const box = geo.boundingBox!.clone();
  box.applyMatrix4(mat);
  return box;
}

interface PartCollisionData {
  part: PlacedPart;
  mat: THREE.Matrix4;
  invMat: THREE.Matrix4;
  aabb: THREE.Box3;
}

/**
 * Mesh-accurate collision detection (async, non-blocking).
 * Yields to the browser between BVH checks so the UI stays responsive.
 * The signal allows cancellation when the assembly changes mid-computation.
 *
 * Phases:
 * 1. Grid broad phase: only check pairs that share a grid cell
 * 2. Pull-through exemption: skip connector+support pairs along matching axis
 * 3. AABB mid-phase: skip pairs whose world bounding boxes don't overlap
 * 4. BVH narrow phase: actual mesh intersection test (yielded)
 */
export async function detectCollidingPartIds(
  assembly: AssemblyState,
  signal?: AbortSignal,
): Promise<Set<string>> {
  // Broad phase: collect candidate pairs from grid occupancy
  const candidatePairs = new Set<string>();
  for (const [, ids] of assembly.gridOccupancy) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`;
        candidatePairs.add(key);
      }
    }
  }

  console.log("[MeshCollision] candidate pairs:", candidatePairs.size);
  if (candidatePairs.size === 0) return new Set();

  // Pre-compute per-part data (matrix, inverse, AABB) on demand
  const partDataCache = new Map<string, PartCollisionData | null>();

  function getPartData(id: string): PartCollisionData | null {
    if (partDataCache.has(id)) return partDataCache.get(id)!;
    const part = assembly.getPartById(id);
    if (!part) { partDataCache.set(id, null); return null; }
    const mat = getPartWorldMatrix(part);
    if (!mat) { partDataCache.set(id, null); return null; }
    const aabb = getPartWorldAABB(part, mat);
    if (!aabb) { partDataCache.set(id, null); return null; }
    const invMat = mat.clone().invert();
    const data: PartCollisionData = { part, mat, invMat, aabb };
    partDataCache.set(id, data);
    return data;
  }

  const collidingIds = new Set<string>();
  const pairs = Array.from(candidatePairs);
  const BATCH_SIZE = 10;
  let ptSkipped = 0, aabbSkipped = 0, bvhTested = 0, bvhHit = 0, noGeoSkipped = 0;

  for (let batch = 0; batch < pairs.length; batch += BATCH_SIZE) {
    if (signal?.aborted) return new Set();

    const end = Math.min(batch + BATCH_SIZE, pairs.length);
    for (let k = batch; k < end; k++) {
      const pairKey = pairs[k];
      const [idA, idB] = pairKey.split("|");

      if (collidingIds.has(idA) && collidingIds.has(idB)) continue;

      const dataA = getPartData(idA);
      const dataB = getPartData(idB);
      if (!dataA || !dataB) continue;

      if (isValidPullThroughPair(dataA.part, dataB.part)) { ptSkipped++; continue; }

      // Shrink AABBs by a small tolerance to avoid false positives from
      // parts that merely touch at a shared boundary (e.g. adjacent connector + support)
      const AABB_TOLERANCE = 0.75; // mm
      const shrunkA = dataA.aabb.clone().expandByScalar(-AABB_TOLERANCE);
      const shrunkB = dataB.aabb.clone().expandByScalar(-AABB_TOLERANCE);
      if (!shrunkA.intersectsBox(shrunkB)) { aabbSkipped++; continue; }

      // Ensure both geometries have BVH for fast dual-tree traversal
      ensureBVH(dataA.part.definitionId);
      const bvhB = ensureBVH(dataB.part.definitionId);
      const geoA = getGeometryForPart(dataA.part.definitionId);
      if (!bvhB || !geoA) { noGeoSkipped++; continue; }

      bvhTested++;
      const trisA = geoA.index ? geoA.index.count / 3 : geoA.attributes.position.count / 3;
      const geoB = getGeometryForPart(dataB.part.definitionId);
      const trisB = geoB ? (geoB.index ? geoB.index.count / 3 : geoB.attributes.position.count / 3) : 0;
      const t0 = performance.now();

      // Shrink geoA slightly around its centroid before testing intersection.
      // This adds ~1mm tolerance so parts that merely touch at a shared
      // boundary (e.g. connector arm tip meets support end) aren't flagged.
      const SHRINK = 0.95;
      geoA.computeBoundingBox();
      const centroid = geoA.boundingBox!.getCenter(new THREE.Vector3());
      const shrinkMat = new THREE.Matrix4()
        .makeTranslation(centroid.x, centroid.y, centroid.z)
        .multiply(new THREE.Matrix4().makeScale(SHRINK, SHRINK, SHRINK))
        .multiply(new THREE.Matrix4().makeTranslation(-centroid.x, -centroid.y, -centroid.z));
      const matAToB = dataB.invMat.clone().multiply(dataA.mat).multiply(shrinkMat);
      const hit = bvhB.intersectsGeometry(geoA, matAToB);
      const dt = performance.now() - t0;
      if (dt > 10) {
        console.warn(`[MeshCollision] SLOW pair: ${dataA.part.definitionId} (${trisA} tris) vs ${dataB.part.definitionId} (${trisB} tris) = ${dt.toFixed(1)}ms hit=${hit}`);
      }
      if (hit) {
        bvhHit++;
        collidingIds.add(idA);
        collidingIds.add(idB);
      }
    }

    // Yield to the browser between batches
    if (batch + BATCH_SIZE < pairs.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  console.log(`[MeshCollision] ptSkipped=${ptSkipped} aabbSkipped=${aabbSkipped} noGeo=${noGeoSkipped} bvhTested=${bvhTested} bvhHit=${bvhHit} colliding=${collidingIds.size}`);
  return collidingIds;
}
