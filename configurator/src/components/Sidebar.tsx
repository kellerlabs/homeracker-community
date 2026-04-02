import { useThumbnail } from "../thumbnails/useThumbnail";
import { PART_CATALOG } from "../data/catalog";
import { useState, useCallback, useRef, useMemo, forwardRef } from "react";
import { ResizableBox } from "react-resizable";
import { PART_COLORS } from "../constants";
import type { InteractionMode, PartDefinition, PartCategory } from "../types";

const SECTIONS: { key: PartCategory; label: string }[] = [
  { key: "connector", label: "Connectors" },
  { key: "support", label: "Supports" },
  { key: "lockpin", label: "Lock Pins" },
  { key: "other", label: "Other" },
  { key: "custom", label: "Custom" },
];

const STICKY_H = 32;

export function Sidebar({
  onSelectPart,
  activeMode,
  usedDefinitionIds,
}: {
  onSelectPart: (id: string) => void;
  activeMode: InteractionMode;
  usedDefinitionIds: Set<string>;
}) {
  const [activeSection, setActiveSection] = useState<PartCategory>(
    SECTIONS[0].key,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<PartCategory, HTMLDivElement>>>({});

  const grouped = useMemo(
    () =>
      PART_CATALOG.reduce(
        (acc, part) => {
          const cat = part.category as PartCategory;
          (acc[cat] ??= []).push(part);
          return acc;
        },
        {} as Partial<Record<PartCategory, PartDefinition[]>>,
      ),
    [],
  );

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    let current: PartCategory = SECTIONS[0].key;
    for (const { key } of SECTIONS) {
      const el = sectionRefs.current[key];
      if (el && el.offsetTop <= scrollTop + STICKY_H + 2) {
        current = key;
      }
    }
    setActiveSection(current);
  }, []);

  const scrollToSection = useCallback((key: PartCategory) => {
    const el = sectionRefs.current[key];
    const container = scrollRef.current;
    if (!el || !container) return;
    container.scrollTo({ top: el.offsetTop - STICKY_H, behavior: "smooth" });
    setActiveSection(key);
  }, []);

  const activeLabel = SECTIONS.find((s) => s.key === activeSection)?.label;

  return (
    <ResizableBox
      width={300}
      height={Infinity}
      minConstraints={[300, 0]}
      maxConstraints={[800, Infinity]}
      axis="x"
      resizeHandles={["e"]}
      handle={(_axis, ref) => (
        <ResizeHandle ref={ref as React.RefObject<HTMLDivElement>} />
      )}
      style={{ flexShrink: 0 }}
      className="relative flex flex-col h-full bg-secondary border-r border-border"
    >
      <>
        <Header />
        <div className="flex flex-row flex-1 overflow-hidden">
          <div className="flex flex-col gap-0.5 p-1 shrink-0 border-r border-border">
            {SECTIONS.map(({ key, label }) => (
              <SubMenu
                key={key}
                label={label}
                isActive={activeSection === key}
                onClick={() => scrollToSection(key)}
              />
            ))}
          </div>
          <div
            ref={scrollRef}
            className="relative flex-1 overflow-y-auto thin-scrollbar"
            onScroll={handleScroll}
          >
            <div className="sticky top-0 z-10 flex h-8 items-center px-3 bg-secondary/90 backdrop-blur-sm border-b border-border">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                {activeLabel}
              </span>
            </div>
            {SECTIONS.map(({ key, label }) => {
              const parts = grouped[key];
              if (!parts?.length) return null;
              return (
                <div key={key}>
                  <div
                    ref={(el) => {
                      if (el) sectionRefs.current[key] = el;
                    }}
                    className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted/50 select-none"
                  >
                    {label}
                  </div>

                  <div className="flex flex-wrap gap-2 px-2 pb-3">
                    {parts.map((part) => (
                      <PartButton
                        key={part.id}
                        part={part}
                        isActive={activeMode === part.id}
                        onSelect={() => onSelectPart(part.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    </ResizableBox>
  );
}

const ResizeHandle = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function ResizeHandle(props, ref) {
  return (
    <div
      ref={ref}
      {...props}
      className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize z-50 bg-transparent hover:bg-gray-500/50 transition-colors duration-150"
    />
  );
});

function PartButton({
  part,
  isActive,
  onSelect,
}: {
  part: PartDefinition;
  isActive: boolean;
  onSelect: () => void;
}) {
  const color = PART_COLORS[part.category] ?? PART_COLORS.custom;
  const thumbnail = useThumbnail(part);

  return (
    <button
      onClick={onSelect}
      title={part.description}
      className={[
        "min-w-0 overflow-hidden rounded-md border px-1.5 py-2",
        "cursor-pointer text-center text-[11px] transition-colors duration-150",
        isActive
          ? "border-accent bg-accent text-black"
          : "border-border bg-primary text-body hover:border-accent hover:bg-tertiary",
      ].join(" ")}
    >
      <div
        className="mb-1 flex h-20 w-full items-center justify-center rounded border"
        style={{
          backgroundColor: isActive
            ? "rgba(0,0,0,0.25)"
            : thumbnail
              ? "#d0d0d0"
              : color + "55",
          borderColor: color,
        }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={part.name}
            className="h-full w-full object-contain rounded"
          />
        ) : (
          <span className="text-lg font-bold" style={{ color }}>
            {getCategoryIcon(part.category)}
          </span>
        )}
      </div>
      <span className="block truncate">{part.name}</span>
    </button>
  );
}

function SubMenu({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-14 h-14 rounded-xl text-xs transition-colors duration-150",
        isActive
          ? "bg-accent text-black font-semibold"
          : "bg-tertiary text-muted hover:bg-primary",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Header() {
  return (
    <div className="p-4 border-b border-border shrink-0">
      <h1 className="text-lg font-bold text-accent">HomeRacker Configurator</h1>
      <div className="flex gap-2.5 mt-1.5">
        <a
          href="https://github.com/kellerlabs/homeracker-community/tree/main/configurator"
          target="_blank"
          rel="noopener noreferrer"
          title="Configurator GitHub"
          className="inline-flex items-center gap-1 text-xs text-muted no-underline opacity-70 transition-opacity duration-150 hover:opacity-100"
        >
          Configurator <Github />
        </a>
        <a
          href="https://github.com/kellerlabs/homeracker"
          target="_blank"
          rel="noopener noreferrer"
          title="HomeRacker Core GitHub"
          className="inline-flex items-center gap-1 text-xs text-muted no-underline opacity-70 transition-opacity duration-150 hover:opacity-100"
        >
          HomeRacker <Github />
        </a>
      </div>
    </div>
  );
}

function getCategoryIcon(category: PartCategory): string {
  switch (category) {
    case "support":
      return "||";
    case "connector":
      return "+";
    case "lockpin":
      return "⊕";
    case "other":
      return "3D";
    case "custom":
      return "★";
    default:
      return "·";
  }
}

function Github() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
