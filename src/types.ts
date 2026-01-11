
export type ToolType =
  | "selection"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "eraser"
  | "laser"
  | "frame"
  | "icon"
  | "image"
  | "hand"
  | "zoom"
  | "note"
  | "highlight";

export type ElementType = "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | "freedraw" | "text" | "frame" | "icon" | "image" | "note" | "highlight";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type TextAlign = "left" | "center" | "right";

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface Binding {
  elementId: string;
  anchor: AnchorPosition;
}

export interface ExcalidrawElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  points?: Point[];
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  fontWeight?: number;
  fontStyle?: string;
  textAlign?: TextAlign;
  isSelected?: boolean;
  startBinding?: Binding;
  endBinding?: Binding;
  groupIds?: string[];
  isLocked?: boolean;
  frameId?: string;
  name?: string;
  seed: number; // For RoughJS deterministic rendering
  fillStyle?: "hachure" | "cross-hatch" | "solid" | "hollow";
  angle?: number;
  roundness?: number;
  roughness?: number;
  simulatePressure?: boolean;
  iconName?: string;
  // Icon specific properties
  iconPath?: string;
  // Image specific properties
  imageData?: string; // Base64 encoded image data
}

export type ResizeHandle = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se' | string;

export interface ResizingState {
  elementId: string;
  handle: ResizeHandle;
  startMousePos: Point;
  originalElement: ExcalidrawElement;
}
export interface GroupResizingState {
  handle: 'nw' | 'ne' | 'sw' | 'se' | 'rotation';
  originalBox: { x: number; y: number; width: number; height: number };
  originalElements: { id: string; x: number; y: number; width: number; height: number; angle?: number }[];
  startAngle?: number;
}

export interface AppState {
  tool: ToolType;
  strokeColor: string;
  backgroundColor: string;
  viewBackgroundColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  pan: { x: number; y: number };
  zoom: number;
  isDragging: boolean;
  selectionStart: Point | null;
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  selectedElementIds: string[];
  editingElementId: string | null;
  resizingState: ResizingState | null;
  groupResizingState: GroupResizingState | null;
  fillStyle: "hachure" | "cross-hatch" | "solid" | "hollow";
  roughness: number;
  eraserSize: number;
  pendingDeletionIds: string[];
  showGrid: boolean;
  snapToGrid: boolean;
  draggingOffset: Point | null;
  cursorStyle: string | null;
}

export const TOOLS: { id: ToolType; icon: string; label: string; shortcut: string }[] = [
  { id: "selection", icon: "mouse-pointer", label: "Selection", shortcut: "1" },
  { id: "hand", icon: "hand", label: "Hand", shortcut: "H" },
  { id: "rectangle", icon: "square", label: "Rectangle", shortcut: "2" },
  { id: "ellipse", icon: "circle", label: "Ellipse", shortcut: "3" },
  { id: "diamond", icon: "diamond", label: "Diamond", shortcut: "4" },
  { id: "arrow", icon: "arrow-right", label: "Arrow", shortcut: "5" },
  { id: "line", icon: "minus", label: "Line", shortcut: "6" },
  { id: "freedraw", icon: "pencil", label: "Draw", shortcut: "7" },
  { id: "highlight", icon: "highlighter", label: "Highlight", shortcut: "G" },
  { id: "text", icon: "type", label: "Text", shortcut: "T" },
  { id: "image", icon: "image", label: "Image", shortcut: "I" },
  { id: "frame", icon: "hash", label: "Frame", shortcut: "F" },
  { id: "eraser", icon: "eraser", label: "Eraser", shortcut: "E" },
  { id: "laser", icon: "wand", label: "Laser", shortcut: "L" },
];