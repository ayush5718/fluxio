import React, { useState, useEffect, useRef } from 'react';
import {
    Menu, X, Sun, Moon, Trash2, HelpCircle, Palette, Monitor, FileDown, Hash
} from 'lucide-react';
import { AppState } from '../types';

interface MainMenuProps {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    onClearCanvas: () => void;
    onThemeChange: () => void;
    theme: 'light' | 'dark';
    onOpenHelp: () => void;
    onExport: () => void;
}

const CANVAS_BACKGROUNDS = {
    light: [
        { name: 'White', color: '#ffffff' },
        { name: 'Paper', color: '#f8f9fa' },
        { name: 'Cream', color: '#fffcf0' },
        { name: 'Gray', color: '#f1f3f5' },
    ],
    dark: [
        { name: 'Deep Black', color: '#000000' },
        { name: 'Dark Gray', color: '#121212' },
        { name: 'Navy', color: '#020617' },
        { name: 'Charcoal', color: '#1e1e1e' },
    ]
};

const MainMenu: React.FC<MainMenuProps> = ({ appState, setAppState, onClearCanvas, onThemeChange, theme, onOpenHelp, onExport }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const backgrounds = theme === 'light' ? CANVAS_BACKGROUNDS.light : CANVAS_BACKGROUNDS.dark;

    return (
        <div className="fixed top-4 right-4 z-[100]" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-gray-600 dark:text-gray-300"
            >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {isOpen && (
                <div className="absolute top-12 right-0 w-64 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-4 bg-transparent min-h-0">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Canvas Background</h3>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {backgrounds.map((bg) => (
                                <button
                                    key={bg.color}
                                    onClick={() => setAppState(prev => ({ ...prev, viewBackgroundColor: bg.color }))}
                                    className={`w-full aspect-square rounded-lg border-2 transition-all ${appState.viewBackgroundColor === bg.color ? 'border-brand scale-95 shadow-inner' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`}
                                    style={{ backgroundColor: bg.color }}
                                    title={bg.name}
                                />
                            ))}
                        </div>

                        <div className="h-[1px] bg-gray-100 dark:bg-gray-800 my-2" />

                        {/* Actions */}
                        <div className="px-2 pb-2">
                            <button
                                onClick={() => { onExport(); setIsOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <FileDown size={16} />
                                <span>Export as PNG</span>
                            </button>

                            <button
                                onClick={() => setAppState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <Monitor size={16} />
                                <span>{appState.showGrid ? "Hide Grid" : "Show Grid"}</span>
                            </button>

                            <button
                                onClick={() => setAppState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }))}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <Hash size={16} />
                                <span>{appState.snapToGrid ? "Disable Snapping" : "Enable Snapping"}</span>
                            </button>
                        </div>

                        <div className="h-[1px] bg-gray-100 dark:bg-gray-800 my-2" />

                        {/* Theme & Clear */}
                        <div className="px-2 space-y-1">
                            <button
                                onClick={() => { onThemeChange(); setIsOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                            </button>
                            <button
                                onClick={() => { onOpenHelp(); setIsOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <HelpCircle size={16} />
                                <span>Help \u0026 Shortcuts</span>
                            </button>
                            <button
                                onClick={() => { onClearCanvas(); setIsOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} />
                                <span>Clear Canvas</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainMenu;
