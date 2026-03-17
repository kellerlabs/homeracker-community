import { useState } from "react";
import type { BOMEntry, PlacedPart } from "../types";
import { getPartDefinition } from "../data/catalog";
import { ColorPicker } from "./ColorPicker";

interface BOMPanelProps {
  entries: BOMEntry[];
  selectedPartIds: Set<string>;
  parts: PlacedPart[];
  onFlashPart: (instanceId: string) => void;
  onFlashDefinition: (definitionId: string) => void;
  onSetColor: (color: string | undefined) => void;
  inventory: Record<string, number>;
  onSetInventory: (inventory: Record<string, number>) => void;
}

function exportCSV(entries: BOMEntry[], inventory: Record<string, number>) {
  const header = "Part,Category,Quantity,Have,Need,Excess";
  const rows = entries.map((e) => {
    const have = inventory[e.definitionId] || 0;
    const diff = e.quantity - have;
    const need = Math.max(0, diff);
    const excess = Math.max(0, -diff);
    return `"${e.name}","${e.category}",${e.quantity},${have},${need},${excess}`;
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "homeracker-bom.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function BOMPanel({ entries, selectedPartIds, parts, onFlashPart, onFlashDefinition, onSetColor, inventory, onSetInventory }: BOMPanelProps) {
  const totalParts = entries.reduce((sum, e) => sum + e.quantity, 0);
  const [showInventory, setShowInventory] = useState(false);

  const selectedParts = parts.filter((p) => selectedPartIds.has(p.instanceId));

  // If all selected parts share the same color, show it; otherwise null (mixed)
  const currentColor = selectedParts.length > 0
    ? (selectedParts.every((p) => p.color === selectedParts[0].color) ? (selectedParts[0].color ?? null) : null)
    : null;

  const totalNeed = showInventory
    ? entries.reduce((sum, e) => sum + Math.max(0, e.quantity - (inventory[e.definitionId] || 0)), 0)
    : 0;
  const totalExcess = showInventory
    ? entries.reduce((sum, e) => sum + Math.max(0, (inventory[e.definitionId] || 0) - e.quantity), 0)
    : 0;

  const handleInventoryChange = (definitionId: string, value: string) => {
    const num = parseInt(value, 10);
    const next = { ...inventory };
    if (isNaN(num) || num <= 0) {
      delete next[definitionId];
    } else {
      next[definitionId] = num;
    }
    onSetInventory(next);
  };

  return (
    <div className={`bom-panel${showInventory ? " bom-panel-wide" : ""}`}>
      <div className="bom-header">
        <h2>Bill of Materials</h2>
        {entries.length > 0 && (
          <div className="bom-header-actions">
            <button
              className={`bom-inventory-btn${showInventory ? " active" : ""}`}
              onClick={() => setShowInventory(!showInventory)}
              title={showInventory ? "Hide inventory" : "Show inventory"}
            >
              Inventory
            </button>
            <button
              className="bom-export-btn"
              onClick={() => exportCSV(entries, inventory)}
              title="Export as CSV"
            >
              Export CSV
            </button>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="bom-empty">
          No parts placed yet. Select a part from the catalog and click on the
          grid to place it.
        </p>
      ) : (
        <>
          <table className="bom-table">
            <thead>
              <tr>
                <th>Part</th>
                <th>Qty</th>
                {showInventory && <th>Have</th>}
                {showInventory && <th>Need</th>}
                {showInventory && <th>Extra</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const have = inventory[entry.definitionId] || 0;
                const diff = entry.quantity - have;
                const need = Math.max(0, diff);
                const excess = Math.max(0, -diff);
                return (
                  <tr
                    key={entry.definitionId}
                    className="bom-row-clickable"
                    onClick={() => onFlashDefinition(entry.definitionId)}
                    title="Click to highlight in model"
                  >
                    <td>{entry.name}</td>
                    <td className="bom-qty">{entry.quantity}</td>
                    {showInventory && (
                      <td className="bom-inventory-cell" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min="0"
                          className="bom-inventory-input"
                          value={have || ""}
                          placeholder="0"
                          onChange={(e) => handleInventoryChange(entry.definitionId, e.target.value)}
                        />
                      </td>
                    )}
                    {showInventory && (
                      <td className={`bom-need${need > 0 ? " bom-need-remaining" : " bom-need-done"}`}>
                        {need}
                      </td>
                    )}
                    {showInventory && (
                      <td className={`bom-excess${excess > 0 ? " bom-excess-has" : ""}`}>
                        {excess > 0 ? `+${excess}` : ""}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bom-total">
            Total: {totalParts} parts
            {showInventory && <span className="bom-total-need"> | Need: {totalNeed}</span>}
            {showInventory && totalExcess > 0 && <span className="bom-total-excess"> | Extra: +{totalExcess}</span>}
          </div>
        </>
      )}

      {selectedParts.length > 0 && (
        <div className="selection-panel">
          <h3>Selected ({selectedParts.length})</h3>
          <ColorPicker currentColor={currentColor} onColorChange={onSetColor} />
          <ul className="selection-list">
            {selectedParts.map((p) => {
              const def = getPartDefinition(p.definitionId);
              return (
                <li
                  key={p.instanceId}
                  className="selection-item"
                  onClick={() => onFlashPart(p.instanceId)}
                >
                  {def?.name ?? p.definitionId}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
