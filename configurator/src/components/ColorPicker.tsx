import { useState, useCallback } from "react";
import { PART_COLORS } from "../constants";

const PRESET_COLORS = [
  { label: "Yellow", hex: PART_COLORS.support },
  { label: "Blue", hex: PART_COLORS.connector },
  { label: "Red", hex: PART_COLORS.lockpin },
  { label: "Green", hex: PART_COLORS.other },
  { label: "Purple", hex: PART_COLORS.custom },
  { label: "White", hex: "#ffffff" },
  { label: "Black", hex: "#222222" },
  { label: "Orange", hex: "#ff8c00" },
  { label: "Pink", hex: "#ff69b4" },
  { label: "Cyan", hex: "#00bcd4" },
  { label: "Lime", hex: "#8bc34a" },
  { label: "Gray", hex: "#9e9e9e" },
];

interface ColorPickerProps {
  currentColor: string | null;
  onColorChange: (color: string | undefined) => void;
}

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  const [customHex, setCustomHex] = useState(currentColor ?? "");

  const handleSwatchClick = useCallback((hex: string) => {
    onColorChange(hex);
    setCustomHex(hex);
  }, [onColorChange]);

  const handleReset = useCallback(() => {
    onColorChange(undefined);
    setCustomHex("");
  }, [onColorChange]);

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customHex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      onColorChange(trimmed);
    } else if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
      onColorChange(`#${trimmed}`);
    }
  }, [customHex, onColorChange]);

  return (
    <div className="color-picker">
      <div className="color-picker-header">
        <span className="color-picker-label">Color</span>
        <button
          className="color-picker-reset"
          onClick={handleReset}
          title="Reset to default category color"
        >
          Reset
        </button>
      </div>
      <div className="color-swatches">
        {PRESET_COLORS.map(({ label, hex }) => (
          <button
            key={hex}
            className={`color-swatch${currentColor === hex ? " active" : ""}`}
            style={{ backgroundColor: hex }}
            onClick={() => handleSwatchClick(hex)}
            title={label}
          />
        ))}
      </div>
      <div className="color-custom-row">
        <div
          className="color-preview"
          style={{ backgroundColor: currentColor ?? "#666" }}
        />
        <input
          className="color-hex-input"
          type="text"
          value={customHex}
          onChange={(e) => setCustomHex(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(); }}
          placeholder="#ff0000"
          maxLength={7}
        />
        <button className="color-apply-btn" onClick={handleCustomSubmit}>
          Apply
        </button>
      </div>
    </div>
  );
}
