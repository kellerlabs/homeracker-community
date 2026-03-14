import type { InteractionMode } from "../types";

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onDelete?: () => void;
  selectedCount: number;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  onShare: () => void;
  onEscape: () => void;
  mode: InteractionMode;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  showCollisions: boolean;
  onToggleCollisions: () => void;
  fineMeshCollisions: boolean;
  onToggleFineMesh: () => void;
}

export function Toolbar({
  onUndo,
  onRedo,
  onDelete,
  selectedCount,
  onClear,
  onSave,
  onLoad,
  onShare,
  onEscape,
  mode,
  snapEnabled,
  onToggleSnap,
  showCollisions,
  onToggleCollisions,
  fineMeshCollisions,
  onToggleFineMesh,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button
          className="toolbar-btn"
          onClick={onRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
      </div>

      <div className="toolbar-group">
        {onDelete && (
          <button
            className="toolbar-btn toolbar-btn-danger"
            onClick={onDelete}
            title="Delete selected (Del)"
          >
            Delete{selectedCount > 1 ? ` (${selectedCount})` : ""}
          </button>
        )}
        <button
          className="toolbar-btn toolbar-btn-danger"
          onClick={onClear}
          title="Clear all parts"
        >
          Clear All
        </button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onSave} title="Save assembly">
          Save
        </button>
        <button className="toolbar-btn" onClick={onLoad} title="Load assembly">
          Load
        </button>
        <button className="toolbar-btn" onClick={onShare} title="Copy shareable link">
          Share
        </button>
      </div>

      <div className="toolbar-group">
        <button
          className={`toolbar-btn${!snapEnabled ? " toolbar-btn-active" : ""}`}
          onClick={onToggleSnap}
          title="Toggle snap-to-connection points"
        >
          Snap: {snapEnabled ? "On" : "Off"}
        </button>
        <button
          className={`toolbar-btn${showCollisions ? " toolbar-btn-active" : ""}`}
          onClick={onToggleCollisions}
          title="Highlight overlapping/colliding parts"
        >
          Show Collisions: {showCollisions ? "On" : "Off"}
        </button>
        {showCollisions && (
          <button
            className={`toolbar-btn${fineMeshCollisions ? " toolbar-btn-active" : ""}`}
            onClick={onToggleFineMesh}
            title="Use precise mesh intersection (slower but more accurate)"
          >
            Fine Mesh Collision Algorithm: {fineMeshCollisions ? "On" : "Off"}
          </button>
        )}
      </div>

      {mode.type === "place" && (
        <div className="toolbar-group">
          <span className="toolbar-mode-label">
            Placing: {mode.definitionId}
          </span>
          <button className="toolbar-btn" onClick={onEscape}>
            Cancel (Esc)
          </button>
        </div>
      )}

      {mode.type === "paste" && (
        <div className="toolbar-group">
          <span className="toolbar-mode-label">
            Pasting {mode.clipboard.parts.length} part(s)
          </span>
          <button className="toolbar-btn" onClick={onEscape}>
            Cancel (Esc)
          </button>
        </div>
      )}
    </div>
  );
}
