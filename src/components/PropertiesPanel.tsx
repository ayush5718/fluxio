
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 12
      });
    }
  };

  return (
    <div
      ref={triggerRef}
      className="flex items-center justify-center"
      onMouseEnter={() => {
        updatePosition();
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && createPortal(
        <div
          className="fixed px-2.5 py-1.5 text-[10px] font-bold text-white bg-gray-900/90 dark:bg-gray-100 dark:text-gray-900 rounded-lg shadow-2xl backdrop-blur-md whitespace-nowrap z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-200 -translate-y-1/2"
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-gray-900/90 dark:border-r-gray-100"></div>
        </div>,
        document.body
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
  const [showFullStrokeColors, setShowFullStrokeColors] = useState(false);
  const [showFullBgColors, setShowFullBgColors] = useState(false);
  const [activeTab, setActiveTab] = useState<'style' | 'arrange'>('style');

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

  // Quick Colors (First 6)
  const quickStrokeColors = STROKE_COLORS.slice(0, 6);
  const quickBgColors = BACKGROUND_COLORS.slice(0, 6);

  return (
    <div
      ref={panelRef}
      onMouseDown={startDrag}
      style={{ left: position.x, top: position.y }}
      className={`fixed z-50 w-[260px] flex flex-col bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden select-none transition-all duration-300 ${isDragging ? 'scale-[1.01] shadow-brand/20 cursor-grabbing ring-2 ring-brand/30' : ''}`}
    >
      {/* Tab Header / Drag Handle */}
      <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 drag-handle cursor-grab active:cursor-grabbing">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex gap-1">
            <button onClick={(e) => { e.stopPropagation(); undo(); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition"><Undo2 size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); redo(); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition"><Redo2 size={14} /></button>
          </div>
          <div className="w-10 h-1 bg-gray-200 dark:bg-gray-800 rounded-full" />
          <div className="flex gap-1 opacity-0 pointer-events-none"><Undo2 size={14} /><Redo2 size={14} /></div>
        </div>

        <div className="flex px-4 pb-0 items-center justify-center">
          <div className="flex bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl mb-3 w-full">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveTab('style'); }}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-all rounded-lg ${activeTab === 'style' ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Style
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveTab('arrange'); }}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-all rounded-lg ${activeTab === 'arrange' ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Arrange
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 flex flex-col gap-5 max-h-[60vh] overflow-y-auto custom-scrollbar bg-transparent">

        {activeTab === 'style' && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-left-2 duration-300">
            {/* Colors Section */}
            <div className="flex flex-col gap-4">
              {/* Stroke */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Stroke</span>
                  <button onClick={() => setShowFullStrokeColors(!showFullStrokeColors)} className="text-[9px] font-bold text-brand hover:underline">{showFullStrokeColors ? 'Less' : 'More'}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(showFullStrokeColors ? STROKE_COLORS : quickStrokeColors).map(c => (
                    <ColorSwatch key={c} color={c} isSelected={strokeColor === c} onClick={() => handleUpdate({ strokeColor: c })} />
                  ))}
                </div>
                {showFullStrokeColors && <HexInput color={strokeColor} onChange={(c) => handleUpdate({ strokeColor: c })} />}
              </div>

              {/* Background */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Fill</span>
                  <button onClick={() => setShowFullBgColors(!showFullBgColors)} className="text-[9px] font-bold text-brand hover:underline">{showFullBgColors ? 'Less' : 'More'}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(showFullBgColors ? BACKGROUND_COLORS : quickBgColors).map(c => (
                    <ColorSwatch key={c} color={c} isTransparent={c === 'transparent'} isSelected={bgColor === c} onClick={() => handleUpdate({ backgroundColor: c })} />
                  ))}
                </div>
                {showFullBgColors && <HexInput color={bgColor === 'transparent' ? '#ffffff' : bgColor} onChange={(c) => handleUpdate({ backgroundColor: c })} />}
              </div>
            </div>

            {/* Density Controls Overlay */}
            <div className="bg-gray-50/50 dark:bg-gray-900/30 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
              <RangeSlider label="Width" min={1} max={15} value={strokeWidth} onChange={(v) => handleUpdate({ strokeWidth: v })} />
              <RangeSlider label="Rough" min={0} max={3} step={0.1} value={roughness} onChange={(v) => handleUpdate({ roughness: v })} />
              <RangeSlider label="Opacity" min={10} max={100} value={opacity} onChange={(v) => handleUpdate({ opacity: v })} />
            </div>

            {/* Style Groups (Horizontal) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <SectionLabel>Stroke</SectionLabel>
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
                  <button onClick={() => handleUpdate({ strokeStyle: 'solid' })} className={`flex-1 py-1.5 rounded-lg flex justify-center items-center transition-all ${strokeStyle === 'solid' ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Minus size={14} strokeWidth={3} /></button>
                  <button onClick={() => handleUpdate({ strokeStyle: 'dashed' })} className={`flex-1 py-1.5 rounded-lg flex justify-center items-center transition-all ${strokeStyle === 'dashed' ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><MoreHorizontal size={14} strokeWidth={3} /></button>
                </div>
              </div>
              <div className="space-y-2">
                <SectionLabel>Edges</SectionLabel>
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
                  <button onClick={() => handleUpdate({ roundness: 0 })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all ${(!firstSelectedElement?.roundness) ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>SHARP</button>
                  <button onClick={() => handleUpdate({ roundness: 12 })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all ${firstSelectedElement?.roundness === 12 ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>ROUND</button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <SectionLabel>Fill Type</SectionLabel>
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
                <button onClick={() => handleUpdate({ fillStyle: 'hachure' })} className={`flex-1 py-1.5 rounded-lg flex justify-center items-center transition-all ${fillStyle === 'hachure' ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Hash size={14} /></button>
                <button onClick={() => handleUpdate({ fillStyle: 'cross-hatch' })} className={`flex-1 py-1.5 rounded-lg flex justify-center items-center transition-all ${fillStyle === 'cross-hatch' ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Grid3x3 size={14} /></button>
                <button onClick={() => handleUpdate({ fillStyle: 'solid' })} className={`flex-1 py-1.5 rounded-lg flex justify-center items-center transition-all ${fillStyle === 'solid' ? 'bg-white dark:bg-gray-700 text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Square size={12} fill="currentColor" strokeWidth={0} /></button>
              </div>
            </div>

            {isTextSelected && (
              <div className="space-y-3 p-3.5 bg-brand/5 dark:bg-brand/10 rounded-2xl border border-brand/10 dark:border-brand/20">
                <SectionLabel>Typography</SectionLabel>
                <div className="flex gap-1 p-1 bg-white/50 dark:bg-black/20 rounded-xl">
                  <button onClick={() => handleUpdate({ fontFamily: 1 })} className={`flex-1 py-1 text-[9px] font-bold rounded-lg ${fontFamily === 1 ? 'bg-brand text-white' : 'text-gray-400'}`}>DRAW</button>
                  <button onClick={() => handleUpdate({ fontFamily: 2 })} className={`flex-1 py-1 text-[9px] font-bold rounded-lg ${fontFamily === 2 ? 'bg-brand text-white' : 'text-gray-400'}`}>SANS</button>
                  <button onClick={() => handleUpdate({ fontFamily: 3 })} className={`flex-1 py-1 text-[9px] font-bold rounded-lg ${fontFamily === 3 ? 'bg-brand text-white' : 'text-gray-400'}`}>MONO</button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[16, 20, 24, 32].map(s => (
                    <button key={s} onClick={() => handleUpdate({ fontSize: s })} className={`py-1 rounded-lg text-[9px] font-mono font-bold transition-all ${fontSize === s ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'arrange' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-2 duration-300">
            {/* Layers Section */}
            <div className="space-y-3">
              <SectionLabel>Layer Order</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onLayerChange('front')} disabled={!hasSelection} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50 text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:text-brand hover:border-brand/30 transition-all disabled:opacity-20">
                  <BringToFront size={14} /> Bring to Front
                </button>
                <button onClick={() => onLayerChange('back')} disabled={!hasSelection} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50 text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:text-brand hover:border-brand/30 transition-all disabled:opacity-20">
                  <SendToBack size={14} /> Send to Back
                </button>
                <button onClick={() => onLayerChange('forward')} disabled={!hasSelection} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50 text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:text-brand hover:border-brand/30 transition-all disabled:opacity-20">
                  <ChevronUp size={14} /> Bring Forward
                </button>
                <button onClick={() => onLayerChange('backward')} disabled={!hasSelection} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50 text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:text-brand hover:border-brand/30 transition-all disabled:opacity-20">
                  <ChevronDown size={14} /> Send Backward
                </button>
              </div>
            </div>

            {/* Alignment Section */}
            <div className="space-y-3">
              <SectionLabel>Align Objects</SectionLabel>
              <div className="bg-gray-100/50 dark:bg-gray-800/20 p-2 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                <div className="grid grid-cols-3 gap-1">
                  <IconButton onClick={() => onAlign('left')} icon={AlignLeft} title="Left" disabled={!hasMultipleSelection} />
                  <IconButton onClick={() => onAlign('center')} icon={AlignCenter} title="Center" disabled={!hasMultipleSelection} />
                  <IconButton onClick={() => onAlign('right')} icon={AlignRight} title="Right" disabled={!hasMultipleSelection} />
                  <IconButton onClick={() => onAlign('top')} icon={AlignJustify} title="Top" disabled={!hasMultipleSelection} />
                  <IconButton onClick={() => onAlign('middle')} icon={AlignVerticalDistributeCenter} title="Middle" disabled={!hasMultipleSelection} />
                  <IconButton onClick={() => onAlign('bottom')} icon={AlignJustify} title="Bottom" disabled={!hasMultipleSelection} />
                </div>
              </div>
            </div>

            {/* Organization Section */}
            <div className="space-y-3">
              <SectionLabel>Organization</SectionLabel>
              <div className="flex gap-2">
                <button onClick={onGroup} disabled={!hasMultipleSelection} className="flex-1 flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50 text-[9px] font-bold uppercase tracking-wider text-gray-500 hover:text-brand transition-all disabled:opacity-20">
                  <Group size={16} /> Group
                </button>
                <button onClick={onUngroup} disabled={!hasSelection} className="flex-1 flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50 text-[9px] font-bold uppercase tracking-wider text-gray-500 hover:text-brand transition-all disabled:opacity-20">
                  <Ungroup size={16} /> Ungroup
                </button>
                <button onClick={onToggleLock} disabled={!hasSelection} className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all disabled:opacity-20 text-[9px] font-bold uppercase tracking-wider ${isLocked ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800/50 text-gray-500 hover:text-brand'}`}>
                  {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                  {isLocked ? 'Locked' : 'Lock'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Action Footer */}
      <div className="p-4 pt-2 pb-5 bg-transparent flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800">
        {hasSelection && (
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))}
            className="w-full py-2.5 rounded-xl bg-red-500 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-red-600 shadow-sm transition-all flex items-center justify-center gap-2 group"
          >
            <Trash2 size={13} />
            Delete
          </button>
        )}
        <button
          onClick={clearCanvas}
          className="w-full py-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <Eraser size={13} /> Clear Canvas
        </button>
      </div>
    </div>
  );
});


export default PropertiesPanel;
