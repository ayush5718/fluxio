
import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ArrowRight, MousePointer2, Square, Circle, Diamond, Minus, ArrowRight as ArrowIcon, Pencil, Type, Image, Eraser, Trash2, Sun, Moon, Wand2, Hash, LayoutGrid } from 'lucide-react';
import { ToolType } from '../types';

interface QuickActionsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (tool: ToolType) => void;
  onAction: (action: string) => void;
  currentTheme: 'light' | 'dark';
}

interface ActionItem {
  id: string;
  label: string;
  keywords: string[];
  icon: React.ElementType;
  shortcut?: string;
  type: 'tool' | 'action';
  value: string;
}

const QuickActions: React.FC<QuickActionsProps> = ({ isOpen, onClose, onSelectTool, onAction, currentTheme }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions: ActionItem[] = [
    { id: 'select', label: 'Selection Tool', keywords: ['move', 'cursor', 'select'], icon: MousePointer2, shortcut: '1', type: 'tool', value: 'selection' },
    { id: 'rect', label: 'Rectangle', keywords: ['box', 'square', 'shape'], icon: Square, shortcut: '2', type: 'tool', value: 'rectangle' },
    { id: 'diamond', label: 'Diamond', keywords: ['rhombus', 'decision', 'shape'], icon: Diamond, shortcut: '3', type: 'tool', value: 'diamond' },
    { id: 'ellipse', label: 'Ellipse', keywords: ['circle', 'oval', 'shape'], icon: Circle, shortcut: '4', type: 'tool', value: 'ellipse' },
    { id: 'arrow', label: 'Arrow', keywords: ['connector', 'direction'], icon: ArrowIcon, shortcut: '5', type: 'tool', value: 'arrow' },
    { id: 'line', label: 'Line', keywords: ['connector', 'straight'], icon: Minus, shortcut: '6', type: 'tool', value: 'line' },
    { id: 'draw', label: 'Freedraw', keywords: ['pencil', 'ink', 'sketch'], icon: Pencil, shortcut: '7', type: 'tool', value: 'freedraw' },
    { id: 'text', label: 'Text', keywords: ['type', 'font', 'label'], icon: Type, shortcut: '8', type: 'tool', value: 'text' },
    { id: 'frame', label: 'Frame', keywords: ['container', 'group', 'artboard'], icon: Hash, shortcut: 'F', type: 'tool', value: 'frame' },
    { id: 'icon', label: 'Icon Library', keywords: ['insert', 'svg', 'graphics'], icon: LayoutGrid, type: 'action', value: 'library' },
    { id: 'ai', label: 'Gemini AI Generation', keywords: ['generate', 'ai', 'diagram', 'prompt'], icon: Wand2, type: 'action', value: 'ai' },
    { id: 'eraser', label: 'Eraser', keywords: ['delete', 'remove', 'rubber'], icon: Eraser, shortcut: '0', type: 'tool', value: 'eraser' },
    { id: 'laser', label: 'Laser Pointer', keywords: ['point', 'present'], icon: Wand2, shortcut: 'L', type: 'tool', value: 'laser' },
    { id: 'theme', label: `Switch to ${currentTheme === 'light' ? 'Dark' : 'Light'} Mode`, keywords: ['theme', 'mode', 'dark', 'light'], icon: currentTheme === 'light' ? Moon : Sun, type: 'action', value: 'theme' },
    { id: 'clear', label: 'Clear Canvas', keywords: ['reset', 'delete all', 'wipe'], icon: Trash2, type: 'action', value: 'clear' },
  ];

  const filteredActions = actions.filter(action =>
    action.label.toLowerCase().includes(query.toLowerCase()) ||
    action.keywords.some(k => k.includes(query.toLowerCase()))
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: ActionItem) => {
    if (item.type === 'tool') {
      onSelectTool(item.value as ToolType);
    } else {
      onAction(item.value);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        handleSelect(filteredActions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[200] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <Search className="text-gray-400 dark:text-gray-500 mr-3" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-lg text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 font-medium"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md font-sans">
            <span>Esc</span>
          </div>
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar"
        >
          {filteredActions.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            filteredActions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleSelect(action)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors
                  ${index === selectedIndex
                    ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-900 dark:text-violet-100'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${index === selectedIndex ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                    <action.icon size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{action.label}</span>
                    {action.keywords.length > 0 && query && (
                      <span className="text-[10px] opacity-60 capitalize">
                        Matches: {action.keywords.find(k => k.includes(query.toLowerCase()))}
                      </span>
                    )}
                  </div>
                </div>
                {action.shortcut && (
                  <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                    {action.shortcut}
                  </span>
                )}
                {action.type === 'action' && !action.shortcut && (
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded">
                    Action
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 bg-gray-50 dark:bg-[#181818] border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400">
          <div className="flex gap-3">
            <span className="flex items-center gap-1"><Command size={10} /> <strong>K</strong> to open</span>
            <span className="flex items-center gap-1"><ArrowRight size={10} /> to select</span>
          </div>
          <div>
            Fluxio
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
