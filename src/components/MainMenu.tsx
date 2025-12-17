
import React, { useState, useEffect, useRef } from 'react';
import { Menu, Moon, Sun, Trash2, HelpCircle, Palette, Monitor, FileDown, FolderOpen } from 'lucide-react';
import { AppState } from '../types';

interface MainMenuProps {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    onClearCanvas: () => void;
    onThemeChange: () => void;
    theme: 'light' | 'dark';
    onOpenHelp: () => void;
}

const CANVAS_BACKGROUNDS = {
    light: [
        "#ffffff", // White
        "#f8f9fa", // Gray 50
        "#fffaff", // Floral White
        "#e3fafc", // Cyan 50 (Muted)
        "#fff9db", // Yellow 50 (Muted)
    ],
    dark: [
        "#121212", // Default Dark
        "#1e1e1e", // Excalidraw Dark
        "#232329", // Dark Blue Gray
        "#2c2c2c", // Graphite
        "#18181b", // Zinc 900
    ]
};

const MainMenu: React.FC<MainMenuProps> = ({ appState, setAppState, onClearCanvas, onThemeChange, theme, onOpenHelp }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const backgroundColors = theme === 'light' ? CANVAS_BACKGROUNDS.light : CANVAS_BACKGROUNDS.dark;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-[0_4px_12px_rgba(124,58,237,0.3)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
                <Menu size={20} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white/80 dark:bg-[#1e1e1e]/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">

                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Canvas Settings</h2>
                    </div>

                    <div className="p-2 space-y-1">

                        {/* Background Color */}
                        <div className="px-3 py-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                                <Palette size={16} /> Canvas Background
                            </div>
                            <div className="flex gap-2">
                                {backgroundColors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setAppState(prev => ({ ...prev, viewBackgroundColor: color }))}
                                        className={`w-8 h-8 rounded-lg border border-black/5 dark:border-white/10 shadow-sm transition-transform hover:scale-110 relative ${appState.viewBackgroundColor === color ? 'ring-2 ring-violet-500 z-10' : ''}`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="h-[1px] bg-gray-100 dark:bg-gray-800 my-2" />

                        {/* Theme & Clear */}
                        <button
                            onClick={() => { onThemeChange(); setIsOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                            <span>Toggle Dark Mode</span>
                        </button>

                        <button
                            onClick={() => { onClearCanvas(); setIsOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                            <span>Reset Canvas</span>
                        </button>

                        <div className="px-3 py-2 text-[10px] text-gray-400 text-center">
                            v1.0.0 • Fluxio
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default MainMenu;
