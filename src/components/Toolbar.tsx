
import React from "react";
import { AppState, TOOLS, ToolType } from "../types";
import {
  MousePointer2,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Minus,
  Pencil,
  Type,
  Eraser,
  Wand2,
  Hash,
  LayoutGrid
} from "lucide-react";

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onOpenLibrary: () => void;
}

const Toolbar: React.FC<ToolbarProps> = React.memo(({ activeTool, onSelectTool, onOpenLibrary }) => {

  const getIcon = (id: string) => {
    switch (id) {
      case "selection": return <MousePointer2 size={20} />;
      case "rectangle": return <Square size={20} />;
      case "ellipse": return <Circle size={20} />;
      case "diamond": return <Diamond size={20} />;
      case "arrow": return <ArrowRight size={20} />;
      case "line": return <Minus size={20} />;
      case "freedraw": return <Pencil size={20} />;
      case "text": return <Type size={20} />;
      case "frame": return <Hash size={20} />;
      case "eraser": return <Eraser size={20} />;
      case "laser": return <Wand2 size={20} />;
      default: return <MousePointer2 size={20} />;
    }
  };

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 
        bg-white/40 dark:bg-black/40 
        backdrop-blur-2xl 
        shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] 
        rounded-2xl 
        p-1.5 
        flex gap-1 items-center z-50 
        border border-white/20 dark:border-white/10
        ring-1 ring-black/5 dark:ring-white/5"
    >
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onSelectTool(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
          className={`p-2.5 rounded-xl transition-all duration-200 ${activeTool === tool.id
            ? "bg-brand text-white shadow-lg shadow-brand/30 scale-105"
            : "text-gray-600 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/10 hover:scale-105"
            }`}
        >
          {getIcon(tool.id)}
        </button>
      ))}

      <div className="w-[1px] h-8 bg-gray-300 dark:bg-white/10 mx-1"></div>

      <button
        onClick={onOpenLibrary}
        title="Icon Library"
        className="p-2.5 rounded-xl transition-all duration-200 text-gray-600 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/10 hover:scale-105"
      >
        <LayoutGrid size={20} />
      </button>

    </div>
  );
});

export default Toolbar;
