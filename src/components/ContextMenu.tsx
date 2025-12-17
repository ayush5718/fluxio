
import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  CopyPlus,
  BringToFront,
  SendToBack,
  Group,
  Ungroup,
  Lock,
  Unlock
} from 'lucide-react';

interface ContextMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
  onAction: (action: string) => void;
  hasSelection: boolean;
  hasMultipleSelection: boolean;
  hasClipboard: boolean;
  isGrouped: boolean;
  isLocked?: boolean;
}

const MenuItem = ({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled = false,
  danger = false
}: {
  icon?: any,
  label: string,
  shortcut?: string,
  onClick: () => void,
  disabled?: boolean,
  danger?: boolean
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    disabled={disabled}
    className={`w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-lg transition-colors group
      ${disabled
        ? 'opacity-40 cursor-not-allowed text-gray-400 dark:text-gray-500'
        : danger
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-700 dark:text-gray-200 hover:bg-brand/10 hover:text-brand'
      }
    `}
  >
    <div className="flex items-center gap-2.5">
      {Icon && <Icon size={14} className={danger ? "" : "text-gray-400 dark:text-gray-500 group-hover:text-brand"} />}
      <span className="font-medium">{label}</span>
    </div>
    {shortcut && (
      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-sans tracking-wide ml-4">{shortcut}</span>
    )}
  </button>
);

const Divider = () => (
  <div className="h-[1px] bg-gray-200/50 dark:bg-white/10 my-1 mx-2" />
);

const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  onClose,
  onAction,
  hasSelection,
  hasMultipleSelection,
  hasClipboard,
  isGrouped,
  isLocked
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!position) return null;

  // Prevent menu from going off-screen
  const style: React.CSSProperties = {
    top: Math.min(position.y, window.innerHeight - 340),
    left: Math.min(position.x, window.innerWidth - 220),
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="fixed z-[100] w-56 p-1.5
        bg-white/70 dark:bg-gray-900/80 
        backdrop-blur-xl 
        border border-white/40 dark:border-white/10 
        shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] 
        rounded-2xl 
        flex flex-col
        animate-in fade-in zoom-in-95 duration-150 ease-out origin-top-left"
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem
        icon={Clipboard}
        label="Paste"
        shortcut="Ctrl+V"
        onClick={() => onAction('paste')}
        disabled={!hasClipboard}
      />

      <Divider />

      <MenuItem
        icon={Copy}
        label="Copy"
        shortcut="Ctrl+C"
        onClick={() => onAction('copy')}
        disabled={!hasSelection}
      />
      <MenuItem
        icon={Scissors}
        label="Cut"
        shortcut="Ctrl+X"
        onClick={() => onAction('cut')}
        disabled={!hasSelection || isLocked}
      />
      <MenuItem
        icon={CopyPlus}
        label="Duplicate"
        shortcut="Ctrl+D"
        onClick={() => onAction('duplicate')}
        disabled={!hasSelection}
      />

      <Divider />

      <MenuItem
        icon={isLocked ? Unlock : Lock}
        label={isLocked ? "Unlock" : "Lock"}
        shortcut="Ctrl+Shift+L"
        onClick={() => onAction(isLocked ? 'unlock' : 'lock')}
        disabled={!hasSelection}
      />

      <Divider />

      <MenuItem
        icon={BringToFront}
        label="Bring to Front"
        onClick={() => onAction('layer-front')}
        disabled={!hasSelection || isLocked}
      />
      <MenuItem
        icon={SendToBack}
        label="Send to Back"
        onClick={() => onAction('layer-back')}
        disabled={!hasSelection || isLocked}
      />

      {(hasMultipleSelection || isGrouped) && (
        <>
          <Divider />
          <MenuItem
            icon={isGrouped ? Ungroup : Group}
            label={isGrouped ? "Ungroup" : "Group"}
            shortcut="Ctrl+G"
            onClick={() => onAction(isGrouped ? 'ungroup' : 'group')}
            disabled={isLocked}
          />
        </>
      )}

      <Divider />

      <MenuItem
        icon={Trash2}
        label="Delete"
        shortcut="Del"
        onClick={() => onAction('delete')}
        disabled={!hasSelection || isLocked}
        danger
      />
    </div>
  );
};

export default ContextMenu;
