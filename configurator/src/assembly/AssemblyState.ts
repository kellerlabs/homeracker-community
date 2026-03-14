import type { PlacedPart, GridPosition, Axis, BOMEntry, AssemblyFile, Rotation3 } from "../types";
import { getPartDefinition } from "../data/catalog";
import { getWorldCells, getAdjacentPosition, rotateGridCells, rotateDirection, transformDirection } from "./grid-utils";

function gridKey(pos: GridPosition): string {
  return `${Math.floor(pos[0])},${Math.floor(pos[1])},${Math.floor(pos[2])}`;
}

/**
 * Each grid cell is a 1-unit cube: position P covers [P, P+1).
 * A fractional cell like 14.7 covers [14.7, 15.7), overlapping integer
 * cells 14 and 15. Register in all integer cells it touches.
 */
function gridKeysForCell(pos: GridPosition): string[] {
  const xVals = [Math.floor(pos[0])];
  const yVals = [Math.floor(pos[1])];
  const zVals = [Math.floor(pos[2])];
  if (pos[0] % 1 !== 0) xVals.push(Math.floor(pos[0]) + 1);
  if (pos[1] % 1 !== 0) yVals.push(Math.floor(pos[1]) + 1);
  if (pos[2] % 1 !== 0) zVals.push(Math.floor(pos[2]) + 1);
  const keys: string[] = [];
  for (const x of xVals)
    for (const y of yVals)
      for (const z of zVals)
        keys.push(`${x},${y},${z}`);
  return keys;
}

let nextId = 0;
function generateId(): string {
  return `part-${++nextId}-${Date.now()}`;
}

export interface AssemblySnapshot {
  parts: PlacedPart[];
  snapEnabled: boolean;
  showCollisions: boolean;
  fineMeshCollisions: boolean;
}

const SETTINGS_KEY = "homeracker-settings";

export class AssemblyState {
  private parts: Map<string, PlacedPart> = new Map();
  /** Maps "x,y,z" grid key → instance IDs at that cell */
  gridOccupancy: Map<string, string[]> = new Map();
  private listeners: Set<() => void> = new Set();
  private cachedSnapshot: AssemblySnapshot = { parts: [], snapEnabled: true, showCollisions: false, fineMeshCollisions: false };

  /** When true, parts snap to nearby connection points during placement/drag */
  snapEnabled: boolean = true;
  /** When true, overlapping grid cells are highlighted in red */
  showCollisions: boolean = false;
  /** When true, use BVH mesh intersection for precise collision detection */
  fineMeshCollisions: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.snapEnabled !== undefined) this.snapEnabled = !!settings.snapEnabled;
        if (settings.showCollisions !== undefined) this.showCollisions = !!settings.showCollisions;
        if (settings.fineMeshCollisions !== undefined) this.fineMeshCollisions = !!settings.fineMeshCollisions;
      }
    } catch { /* ignore */ }
  }

  private persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ snapEnabled: this.snapEnabled, showCollisions: this.showCollisions, fineMeshCollisions: this.fineMeshCollisions }));
    } catch { /* ignore */ }
  }

  setSnapEnabled(value: boolean) {
    this.snapEnabled = value;
    this.persistSettings();
    this.notify();
  }

  setShowCollisions(value: boolean) {
    this.showCollisions = value;
    this.persistSettings();
    this.notify();
  }

  setFineMeshCollisions(value: boolean) {
    this.fineMeshCollisions = value;
    this.persistSettings();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.cachedSnapshot = {
      parts: Array.from(this.parts.values()),
      snapEnabled: this.snapEnabled,
      showCollisions: this.showCollisions,
      fineMeshCollisions: this.fineMeshCollisions,
    };
    for (const listener of this.listeners) {
      listener();
    }
  }

  getSnapshot(): AssemblySnapshot {
    return this.cachedSnapshot;
  }

  getPartById(id: string): PlacedPart | undefined {
    return this.parts.get(id);
  }

  getAllParts(): PlacedPart[] {
    return Array.from(this.parts.values());
  }

  /** Get which part occupies a position (returns first occupant) — used by BOM */
  getPartAt(pos: GridPosition): PlacedPart | undefined {
    const ids = this.gridOccupancy.get(gridKey(pos));
    if (!ids || ids.length === 0) return undefined;
    return this.parts.get(ids[0]);
  }

  /** Check if a grid cell has any occupant — used by snap system to avoid snapping onto occupied cells */
  isOccupied(pos: GridPosition): boolean {
    const ids = this.gridOccupancy.get(gridKey(pos));
    return !!ids && ids.length > 0;
  }

  /** Compute the world-space cells a part would occupy */
  private getRotatedWorldCells(
    def: { gridCells: GridPosition[] },
    position: GridPosition,
    rotation: Rotation3 = [0, 0, 0],
    orientation: Axis = "y",
  ): GridPosition[] {
    const rotated = rotateGridCells(def.gridCells, rotation);
    return getWorldCells(rotated, position, orientation);
  }

  /** Add a part to the assembly. Returns the instance ID. */
  addPart(
    definitionId: string,
    position: GridPosition,
    rotation: PlacedPart["rotation"] = [0, 0, 0],
    orientation?: PlacedPart["orientation"],
    color?: string,
  ): string | null {
    const def = getPartDefinition(definitionId);
    if (!def) return null;

    const instanceId = generateId();
    const part: PlacedPart = {
      instanceId,
      definitionId,
      position,
      rotation,
      orientation,
      color,
    };

    this.parts.set(instanceId, part);

    const effectiveOrientation = orientation ?? "y";
    const worldCells = this.getRotatedWorldCells(def, position, rotation, effectiveOrientation);
    for (const worldCell of worldCells) {
      for (const key of gridKeysForCell(worldCell)) {
        const ids = this.gridOccupancy.get(key) || [];
        if (!ids.includes(instanceId)) {
          ids.push(instanceId);
        }
        this.gridOccupancy.set(key, ids);
      }
    }

    this.notify();
    return instanceId;
  }

  /** Remove a part from the assembly */
  removePart(instanceId: string): PlacedPart | null {
    const part = this.parts.get(instanceId);
    if (!part) return null;

    const def = getPartDefinition(part.definitionId);
    if (def) {
      const effectiveOrientation = part.orientation ?? "y";
      const worldCells = this.getRotatedWorldCells(def, part.position, part.rotation, effectiveOrientation);
      for (const worldCell of worldCells) {
        for (const key of gridKeysForCell(worldCell)) {
          const ids = this.gridOccupancy.get(key);
          if (ids) {
            const filtered = ids.filter((id) => id !== instanceId);
            if (filtered.length === 0) {
              this.gridOccupancy.delete(key);
            } else {
              this.gridOccupancy.set(key, filtered);
            }
          }
        }
      }
    }

    this.parts.delete(instanceId);
    this.notify();
    return part;
  }

  /** Set the color override for a single part. Pass undefined to reset to default. */
  setPartColor(instanceId: string, color: string | undefined): boolean {
    const part = this.parts.get(instanceId);
    if (!part) return false;
    if (color === undefined) {
      delete part.color;
    } else {
      part.color = color;
    }
    this.notify();
    return true;
  }

  /** Set color for multiple parts at once (single notification). */
  setPartsColor(instanceIds: string[], color: string | undefined): void {
    let changed = false;
    for (const id of instanceIds) {
      const part = this.parts.get(id);
      if (!part) continue;
      if (color === undefined) {
        delete part.color;
      } else {
        part.color = color;
      }
      changed = true;
    }
    if (changed) this.notify();
  }

  /** Clear all parts */
  clear() {
    this.parts.clear();
    this.gridOccupancy.clear();
    this.notify();
  }

  /** Generate bill of materials */
  getBOM(): BOMEntry[] {
    const counts = new Map<string, number>();
    for (const part of this.parts.values()) {
      counts.set(part.definitionId, (counts.get(part.definitionId) || 0) + 1);
    }

    const entries: BOMEntry[] = [];
    for (const [defId, quantity] of counts) {
      const def = getPartDefinition(defId);
      if (def) {
        entries.push({
          definitionId: defId,
          name: def.name,
          category: def.category,
          quantity,
        });
      }
    }

    // Auto-calculate lock pins needed
    let lockPinsNeeded = 0;
    for (const part of this.parts.values()) {
      const def = getPartDefinition(part.definitionId);
      if (def?.category === "connector") {
        for (const cp of def.connectionPoints) {
          const orientedDir = transformDirection(cp.direction as any, part.orientation ?? "y");
          const rotatedDir = rotateDirection(orientedDir, part.rotation);
          const adjacentPos = getAdjacentPosition(part.position, rotatedDir);
          const adjacent = this.getPartAt(adjacentPos);
          if (adjacent) {
            const adjacentDef = getPartDefinition(adjacent.definitionId);
            if (adjacentDef?.category === "support") {
              lockPinsNeeded++;
            }
          }
        }
      }
    }

    if (lockPinsNeeded > 0) {
      const withSpare = Math.ceil(lockPinsNeeded * 1.1);
      entries.push({
        definitionId: "lockpin-standard",
        name: `Lock Pin (auto: ${lockPinsNeeded} + spare)`,
        category: "lockpin",
        quantity: withSpare,
      });
    }

    return entries.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  /** Serialize to JSON file format */
  serialize(name: string = "My Rack"): AssemblyFile {
    return {
      version: "1.0",
      name,
      parts: Array.from(this.parts.values()).map((p) => ({
        type: p.definitionId,
        position: p.position,
        rotation: p.rotation,
        orientation: p.orientation,
        ...(p.color ? { color: p.color } : {}),
      })),
    };
  }

  /** Load from JSON file format */
  deserialize(data: AssemblyFile) {
    this.clear();
    for (const p of data.parts) {
      const rot: PlacedPart["rotation"] = Array.isArray(p.rotation)
        ? (p.rotation as PlacedPart["rotation"])
        : [0, (p.rotation || 0) as any, 0];
      this.addPart(p.type, p.position, rot, p.orientation, p.color);
    }
  }
}
