import React, { useState, useRef, useEffect } from 'react';
import { useHistory } from '../hooks/useHistory';
import Toolbar from '../components/Toolbar';
import PropertiesPanel from '../components/PropertiesPanel';
import GeminiModal from '../components/GeminiModal';
import ContextMenu from '../components/ContextMenu';
import IconLibrary from '../components/IconLibrary';
import QuickActions from '../components/QuickActions';
import HelpDialog from '../components/HelpDialog';
import MainMenu from '../components/MainMenu';
import ExportModal from '../components/ExportModal';
import CanvasContainer from '../components/CanvasContainer';
import { AppState, ExcalidrawElement, Point, TOOLS } from '../types';
import { getFontFamilyString, measureText } from '../utils/renderer';
import { useFrame } from '../hooks/useFrame';
import { useEditorEvents } from '../hooks/useEditorEvents';
import { ARCHITECTURE_ICONS } from '../utils/icons';

const EditorPage = () => {
    // --- State ---
    const [elements, setElements] = useState<ExcalidrawElement[]>(() => {
        const saved = localStorage.getItem('fluxio-elements');
        return saved ? JSON.parse(saved) : [];
    });
    const [appState, setAppState] = useState<AppState>(() => {
        const saved = localStorage.getItem('fluxio-state');
        const defaultState: AppState = {
            tool: "selection",
            strokeColor: "#000000",
            backgroundColor: "transparent",
            viewBackgroundColor: "#f8f9fa",
            strokeWidth: 2,
            strokeStyle: "solid",
            fillStyle: "hachure",
            opacity: 100,
            pan: { x: 0, y: 0 },
            zoom: 1,
            isDragging: false,
            selectionStart: null,
            selectionBox: null,
            selectedElementIds: [],
            editingElementId: null,
            resizingState: null,
            roughness: 0.5,
            eraserSize: 20,
            pendingDeletionIds: [],
            showGrid: true,
            snapToGrid: true,
            draggingOffset: null,
        };
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { ...defaultState, ...parsed, isDragging: false, selectionStart: null, selectionBox: null, selectedElementIds: [], editingElementId: null, resizingState: null, draggingOffset: null };
            } catch (e) { return defaultState; }
        }
        return defaultState;
    });

    const [clipboard, setClipboard] = useState<ExcalidrawElement[] | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [highlightedElementId, setHighlightedElementId] = useState<string | null>(null);
    const [laserTrails, setLaserTrails] = useState<{ x: number, y: number, time: number }[][]>([]);
    const [eraserTrail, setEraserTrail] = useState<Point[]>([]);
    const [cursorPos, setCursorPos] = useState<Point | null>(null);
    const currentLaserRef = useRef<{ x: number, y: number, time: number }[]>([]);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark' || 'light'));

    const { saveHistory, undo: undoHistory, redo: redoHistory, clearHistory, canUndo, canRedo } = useHistory([]);
    const { defineFrameGroups, handleDragToFrame } = useFrame();

    const [isGeminiOpen, setIsGeminiOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [tempElement, setTempElement] = useState<ExcalidrawElement | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Hooks for events
    const { handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick } = useEditorEvents({
        elements, setElements, appState, setAppState, tempElement, setTempElement,
        setCursorPos, setHighlightedElementId, setEraserTrail, setLaserTrails, currentLaserRef,
        saveHistory, defineFrameGroups, handleDragToFrame
    });

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    useEffect(() => {
        if (appState.editingElementId && textAreaRef.current) {
            // Small delay to ensure textarea is rendered and positioned
            const timeoutId = setTimeout(() => { 
                textAreaRef.current?.focus(); 
                textAreaRef.current?.select(); 
            }, 10);
            return () => clearTimeout(timeoutId);
        }
    }, [appState.editingElementId]);

    useEffect(() => {
        const { isDragging, selectionStart, selectionBox, selectedElementIds, editingElementId, resizingState, pan, zoom, ...persistentState } = appState;
        localStorage.setItem('fluxio-elements', JSON.stringify(elements));
        localStorage.setItem('fluxio-state', JSON.stringify(persistentState));
    }, [elements, appState.strokeColor, appState.backgroundColor, appState.strokeWidth, appState.strokeStyle, appState.fillStyle, appState.opacity, appState.showGrid, appState.viewBackgroundColor, appState.snapToGrid]);

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!(e.target instanceof HTMLCanvasElement)) return;
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                setAppState(prev => {
                    const zoomFactor = Math.exp(-e.deltaY * 0.008);
                    const newZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.1), 100);
                    const newPanX = e.clientX - (e.clientX - prev.pan.x) * (newZoom / prev.zoom);
                    const newPanY = e.clientY - (e.clientY - prev.pan.y) * (newZoom / prev.zoom);
                    return { ...prev, zoom: newZoom, pan: { x: newPanX, y: newPanY } };
                });
            } else {
                setAppState(prev => ({ ...prev, pan: { x: prev.pan.x - e.deltaX, y: prev.pan.y - e.deltaY } }));
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);

    // Laser trail cleanup
    useEffect(() => {
        if (laserTrails.length === 0) return;
        const loop = () => {
            const now = Date.now();
            let changed = false;
            const activeTrails = laserTrails.map(trail => {
                const isCurrent = trail === currentLaserRef.current && appState.isDragging && appState.tool === 'laser';
                if (isCurrent) return trail;
                const filtered = trail.filter(p => now - p.time < 1000);
                if (filtered.length !== trail.length) changed = true;
                return filtered;
            }).filter(trail => trail.length > 0);
            if (changed) setLaserTrails(activeTrails);
            if (activeTrails.length > 0) requestAnimationFrame(loop);
        };
        const id = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(id);
    }, [laserTrails, appState.isDragging, appState.tool]);

    const updateElements = (newElements: ExcalidrawElement[], shouldSaveToHistory = false) => {
        setElements(newElements);
        if (shouldSaveToHistory) saveHistory(newElements);
    };

    const updateSelectedElements = (updates: Partial<ExcalidrawElement>) => {
        if (appState.selectedElementIds.length === 0) return;
        const updated = elements.map(el => appState.selectedElementIds.includes(el.id) ? { ...el, ...updates } : el);
        updateElements(updated, true);
    };

    const undo = () => { const prev = undoHistory(); if (prev) setElements(prev); };
    const redo = () => { const next = redoHistory(); if (next) setElements(next); };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (appState.editingElementId) return;
        const isCtrl = e.metaKey || e.ctrlKey;
        if (isCtrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const remaining = elements.filter(el => !appState.selectedElementIds.includes(el.id) || el.isLocked);
            updateElements(remaining, true);
            setAppState(prev => ({ ...prev, selectedElementIds: [] }));
        }
    };
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [appState.selectedElementIds, elements]);

    const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); };

    const handleContextAction = (action: string) => {
        setContextMenu(null);
        switch (action) {
            case 'copy':
                if (appState.selectedElementIds.length === 0) return;
                const selected = elements.filter(el => appState.selectedElementIds.includes(el.id));
                setClipboard(JSON.parse(JSON.stringify(selected)));
                break;
            case 'paste':
                if (!clipboard || clipboard.length === 0) return;
                const offset = 20;
                const newElements = clipboard.map(el => ({
                    ...el,
                    id: crypto.randomUUID(),
                    x: el.x + offset,
                    y: el.y + offset,
                    seed: Math.floor(Math.random() * 2 ** 31)
                }));
                updateElements([...elements, ...newElements], true);
                setAppState(prev => ({ ...prev, selectedElementIds: newElements.map(e => e.id) }));
                break;
            case 'delete':
                const remaining = elements.filter(el => !appState.selectedElementIds.includes(el.id) || el.isLocked);
                updateElements(remaining, true);
                setAppState(prev => ({ ...prev, selectedElementIds: [] }));
                break;
        }
    };

    const handleAddIcon = (iconId: string) => {
        const iconDef = ARCHITECTURE_ICONS.find(i => i.id === iconId);
        if (!iconDef) return;
        const id = crypto.randomUUID();
        const newIcon: ExcalidrawElement = {
            id, type: 'icon', x: 100, y: 100, width: 50, height: 50, strokeColor: '#ffffff',
            backgroundColor: iconDef.defaultColor, strokeWidth: 2, strokeStyle: 'solid', fillStyle: 'solid',
            opacity: 100, iconPath: iconDef.path, seed: Math.floor(Math.random() * 2 ** 31),
            roughness: appState.roughness
        };
        updateElements([...elements, newIcon], true);
        setAppState(prev => ({ ...prev, selectedElementIds: [id], tool: 'selection' }));
        setIsLibraryOpen(false);
    };

    const handleQuickAction = (action: string) => {
        switch (action) {
            case 'library': setIsLibraryOpen(true); break;
            case 'ai': setIsGeminiOpen(true); break;
            case 'theme': handleToggleTheme(); break;
            case 'clear':
                if (window.confirm('Clear canvas?')) {
                    setElements([]);
                    clearHistory();
                }
                break;
            case 'export': handleExport(); break;
        }
    };

    const handleToggleTheme = () => {
        setTheme(t => {
            const newTheme = t === 'light' ? 'dark' : 'light';
            setAppState(prev => ({ ...prev, viewBackgroundColor: newTheme === 'dark' ? '#121212' : '#f8f9fa' }));
            return newTheme;
        });
    };
    const handleExport = () => setIsExportModalOpen(true);

    const handleTextBlur = () => {
        if (appState.editingElementId) {
            const updatedElements = elements.map(el => {
                if (el.id === appState.editingElementId && el.type === 'text') {
                    // If text is empty, mark for deletion
                    if (!el.text || el.text.trim() === '') {
                        return null; // Will be filtered out
                    }
                    return el;
                }
                return el;
            }).filter(el => el !== null) as ExcalidrawElement[];
            
            // Update elements and save history
            setElements(updatedElements);
            saveHistory(updatedElements);
            
            // Clear editing state - this will make text visible again
            setAppState(prev => ({ ...prev, editingElementId: null }));
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#f8f9fa] dark:bg-[#121212] touch-none select-none text-gray-900 dark:text-gray-100 transition-colors duration-200"
            style={{ backgroundColor: appState.viewBackgroundColor }}>

            <div className="fixed top-6 right-6 z-50">
                <MainMenu appState={appState} setAppState={setAppState} onClearCanvas={() => { if (window.confirm('Clear?')) { setElements([]); clearHistory(); } }}
                    theme={theme} onThemeChange={handleToggleTheme} onOpenHelp={() => setIsHelpOpen(true)} onExport={handleExport} />
            </div>

            <CanvasContainer
                elements={elements} tempElement={tempElement} appState={appState} theme={theme}
                highlightedElementId={highlightedElementId} laserTrails={laserTrails} eraserTrail={eraserTrail} cursorPos={cursorPos}
                handleMouseDown={handleMouseDown} handleMouseMove={handleMouseMove} handleMouseUp={handleMouseUp}
                handleDoubleClick={handleDoubleClick} handleContextMenu={handleContextMenu}
            />

            {appState.editingElementId && (() => {
                const el = elements.find(e => e.id === appState.editingElementId);
                if (!el) return null;
                const isFrame = el.type === 'frame';
                const textValue = isFrame ? (el.name || "Frame") : (el.text || "");
                return (
                    <textarea ref={textAreaRef} 
                        className="fixed bg-transparent outline-none resize-none overflow-hidden border-none whitespace-pre pointer-events-auto"
                        style={{
                            left: (el.x * appState.zoom) + appState.pan.x,
                            top: ((isFrame ? el.y - 24 : el.y) * appState.zoom) + appState.pan.y,
                            fontSize: (isFrame ? 14 : (el.fontSize || 20)) * appState.zoom,
                            fontFamily: isFrame ? 'sans-serif' : getFontFamilyString(el.fontFamily),
                            color: el.strokeColor || 'inherit',
                            minWidth: '1px',
                            minHeight: '1em',
                            padding: 0,
                            margin: 0,
                            lineHeight: 1.25,
                            transformOrigin: 'top left',
                            transform: `scale(${appState.zoom})`,
                            zIndex: 1000, // High z-index to ensure it's on top
                            caretColor: el.strokeColor || 'inherit',
                        }}
                        // We set width/height via ref or auto-calc.
                        // For Excalidraw-like feel, width should be exactly text width + char.
                        // Height should be scrollHeight.
                        value={textValue}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (isFrame) updateElements(elements.map(item => item.id === el.id ? { ...item, name: val } : item));
                            else {
                                // Dynamic resize logic
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                                e.target.style.width = 'auto';
                                e.target.style.width = e.target.scrollWidth + 'px';

                                const metrics = measureText(val, el.fontSize || 20, el.fontFamily || 1, el.fontWeight, el.fontStyle);
                                // We store logic size, but visually we let the textarea grow.
                                updateElements(elements.map(item => item.id === el.id ? { ...item, text: val, width: metrics.width, height: metrics.height } : item));
                            }
                        }}
                        onBlur={handleTextBlur}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) e.currentTarget.blur();
                            if (e.key === 'Escape') e.currentTarget.blur();
                        }}
                        autoFocus spellCheck={false}
                    />
                );
            })()}

            <Toolbar activeTool={appState.tool} onSelectTool={(tool) => setAppState(prev => ({ ...prev, tool, selectedElementIds: [] }))} onOpenLibrary={() => setIsLibraryOpen(true)} />

            <PropertiesPanel appState={appState} setAppState={setAppState} elements={elements} onUpdateElement={updateSelectedElements} undo={undo} redo={redo}
                clearCanvas={() => { setElements([]); clearHistory(); }} openGemini={() => setIsGeminiOpen(true)}
                onLayerChange={() => { }} onGroup={() => { }} onUngroup={() => { }} onAlign={() => { }} onToggleLock={() => { }} />

            <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-lg shadow-sm text-xs font-medium text-gray-600 dark:text-gray-300">
                    <button onClick={() => setAppState(s => ({ ...s, zoom: Math.max(0.1, s.zoom - 0.1) }))}>-</button>
                    <span className="w-8 text-center">{Math.round(appState.zoom * 100)}%</span>
                    <button onClick={() => setAppState(s => ({ ...s, zoom: Math.min(5, s.zoom + 0.1) }))}>+</button>
                </div>
            </div>

            <IconLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectIcon={handleAddIcon} />
            <QuickActions isOpen={isQuickActionsOpen} onClose={() => setIsQuickActionsOpen(false)} currentTheme={theme} onSelectTool={(t) => setAppState(p => ({ ...p, tool: t }))} onAction={handleQuickAction} />
            <HelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
            <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} elements={elements} selectedElementIds={appState.selectedElementIds} viewBackgroundColor={appState.viewBackgroundColor} theme={theme} />

            <ContextMenu position={contextMenu} onClose={() => setContextMenu(null)} onAction={handleContextAction}
                hasSelection={appState.selectedElementIds.length > 0} hasMultipleSelection={appState.selectedElementIds.length > 1} hasClipboard={!!clipboard}
                isGrouped={false} isLocked={false} />

            <GeminiModal isOpen={isGeminiOpen} onClose={() => setIsGeminiOpen(false)} onElementsGenerated={(newEls) => updateElements([...elements, ...newEls], true)} />
        </div>
    );
};

export default EditorPage;
