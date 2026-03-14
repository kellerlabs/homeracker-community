import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import type { PartDefinition, GridPosition } from "../types";
import { BASE_UNIT } from "../constants";
import {
  saveSTLBuffer,
  saveCustomPartsMeta,
  loadCustomPartsMeta,
  loadAllSTLBuffers,
  loadSTLBuffer,
  deleteSTLBuffer,
  type CustomPartMeta,
} from "./custom-parts-storage";
import type { EmbeddedCustomPart } from "../types";

const stlLoader = new STLLoader();

/** Runtime store for imported STL geometries, keyed by definition ID */
const geometryStore = new Map<string, THREE.BufferGeometry>();

/** Runtime store for custom part definitions */
const customDefinitions: PartDefinition[] = [];

/** Subscribers for React reactivity */
const listeners = new Set<() => void>();
let snapshot = { definitions: [] as PartDefinition[] };

function notify() {
  snapshot = { definitions: [...customDefinitions] };
  listeners.forEach((cb) => cb());
}

/** Persist current custom parts metadata to localStorage */
function persistMeta() {
  const meta: CustomPartMeta[] = customDefinitions.map((d) => ({
    id: d.id,
    name: d.name,
    gridCells: d.gridCells,
    format: d.id.startsWith("custom-3mf-") ? "3mf" as const : "stl" as const,
  }));
  saveCustomPartsMeta(meta);
}

export function subscribeCustomParts(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getCustomPartsSnapshot() {
  return snapshot;
}

/** Get all custom part definitions */
export function getCustomParts(): PartDefinition[] {
  return customDefinitions;
}

/** Look up a custom part definition by ID */
export function getCustomPartDefinition(id: string): PartDefinition | undefined {
  return customDefinitions.find((d) => d.id === id);
}

/** Get stored geometry for a custom part */
export function getCustomPartGeometry(defId: string): THREE.BufferGeometry | undefined {
  return geometryStore.get(defId);
}

/** Check if a definition ID is a custom imported part */
export function isCustomPart(defId: string): boolean {
  return geometryStore.has(defId);
}

/** Download the original STL/3MF file for a custom part */
export async function downloadCustomPart(defId: string): Promise<void> {
  const def = getCustomPartDefinition(defId);
  if (!def) return;

  let buffer: ArrayBuffer | undefined;
  try {
    buffer = await loadSTLBuffer(defId);
  } catch {
    return;
  }
  if (!buffer) return;

  const format: ModelFormat = defId.startsWith("custom-3mf-") ? "3mf" : "stl";
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${def.name.replace(/\s+/g, "-").toLowerCase()}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Delete a custom part from the library (geometry store, definitions, and persistence) */
export async function deleteCustomPart(defId: string): Promise<void> {
  const idx = customDefinitions.findIndex((d) => d.id === defId);
  if (idx === -1) return;
  customDefinitions.splice(idx, 1);
  const geo = geometryStore.get(defId);
  if (geo) {
    geo.dispose();
    geometryStore.delete(defId);
  }
  notify();
  persistMeta();
  try { await deleteSTLBuffer(defId); } catch { /* ignore */ }
}

let nextId = 1;

/**
 * Voxelize a geometry: find which grid cells actually contain mesh triangles.
 * Only cells with geometry are returned, so hollow interiors remain free.
 */
function voxelizeGeometry(geometry: THREE.BufferGeometry): {
  gridCells: GridPosition[];
  cellsX: number;
  cellsY: number;
  cellsZ: number;
} {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const cellsX = Math.max(1, Math.ceil(size.x / BASE_UNIT));
  const cellsY = Math.max(1, Math.ceil(size.y / BASE_UNIT));
  const cellsZ = Math.max(1, Math.ceil(size.z / BASE_UNIT));

  const positions = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : positions.count / 3;

  const occupiedCells = new Set<string>();

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    // Triangle vertex positions
    const xs = [positions.getX(i0), positions.getX(i1), positions.getX(i2)];
    const ys = [positions.getY(i0), positions.getY(i1), positions.getY(i2)];
    const zs = [positions.getZ(i0), positions.getZ(i1), positions.getZ(i2)];

    // Triangle AABB → grid cell range
    const cMinX = Math.max(0, Math.floor((Math.min(...xs) - bbox.min.x) / BASE_UNIT));
    const cMinY = Math.max(0, Math.floor((Math.min(...ys) - bbox.min.y) / BASE_UNIT));
    const cMinZ = Math.max(0, Math.floor((Math.min(...zs) - bbox.min.z) / BASE_UNIT));
    const cMaxX = Math.min(cellsX - 1, Math.floor((Math.max(...xs) - bbox.min.x) / BASE_UNIT));
    const cMaxY = Math.min(cellsY - 1, Math.floor((Math.max(...ys) - bbox.min.y) / BASE_UNIT));
    const cMaxZ = Math.min(cellsZ - 1, Math.floor((Math.max(...zs) - bbox.min.z) / BASE_UNIT));

    for (let cx = cMinX; cx <= cMaxX; cx++) {
      for (let cy = cMinY; cy <= cMaxY; cy++) {
        for (let cz = cMinZ; cz <= cMaxZ; cz++) {
          occupiedCells.add(`${cx},${cy},${cz}`);
        }
      }
    }
  }

  const gridCells: GridPosition[] = [];
  for (const key of occupiedCells) {
    const [x, y, z] = key.split(",").map(Number);
    gridCells.push([x, y, z] as GridPosition);
  }

  return { gridCells, cellsX, cellsY, cellsZ };
}

type ModelFormat = "stl" | "3mf";

/**
 * Parse a single 3MF <model> XML string and extract all mesh geometries.
 * Returns one BufferGeometry per <object> that contains a <mesh>.
 */
function parse3MFModelXml(xml: string): { objectId: string; name?: string; geometry: THREE.BufferGeometry }[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const results: { objectId: string; name?: string; geometry: THREE.BufferGeometry }[] = [];

  const objects = doc.querySelectorAll("object");
  for (const obj of objects) {
    const mesh = obj.querySelector("mesh");
    if (!mesh) continue;

    const id = obj.getAttribute("id") ?? "0";
    const name = obj.getAttribute("name") || undefined;
    const vertexNodes = mesh.querySelectorAll("vertices > vertex");
    const triNodes = mesh.querySelectorAll("triangles > triangle");

    const positions = new Float32Array(vertexNodes.length * 3);
    for (let i = 0; i < vertexNodes.length; i++) {
      const v = vertexNodes[i];
      positions[i * 3] = parseFloat(v.getAttribute("x") ?? "0");
      positions[i * 3 + 1] = parseFloat(v.getAttribute("y") ?? "0");
      positions[i * 3 + 2] = parseFloat(v.getAttribute("z") ?? "0");
    }

    const indices = new Uint32Array(triNodes.length * 3);
    for (let i = 0; i < triNodes.length; i++) {
      const t = triNodes[i];
      indices[i * 3] = parseInt(t.getAttribute("v1") ?? "0", 10);
      indices[i * 3 + 1] = parseInt(t.getAttribute("v2") ?? "0", 10);
      indices[i * 3 + 2] = parseInt(t.getAttribute("v3") ?? "0", 10);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    results.push({ objectId: id, name, geometry });
  }

  return results;
}

/**
 * Parse a 3MF ZIP archive and return one BufferGeometry per mesh object.
 * Handles the production extension (p:path) by parsing each .model file separately.
 */
function parse3MF(buffer: ArrayBuffer): { geometry: THREE.BufferGeometry; name?: string }[] {
  const zip = unzipSync(new Uint8Array(buffer));
  const decoder = new TextDecoder();

  // Collect all .model files and their mesh objects
  const allObjects = new Map<string, { objectId: string; name?: string; geometry: THREE.BufferGeometry }>();

  for (const filename in zip) {
    if (!filename.match(/\.model$/i)) continue;
    const xml = decoder.decode(zip[filename]);
    const meshes = parse3MFModelXml(xml);
    for (const m of meshes) {
      // Key by "path:objectId" for cross-model component resolution
      allObjects.set(`/${filename}:${m.objectId}`, m);
      // Also store by bare objectId for same-model references
      allObjects.set(`${filename}:${m.objectId}`, m);
    }
  }

  // Find root model and its build items
  let rootModelPath = "";
  for (const filename in zip) {
    if (filename.match(/^_rels\/.rels$/)) {
      const xml = decoder.decode(zip[filename]);
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const rel = doc.querySelector("Relationship");
      if (rel) {
        const target = rel.getAttribute("Target") ?? "";
        rootModelPath = target.startsWith("/") ? target.substring(1) : target;
      }
    }
  }

  if (!rootModelPath || !zip[rootModelPath]) {
    // No rels — just return all mesh objects found
    return [...allObjects.values()].map((o) => ({ geometry: o.geometry, name: o.name }));
  }

  const rootXml = decoder.decode(zip[rootModelPath]);
  const rootDoc = new DOMParser().parseFromString(rootXml, "application/xml");

  // Resolve build items: each <item objectid="X"> in the root model's <build>
  const buildItems = rootDoc.querySelectorAll("build > item");
  if (buildItems.length === 0) {
    // No build section — return all mesh objects
    return [...allObjects.values()].map((o) => ({ geometry: o.geometry, name: o.name }));
  }

  const results: { geometry: THREE.BufferGeometry; name?: string }[] = [];
  const rootObjects = rootDoc.querySelectorAll("object");

  for (const item of buildItems) {
    const objectId = item.getAttribute("objectid");
    if (!objectId) continue;

    // Find the object in the root model
    const obj = Array.from(rootObjects).find((o) => o.getAttribute("id") === objectId);
    if (!obj) continue;

    // Name priority: root object name attribute
    const rootObjName = obj.getAttribute("name") || undefined;

    // Direct mesh in root model?
    const directKey = `${rootModelPath}:${objectId}`;
    if (allObjects.has(directKey)) {
      const entry = allObjects.get(directKey)!;
      results.push({ geometry: entry.geometry, name: rootObjName ?? entry.name });
      continue;
    }

    // Composite with p:path references?
    const components = obj.querySelectorAll("components > component");
    for (const comp of components) {
      const pPath = comp.getAttribute("p:path") ?? comp.getAttributeNS(
        "http://schemas.microsoft.com/3dmanufacturing/production/2015/06", "path"
      );
      const compObjectId = comp.getAttribute("objectid");
      if (!compObjectId) continue;

      if (pPath) {
        // Resolve external model reference
        const resolvedPath = pPath.startsWith("/") ? pPath.substring(1) : pPath;
        const key = `${resolvedPath}:${compObjectId}`;
        const entry = allObjects.get(key);
        if (entry) results.push({ geometry: entry.geometry, name: rootObjName ?? entry.name });
      } else {
        // Same-model reference
        const key = `${rootModelPath}:${compObjectId}`;
        const entry = allObjects.get(key);
        if (entry) results.push({ geometry: entry.geometry, name: rootObjName ?? entry.name });
      }
    }
  }

  if (results.length === 0) {
    // Fallback: return all mesh objects found in any model file
    return [...allObjects.values()].map((o) => ({ geometry: o.geometry, name: o.name }));
  }

  return results;
}

/** Parse a stored buffer back into a single geometry for restore. */
function parseStoredBuffer(buffer: ArrayBuffer, format: ModelFormat): THREE.BufferGeometry {
  if (format === "3mf") {
    const geometries = parse3MF(buffer);
    if (geometries.length === 0) throw new Error("3MF file contains no mesh geometry");
    return geometries[0].geometry; // Restore uses the first geometry (each part stored separately)
  }
  return stlLoader.parse(buffer);
}

/** Detect format from filename extension. */
function detectFormat(filename: string): ModelFormat {
  return filename.toLowerCase().endsWith(".3mf") ? "3mf" : "stl";
}

/**
 * Register a single geometry as a custom part and persist it.
 */
async function registerCustomPart(
  name: string,
  format: ModelFormat,
  geometry: THREE.BufferGeometry,
  buffer: ArrayBuffer,
): Promise<PartDefinition> {
  const { gridCells, cellsX, cellsY, cellsZ } = voxelizeGeometry(geometry);
  geometry.center();

  const id = `custom-${format}-${nextId++}`;
  const def: PartDefinition = {
    id,
    category: "custom",
    name,
    description: `Imported ${format.toUpperCase()} (${cellsX}x${cellsY}x${cellsZ} units)`,
    modelPath: "",
    connectionPoints: [],
    gridCells,
  };

  geometryStore.set(id, geometry);
  customDefinitions.push(def);
  notify();

  await saveSTLBuffer(id, buffer);
  persistMeta();

  return def;
}

/**
 * Import a 3D model file (STL or 3MF) and register it as custom catalog part(s).
 * STL produces one part. 3MF may produce multiple parts (one per mesh object).
 * Returns the array of new PartDefinitions.
 */
export function importModelFile(file: File): Promise<PartDefinition[]> {
  const format = detectFormat(file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const baseName = file.name.replace(/\.(stl|3mf)$/i, "");

        if (format === "stl") {
          const geometry = stlLoader.parse(buffer);
          const def = await registerCustomPart(baseName, format, geometry, buffer);
          resolve([def]);
        } else {
          const parts = parse3MF(buffer);
          if (parts.length === 0) throw new Error("3MF file contains no mesh geometry");

          const defs: PartDefinition[] = [];
          for (let i = 0; i < parts.length; i++) {
            const objName = parts[i].name;
            const partLabel = objName
              ? `${baseName} - ${objName}`
              : parts.length === 1 ? baseName : `${baseName} (${i + 1})`;
            const def = await registerCustomPart(partLabel, format, parts[i].geometry, buffer);
            defs.push(def);
          }
          resolve(defs);
        }
      } catch (err) {
        reject(new Error(`Failed to parse ${format.toUpperCase()}: ${err}`));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/** @deprecated Use importModelFile instead. */
export const importSTL = importModelFile;

/**
 * Restore custom parts from IndexedDB + localStorage.
 * Must be called before assembly.deserialize() so custom part IDs resolve.
 */
export async function restoreCustomParts(): Promise<void> {
  const meta = loadCustomPartsMeta();
  if (meta.length === 0) return;

  let buffers: Map<string, ArrayBuffer>;
  try {
    buffers = await loadAllSTLBuffers();
  } catch {
    return; // IndexedDB unavailable
  }

  for (const entry of meta) {
    const buffer = buffers.get(entry.id);
    if (!buffer) continue; // Binary lost — skip this part

    try {
      const format: ModelFormat =
        entry.format ?? (entry.id.startsWith("custom-3mf-") ? "3mf" : "stl");
      const geometry = parseStoredBuffer(buffer, format);

      // Re-voxelize from actual geometry (fixes stale bounding-box cells from old saves)
      const { gridCells } = voxelizeGeometry(geometry);

      geometry.center();

      const def: PartDefinition = {
        id: entry.id,
        category: "custom",
        name: entry.name,
        description: `Imported ${format.toUpperCase()} (${gridCells.length} cells)`,
        modelPath: "",
        connectionPoints: [],
        gridCells,
      };

      geometryStore.set(entry.id, geometry);
      customDefinitions.push(def);
    } catch {
      // Skip corrupt entries
    }
  }

  // Set nextId past any restored IDs to avoid collisions
  for (const entry of meta) {
    const match = entry.id.match(/^custom-(?:stl|3mf)-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= nextId) nextId = num + 1;
    }
  }

  notify();
}

/**
 * Build embedded custom part data for all custom parts referenced in a part list.
 * Loads binary buffers from IndexedDB and base64-encodes them.
 */
export async function getEmbeddedCustomParts(partTypes: string[]): Promise<EmbeddedCustomPart[]> {
  const uniqueCustomIds = [...new Set(partTypes.filter((t) => isCustomPart(t)))];
  if (uniqueCustomIds.length === 0) return [];

  const embedded: EmbeddedCustomPart[] = [];
  for (const id of uniqueCustomIds) {
    const def = getCustomPartDefinition(id);
    if (!def) continue;

    let buffer: ArrayBuffer | undefined;
    try {
      buffer = await loadSTLBuffer(id);
    } catch {
      continue;
    }
    if (!buffer) continue;

    // ArrayBuffer → base64
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const data = btoa(binary);

    const format: "stl" | "3mf" = id.startsWith("custom-3mf-") ? "3mf" : "stl";
    embedded.push({
      id,
      name: def.name,
      format,
      gridCells: def.gridCells,
      data,
    });
  }

  return embedded;
}

/**
 * Restore embedded custom parts from a loaded save file.
 * Skips parts whose IDs already exist in the geometry store.
 */
export async function restoreEmbeddedCustomParts(embedded: EmbeddedCustomPart[]): Promise<void> {
  for (const entry of embedded) {
    if (geometryStore.has(entry.id)) continue; // Already loaded

    // Base64 → ArrayBuffer
    const binary = atob(entry.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    try {
      const geometry = parseStoredBuffer(buffer, entry.format);
      const { gridCells } = voxelizeGeometry(geometry);
      geometry.center();

      const def: PartDefinition = {
        id: entry.id,
        category: "custom",
        name: entry.name,
        description: `Imported ${entry.format.toUpperCase()} (${gridCells.length} cells)`,
        modelPath: "",
        connectionPoints: [],
        gridCells,
      };

      geometryStore.set(entry.id, geometry);
      customDefinitions.push(def);

      // Persist to IndexedDB + localStorage so it sticks around
      await saveSTLBuffer(entry.id, buffer);
    } catch {
      // Skip corrupt entries
    }
  }

  // Update nextId to avoid collisions
  for (const entry of embedded) {
    const match = entry.id.match(/^custom-(?:stl|3mf)-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= nextId) nextId = num + 1;
    }
  }

  persistMeta();
  notify();
}
