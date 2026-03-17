import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { ViewportCanvas } from "./ViewportCanvas";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { BOMPanel } from "./BOMPanel";
import { AssemblyState } from "../assembly/AssemblyState";
import { HistoryManager, type Command } from "../assembly/HistoryManager";
import type { InteractionMode, GridPosition, PlacedPart, Axis, Rotation3, ClipboardData } from "../types";
import { findBestSnap, findSnapPoints, findBestConnectorSnap, findConnectorSnapPoints, computeAutoRotation } from "../assembly/snap";
import { computeGroundLift } from "../assembly/grid-utils";
import { detectCollidingPartIds, detectCollidingPartIdsMesh } from "../assembly/collision";
import { restoreCustomParts, importModelFile, isCustomPart, getEmbeddedCustomParts, restoreEmbeddedCustomParts } from "../data/custom-parts";
import { encodeAssemblyToHash, decodeAssemblyFromHash, hasCustomParts } from "../sharing/url-sharing";

// Global singleton instances
const assembly = new AssemblyState();
const history = new HistoryManager();

const STORAGE_KEY = "homeracker-scene";
const INVENTORY_STORAGE_KEY = "homeracker-inventory";

// Restore custom parts (IndexedDB) THEN assembly (localStorage or URL hash).
// Custom part definitions must exist before deserialize() resolves their IDs.
const initPromise = restoreCustomParts()
  .catch(() => {}) // IndexedDB may be unavailable
  .then(async () => {
    // URL hash takes priority over localStorage
    if (location.hash.startsWith("#scene=")) {
      const data = await decodeAssemblyFromHash(location.hash);
      if (data) {
        assembly.deserialize(data);
        window.history.replaceState(null, "", location.pathname + location.search);
        return;
      }
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) assembly.deserialize(JSON.parse(saved));
    } catch {
      // Ignore corrupt/missing data
    }
  });

// Auto-persist scene to localStorage on every change
assembly.subscribe(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assembly.serialize()));
  } catch {
    // Ignore quota errors
  }
});

// Expose for e2e testing
(window as any).__assembly = assembly;
(window as any).__snap = { findBestSnap, findSnapPoints, findBestConnectorSnap, findConnectorSnapPoints, computeAutoRotation };
(window as any).__importSTL = importModelFile; // backward compat for e2e
(window as any).__importModel = importModelFile;
(window as any).__computeGroundLift = computeGroundLift;
(window as any).__collision = { detectCollidingPartIds, detectCollidingPartIdsMesh };

export function App() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<InteractionMode>({ type: "select" });
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [flashPartId, setFlashPartId] = useState<string | null>(null);
  const [flashDefinitionId, setFlashDefinitionId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});

  const handleFlashPart = useCallback((instanceId: string) => {
    setFlashPartId(instanceId);
    setTimeout(() => setFlashPartId(null), 600);
  }, []);

  const handleFlashDefinition = useCallback((definitionId: string) => {
    setFlashDefinitionId(definitionId);
    setTimeout(() => setFlashDefinitionId(null), 600);
  }, []);

  const handleSetInventory = useCallback((newInventory: Record<string, number>) => {
    setInventory(newInventory);
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(newInventory));
    } catch { /* ignore quota errors */ }
  }, []);

  // Wait for custom parts + assembly restore before rendering
  useEffect(() => {
    initPromise.then(() => {
      // Restore inventory from localStorage
      try {
        const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
        if (saved) setInventory(JSON.parse(saved));
      } catch { /* ignore */ }
      setReady(true);
    });
  }, []);

  // Subscribe to assembly changes for re-renders
  const snapshot = useSyncExternalStore(
    (cb) => assembly.subscribe(cb),
    () => assembly.getSnapshot()
  );

  const handleSelectPart = useCallback((definitionId: string) => {
    setMode({ type: "place", definitionId });
    setSelectedPartIds(new Set());
  }, []);

  const handlePlacePart = useCallback(
    (definitionId: string, position: GridPosition, rotation: PlacedPart["rotation"] = [0, 0, 0], orientation?: Axis) => {
      const cmd: Command = {
        description: `Place ${definitionId}`,
        execute() {
          assembly.addPart(definitionId, position, rotation, orientation);
        },
        undo() {
          // Find the most recently added part with this definition at this position
          const parts = assembly.getAllParts();
          const match = parts.find(
            (p) =>
              p.definitionId === definitionId &&
              p.position[0] === position[0] &&
              p.position[1] === position[1] &&
              p.position[2] === position[2]
          );
          if (match) assembly.removePart(match.instanceId);
        },
      };
      history.execute(cmd);
    },
    []
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedPartIds.size === 0) return;
    const partsToDelete = [...selectedPartIds]
      .map((id) => assembly.getPartById(id))
      .filter((p): p is PlacedPart => !!p)
      .map((p) => ({ ...p }));
    if (partsToDelete.length === 0) return;

    const cmd: Command = {
      description: `Delete ${partsToDelete.length} part(s)`,
      execute() {
        for (const p of partsToDelete) assembly.removePart(p.instanceId);
      },
      undo() {
        for (const p of partsToDelete) {
          assembly.addPart(p.definitionId, p.position, p.rotation, p.orientation, p.color);
        }
      },
    };
    history.execute(cmd);
    setSelectedPartIds(new Set());
  }, [selectedPartIds]);

  const handleMovePart = useCallback(
    (instanceId: string, newPosition: GridPosition, newRotation?: PlacedPart["rotation"], newOrientation?: Axis) => {
      const part = assembly.getPartById(instanceId);
      if (!part) return;

      const rotation = newRotation ?? part.rotation;
      const orientation = newOrientation ?? part.orientation;
      const samePosition =
        part.position[0] === newPosition[0] &&
        part.position[1] === newPosition[1] &&
        part.position[2] === newPosition[2];
      const sameRotation =
        part.rotation[0] === rotation[0] &&
        part.rotation[1] === rotation[1] &&
        part.rotation[2] === rotation[2];
      const sameOrientation = part.orientation === orientation;
      if (samePosition && sameRotation && sameOrientation) return; // No-op

      const oldPosition = part.position;
      const oldRotation = part.rotation;
      const oldOrientation = part.orientation;
      const oldColor = part.color;
      const definitionId = part.definitionId;

      const cmd: Command = {
        description: `Move ${definitionId}`,
        execute() {
          assembly.removePart(instanceId);
          assembly.addPart(definitionId, newPosition, rotation, orientation, oldColor);
        },
        undo() {
          // Find the part at the new position and move it back
          const parts = assembly.getAllParts();
          const match = parts.find(
            (p) =>
              p.definitionId === definitionId &&
              p.position[0] === newPosition[0] &&
              p.position[1] === newPosition[1] &&
              p.position[2] === newPosition[2]
          );
          if (match) {
            assembly.removePart(match.instanceId);
            assembly.addPart(definitionId, oldPosition, oldRotation, oldOrientation, oldColor);
          }
        },
      };
      history.execute(cmd);
    },
    []
  );

  const handleMoveSelectedParts = useCallback(
    (primaryId: string, newPosition: GridPosition, newRotation?: PlacedPart["rotation"], newOrientation?: Axis) => {
      const primary = assembly.getPartById(primaryId);
      if (!primary) return;

      const delta: GridPosition = [
        newPosition[0] - primary.position[0],
        newPosition[1] - primary.position[1],
        newPosition[2] - primary.position[2],
      ];
      if (delta[0] === 0 && delta[1] === 0 && delta[2] === 0 && !newRotation && !newOrientation) return;

      // Snapshot all selected parts before moving
      const partsToMove: { id: string; def: string; oldPos: GridPosition; oldRot: Rotation3; oldOrient?: Axis; color?: string; newPos: GridPosition; newRot: Rotation3; newOrient?: Axis }[] = [];
      for (const id of selectedPartIds) {
        const part = assembly.getPartById(id);
        if (!part) continue;
        const isPrimary = id === primaryId;
        partsToMove.push({
          id,
          def: part.definitionId,
          oldPos: part.position,
          oldRot: part.rotation,
          oldOrient: part.orientation,
          color: part.color,
          newPos: isPrimary ? newPosition : [part.position[0] + delta[0], part.position[1] + delta[1], part.position[2] + delta[2]],
          newRot: isPrimary ? (newRotation ?? part.rotation) : part.rotation,
          newOrient: isPrimary ? (newOrientation ?? part.orientation) : part.orientation,
        });
      }

      const cmd: Command = {
        description: `Move ${partsToMove.length} part(s)`,
        execute() {
          // Remove all first, then re-add at new positions (avoids collision with each other)
          for (const p of partsToMove) assembly.removePart(p.id);
          for (const p of partsToMove) assembly.addPart(p.def, p.newPos, p.newRot, p.newOrient, p.color);
        },
        undo() {
          // Remove parts at new positions, re-add at old positions
          const allParts = assembly.getAllParts();
          for (const p of partsToMove) {
            const match = allParts.find(
              (ap) => ap.definitionId === p.def &&
                ap.position[0] === p.newPos[0] && ap.position[1] === p.newPos[1] && ap.position[2] === p.newPos[2]
            );
            if (match) assembly.removePart(match.instanceId);
          }
          for (const p of partsToMove) assembly.addPart(p.def, p.oldPos, p.oldRot, p.oldOrient, p.color);
        },
      };
      history.execute(cmd);
    },
    [selectedPartIds]
  );

  const handleNudgeParts = useCallback(
    (dx: number, dy: number, dz: number) => {
      if (selectedPartIds.size === 0) return;

      const partsToNudge: { id: string; def: string; oldPos: GridPosition; rot: Rotation3; orient?: Axis; color?: string }[] = [];
      for (const id of selectedPartIds) {
        const part = assembly.getPartById(id);
        if (!part) continue;
        partsToNudge.push({
          id,
          def: part.definitionId,
          oldPos: part.position,
          rot: part.rotation,
          orient: part.orientation,
          color: part.color,
        });
      }
      if (partsToNudge.length === 0) return;

      const cmd: Command = {
        description: `Nudge ${partsToNudge.length} part(s)`,
        execute() {
          for (const p of partsToNudge) assembly.removePart(p.id);
          for (const p of partsToNudge) {
            const newPos: GridPosition = [p.oldPos[0] + dx, p.oldPos[1] + dy, p.oldPos[2] + dz];
            assembly.addPart(p.def, newPos, p.rot, p.orient, p.color);
          }
        },
        undo() {
          // Remove parts at nudged positions, re-add at original positions
          const allParts = assembly.getAllParts();
          for (const p of partsToNudge) {
            const newPos: GridPosition = [p.oldPos[0] + dx, p.oldPos[1] + dy, p.oldPos[2] + dz];
            const match = allParts.find(
              (ap) => ap.definitionId === p.def &&
                ap.position[0] === newPos[0] && ap.position[1] === newPos[1] && ap.position[2] === newPos[2]
            );
            if (match) assembly.removePart(match.instanceId);
          }
          for (const p of partsToNudge) assembly.addPart(p.def, p.oldPos, p.rot, p.orient, p.color);
        },
      };
      history.execute(cmd);
      // Re-select nudged parts (they get new IDs after remove+add)
      const allParts = assembly.getAllParts();
      const newIds = new Set<string>();
      for (const p of partsToNudge) {
        const newPos: GridPosition = [p.oldPos[0] + dx, p.oldPos[1] + dy, p.oldPos[2] + dz];
        const match = allParts.find(
          (ap) => ap.definitionId === p.def &&
            ap.position[0] === newPos[0] && ap.position[1] === newPos[1] && ap.position[2] === newPos[2]
        );
        if (match) newIds.add(match.instanceId);
      }
      setSelectedPartIds(newIds);
    },
    [selectedPartIds]
  );

  const handleClickPart = useCallback(
    (instanceId: string, shiftKey: boolean) => {
      if (mode.type === "select") {
        setSelectedPartIds((prev) => {
          if (shiftKey) {
            const next = new Set(prev);
            if (next.has(instanceId)) next.delete(instanceId);
            else next.add(instanceId);
            return next;
          }
          // Toggle single selection
          if (prev.size === 1 && prev.has(instanceId)) return new Set();
          return new Set([instanceId]);
        });
      }
    },
    [mode]
  );

  const handleClickEmpty = useCallback(() => {
    setSelectedPartIds(new Set());
  }, []);

  const handleBoxSelect = useCallback((ids: string[]) => {
    setSelectedPartIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const handleEscape = useCallback(() => {
    setMode({ type: "select" });
    setSelectedPartIds(new Set());
  }, []);

  const handleUndo = useCallback(() => { history.undo(); setSelectedPartIds(new Set()); }, []);
  const handleRedo = useCallback(() => { history.redo(); setSelectedPartIds(new Set()); }, []);

  const handleCopy = useCallback(() => {
    if (selectedPartIds.size === 0) return;
    const parts = [...selectedPartIds]
      .map((id) => assembly.getPartById(id))
      .filter((p): p is PlacedPart => !!p);
    if (parts.length === 0) return;

    const cx = parts.reduce((s, p) => s + p.position[0], 0) / parts.length;
    const cy = parts.reduce((s, p) => s + p.position[1], 0) / parts.length;
    const cz = parts.reduce((s, p) => s + p.position[2], 0) / parts.length;
    const centerX = Math.round(cx);
    const centerY = Math.round(cy);
    const centerZ = Math.round(cz);

    const clipboard: ClipboardData = {
      parts: parts.map((p) => ({
        definitionId: p.definitionId,
        offset: [
          p.position[0] - centerX,
          p.position[1] - centerY,
          p.position[2] - centerZ,
        ] as GridPosition,
        rotation: p.rotation,
        orientation: p.orientation,
        color: p.color,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify({ homeracker: "clipboard", ...clipboard })).catch(() => {});
    setToast(`Copied ${parts.length} part(s)`);
    setTimeout(() => setToast(null), 2000);
  }, [selectedPartIds]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (data?.homeracker !== "clipboard" || !Array.isArray(data.parts)) return;
      const clipboard: ClipboardData = { parts: data.parts };
      setMode({ type: "paste", clipboard });
      setSelectedPartIds(new Set());
    } catch {
      // Not valid clipboard data — ignore
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        handlePaste();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleCopy, handlePaste]);

  const handleClear = useCallback(() => {
    assembly.clear();
    history.clear();
    setSelectedPartIds(new Set());
  }, []);

  const handleSave = useCallback(async () => {
    const data = assembly.serialize();
    // Embed custom STL/3MF binaries so the file is portable
    const embedded = await getEmbeddedCustomParts(data.parts.map((p) => p.type));
    if (embedded.length > 0) {
      data.customParts = embedded;
    }
    // Include inventory if any values are set
    const hasInventory = Object.values(inventory).some((v) => v > 0);
    if (hasInventory) {
      data.inventory = inventory;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.name.replace(/\s+/g, "-").toLowerCase()}.homeracker.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [inventory]);

  const handleLoad = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.homeracker.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        // Restore embedded custom parts before deserializing the assembly
        if (data.customParts && Array.isArray(data.customParts)) {
          await restoreEmbeddedCustomParts(data.customParts);
        }
        assembly.deserialize(data);
        history.clear();
        setSelectedPartIds(new Set());
        // Restore inventory from loaded file
        if (data.inventory && typeof data.inventory === "object") {
          handleSetInventory(data.inventory);
        } else {
          handleSetInventory({});
        }
      } catch (e) {
        console.error("Failed to load assembly:", e);
      }
    };
    input.click();
  }, [handleSetInventory]);

  const handleToggleSnap = useCallback(() => {
    assembly.setSnapEnabled(!assembly.snapEnabled);
  }, []);

  const handleToggleCollisions = useCallback(() => {
    assembly.setShowCollisions(!assembly.showCollisions);
  }, []);

  const handleToggleFineMesh = useCallback(() => {
    assembly.setFineMeshCollisions(!assembly.fineMeshCollisions);
  }, []);

  const [toast, setToast] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    const data = assembly.serialize();
    if (hasCustomParts(data)) {
      data.parts = data.parts.filter((p) => !isCustomPart(p.type));
      if (data.parts.length === 0) {
        setToast("Nothing to share — custom STL parts can't be included in links");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setToast("Custom STL parts excluded from shared link");
      setTimeout(() => setToast(null), 3000);
    }
    const hash = await encodeAssemblyToHash(data);
    const url = location.origin + location.pathname + hash;
    await navigator.clipboard.writeText(url);
    setToast((prev) => prev ?? "Link copied to clipboard!");
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handlePasteParts = useCallback(
    (clipboard: ClipboardData, targetPosition: GridPosition, extraRotation?: Rotation3) => {
      const addRot = (a: Rotation3, b: Rotation3): Rotation3 => [
        ((a[0] + b[0]) % 360) as Rotation3[0],
        ((a[1] + b[1]) % 360) as Rotation3[1],
        ((a[2] + b[2]) % 360) as Rotation3[2],
      ];
      const addedParts: { definitionId: string; position: GridPosition; rotation: Rotation3; orientation?: Axis; color?: string }[] = [];
      for (const cp of clipboard.parts) {
        const pos: GridPosition = [
          targetPosition[0] + cp.offset[0],
          targetPosition[1] + cp.offset[1],
          targetPosition[2] + cp.offset[2],
        ];
        const rot = extraRotation ? addRot(cp.rotation, extraRotation) : cp.rotation;
        addedParts.push({ definitionId: cp.definitionId, position: pos, rotation: rot, orientation: cp.orientation, color: cp.color });
      }
      if (addedParts.length === 0) return;

      const cmd: Command = {
        description: `Paste ${addedParts.length} part(s)`,
        execute() {
          for (const p of addedParts) {
            assembly.addPart(p.definitionId, p.position, p.rotation, p.orientation, p.color);
          }
        },
        undo() {
          // Remove in reverse order
          for (let i = addedParts.length - 1; i >= 0; i--) {
            const p = addedParts[i];
            const parts = assembly.getAllParts();
            const match = parts.find(
              (pp) =>
                pp.definitionId === p.definitionId &&
                pp.position[0] === p.position[0] &&
                pp.position[1] === p.position[1] &&
                pp.position[2] === p.position[2]
            );
            if (match) assembly.removePart(match.instanceId);
          }
        },
      };
      history.execute(cmd);
      setMode({ type: "select" });
    },
    []
  );

  const handleSetColor = useCallback(
    (color: string | undefined) => {
      if (selectedPartIds.size === 0) return;

      const colorChanges: Array<{ instanceId: string; oldColor: string | undefined }> = [];
      for (const id of selectedPartIds) {
        const part = assembly.getPartById(id);
        if (part) {
          colorChanges.push({ instanceId: id, oldColor: part.color });
        }
      }
      if (colorChanges.length === 0) return;

      const ids = colorChanges.map((c) => c.instanceId);

      const cmd: Command = {
        description: `Color ${colorChanges.length} part(s)`,
        execute() {
          assembly.setPartsColor(ids, color);
        },
        undo() {
          for (const { instanceId, oldColor } of colorChanges) {
            assembly.setPartColor(instanceId, oldColor);
          }
        },
      };
      history.execute(cmd);
    },
    [selectedPartIds]
  );

  const bom = assembly.getBOM();

  if (!ready) return null;

  return (
    <div className="app">
      <Sidebar onSelectPart={handleSelectPart} activeMode={mode} />
      <div className="main-area">
        <Toolbar
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDelete={selectedPartIds.size > 0 ? handleDeleteSelected : undefined}
          selectedCount={selectedPartIds.size}
          onClear={handleClear}
          onSave={handleSave}
          onLoad={handleLoad}
          onShare={handleShare}
          onEscape={handleEscape}
          mode={mode}
          snapEnabled={snapshot.snapEnabled}
          onToggleSnap={handleToggleSnap}
          showCollisions={snapshot.showCollisions}
          onToggleCollisions={handleToggleCollisions}
          fineMeshCollisions={snapshot.fineMeshCollisions}
          onToggleFineMesh={handleToggleFineMesh}
        />
        <ViewportCanvas
          parts={snapshot.parts}
          mode={mode}
          selectedPartIds={selectedPartIds}
          assembly={assembly}
          onPlacePart={handlePlacePart}
          onMovePart={handleMovePart}
          onMoveSelectedParts={handleMoveSelectedParts}
          onClickPart={handleClickPart}
          onClickEmpty={handleClickEmpty}
          onBoxSelect={handleBoxSelect}
          onNudgeParts={handleNudgeParts}
          onDeleteSelected={handleDeleteSelected}
          onPasteParts={handlePasteParts}
          onEscape={handleEscape}
          flashPartId={flashPartId}
          flashDefinitionId={flashDefinitionId}
          snapEnabled={snapshot.snapEnabled}
          showCollisions={snapshot.showCollisions}
          fineMeshCollisions={snapshot.fineMeshCollisions}
        />
      </div>
      <BOMPanel entries={bom} selectedPartIds={selectedPartIds} parts={snapshot.parts} onFlashPart={handleFlashPart} onFlashDefinition={handleFlashDefinition} onSetColor={handleSetColor} inventory={inventory} onSetInventory={handleSetInventory} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
