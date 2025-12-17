
import React from 'react';
import { X, Keyboard, MousePointer2, Square, Circle, Diamond, ArrowRight, Minus, Pencil, Type, Hash, Eraser, Wand2 } from 'lucide-react';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutSection = ({ title, shortcuts }: { title: string, shortcuts: { label: string, keys: string[], icon?: React.ElementType }[] }) => (
  <div className="mb-6">
    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-700 pb-1">{title}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
      {shortcuts.map((s, i) => (
        <div key={i} className="flex items-center justify-between group">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            {s.icon && <s.icon size={14} className="text-gray-400 dark:text-gray-500" />}
            <span>{s.label}</span>
          </div>
          <div className="flex gap-1">
            {s.keys.map((k, j) => (
              <kbd key={j} className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
                {k}
              </kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const HelpDialog: React.FC<HelpDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
            <Keyboard size={20} />
            <h2 className="font-bold text-lg">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-[#121212]">
          <ShortcutSection 
            title="Tools" 
            shortcuts={[
              { label: 'Selection', keys: ['1', 'V'], icon: MousePointer2 },
              { label: 'Rectangle', keys: ['2', 'R'], icon: Square },
              { label: 'Diamond', keys: ['3', 'D'], icon: Diamond },
              { label: 'Ellipse', keys: ['4', 'E'], icon: Circle },
              { label: 'Arrow', keys: ['5', 'A'], icon: ArrowRight },
              { label: 'Line', keys: ['6', 'L'], icon: Minus },
              { label: 'Freedraw', keys: ['7', 'P', 'X'], icon: Pencil },
              { label: 'Text', keys: ['8', 'T'], icon: Type },
              { label: 'Frame', keys: ['F'], icon: Hash },
              { label: 'Eraser', keys: ['0', 'Del'], icon: Eraser },
              { label: 'Laser', keys: ['K'], icon: Wand2 },
            ]}
          />

          <ShortcutSection 
            title="Editor" 
            shortcuts={[
              { label: 'Undo', keys: ['Ctrl', 'Z'] },
              { label: 'Redo', keys: ['Ctrl', 'Shift', 'Z'] },
              { label: 'Copy', keys: ['Ctrl', 'C'] },
              { label: 'Paste', keys: ['Ctrl', 'V'] },
              { label: 'Cut', keys: ['Ctrl', 'X'] },
              { label: 'Duplicate', keys: ['Ctrl', 'D'] },
              { label: 'Select All', keys: ['Ctrl', 'A'] },
              { label: 'Delete', keys: ['Del', 'Backspace'] },
              { label: 'Group', keys: ['Ctrl', 'G'] },
              { label: 'Ungroup', keys: ['Ctrl', 'Shift', 'G'] },
              { label: 'Lock/Unlock', keys: ['Ctrl', 'Shift', 'L'] },
              { label: 'Bring to Front', keys: [']'] },
              { label: 'Send to Back', keys: ['['] },
            ]}
          />

          <ShortcutSection 
            title="View & System" 
            shortcuts={[
              { label: 'Zoom In', keys: ['Ctrl', '+'] },
              { label: 'Zoom Out', keys: ['Ctrl', '-'] },
              { label: 'Quick Actions', keys: ['Ctrl', 'K'] },
              { label: 'Help', keys: ['?'] },
              { label: 'Pan Canvas', keys: ['Space + Drag'] },
              { label: 'Toggle Theme', keys: ['Alt', 'Shift', 'T'] },
            ]}
          />
        </div>
        
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-xs text-center text-gray-500 dark:text-gray-400">
            Press <kbd className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">?</kbd> anytime to open this dialog.
        </div>
      </div>
    </div>
  );
};

export default HelpDialog;
