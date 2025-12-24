# Complete Application Analysis: Fluxio (AI-Enhanced Whiteboard)

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [File Structure Analysis](#file-structure-analysis)
4. [Core Components Deep Dive](#core-components-deep-dive)
5. [State Management](#state-management)
6. [Rendering System](#rendering-system)
7. [Event Handling System](#event-handling-system)
8. [Features & Functionality](#features--functionality)
9. [Data Flow](#data-flow)
10. [Performance Optimizations](#performance-optimizations)
11. [Dependencies & Configuration](#dependencies--configuration)
12. [Key Algorithms & Logic](#key-algorithms--logic)

---

## Project Overview

**Fluxio** is an intelligent, high-performance whiteboarding tool with native AI integration, infinite canvas, and hand-drawn aesthetics. It's built as a React + TypeScript application using Vite as the build tool.

### Key Characteristics:
- **Type**: Web-based drawing/whiteboarding application
- **Primary Use Case**: Creating diagrams, flowcharts, and visual designs
- **AI Integration**: Google Gemini API for diagram generation
- **Rendering**: Canvas-based with RoughJS for hand-drawn aesthetics
- **State Persistence**: LocalStorage for auto-save
- **Theme Support**: Light/Dark mode

---

## Architecture & Tech Stack

### Technology Stack:
- **Frontend Framework**: React 19.2.3
- **Language**: TypeScript 5.8.2
- **Build Tool**: Vite 6.2.0
- **Styling**: Tailwind CSS 4.1.18
- **Routing**: React Router DOM 7.10.1
- **Rendering Engine**: RoughJS 4.6.6 (hand-drawn style)
- **AI Service**: @google/genai 1.33.0
- **Icons**: Lucide React 0.561.0

### Architecture Pattern:
- **Component-Based**: React functional components with hooks
- **Separation of Concerns**: 
  - Components (UI)
  - Hooks (Logic)
  - Services (External APIs)
  - Utils (Pure functions)
- **Dual Canvas System**: Static + Dynamic layers for performance

---

## File Structure Analysis

### Root Level
```
geminidraw/
├── index.html          # Entry HTML with font preloads
├── package.json        # Dependencies & scripts
├── vite.config.ts      # Vite configuration with env vars
├── tsconfig.json       # TypeScript compiler options
├── tailwind.config.js # Tailwind theme & customizations
└── postcss.config.js   # PostCSS configuration
```

### Source Structure (`src/`)
```
src/
├── index.tsx           # React entry point
├── App.tsx              # Router setup
├── index.css            # Global styles + Tailwind imports
├── types.ts             # TypeScript type definitions
├── constants.ts         # App-wide constants (colors, zoom limits)
├── components/          # UI Components (11 files)
├── hooks/               # Custom React hooks (4 files)
├── services/            # External services (1 file)
├── utils/               # Utility functions (4 files)
├── layouts/             # Layout components (1 file)
└── pages/               # Page components (1 file)
```

---

## Core Components Deep Dive

### 1. **EditorPage.tsx** (Main Application Component)
**Purpose**: Central orchestrator for the entire editor

**Key Responsibilities**:
- Manages global state (elements, appState, theme)
- Coordinates all sub-components
- Handles keyboard shortcuts
- Manages localStorage persistence
- Handles wheel events (zoom/pan)
- Manages modal states (Gemini, Library, Help, Export)

**State Management**:
```typescript
- elements: ExcalidrawElement[]        // All drawn elements
- appState: AppState                    // UI state (tool, colors, zoom, etc.)
- clipboard: ExcalidrawElement[]       // Copy/paste buffer
- contextMenu: {x, y} | null          // Right-click menu position
- highlightedElementId: string | null  // Hover feedback
- laserTrails: Point[][]               // Laser pointer trails
- eraserTrail: Point[]                 // Eraser visual feedback
- theme: 'light' | 'dark'              // Theme preference
```

**Key Features**:
- Auto-save to localStorage on state changes
- Undo/Redo via useHistory hook
- Text editing with dynamic textarea
- Context menu handling
- Frame management integration

### 2. **CanvasContainer.tsx** (Rendering Container)
**Purpose**: Manages dual-canvas rendering system

**Architecture**:
- **Static Canvas**: Renders persistent elements (optimized, redraws only on changes)
- **Dynamic Canvas**: Renders overlays, selections, temp elements (redraws every frame)

**Why Dual Canvas?**
- Performance: Static elements don't need constant redraw
- Smooth interactions: Dynamic layer handles real-time feedback
- Efficient: Only updates what changes

### 3. **Toolbar.tsx** (Tool Selection)
**Purpose**: Tool selection interface

**Features**:
- 11 tools: Selection, Rectangle, Ellipse, Diamond, Arrow, Line, Freedraw, Text, Frame, Eraser, Laser
- Icon library button
- Visual feedback for active tool
- Keyboard shortcuts displayed

### 4. **PropertiesPanel.tsx** (Element Properties)
**Purpose**: Comprehensive property editor

**Sections**:
1. **Transformation**: X, Y, Width, Height, Rotation
2. **Colors**: Stroke & Background (swatches + hex input)
3. **Appearance**: Stroke width, Roughness, Opacity sliders
4. **Stroke Style**: Solid, Dashed, Dotted
5. **Fill Style**: Hachure, Cross-hatch, Solid
6. **Edges**: Roundness for rectangles
7. **Typography**: Font family, size (for text elements)
8. **Arrange**: Layer ordering, Group/Ungroup, Lock

**Features**:
- Draggable panel
- Context-aware (shows relevant options based on selection)
- Multi-selection support
- Undo/Redo buttons

### 5. **MainMenu.tsx** (Settings Menu)
**Purpose**: Canvas settings and actions

**Features**:
- Canvas background color picker (4 light + 4 dark options)
- Grid toggle
- Snap-to-grid toggle
- Export option
- Theme toggle
- Help dialog trigger
- Clear canvas

### 6. **QuickActions.tsx** (Command Palette)
**Purpose**: Cmd+K style command palette

**Features**:
- Searchable action list
- Keyboard navigation (Arrow keys, Enter)
- Tool selection
- Action execution (AI, Library, Theme, Clear)
- Visual feedback with icons

### 7. **ContextMenu.tsx** (Right-Click Menu)
**Purpose**: Contextual actions menu

**Actions**:
- Copy/Cut/Paste/Duplicate
- Lock/Unlock
- Layer ordering (Bring to Front, Send to Back)
- Group/Ungroup
- Delete

**Features**:
- Position-aware (prevents off-screen)
- Disabled states for invalid actions
- Keyboard shortcuts displayed

### 8. **ExportModal.tsx** (Export Dialog)
**Purpose**: Export canvas as PNG

**Options**:
- Export area: Full scene or selection only
- Background: Include/exclude with color picker
- Padding: Adjustable (0-100px)
- Preview: Real-time canvas preview
- Actions: Copy to clipboard or download

### 9. **GeminiModal.tsx** (AI Generation)
**Purpose**: Interface for AI diagram generation

**Flow**:
1. User enters text prompt
2. Calls `generateDiagram()` from geminiService
3. Receives array of ExcalidrawElements
4. Adds to canvas

**Error Handling**: Shows error message if API key missing or generation fails

### 10. **HelpDialog.tsx** (Keyboard Shortcuts)
**Purpose**: Reference for all keyboard shortcuts

**Sections**:
- Tools shortcuts (1-8, F, 0, L)
- Editor shortcuts (Ctrl+Z, Ctrl+C, etc.)
- View & System shortcuts

### 11. **IconLibrary.tsx** (Icon Browser)
**Purpose**: Browse and insert architecture icons

**Features**:
- Searchable icon library
- Category filtering (compute, database, storage, network, analytics)
- 10 predefined icons (Server, Lambda, Database, Storage, etc.)
- Visual preview with default colors

---

## State Management

### AppState Structure (`types.ts`)
```typescript
interface AppState {
  tool: ToolType                    // Current active tool
  strokeColor: string               // Default stroke color
  backgroundColor: string            // Default background color
  viewBackgroundColor: string      // Canvas background
  strokeWidth: number               // Line thickness
  strokeStyle: StrokeStyle         // solid | dashed | dotted
  opacity: number                   // 10-100
  pan: { x: number, y: number }    // Canvas pan offset
  zoom: number                      // Zoom level (0.1-100)
  isDragging: boolean              // Drag state
  selectionStart: Point | null     // Selection origin
  selectionBox: Rect | null       // Marquee selection box
  selectedElementIds: string[]     // Selected elements
  editingElementId: string | null  // Currently editing text/frame
  resizingState: ResizingState | null
  fillStyle: FillStyle             // hachure | cross-hatch | solid | hollow
  roughness: number                // RoughJS roughness (0-3)
  eraserSize: number               // Eraser brush size
  pendingDeletionIds: string[]     // Elements marked for deletion
  showGrid: boolean                // Grid visibility
  snapToGrid: boolean              // Snap to grid enabled
  draggingOffset: Point | null    // Offset during drag (for smooth preview)
}
```

### Element Structure (`types.ts`)
```typescript
interface ExcalidrawElement {
  id: string                       // Unique identifier
  type: ElementType                // rectangle | ellipse | diamond | arrow | line | freedraw | text | frame | icon
  x: number, y: number            // Position
  width: number, height: number   // Dimensions
  strokeColor: string              // Stroke color
  backgroundColor: string         // Fill color
  strokeWidth: number             // Line thickness
  strokeStyle: StrokeStyle        // solid | dashed | dotted
  opacity: number                 // 10-100
  points?: Point[]                // For arrows, lines, freedraw
  text?: string                  // Text content
  fontSize?: number               // Text size
  fontFamily?: number             // 1=Kalam, 2=Inter, 3=JetBrains Mono
  fontWeight?: number             // Font weight
  fontStyle?: string              // normal | italic
  textAlign?: TextAlign           // left | center | right
  isSelected?: boolean            // Selection state
  startBinding?: Binding          // Arrow/line start connection
  endBinding?: Binding            // Arrow/line end connection
  groupIds?: string[]             // Group membership
  isLocked?: boolean              // Locked state
  frameId?: string                // Parent frame ID
  name?: string                   // Frame name
  seed: number                    // RoughJS deterministic seed
  fillStyle?: FillStyle           // Fill pattern
  angle?: number                  // Rotation in radians
  roundness?: number              // Corner radius
  roughness?: number              // RoughJS roughness
  iconPath?: string               // SVG path for icons
}
```

### State Persistence
- **LocalStorage Keys**:
  - `fluxio-elements`: Serialized elements array
  - `fluxio-state`: Persistent app state (excludes transient states)
  - `theme`: User theme preference
- **Auto-save**: Triggers on element changes and property updates

---

## Rendering System

### Dual Canvas Architecture

#### Static Canvas (`useCanvas.ts`)
**Purpose**: Renders persistent elements

**Optimization Strategy**:
- Only redraws when:
  - Elements array changes
  - Pan/zoom changes
  - Theme changes
  - Grid visibility changes
- Skips elements being dragged (uses `skipIds` parameter)
- Uses RoughJS drawable caching (see `renderer.ts`)

**Rendering Pipeline**:
1. Clear canvas
2. Draw background color
3. Draw grid (if enabled)
4. Draw welcome screen (if no elements)
5. Apply transform (DPR, pan, zoom)
6. Draw all elements (excluding skipped)

#### Dynamic Canvas (`useCanvas.ts`)
**Purpose**: Renders overlays and interactive elements

**Redraws Every Frame**:
- Selection boxes
- Resize handles
- Connector handles
- Snap points
- Temp element (while drawing)
- Eraser trail
- Laser trails
- Dragging preview

**Performance**: Uses `requestAnimationFrame` for smooth 60fps updates

### Rendering Functions (`renderer.ts`)

#### `renderStaticScene()`
- Main static rendering function
- Handles DPR scaling
- Applies pan/zoom transforms
- Calls `drawElements()` for actual drawing

#### `renderDynamicScene()`
- Renders overlays and interactive feedback
- Handles dragging preview with offset
- Draws selection boxes and handles
- Manages eraser/laser trails

#### `drawElements()`
- Core element drawing function
- Uses RoughJS for hand-drawn style
- Handles rotation
- Applies clipping for frame children
- Supports opacity
- Theme-aware color adaptation

#### RoughJS Integration
- **Caching**: Drawables cached by geometry + style hash
- **Deterministic**: Uses `seed` for consistent rendering
- **Styles**: Supports hachure, cross-hatch, solid fills
- **Roughness**: Adjustable (0-3) for sketchiness level

### Text Rendering
- Uses Canvas 2D text API
- Supports word wrapping
- Multi-line text with line height
- Text alignment (left, center, right)
- Font family switching (Kalam, Inter, JetBrains Mono)

### Grid Rendering
- Dot grid pattern
- 20px spacing (scaled by zoom)
- Theme-aware colors
- Offset by pan for smooth scrolling

---

## Event Handling System

### Mouse Events (`useEditorEvents.ts`)

#### `handleMouseDown()`
**Tool-Specific Behavior**:

1. **Selection Tool**:
   - Click element → Select
   - Shift+Click → Toggle selection
   - Click empty → Start marquee
   - Click resize handle → Start resizing
   - Click connector handle → Start arrow from element

2. **Drawing Tools** (Rectangle, Ellipse, Diamond):
   - Create temp element
   - Start drag to define size

3. **Arrow/Line Tool**:
   - Snap to element if hovered
   - Create with start binding if snapped
   - Create temp element with points array

4. **Freedraw Tool**:
   - Create temp element with points array
   - Add points on move

5. **Text Tool**:
   - Create text element immediately
   - Switch to editing mode

6. **Frame Tool**:
   - Create frame with auto-naming
   - Auto-assign children on creation

7. **Eraser Tool**:
   - Start eraser trail
   - Mark elements for deletion

8. **Laser Tool**:
   - Start laser trail

#### `handleMouseMove()`
**Key Features**:
- Grid snapping (if enabled)
- Element highlighting
- Cursor changes (resize handles, connectors)
- Drag preview (uses `draggingOffset` for smoothness)
- Temp element updates
- Eraser trail updates
- Resize handle calculations

**Smart Features**:
- Arrow snapping to elements
- Orthogonal routing for arrows
- Frame membership detection during drag

#### `handleMouseUp()`
**Finalization**:
- Commit temp element to elements array
- Apply final drag offset
- Update frame memberships
- Clean up pending deletions
- Save to history
- Reset drag state

### Keyboard Events (`EditorPage.tsx`)

**Shortcuts**:
- `Ctrl+Z` / `Ctrl+Shift+Z`: Undo/Redo
- `Delete` / `Backspace`: Delete selected
- `Ctrl+K`: Open Quick Actions
- `?`: Open Help
- `1-8, 0, F, L`: Tool selection
- `Ctrl+C/V/X`: Copy/Paste/Cut
- `Ctrl+D`: Duplicate
- `Ctrl+G`: Group
- `Ctrl+Shift+L`: Lock/Unlock

### Wheel Events (`EditorPage.tsx`)
- `Ctrl+Wheel`: Zoom (centered on cursor)
- `Wheel`: Pan canvas

---

## Features & Functionality

### Drawing Tools

1. **Selection Tool**
   - Single/multi selection
   - Marquee selection
   - Drag to move
   - Resize handles (8 corners + 4 edges)
   - Rotation handle
   - Connector handles (4 directions)

2. **Shape Tools** (Rectangle, Ellipse, Diamond)
   - Click and drag to create
   - Shift for square/circle
   - Roundness for rectangles
   - Fill styles (hachure, cross-hatch, solid)

3. **Arrow/Line Tool**
   - Smart snapping to elements
   - Orthogonal routing
   - Start/end bindings
   - Arrowhead rendering

4. **Freedraw Tool**
   - Freehand drawing
   - Point-based path
   - RoughJS curve rendering

5. **Text Tool**
   - Click to create
   - Inline editing
   - Multi-line support
   - Font family/size selection

6. **Frame Tool**
   - Container for grouping
   - Auto-naming (Frame 1, Frame 2, ...)
   - Clipping children
   - Drag-in/drag-out detection

7. **Eraser Tool**
   - Brush-based deletion
   - Visual trail
   - Pending deletion preview

8. **Laser Tool**
   - Temporary pointer trails
   - Fade-out animation (1 second)
   - Multiple simultaneous trails

9. **Icon Tool**
   - Architecture icon library
   - 10 predefined icons
   - Category filtering

### Advanced Features

1. **Frame System**
   - Genesis capture: Elements inside frame on creation
   - Drag-in: Elements enter frame when dragged inside
   - Drag-out: Elements exit when <50% overlap
   - Sticky exit: Retains membership if >50% overlap

2. **Connector System**
   - Smart anchor selection
   - Orthogonal routing
   - Auto-update on element move
   - Visual snap points

3. **Grouping** (UI present, logic partially implemented)
   - Group/Ungroup buttons
   - Group selection on click

4. **Locking**
   - Lock/Unlock elements
   - Visual lock icon
   - Prevents selection/editing

5. **Layer Management**
   - Bring to Front/Back
   - Bring Forward/Backward
   - Z-order based on array index

6. **AI Generation**
   - Gemini API integration
   - Text-to-diagram conversion
   - JSON schema validation
   - Auto-styling of generated elements

7. **Export**
   - PNG export
   - Selection or full scene
   - Background options
   - Padding control
   - Clipboard copy

---

## Data Flow

### Element Creation Flow
```
User Action (MouseDown)
  ↓
useEditorEvents.handleMouseDown()
  ↓
Create tempElement
  ↓
User Drags (MouseMove)
  ↓
Update tempElement
  ↓
User Releases (MouseUp)
  ↓
Commit to elements array
  ↓
saveHistory()
  ↓
Update localStorage
```

### Selection Flow
```
User Clicks Element
  ↓
getElementAtPosition()
  ↓
Update selectedElementIds
  ↓
PropertiesPanel shows element properties
  ↓
User Edits Properties
  ↓
updateSelectedElements()
  ↓
Update elements array
  ↓
saveHistory()
```

### Drag Flow
```
MouseDown on Selected Element
  ↓
Set isDragging = true
  ↓
MouseMove
  ↓
Calculate draggingOffset
  ↓
Dynamic canvas shows preview
  ↓
MouseUp
  ↓
Apply offset to elements
  ↓
Update frame memberships
  ↓
saveHistory()
```

### Rendering Flow
```
State Change (elements, appState)
  ↓
useCanvas hook detects change
  ↓
Static Canvas: renderStaticScene()
  ↓
Dynamic Canvas: renderDynamicScene()
  ↓
requestAnimationFrame loop
  ↓
Canvas updated
```

---

## Performance Optimizations

### 1. **Dual Canvas System**
- Static layer: Redraws only on changes
- Dynamic layer: Lightweight overlays only

### 2. **RoughJS Caching**
- Drawables cached by geometry hash
- Avoids recalculating paths on every frame
- Cache key includes: type, seed, dimensions, style

### 3. **Drag Optimization**
- Uses `draggingOffset` instead of updating elements array
- Static canvas skips dragged elements
- Dynamic canvas shows preview
- Final commit on mouse up

### 4. **Skip IDs System**
- Elements being dragged excluded from static render
- Editing elements excluded
- Pending deletions shown separately

### 5. **Device Pixel Ratio**
- High-DPI support
- Canvas scaled for retina displays
- Maintains crisp rendering

### 6. **LocalStorage Throttling**
- Only saves persistent state
- Excludes transient states (isDragging, selectionBox)
- Debounced by React's effect dependencies

### 7. **Laser Trail Cleanup**
- Automatic fade-out (1 second)
- Removes expired trails
- Prevents memory leaks

---

## Dependencies & Configuration

### Key Dependencies

1. **@google/genai**: Gemini AI API client
   - Used in: `services/geminiService.ts`
   - Environment: `GEMINI_API_KEY` required

2. **roughjs**: Hand-drawn style rendering
   - Used in: `utils/renderer.ts`
   - Provides: Sketchy, organic shapes

3. **lucide-react**: Icon library
   - Used in: All components
   - Provides: Consistent icon set

4. **react-router-dom**: Routing
   - Used in: `App.tsx`
   - Current: Single route (EditorPage)

5. **tailwindcss**: Utility-first CSS
   - Used in: All components
   - Custom theme: Brand colors, fonts

### Configuration Files

1. **vite.config.ts**
   - Port: 3000
   - Host: 0.0.0.0 (network accessible)
   - Env vars: GEMINI_API_KEY
   - Path alias: `@/` → `./src/`

2. **tsconfig.json**
   - Target: ES2022
   - Module: ESNext
   - JSX: react-jsx
   - Paths: `@/*` → `./*`

3. **tailwind.config.js**
   - Custom colors: brand (#6965db)
   - Custom fonts: Kalam, Inter, JetBrains Mono
   - Dark mode: class-based

---

## Key Algorithms & Logic

### 1. **Hit Testing** (`geometry.ts`)
```typescript
hitTest(x, y, element) → 'stroke' | 'fill' | null
```
- Checks point against element bounds
- Handles rotation
- Different logic per element type
- Threshold-based for stroke detection

### 2. **Element Selection** (`geometry.ts`)
```typescript
getElementAtPosition(x, y, elements) → Element | null
```
- Reverse iteration (top-most first)
- Respects locked elements
- Text/icons always selectable on fill
- Other elements: stroke or filled background

### 3. **Orthogonal Routing** (`geometry.ts`)
```typescript
generateOrthogonalPoints(start, end, startAnchor, endAnchor, ...)
```
- Creates elbow connections
- Detects alignment (horizontal/vertical)
- Uses breakout points
- Simplifies path points

### 4. **Smart Anchors** (`geometry.ts`)
```typescript
getSmartAnchors(e1, e2) → {start: Anchor, end: Anchor}
```
- Calculates best anchor points based on relative position
- Uses angle between element centers
- Returns optimal anchor pair

### 5. **Frame Membership** (`frameUtils.ts`)
```typescript
isElementInsideFrame(element, frame) → boolean
doesElementOverlapFrame(element, frame, threshold) → boolean
```
- Strict containment check
- Overlap percentage calculation
- Used for drag-in/drag-out logic

### 6. **Resize Logic** (`geometry.ts`)
```typescript
resizeElement(handle, element, position, keepAspectRatio)
```
- Handles 8 corner/edge handles
- Rotation handle
- Point-based for arrows/lines
- Aspect ratio preservation option
- Normalizes negative dimensions

### 7. **Text Measurement** (`renderer.ts`)
```typescript
measureText(text, fontSize, fontFamily, ...) → {width, height, actualWidth}
```
- Canvas-based text measurement
- Word wrapping support
- Multi-line height calculation
- Used for dynamic text sizing

### 8. **History Management** (`useHistory.ts`)
```typescript
saveHistory(elements)
undo() → previousElements | null
redo() → nextElements | null
```
- Array-based history
- Current step tracking
- Branch truncation on new action
- Max history: Unlimited (could be optimized)

---

## Summary

Fluxio is a sophisticated whiteboarding application with:

✅ **11 Drawing Tools** (Selection, Shapes, Arrow, Line, Freedraw, Text, Frame, Eraser, Laser, Icon)
✅ **Dual Canvas Rendering** (Static + Dynamic for performance)
✅ **RoughJS Integration** (Hand-drawn aesthetics)
✅ **AI Generation** (Gemini API for diagram creation)
✅ **Frame System** (Container-based grouping)
✅ **Smart Connectors** (Auto-routing arrows with snapping)
✅ **Full Property Editing** (Colors, styles, typography, transformation)
✅ **Export Functionality** (PNG with options)
✅ **Theme Support** (Light/Dark mode)
✅ **LocalStorage Persistence** (Auto-save)
✅ **Undo/Redo** (History management)
✅ **Keyboard Shortcuts** (Comprehensive)
✅ **Context Menus** (Right-click actions)
✅ **Command Palette** (Cmd+K style)

The codebase is well-structured with clear separation of concerns, performance optimizations, and a comprehensive feature set for professional diagramming and whiteboarding.

---

**Analysis Date**: 2024
**Lines of Code**: ~5,000+
**Components**: 11
**Hooks**: 4
**Utils**: 4
**Services**: 1

