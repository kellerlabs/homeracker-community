/** 3D grid position as integer multiples of BASE_UNIT */
export type GridPosition = [number, number, number];

/** Part category */
export type PartCategory = "support" | "connector" | "lockpin" | "other" | "custom";

/** Direction an arm/connection faces */
export type Direction = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

/** Axis a support spans along */
export type Axis = "x" | "y" | "z";

/** Connection point on a part */
export interface ConnectionPoint {
  /** Grid offset from part origin */
  offset: GridPosition;
  /** Direction the connection faces */
  direction: Direction;
  /** male = support end, female = connector socket */
  type: "male" | "female";
}

/** Definition of a part type in the catalog */
export interface PartDefinition {
  id: string;
  category: PartCategory;
  name: string;
  description: string;
  modelPath: string;
  thumbnailPath?: string;
  /** Connection points where other parts attach */
  connectionPoints: ConnectionPoint[];
  /** Grid cells this part occupies relative to its origin */
  gridCells: GridPosition[];
  /** For pull-through connectors: which axis supports can pass through (before rotation) */
  pullThroughAxis?: Axis;
  /** Group name for organizing parts into sub-folders (e.g. multi-part 3MF files) */
  group?: string;
}

/** Rotation step: 0, 90, 180, or 270 degrees */
export type RotationStep = 0 | 90 | 180 | 270;

/** 3-axis rotation in degrees [X, Y, Z], each a multiple of 90 */
export type Rotation3 = [RotationStep, RotationStep, RotationStep];

/** A part placed in the assembly */
export interface PlacedPart {
  /** Unique instance ID */
  instanceId: string;
  /** References PartDefinition.id */
  definitionId: string;
  /** Grid position */
  position: GridPosition;
  /** Rotation in degrees [X, Y, Z] */
  rotation: Rotation3;
  /** For supports: which axis the beam spans */
  orientation?: Axis;
  /** Optional color override (hex string, e.g. "#ff0000"). undefined = use category default. */
  color?: string;
}

/** A part in the clipboard, with position relative to selection center */
export interface ClipboardPart {
  definitionId: string;
  offset: GridPosition;
  rotation: Rotation3;
  orientation?: Axis;
  color?: string;
}

/** Clipboard data for copy/paste */
export interface ClipboardData {
  parts: ClipboardPart[];
}

/** Interaction mode */
export type InteractionMode =
  | { type: "select" }
  | { type: "place"; definitionId: string }
  | { type: "paste"; clipboard: ClipboardData };

/** State for a part being dragged */
export interface DragState {
  instanceId: string;
  definitionId: string;
  originalPosition: GridPosition;
  rotation: Rotation3;
  orientation?: Axis;
}

/** BOM entry */
export interface BOMEntry {
  definitionId: string;
  name: string;
  category: PartCategory;
  quantity: number;
}

/** Embedded custom part data for portable save files */
export interface EmbeddedCustomPart {
  id: string;
  name: string;
  format: "stl" | "3mf";
  gridCells: GridPosition[];
  /** Base64-encoded binary data */
  data: string;
}

/** Serialized assembly format */
export interface AssemblyFile {
  version: "1.0";
  name: string;
  parts: Array<{
    type: string;
    position: GridPosition;
    rotation: [number, number, number];
    orientation?: Axis;
    color?: string;
  }>;
  /** Embedded custom part binaries for portability */
  customParts?: EmbeddedCustomPart[];
}
