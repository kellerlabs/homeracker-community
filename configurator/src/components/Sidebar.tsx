import { useState, useSyncExternalStore, useCallback } from "react";
import { PART_CATALOG } from "../data/catalog";
import { PART_COLORS } from "../constants";
import { subscribeCustomParts, getCustomPartsSnapshot, importModelFile, deleteCustomPart, downloadCustomPart } from "../data/custom-parts";
import { useThumbnail } from "../thumbnails/useThumbnail";
import type { InteractionMode, PartCategory, PartDefinition } from "../types";

interface SidebarProps {
  onSelectPart: (definitionId: string) => void;
  activeMode: InteractionMode;
}

const SECTIONS: { key: string; label: string; filter: (p: PartDefinition) => boolean }[] = [
  { key: "connector", label: "Connectors", filter: (p) => p.category === "connector" && !p.id.includes("-pt-") && !p.id.includes("-foot") },
  { key: "connector-pt", label: "Pull-Through", filter: (p) => p.category === "connector" && p.id.includes("-pt-") },
  { key: "support", label: "Supports", filter: (p) => p.category === "support" },
  { key: "connector-foot", label: "Feet", filter: (p) => p.category === "connector" && p.id.includes("-foot") && !p.id.includes("-pt-") },
  { key: "lockpin", label: "Lock Pins", filter: (p) => p.category === "lockpin" },
];

function getCategoryIcon(category: PartCategory): string {
  switch (category) {
    case "connector": return "+";
    case "support": return "||";
    case "other": return "3D";
    case "custom": return "3D";
    default: return ".";
  }
}

function PartButton({ part, isActive, onSelect }: { part: PartDefinition; isActive: boolean; onSelect: () => void }) {
  const color = PART_COLORS[part.category] || PART_COLORS.custom;
  const thumbnail = useThumbnail(part);
  return (
    <button
      className={`catalog-item ${isActive ? "active" : ""}`}
      onClick={onSelect}
      title={part.description}
    >
      <div
        className="catalog-item-preview"
        style={{
          backgroundColor: thumbnail ? "#d0d0d0" : color + "55",
          borderColor: color,
        }}
      >
        {thumbnail ? (
          <img src={thumbnail} alt={part.name} className="catalog-item-thumbnail" />
        ) : (
          <div className="catalog-item-icon" style={{ color }}>
            {getCategoryIcon(part.category)}
          </div>
        )}
      </div>
      <span className="catalog-item-name">{part.name}</span>
    </button>
  );
}

export function Sidebar({ onSelectPart, activeMode }: SidebarProps) {
  const activePlaceId =
    activeMode.type === "place" ? activeMode.definitionId : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("homeracker-collapsed");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Subscribe to custom parts changes
  const customSnapshot = useSyncExternalStore(
    subscribeCustomParts,
    getCustomPartsSnapshot,
  );

  const handleImportModel = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".stl,.3mf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const defs = await importModelFile(file);
        if (defs.length > 0) onSelectPart(defs[0].id);
      } catch (err) {
        console.error("Model import failed:", err);
      }
    };
    input.click();
  }, [onSelectPart]);

  const toggleCategory = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem("homeracker-collapsed", JSON.stringify([...next])); } catch { }
      return next;
    });
  }, []);

  const query = searchQuery.toLowerCase().trim();
  const isSearching = query.length > 0;

  const filterParts = (parts: PartDefinition[]) =>
    isSearching ? parts.filter((p) => p.name.toLowerCase().includes(query)) : parts;
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>HomeRacker Configurator</h1>
        <div className="sidebar-subtitle sidebar-links">
          <a href="https://github.com/ZachGoldberg/homeracker-configurator" target="_blank" rel="noopener noreferrer" title="Configurator GitHub">
            Configurator <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
          </a>

          <a href="https://github.com/kellerlabs/homeracker" target="_blank" rel="noopener noreferrer" title="HomeRacker Core GitHub">
            HomeRacker <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
          </a>
        </div>
      </div>

      <div className="sidebar-search-container">
        <input
          className="sidebar-search"
          type="text"
          placeholder="Filter parts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setSearchQuery(""); }}
        />
      </div>

      {SECTIONS.map(({ key, label, filter }) => {
        const parts = filterParts(PART_CATALOG.filter(filter));
        if (parts.length === 0) return null;

        const isCollapsed = !isSearching && collapsed.has(key);

        return (
          <div key={key} className="catalog-section">
            <h2
              className="catalog-section-title"
              onClick={() => toggleCategory(key)}
            >
              <span className="catalog-section-toggle">{isCollapsed ? "\u25b8" : "\u25be"}</span>
              {label}
              <span className="catalog-section-count">{parts.length}</span>
            </h2>
            {!isCollapsed && (
              <div className="catalog-grid">
                {parts.map((part) => (
                  <PartButton
                    key={part.id}
                    part={part}
                    isActive={activePlaceId === part.id}
                    onSelect={() => onSelectPart(part.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Other — raw models, grouped by source file */}
      {(() => {
        const otherParts = filterParts(PART_CATALOG.filter((p) => p.category === "other"));
        if (otherParts.length === 0) return null;

        const isOtherCollapsed = !isSearching && collapsed.has("other");

        // Group parts by their group field; ungrouped parts go into a flat list
        const groups: Map<string, PartDefinition[]> = new Map();
        const ungrouped: PartDefinition[] = [];
        for (const part of otherParts) {
          if (part.group) {
            const list = groups.get(part.group) ?? [];
            list.push(part);
            groups.set(part.group, list);
          } else {
            ungrouped.push(part);
          }
        }

        return (
          <div className="catalog-section">
            <h2
              className="catalog-section-title"
              onClick={() => toggleCategory("other")}
            >
              <span className="catalog-section-toggle">{isOtherCollapsed ? "\u25b8" : "\u25be"}</span>
              Other
              <span className="catalog-section-count">{otherParts.length}</span>
            </h2>
            {!isOtherCollapsed && (
              <>
                {ungrouped.length > 0 && (
                  <div className="catalog-grid">
                    {ungrouped.map((part) => (
                      <PartButton
                        key={part.id}
                        part={part}
                        isActive={activePlaceId === part.id}
                        onSelect={() => onSelectPart(part.id)}
                      />
                    ))}
                  </div>
                )}
                {[...groups.entries()].map(([groupName, parts]) => {
                  const groupKey = `other-group-${groupName}`;
                  const isGroupCollapsed = !isSearching && collapsed.has(groupKey);
                  return (
                    <div key={groupKey} className="catalog-subgroup">
                      <h3
                        className="catalog-subgroup-title"
                        onClick={() => toggleCategory(groupKey)}
                      >
                        <span className="catalog-section-toggle">{isGroupCollapsed ? "\u25b8" : "\u25be"}</span>
                        {groupName}
                        <span className="catalog-section-count">{parts.length}</span>
                      </h3>
                      {!isGroupCollapsed && (
                        <div className="catalog-grid">
                          {parts.map((part) => (
                            <PartButton
                              key={part.id}
                              part={part}
                              isActive={activePlaceId === part.id}
                              onSelect={() => onSelectPart(part.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })()}

      {/* Custom / Imported section */}
      {(() => {
        const customParts = filterParts(customSnapshot.definitions);
        const isCustomCollapsed = !isSearching && collapsed.has("custom");
        if (isSearching && customParts.length === 0) return null;

        return (
          <div className="catalog-section">
            <h2
              className="catalog-section-title"
              onClick={() => toggleCategory("custom")}
            >
              <span className="catalog-section-toggle">{isCustomCollapsed ? "\u25b8" : "\u25be"}</span>
              Custom
              {customParts.length > 0 && (
                <span className="catalog-section-count">{customParts.length}</span>
              )}
            </h2>
            {!isCustomCollapsed && (
              <>
                {customParts.length > 0 && (
                  <div className="catalog-grid" style={{ marginBottom: 8 }}>
                    {customParts.map((part) => (
                      <div key={part.id} className="catalog-item-wrapper">
                        <PartButton
                          part={part}
                          isActive={activePlaceId === part.id}
                          onSelect={() => onSelectPart(part.id)}
                        />
                        <button
                          className="catalog-item-download"
                          title={`Download ${part.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadCustomPart(part.id);
                          }}
                        >
                          &#8595;
                        </button>
                        <button
                          className="catalog-item-delete"
                          title={`Remove ${part.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomPart(part.id);
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="catalog-import-btn" onClick={handleImportModel}>
                  Import Model
                </button>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
