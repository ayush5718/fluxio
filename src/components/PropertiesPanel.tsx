
import React, { useState } from "react";
import { AppState, ExcalidrawElement, StrokeStyle, TextAlign } from "../types";
import {
  BringToFront,
  SendToBack,
  ChevronUp,
  ChevronDown,
  Group,
  Ungroup,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalDistributeCenter,
  AlignJustify,
  Trash2,
  Undo2,
  Redo2,
  Eraser,
  Palette,
  Plus,
  Bold,
  Italic,
  Lock,
  Unlock,
  Type,
  Code,
  Pencil
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

// Solid colors for Strokes
const STROKE_COLORS = [
  "#000000", "#343a40", "#868e96", "#fa5252",
  "#e64980", "#be4bdb", "#7950f2", "#4c6ef5",
  "#228be6", "#15aabf", "#12b886", "#40c057",
  "#82c91e", "#fab005", "#fd7e14", "#ffffff"
];

// Pastel/Light colors for Backgrounds (Excalidraw-like)
const BACKGROUND_COLORS = [
  "#ffffff", // White
  "#f8f9fa", // Light Gray
  "#ffc9c9", // Light Red
  "#fcc2d7", // Light Pink
  "#eebefa", // Light Grape
  "#d0bfff", // Light Violet
  "#a5d8ff", // Light Blue
  "#99e9f2", // Light Cyan
  "#96f2d7", // Light Teal
  "#b2f2bb", // Light Green
  "#d8f5a2", // Light Lime
  "#ffec99", // Light Yellow
  "#ffc078", // Light Orange
];

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute left-full ml-3 px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-200 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] whitespace-nowrap z-50 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200">
          {content}
        </div>
      )}
    </div>
  )
};

interface SectionHeaderProps {
  children: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ children }) => (
  <h3 className="text-[10px] font-bold text-gray-500/80 dark:text-gray-400/80 uppercase tracking-widest mb-3 mt-5 first:mt-0 ml-1">
    {children}
  </h3>
);

interface IconButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({ onClick, icon: Icon, title, disabled = false, danger = false, active = false }) => (
  <Tooltip content={title}>
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center
        ${disabled
          ? 'opacity-30 cursor-not-allowed'
          : danger
            ? 'hover:bg-red-500/10 text-red-500 hover:text-red-600'
            : active
              ? 'bg-violet-500 text-white shadow-md'
              : 'hover:bg-white/40 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 shadow-sm hover:shadow-md border border-transparent hover:border-white/20'
        }
      `}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  </Tooltip>
);

interface ColorButtonProps {
  color: string;
  isSelected: boolean;
  onClick: () => void;
}

const ColorButton: React.FC<ColorButtonProps> = ({ color, isSelected, onClick }) => (
  <button
    className={`w-6 h-6 rounded-md border border-black/10 dark:border-white/10 shadow-sm transition-transform hover:scale-110 focus:outline-none relative group
        ${isSelected ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent z-10 scale-110' : ''}`}
    style={{ backgroundColor: color }}
    onClick={onClick}
    title={color}
  >
    {/* Highlight for white color to make it visible */}
    {color === '#ffffff' && <div className="absolute inset-0 bg-gray-100/20"></div>}
  </button>
);

interface CustomColorPickerProps {
  value: string;
  onChange: (val: string) => void;
}

const CustomColorPicker: React.FC<CustomColorPickerProps> = ({ value, onChange }) => {
  return (
    <div className="relative group">
      <button className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-500 border border-white/20 shadow-sm hover:scale-110 transition-transform flex items-center justify-center overflow-hidden">
        <Plus size={14} className="text-white mix-blend-plus-lighter" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/30 pointer-events-none"></div>
      </button>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        title="Custom Color"
      />
    </div>
  );
};

// Simple SVG components for stroke styles
const SolidLineIcon = ({ selected }: { selected: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DashedLineIcon = ({ selected }: { selected: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 12H20.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DottedLineIcon = ({ selected }: { selected: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

const PropertiesPanel: React.FC<PropertiesPanelProps> = React.memo(({
  appState,
  setAppState,
  elements,
  onUpdateElement,
  undo,
  redo,
  clearCanvas,
  openGemini,
  onLayerChange,
  onGroup,
  onUngroup,
  onAlign,
  onToggleLock
}) => {
  const hasSelection = appState.selectedElementIds.length > 0;
  const hasMultipleSelection = appState.selectedElementIds.length > 1;

  const firstSelectedElement = hasSelection
    ? elements.find(el => el.id === appState.selectedElementIds[0])
    : null;

  const isLocked = firstSelectedElement?.isLocked || false;

  const currentStrokeColor = firstSelectedElement ? firstSelectedElement.strokeColor : appState.strokeColor;
  const currentBackgroundColor = firstSelectedElement ? firstSelectedElement.backgroundColor : appState.backgroundColor;
  const currentStrokeWidth = firstSelectedElement ? firstSelectedElement.strokeWidth : appState.strokeWidth;
  const currentStrokeStyle = firstSelectedElement ? (firstSelectedElement.strokeStyle || "solid") : (appState.strokeStyle || "solid");
  const currentOpacity = firstSelectedElement ? firstSelectedElement.opacity : appState.opacity;
  const currentFontFamily = firstSelectedElement ? (firstSelectedElement.fontFamily || 1) : 1;
  const currentFontWeight = firstSelectedElement ? (firstSelectedElement.fontWeight || 400) : 400;
  const currentFontStyle = firstSelectedElement ? (firstSelectedElement.fontStyle || 'normal') : 'normal';
  const currentTextAlign = firstSelectedElement ? (firstSelectedElement.textAlign || 'left') : 'left';
  const currentFontSize = firstSelectedElement ? (firstSelectedElement.fontSize || 20) : 20;

  const isTextSelected = firstSelectedElement?.type === 'text';

  const handleStrokeColorChange = (color: string) => {
    setAppState(s => ({ ...s, strokeColor: color }));
    if (hasSelection) onUpdateElement({ strokeColor: color });
  };

  const handleBackgroundColorChange = (color: string) => {
    setAppState(s => ({ ...s, backgroundColor: color }));
    if (hasSelection) onUpdateElement({ backgroundColor: color });
  };

  const handleStrokeWidthChange = (width: number) => {
    setAppState(s => ({ ...s, strokeWidth: width }));
    if (hasSelection) onUpdateElement({ strokeWidth: width });
  };

  const handleStrokeStyleChange = (style: StrokeStyle) => {
    setAppState(s => ({ ...s, strokeStyle: style }));
    if (hasSelection) onUpdateElement({ strokeStyle: style });
  };

  const handleOpacityChange = (opacity: number) => {
    setAppState(s => ({ ...s, opacity: opacity }));
    if (hasSelection) onUpdateElement({ opacity: opacity });
  };

  const handleFontFamilyChange = (font: number) => {
    if (hasSelection) onUpdateElement({ fontFamily: font });
  };

  const handleFontWeightToggle = () => {
    const newWeight = currentFontWeight === 700 ? 400 : 700;
    if (hasSelection) onUpdateElement({ fontWeight: newWeight });
  };

  const handleFontStyleToggle = () => {
    const newStyle = currentFontStyle === 'italic' ? 'normal' : 'italic';
    if (hasSelection) onUpdateElement({ fontStyle: newStyle });
  };

  const handleTextAlignChange = (align: TextAlign) => {
    if (hasSelection) onUpdateElement({ textAlign: align });
  };

  const handleFontSizeChange = (size: number) => {
    if (hasSelection) onUpdateElement({ fontSize: size });
  };

  return (
    <div className="fixed left-6 top-1/2 transform -translate-y-1/2 w-72 z-40 max-h-[85vh] flex flex-col overflow-hidden 
      bg-white/10 dark:bg-black/30 
      backdrop-blur-2xl 
      border border-white/20 dark:border-white/10 
      shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] 
      rounded-[2rem]">

      <div className="p-5 border-b border-white/10 dark:border-white/5 bg-gradient-to-b from-white/10 to-transparent dark:from-white/5">
        <div className="flex gap-2 mb-4">
          <button onClick={undo} className="flex-1 py-2.5 px-3 bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl text-sm font-semibold hover:bg-white/30 dark:hover:bg-white/10 transition shadow-sm flex items-center justify-center gap-2 text-gray-800 dark:text-gray-100 backdrop-blur-md">
            <Undo2 size={16} />
          </button>
          <button onClick={redo} className="flex-1 py-2.5 px-3 bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl text-sm font-semibold hover:bg-white/30 dark:hover:bg-white/10 transition shadow-sm flex items-center justify-center gap-2 text-gray-800 dark:text-gray-100 backdrop-blur-md">
            <Redo2 size={16} />
          </button>
        </div>
        {/* AI Gen Button Removed as per request */}
      </div>

      <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-6">

        {hasSelection && (
          <div className="animate-in slide-in-from-left-4 fade-in duration-300">
            <SectionHeader>Arrange</SectionHeader>
            <div className="bg-white/10 dark:bg-white/5 rounded-2xl p-2 border border-white/20 dark:border-white/5 shadow-inner backdrop-blur-sm">

              <div className="flex justify-between items-center px-1 mb-2">
                <div className="flex gap-1 w-full justify-between">
                  <IconButton onClick={() => onLayerChange('back')} icon={SendToBack} title="Send to Back" />
                  <IconButton onClick={() => onLayerChange('backward')} icon={ChevronDown} title="Send Backward" />
                  <IconButton onClick={() => onLayerChange('forward')} icon={ChevronUp} title="Bring Forward" />
                  <IconButton onClick={() => onLayerChange('front')} icon={BringToFront} title="Bring to Front" />
                </div>
              </div>

              <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent my-2"></div>

              <div className="flex justify-between gap-1 px-1">
                <IconButton onClick={onGroup} disabled={!hasMultipleSelection} icon={Group} title="Group" />
                <IconButton onClick={onUngroup} icon={Ungroup} title="Ungroup" />
                <div className="w-[1px] bg-white/10 mx-1"></div>
                <IconButton
                  onClick={onToggleLock}
                  icon={isLocked ? Lock : Unlock}
                  title={isLocked ? "Unlock" : "Lock"}
                  active={isLocked}
                />
              </div>

              <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent my-2"></div>

              <div className="flex justify-between gap-1 px-1">
                <IconButton onClick={() => onAlign('left')} disabled={!hasMultipleSelection} icon={AlignLeft} title="Align Left" />
                <IconButton onClick={() => onAlign('center')} disabled={!hasMultipleSelection} icon={AlignCenter} title="Align Center" />
                <IconButton onClick={() => onAlign('right')} disabled={!hasMultipleSelection} icon={AlignRight} title="Align Right" />
                <IconButton onClick={() => onAlign('middle')} disabled={!hasMultipleSelection} icon={AlignVerticalDistributeCenter} title="Align Middle" />
              </div>
            </div>
          </div>
        )}

        {isTextSelected && (
          <div className="animate-in slide-in-from-left-4 fade-in duration-300">
            <SectionHeader>Typography</SectionHeader>
            <div className="flex flex-col gap-3">
              <div className="mb-1">
                <label className="text-[10px] text-gray-500 mb-1.5 block">Font Family</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFontFamilyChange(1)}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all shadow-sm ${currentFontFamily === 1 ? 'bg-violet-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-600 dark:text-gray-300 border border-white/10'}`}
                    title="Hand-drawn"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleFontFamilyChange(2)}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all shadow-sm ${currentFontFamily === 2 ? 'bg-violet-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-600 dark:text-gray-300 border border-white/10'}`}
                    title="Sans-serif"
                  >
                    <Type size={16} />
                  </button>
                  <button
                    onClick={() => handleFontFamilyChange(3)}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all shadow-sm ${currentFontFamily === 3 ? 'bg-violet-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-600 dark:text-gray-300 border border-white/10'}`}
                    title="Monospace"
                  >
                    <Code size={16} />
                  </button>
                </div>
              </div>

              <div className="mb-1">
                <label className="text-[10px] text-gray-500 mb-1.5 block">Font Size</label>
                <div className="flex gap-2">
                  {[
                    { label: 'S', size: 16 },
                    { label: 'M', size: 20 },
                    { label: 'L', size: 28 },
                    { label: 'XL', size: 36 }
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleFontSizeChange(opt.size)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${currentFontSize === opt.size
                        ? 'bg-violet-500/20 border-violet-500 text-violet-600 dark:text-violet-300'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-1">
                <label className="text-[10px] text-gray-500 mb-1.5 block">Text Align</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTextAlignChange('left')}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all shadow-sm ${currentTextAlign === 'left' ? 'bg-violet-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-600 dark:text-gray-300 border border-white/10'}`}
                  >
                    <AlignLeft size={16} />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('center')}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all shadow-sm ${currentTextAlign === 'center' ? 'bg-violet-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-600 dark:text-gray-300 border border-white/10'}`}
                  >
                    <AlignCenter size={16} />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('right')}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all shadow-sm ${currentTextAlign === 'right' ? 'bg-violet-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-600 dark:text-gray-300 border border-white/10'}`}
                  >
                    <AlignRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <SectionHeader>{hasSelection ? 'Appearance' : 'Defaults'}</SectionHeader>

          <div className="mb-6">
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-3 block ml-1 flex justify-between">
              <span>Stroke</span>
              <span className="text-[10px] opacity-50 uppercase tracking-wide">{currentStrokeColor}</span>
            </label>
            <div className={`grid grid-cols-6 gap-2 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
              {STROKE_COLORS.map((c) => (
                <ColorButton
                  key={c}
                  color={c}
                  isSelected={currentStrokeColor === c}
                  onClick={() => handleStrokeColorChange(c)}
                />
              ))}
              <CustomColorPicker
                value={currentStrokeColor}
                onChange={handleStrokeColorChange}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-3 block ml-1 flex justify-between">
              <span>Fill</span>
              <span className="text-[10px] opacity-50 uppercase tracking-wide">{currentBackgroundColor === 'transparent' ? 'None' : currentBackgroundColor}</span>
            </label>
            <div className={`grid grid-cols-6 gap-2 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
              <button
                className={`w-6 h-6 rounded-md border border-white/20 dark:border-white/10 flex items-center justify-center bg-white/10 text-[10px] hover:scale-110 transition-transform shadow-sm group ${currentBackgroundColor === 'transparent' ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent' : ''}`}
                onClick={() => handleBackgroundColorChange('transparent')}
                title="Transparent"
              >
                <div className="w-full h-[1px] bg-red-400/80 transform -rotate-45 group-hover:bg-red-500"></div>
              </button>
              {BACKGROUND_COLORS.map((c) => (
                <ColorButton
                  key={c}
                  color={c}
                  isSelected={currentBackgroundColor === c}
                  onClick={() => handleBackgroundColorChange(c)}
                />
              ))}
              <CustomColorPicker
                value={currentBackgroundColor === 'transparent' ? '#ffffff' : currentBackgroundColor}
                onChange={handleBackgroundColorChange}
              />
            </div>
          </div>

          <div className={`space-y-5 bg-white/10 dark:bg-white/5 p-4 rounded-2xl border border-white/20 dark:border-white/5 backdrop-blur-sm ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>

            {/* Stroke Style */}
            <div>
              <div className="flex justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                <span>Stroke Style</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStrokeStyleChange("solid")}
                  className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all ${currentStrokeStyle === 'solid' ? 'bg-violet-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white/10 border border-white/10'}`}
                  title="Solid"
                >
                  <SolidLineIcon selected={currentStrokeStyle === 'solid'} />
                </button>
                <button
                  onClick={() => handleStrokeStyleChange("dashed")}
                  className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all ${currentStrokeStyle === 'dashed' ? 'bg-violet-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white/10 border border-white/10'}`}
                  title="Dashed"
                >
                  <DashedLineIcon selected={currentStrokeStyle === 'dashed'} />
                </button>
                <button
                  onClick={() => handleStrokeStyleChange("dotted")}
                  className={`flex-1 py-2 rounded-xl flex items-center justify-center transition-all ${currentStrokeStyle === 'dotted' ? 'bg-violet-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white/10 border border-white/10'}`}
                  title="Dotted"
                >
                  <DottedLineIcon selected={currentStrokeStyle === 'dotted'} />
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                <span>Stroke Width</span>
                <span className="text-gray-700 dark:text-gray-200">{currentStrokeWidth}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={currentStrokeWidth}
                onChange={(e) => handleStrokeWidthChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200/50 dark:bg-gray-700/50 rounded-full appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                <span>Opacity</span>
                <span className="text-gray-700 dark:text-gray-200">{currentOpacity}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={currentOpacity}
                onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200/50 dark:bg-gray-700/50 rounded-full appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 dark:border-white/5 space-y-2">
          {hasSelection && (
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
              }}
              disabled={isLocked}
              className={`w-full py-2.5 px-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition flex items-center justify-center gap-2 border border-red-500/10 backdrop-blur-sm ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Trash2 size={16} /> Delete Selection
            </button>
          )}
          <button
            onClick={clearCanvas}
            className="w-full py-2.5 px-3 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 hover:bg-white/20 dark:hover:bg-white/5"
          >
            <Eraser size={16} /> Clear Canvas
          </button>
        </div>

      </div>
    </div>
  );
});

export default PropertiesPanel;
