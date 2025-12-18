
import React, { useState, useEffect, useRef } from "react";
import { AppState, ExcalidrawElement, StrokeStyle, TextAlign } from "../types";
import {
  BringToFront, SendToBack, ChevronUp, ChevronDown, Group, Ungroup,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalDistributeCenter,
  AlignJustify, Trash2, Undo2, Redo2, Eraser, Palette, Plus,
  Bold, Italic, Lock, Unlock, Type, Code, Pencil, GripHorizontal,
  Minus, MoreHorizontal, Hash, Grid3x3, Square, Target
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
        <div className="absolute left-full ml-3 px-2.5 py-1.5 text-[10px] font-semibold text-white bg-gray-900/90 dark:bg-gray-100 dark:text-gray-900 rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap z-[100] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          {content}
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-gray-900/90 dark:border-r-gray-100"></div>
        </div>
      )}
    </div>
  )
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3 mt-1 flex items-center gap-2">
    <span className="flex-1">{children}</span>
    <div className="h-[1px] flex-[2] bg-gray-100 dark:bg-gray-800/50" />
  </h3>
);

const IconButton: React.FC<{ onClick: () => void; icon: React.ElementType; title: string; disabled?: boolean; active?: boolean }> =
  ({ onClick, icon: Icon, title, disabled = false, active = false }) => (
    <Tooltip content={title}>
      <button onClick={onClick} disabled={disabled}
        className={`p-2 rounded-[10px] transition-all duration-200 flex items-center justify-center border
        ${disabled ? 'opacity-20 cursor-not-allowed border-transparent' :
            active ? 'bg-brand text-white border-brand shadow-[0_0_12px_rgba(105,101,219,0.3)]' :
              'bg-gray-50 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-800/50 hover:bg-white dark:hover:bg-gray-700/50 hover:border-brand/30 hover:text-brand hover:shadow-sm'}`}
      >
        <Icon size={15} strokeWidth={2.5} />
      </button>
    </Tooltip>
  );

const ColorSwatch: React.FC<{ color: string; isSelected: boolean; onClick: () => void; isTransparent?: boolean }> = ({ color, isSelected, onClick, isTransparent }) => (
  <button
    onClick={onClick}
    className={`w-5 h-5 rounded-full transition-all duration-200 hover:scale-125 hover:z-10 focus:outline-none relative border
      ${isSelected ? 'ring-2 ring-brand ring-offset-2 ring-offset-white dark:ring-offset-[#1e1e1e] scale-110 border-transparent z-10' : 'border-gray-100 dark:border-white/5'}
      ${isTransparent ? 'bg-white/50 dark:bg-white/10 flex items-center justify-center' : ''}
    `}
    style={!isTransparent ? { backgroundColor: color } : {}}
    title={isTransparent ? "Transparent" : color}
  >
    {isTransparent && <div className="w-[1px] h-full bg-red-500/60 transform rotate-45" />}
    {color === 'transparent' && isSelected && <div className="absolute inset-0 rounded-full border border-brand/50" />}
  </button>
);

const RangeSlider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (val: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="flex flex-col gap-2 group mb-1">
    <div className="flex justify-between items-center">
      <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 group-hover:text-gray-500 transition-colors uppercase">{label}</span>
      <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded leading-none">{value}</span>
    </div>
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800/50 rounded-full appearance-none cursor-pointer accent-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
      />
    </div>
  </div>
);

const NumericInput: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">{label}</span>
    <div className="flex items-center bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-xl px-2 py-1.5 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/5 transition-all">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full bg-transparent text-[11px] font-medium text-gray-700 dark:text-gray-200 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-l border-gray-100 dark:border-gray-800 ml-2 pl-2">
        <button onClick={() => onChange(value + 1)} className="hover:text-brand text-gray-400 transition-colors"><Plus size={10} strokeWidth={3} /></button>
        <button onClick={() => onChange(value - 1)} className="hover:text-brand text-gray-400 transition-colors"><Minus size={10} strokeWidth={3} /></button>
      </div>
    </div>
  </div>
);

const HexInput: React.FC<{ color: string; onChange: (c: string) => void }> = ({ color, onChange }) => {
  const [val, setVal] = useState(color);
  useEffect(() => setVal(color), [color]);

  return (
    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-xl px-2.5 py-2 group focus-within:border-brand transition-all">
      <Hash size={12} className="text-gray-400 group-focus-within:text-brand" />
      <input
        type="text"
        value={val.replace('#', '')}
        onChange={(e) => {
          const v = e.target.value;
          setVal('#' + v);
          if (/^#?([0-9A-F]{3}){1,2}$/i.test('#' + v)) onChange('#' + v.replace('#', ''));
        }}
        className="w-full bg-transparent text-[10px] font-bold font-mono text-gray-700 dark:text-gray-200 uppercase outline-none"
        placeholder="HEX CODE"
      />
    </div>
  );
};

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
  const fillStyle = firstSelectedElement?.fillStyle || appState.fillStyle || 'hachure';
  const roughness = firstSelectedElement?.roughness ?? appState.roughness ?? 0.5;
  const fontFamily = firstSelectedElement?.fontFamily || 1;
  const fontSize = firstSelectedElement?.fontSize || 20;

  const eraserSize = 20;

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
      className={`fixed z-50 w-[280px] flex flex-col bg-white/70 dark:bg-[#1e1e1e]/80 border border-white/40 dark:border-gray-800/50 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl overflow-hidden select-none transition-all duration-300 ${isDragging ? 'scale-[1.02] shadow-brand/20 cursor-grabbing ring-2 ring-brand/20' : ''}`}
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


        {/* Precise Transformation */}
        {firstSelectedElement && !hasMultipleSelection && (
          <div className="bg-gray-50/30 dark:bg-gray-800/20 p-4 rounded-2xl border border-gray-100/50 dark:border-gray-800/30 flex flex-col gap-4">
            <SectionLabel>Transformation</SectionLabel>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <NumericInput label="X Position" value={Math.round(firstSelectedElement.x)} onChange={(v) => handleUpdate({ x: v })} />
              <NumericInput label="Y Position" value={Math.round(firstSelectedElement.y)} onChange={(v) => handleUpdate({ y: v })} />
              <NumericInput label="Width" value={Math.round(firstSelectedElement.width)} onChange={(v) => handleUpdate({ width: v })} />
              <NumericInput label="Height" value={Math.round(firstSelectedElement.height)} onChange={(v) => handleUpdate({ height: v })} />
            </div>
            {firstSelectedElement.type !== 'line' && firstSelectedElement.type !== 'arrow' && (
              <NumericInput label="Rotation (deg)" value={Math.round((firstSelectedElement.angle || 0) * (180 / Math.PI))} onChange={(v) => handleUpdate({ angle: v * (Math.PI / 180) })} />
            )}
          </div>
        )}

        {/* Colors */}
        <div className="flex flex-col gap-4">
          <div>
            <SectionLabel>Stroke Color</SectionLabel>
            <div className="grid grid-cols-8 gap-2 mb-4">
              {STROKE_COLORS.map(c => (
                <ColorSwatch key={c} color={c} isSelected={strokeColor === c} onClick={() => handleUpdate({ strokeColor: c })} />
              ))}
            </div>
            <HexInput color={strokeColor} onChange={(c) => handleUpdate({ strokeColor: c })} />
          </div>

          <div>
            <SectionLabel>Background Color</SectionLabel>
            <div className="grid grid-cols-8 gap-2 mb-4">
              {BACKGROUND_COLORS.map(c => (
                <ColorSwatch key={c} color={c} isTransparent={c === 'transparent'} isSelected={bgColor === c} onClick={() => handleUpdate({ backgroundColor: c })} />
              ))}
            </div>
            <HexInput color={bgColor === 'transparent' ? '#ffffff' : bgColor} onChange={(c) => handleUpdate({ backgroundColor: c })} />
          </div>
        </div>

        {/* Appearance Sliders */}
        <div className="bg-gray-50/30 dark:bg-gray-800/20 p-4 rounded-2xl border border-gray-100/50 dark:border-gray-800/30 space-y-4">
          <RangeSlider label="Stroke Width" min={1} max={15} value={strokeWidth} onChange={(v) => handleUpdate({ strokeWidth: v })} />
          <RangeSlider label="Roughness" min={0} max={3} step={0.1} value={roughness} onChange={(v) => handleUpdate({ roughness: v })} />
          <RangeSlider label="Opacity" min={10} max={100} value={opacity} onChange={(v) => handleUpdate({ opacity: v })} />
        </div>

        {/* Stroke Style */}
        <div>
          <SectionLabel>Stroke Style</SectionLabel>
          <div className="flex gap-2 p-1 bg-gray-50/30 dark:bg-gray-800/20 rounded-xl border border-gray-100/50 dark:border-gray-800/30">
            <button onClick={() => handleUpdate({ strokeStyle: 'solid' })} className={`flex-1 py-2 rounded-lg flex justify-center items-center gap-2 transition-all ${strokeStyle === 'solid' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700/50'}`}>
              <Minus size={16} strokeWidth={3} />
            </button>
            <button onClick={() => handleUpdate({ strokeStyle: 'dashed' })} className={`flex-1 py-2 rounded-lg flex justify-center items-center gap-2 transition-all ${strokeStyle === 'dashed' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700/50'}`}>
              <MoreHorizontal size={16} strokeWidth={3} />
            </button>
            <button onClick={() => handleUpdate({ strokeStyle: 'dotted' })} className={`flex-1 py-2 rounded-lg flex justify-center items-center gap-2 transition-all ${strokeStyle === 'dotted' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700/50'}`}>
              <div className="flex gap-0.5"><div className="w-1 h-1 rounded-full bg-current" /><div className="w-1 h-1 rounded-full bg-current" /><div className="w-1 h-1 rounded-full bg-current" /></div>
            </button>
          </div>
        </div>

        {/* Fill Style */}
        <div>
          <SectionLabel>Fill Style</SectionLabel>
          <div className="flex gap-2 p-1 bg-gray-50/30 dark:bg-gray-800/20 rounded-xl border border-gray-100/50 dark:border-gray-800/30">
            <button onClick={() => handleUpdate({ fillStyle: 'hachure' })} className={`flex-1 py-2 rounded-lg flex justify-center items-center gap-2 transition-all ${fillStyle === 'hachure' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700/50'}`}>
              <Hash size={16} strokeWidth={2.5} />
            </button>
            <button onClick={() => handleUpdate({ fillStyle: 'cross-hatch' })} className={`flex-1 py-2 rounded-lg flex justify-center items-center gap-2 transition-all ${fillStyle === 'cross-hatch' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700/50'}`}>
              <Grid3x3 size={16} />
            </button>
            <button onClick={() => handleUpdate({ fillStyle: 'solid' })} className={`flex-1 py-2 rounded-lg flex justify-center items-center gap-2 transition-all ${fillStyle === 'solid' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700/50'}`}>
              <Square size={14} fill="currentColor" strokeWidth={0} />
            </button>
          </div>
        </div>

        {/* Roundness (Only for Rectangles) */}
        {hasSelection && !hasMultipleSelection && firstSelectedElement?.type === 'rectangle' && (
          <div>
            <SectionLabel>Edges</SectionLabel>
            <div className="flex gap-2 p-1 bg-gray-50/30 dark:bg-gray-800/20 rounded-xl border border-gray-100/50 dark:border-gray-800/30">
              <button onClick={() => handleUpdate({ roundness: 0 })} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${(!firstSelectedElement.roundness || firstSelectedElement.roundness === 0) ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700/50'}`}>Sharp</button>
              <button onClick={() => handleUpdate({ roundness: 12 })} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${firstSelectedElement.roundness === 12 ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700/50'}`}>Round</button>
            </div>
          </div>
        )}

        {/* Text Selection */}
        {isTextSelected && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <SectionLabel>Typography</SectionLabel>
            <div className="grid grid-cols-1 gap-3 p-3.5 bg-gray-50/30 dark:bg-gray-800/20 rounded-2xl border border-gray-100/50 dark:border-gray-800/30">
              <div className="flex gap-1.5">
                <button onClick={() => handleUpdate({ fontFamily: 1 })} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${fontFamily === 1 ? 'bg-brand text-white shadow-md' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`}>DRAW</button>
                <button onClick={() => handleUpdate({ fontFamily: 2 })} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${fontFamily === 2 ? 'bg-brand text-white shadow-md' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`}>SANS</button>
                <button onClick={() => handleUpdate({ fontFamily: 3 })} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${fontFamily === 3 ? 'bg-brand text-white shadow-md' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`}>MONO</button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[16, 20, 28, 36].map(s => (
                  <button key={s} onClick={() => handleUpdate({ fontSize: s })} className={`py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all ${fontSize === s ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 shadow-lg' : 'text-gray-500 hover:bg-white dark:hover:bg-white/5'}`}>
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
      <div className="p-4 pt-1 mb-2 bg-transparent flex flex-col gap-2">
        {hasSelection && (
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))}
            className="w-full py-3.5 rounded-2xl bg-red-500/10 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center gap-2.5 group"
          >
            <Trash2 size={15} className="group-hover:rotate-12 transition-transform" />
            Delete Element
          </button>
        )}
        <button
          onClick={clearCanvas}
          className="w-full py-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-2"
        >
          <Eraser size={14} /> Clear Canvas
        </button>
      </div>

    </div>
  );
});

export default PropertiesPanel;
