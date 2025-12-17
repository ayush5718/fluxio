
import React, { useState, useEffect, useRef } from "react";
import { AppState, ExcalidrawElement, StrokeStyle, TextAlign } from "../types";
import {
  BringToFront, SendToBack, ChevronUp, ChevronDown, Group, Ungroup,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalDistributeCenter,
  AlignJustify, Trash2, Undo2, Redo2, Eraser, Palette, Plus,
  Bold, Italic, Lock, Unlock, Type, Code, Pencil, GripHorizontal,
  Minus, MoreHorizontal
} from "lucide-react";

interface PropertiesPanelProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  elements: ExcalidrawElement[];
  onUpdateElement: (updates: Partial<ExcalidrawElement>) => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  openGemini: () => void;
  onLayerChange: (action: 'front' | 'back' | 'forward' | 'backward') => void;
  onGroup: () => void;
  onUngroup: () => void;
  onAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onToggleLock: () => void;
}

// -----------------------------------------------------------------------------
// Constants & Config
// -----------------------------------------------------------------------------

const STROKE_COLORS = [
  "#000000", "#343a40", "#868e96", "#fa5252",
  "#e64980", "#be4bdb", "#7950f2", "#4c6ef5",
  "#228be6", "#15aabf", "#12b886", "#40c057",
  "#82c91e", "#fab005", "#fd7e14", "#ffffff"
];

const BACKGROUND_COLORS = [
  "transparent", "#ffffff", "#f8f9fa", "#ffc9c9", "#fcc2d7",
  "#eebefa", "#d0bfff", "#a5d8ff", "#99e9f2",
  "#96f2d7", "#b2f2bb", "#d8f5a2", "#ffec99", "#ffc078"
];

// -----------------------------------------------------------------------------
// Component Definitions
// -----------------------------------------------------------------------------

const Tooltip: React.FC<{ children: React.ReactNode; content: string }> = ({ children, content }) => {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative flex items-center justify-center group"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full mb-2 px-2.5 py-1 text-[10px] font-medium text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-150">
          {content}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 mt-1">
    {children}
  </h3>
);

const IconButton: React.FC<{ onClick: () => void; icon: React.ElementType; title: string; disabled?: boolean; active?: boolean }> =
  ({ onClick, icon: Icon, title, disabled = false, active = false }) => (
    <Tooltip content={title}>
      <button onClick={onClick} disabled={disabled}
        className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center
        ${disabled ? 'opacity-30 cursor-not-allowed' :
            active ? 'bg-violet-600 text-white shadow-sm' :
              'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}
      >
        <Icon size={16} strokeWidth={2} />
      </button>
    </Tooltip>
  );

const ColorSwatch: React.FC<{ color: string; isSelected: boolean; onClick: () => void; isTransparent?: boolean }> = ({ color, isSelected, onClick, isTransparent }) => (
  <button
    onClick={onClick}
    className={`w-6 h-6 rounded-[6px] transition-transform hover:scale-110 focus:outline-none relative
      ${isSelected ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#1e1e1e] z-10 scale-105' : 'hover:ring-1 hover:ring-white/20'}
      ${isTransparent ? 'bg-white/10 flex items-center justify-center' : ''}
    `}
    style={!isTransparent ? { backgroundColor: color } : {}}
    title={isTransparent ? "Transparent" : color}
  >
    {isTransparent && <div className="w-full h-[1px] bg-red-400 transform -rotate-45" />}
    {color === '#ffffff' && !isTransparent && <div className="absolute inset-0 border border-gray-200/10 rounded-[6px]" />}
  </button>
);

const RangeSlider: React.FC<{ label: string; value: number; min: number; max: number; onChange: (val: number) => void }> = ({ label, value, min, max, onChange }) => (
  <div className="flex items-center gap-3 group">
    <span className="text-[11px] font-medium text-gray-400 w-12 group-hover:text-gray-300 transition-colors">{label}</span>
    <div className="flex-1 relative h-6 flex items-center">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
    </div>
    <span className="text-[10px] text-gray-500 w-6 text-right font-mono">{value}</span>
  </div>
);

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

const PropertiesPanel: React.FC<PropertiesPanelProps> = React.memo((props) => {
  const { appState, setAppState, elements, onUpdateElement, undo, redo, clearCanvas, onLayerChange, onGroup, onUngroup, onAlign, onToggleLock } = props;

  // State
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const panelRef = useRef<HTMLDivElement>(null);

  // Derived State
  const hasSelection = appState.selectedElementIds.length > 0;
  const hasMultipleSelection = appState.selectedElementIds.length > 1;
  const firstSelectedElement = hasSelection ? elements.find(el => el.id === appState.selectedElementIds[0]) : null;
  const isLocked = firstSelectedElement?.isLocked || false;
  const isTextSelected = firstSelectedElement?.type === 'text';

  // Styles
  const strokeColor = firstSelectedElement?.strokeColor || appState.strokeColor;
  const bgColor = firstSelectedElement?.backgroundColor || appState.backgroundColor;
  const strokeWidth = firstSelectedElement?.strokeWidth || appState.strokeWidth;
  const opacity = firstSelectedElement?.opacity || appState.opacity;
  const strokeStyle = firstSelectedElement?.strokeStyle || appState.strokeStyle || 'solid';
  const fontFamily = firstSelectedElement?.fontFamily || 1;
  const fontSize = firstSelectedElement?.fontSize || 20;

  const handleUpdate = (updates: Partial<ExcalidrawElement>) => {
    if (hasSelection) onUpdateElement(updates);
    setAppState(s => ({ ...s, ...updates }));
  };

  // Dragging Logic
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - (panelRef.current?.offsetWidth || 0)));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - (panelRef.current?.offsetHeight || 0)));
      setPosition({ x: newX, y: newY });
    };
    const handleUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, dragOffset]);

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  return (
    <div
      ref={panelRef}
      onMouseDown={startDrag}
      style={{ left: position.x, top: position.y }}
      className={`fixed z-50 w-[280px] flex flex-col bg-white/80 dark:bg-[#1e1e1e]/90 border border-white/20 dark:border-gray-800 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-2xl backdrop-blur-xl overflow-hidden select-none transition-shadow ${isDragging ? 'shadow-violet-500/10 cursor-grabbing' : ''}`}
    >
      {/* Header / Drag Handle */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 drag-handle cursor-grab active:cursor-grabbing bg-transparent">
        <div className="flex gap-2">
          <button onClick={undo} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"><Undo2 size={16} /></button>
          <button onClick={redo} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"><Redo2 size={16} /></button>
        </div>
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-800 rounded-full" />
        <div className="w-14" /> {/* Spacer for balance */}
      </div>

      {/* Main Content */}
      <div className="p-5 flex flex-col gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-transparent">

        {/* Colors */}
        <div>
          <SectionLabel>Stroke</SectionLabel>
          <div className="grid grid-cols-8 gap-2 mb-4">
            {STROKE_COLORS.map(c => (
              <ColorSwatch key={c} color={c} isSelected={strokeColor === c} onClick={() => handleUpdate({ strokeColor: c })} />
            ))}
          </div>

          <SectionLabel>Fill</SectionLabel>
          <div className="grid grid-cols-8 gap-2">
            {BACKGROUND_COLORS.map(c => (
              <ColorSwatch key={c} color={c} isTransparent={c === 'transparent'} isSelected={bgColor === c} onClick={() => handleUpdate({ backgroundColor: c })} />
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="bg-gray-50/50 dark:bg-gray-800/30 p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
          <RangeSlider label="Width" min={1} max={20} value={strokeWidth} onChange={(v) => handleUpdate({ strokeWidth: v })} />
          <RangeSlider label="Opacity" min={10} max={100} value={opacity} onChange={(v) => handleUpdate({ opacity: v })} />
        </div>

        {/* Stroke Style */}
        <div>
          <SectionLabel>Stroke Style</SectionLabel>
          <div className="flex gap-2 p-1 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <button onClick={() => handleUpdate({ strokeStyle: 'solid' })} className={`flex-1 py-1.5 rounded-md flex justify-center items-center gap-2 ${strokeStyle === 'solid' ? 'bg-violet-600/20 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/50' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}>
              <Minus size={18} />
            </button>
            <button onClick={() => handleUpdate({ strokeStyle: 'dashed' })} className={`flex-1 py-1.5 rounded-md flex justify-center items-center gap-2 ${strokeStyle === 'dashed' ? 'bg-violet-600/20 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/50' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}>
              <MoreHorizontal size={18} />
            </button>
            <button onClick={() => handleUpdate({ strokeStyle: 'dotted' })} className={`flex-1 py-1.5 rounded-md flex justify-center items-center gap-2 ${strokeStyle === 'dotted' ? 'bg-violet-600/20 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/50' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}>
              <div className="flex gap-0.5"><div className="w-1 h-1 rounded-full bg-current" /><div className="w-1 h-1 rounded-full bg-current" /><div className="w-1 h-1 rounded-full bg-current" /></div>
            </button>
          </div>
        </div>

        {/* Text Selection */}
        {isTextSelected && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <SectionLabel>Typography</SectionLabel>
            <div className="flex flex-col gap-2 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex gap-1 justify-between">
                <button onClick={() => handleUpdate({ fontFamily: 1 })} className={`flex-1 py-1.5 rounded text-xs ${fontFamily === 1 ? 'bg-violet-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Draw</button>
                <button onClick={() => handleUpdate({ fontFamily: 2 })} className={`flex-1 py-1.5 rounded text-xs ${fontFamily === 2 ? 'bg-violet-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Sans</button>
                <button onClick={() => handleUpdate({ fontFamily: 3 })} className={`flex-1 py-1.5 rounded text-xs ${fontFamily === 3 ? 'bg-violet-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Mono</button>
              </div>
              <div className="grid grid-cols-4 gap-1 mt-1">
                {[16, 20, 28, 36].map(s => (
                  <button key={s} onClick={() => handleUpdate({ fontSize: s })} className={`py-1 rounded text-xs font-mono ${fontSize === s ? 'bg-gray-900 dark:bg-white/10 text-white ring-1 ring-white/20' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Arrange / Layers */}
        {(hasSelection || true) && (
          <div>
            <SectionLabel>Arrange</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              <IconButton onClick={() => onLayerChange('back')} icon={SendToBack} title="Send to Back" disabled={!hasSelection} />
              <IconButton onClick={() => onLayerChange('backward')} icon={ChevronDown} title="Send Backward" disabled={!hasSelection} />
              <IconButton onClick={() => onLayerChange('forward')} icon={ChevronUp} title="Bring Forward" disabled={!hasSelection} />
              <IconButton onClick={() => onLayerChange('front')} icon={BringToFront} title="Bring to Front" disabled={!hasSelection} />

              <div className="col-span-4 h-[1px] bg-gray-100 dark:bg-gray-800 my-1" />

              <IconButton onClick={onGroup} icon={Group} title="Group" disabled={!hasMultipleSelection} />
              <IconButton onClick={onUngroup} icon={Ungroup} title="Ungroup" disabled={!hasSelection} />
              <IconButton onClick={onToggleLock} icon={isLocked ? Lock : Unlock} title={isLocked ? "Unlock" : "Lock"} active={isLocked} disabled={!hasSelection} />
              <div /> {/* Spacer */}
            </div>
          </div>
        )}

      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-transparent flex flex-col gap-2">
        {hasSelection && (
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))}
            className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 font-semibold hover:bg-red-500 hover:text-white transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
            Delete
          </button>
        )}
        <button
          onClick={clearCanvas}
          className="w-full py-2.5 rounded-xl text-gray-500 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium flex items-center justify-center gap-2"
        >
          <Eraser size={14} /> Clear Canvas
        </button>
      </div>

    </div>
  );
});

export default PropertiesPanel;
