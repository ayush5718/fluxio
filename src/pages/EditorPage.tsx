
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
import { AppState, ExcalidrawElement, Point, ToolType, TOOLS, Binding } from '../types';
import { renderScene, getFontFamilyString, getFontString, measureText } from '../utils/renderer';
import {
    getDistance,
    hitTest,
    getElementAtPosition,
    getElementsWithinRect,
    getResizeHandles,
    getResizeHandleAtPosition,
    getConnectorHandleAtPosition,
    getCursorForHandle,
    resizeElement,
    getSnapPoints,
    getClosestSnapPoint,
    getAnchorPosition,
    generateOrthogonalPoints,
    getSmartAnchors,
    getIntersectingPoint
} from '../utils/geometry';
import { findEnclosingFrame } from '../utils/frameUtils';
import { ARCHITECTURE_ICONS } from '../utils/icons';
import { useFrame } from '../hooks/useFrame';
import { Sun, Moon, HelpCircle } from 'lucide-react';

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
            showGrid: true,
            snapToGrid: true,
        };
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Reset transient states
                return {
                    ...defaultState,
                    ...parsed,
                    isDragging: false,
                    selectionStart: null,
                    selectionBox: null,
                    selectedElementIds: [],
                    editingElementId: null,
                    resizingState: null
                };
            } catch (e) {
                return defaultState;
            }
        }
        return defaultState;
    });

    const [clipboard, setClipboard] = useState<ExcalidrawElement[] | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [highlightedElementId, setHighlightedElementId] = useState<string | null>(null);
    const [laserTrails, setLaserTrails] = useState<{ x: number, y: number, time: number }[][]>([]);
    const currentLaserRef = useRef<{ x: number, y: number, time: number }[]>([]);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    });

    // History Hook
    const { saveHistory, undo: undoHistory, redo: redoHistory, clearHistory, canUndo, canRedo } = useHistory([]);

    // Frame Hook
    const { defineFrameGroups, handleDragToFrame } = useFrame();


    const [isGeminiOpen, setIsGeminiOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const [tempElement, setTempElement] = useState<ExcalidrawElement | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Constants
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 100;

    useEffect(() => {
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    useEffect(() => {
        if (appState.editingElementId && textAreaRef.current) {
            setTimeout(() => {
                textAreaRef.current?.focus();
                textAreaRef.current?.select();
            }, 0);
        }
    }, [appState.editingElementId]);

    useEffect(() => {
        const { isDragging, selectionStart, selectionBox, selectedElementIds, editingElementId, resizingState, pan, zoom, ...persistentState } = appState;
        localStorage.setItem('fluxio-elements', JSON.stringify(elements));
        localStorage.setItem('fluxio-state', JSON.stringify(persistentState));
    }, [elements, appState.strokeColor, appState.backgroundColor, appState.strokeWidth, appState.strokeStyle, appState.fillStyle, appState.opacity, appState.showGrid, appState.viewBackgroundColor, appState.snapToGrid]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.target !== canvas) return;
            e.preventDefault();

            if (e.ctrlKey || e.metaKey) {
                setAppState(prev => {
                    const ZOOM_SENSITIVITY = 0.008;
                    const zoomFactor = Math.exp(-e.deltaY * ZOOM_SENSITIVITY);
                    const newZoom = Math.min(Math.max(prev.zoom * zoomFactor, MIN_ZOOM), MAX_ZOOM);

                    const mouseX = e.clientX;
                    const mouseY = e.clientY;

                    const newPanX = mouseX - (mouseX - prev.pan.x) * (newZoom / prev.zoom);
                    const newPanY = mouseY - (mouseY - prev.pan.y) * (newZoom / prev.zoom);

                    return {
                        ...prev,
                        zoom: newZoom,
                        pan: { x: newPanX, y: newPanY }
                    };
                });
            } else {
                setAppState(prev => ({
                    ...prev,
                    pan: {
                        x: prev.pan.x - e.deltaX,
                        y: prev.pan.y - e.deltaY
                    }
                }));
            }
        };
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, []);

    useEffect(() => {
        if (laserTrails.length === 0) return;

        let animationFrameId: number;
        const loop = () => {
            const now = Date.now();
            let changed = false;

            const activeTrails = laserTrails.map(trail => {
                const isCurrent = trail === currentLaserRef.current && appState.isDragging && appState.tool === 'laser';
                if (isCurrent) return trail;

                const filtered = trail.filter(p => now - p.time < 1000);
                if (filtered.length !== trail.length) changed = true;
                return filtered;
            }).filter(trail => {
                if (trail.length === 0) {
                    changed = true;
                    return false;
                }
                return true;
            });

            if (changed) {
                setLaserTrails(activeTrails);
            }

            if (activeTrails.length > 0) {
                animationFrameId = requestAnimationFrame(loop);
            }
        };

        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [laserTrails, appState.isDragging, appState.tool]);

    const updateElements = (newElements: ExcalidrawElement[], shouldSaveToHistory = false) => {
        setElements(newElements);
        if (shouldSaveToHistory) saveHistory(newElements);
    };

    const updateSelectedElements = (updates: Partial<ExcalidrawElement>) => {
        if (appState.selectedElementIds.length === 0) return;
        const updatedElements = elements.map(el => {
            if (appState.selectedElementIds.includes(el.id)) {
                if ('isLocked' in updates) return { ...el, ...updates };
                if (el.isLocked) return el;
                return { ...el, ...updates };
            }
            return el;
        });
        updateElements(updatedElements, true);
    };

    const undo = () => {
        const prevElements = undoHistory();
        if (prevElements) setElements(prevElements);
    };

    const redo = () => {
        const nextElements = redoHistory();
        if (nextElements) setElements(nextElements);
    };

    const copySelection = () => {
        if (appState.selectedElementIds.length === 0) return;
        const selectedElements = elements.filter(el => appState.selectedElementIds.includes(el.id));
        setClipboard(JSON.parse(JSON.stringify(selectedElements)));
    };

    const cutSelection = () => {
        const selectedLocked = elements.some(el => appState.selectedElementIds.includes(el.id) && el.isLocked);
        if (selectedLocked) return;
        copySelection();
        handleDelete();
    };

    const pasteFromClipboard = () => {
        if (!clipboard || clipboard.length === 0) return;
        const offset = 20;
        const newElements = clipboard.map(el => ({
            ...el,
            id: crypto.randomUUID(),
            x: el.x + offset,
            y: el.y + offset,
            groupIds: el.groupIds ? [...el.groupIds] : undefined,
            seed: Math.floor(Math.random() * 2 ** 31) // Refresh seed on paste? Maybe yes.
            , fillStyle: el.fillStyle || "hachure"
        }));
        updateElements([...elements, ...newElements], true);
        setAppState(prev => ({ ...prev, selectedElementIds: newElements.map(e => e.id) }));
    };

    const duplicateSelection = () => {
        if (appState.selectedElementIds.length === 0) return;
        const selectedElements = elements.filter(el => appState.selectedElementIds.includes(el.id));
        const offset = 20;
        const newElements = selectedElements.map(el => ({
            ...el,
            id: crypto.randomUUID(),
            x: el.x + offset,
            y: el.y + offset,
            seed: Math.floor(Math.random() * 2 ** 31),
            fillStyle: el.fillStyle || "hachure"
        }));
        updateElements([...elements, ...newElements], true);
        setAppState(prev => ({ ...prev, selectedElementIds: newElements.map(e => e.id) }));
    };

    const handleDelete = () => {
        if (appState.selectedElementIds.length > 0) {
            const idsToDelete = appState.selectedElementIds.filter(id => {
                const el = elements.find(e => e.id === id);
                return el && !el.isLocked;
            });
            if (idsToDelete.length === 0) return;
            const remaining = elements.filter(el => !idsToDelete.includes(el.id));
            updateElements(remaining, true);
            setAppState(prev => ({ ...prev, selectedElementIds: prev.selectedElementIds.filter(id => !idsToDelete.includes(id)) }));
        }
    };

    const handleToggleLock = () => {
        if (appState.selectedElementIds.length === 0) return;
        const selectedElements = elements.filter(el => appState.selectedElementIds.includes(el.id));
        const allLocked = selectedElements.every(el => el.isLocked);
        updateSelectedElements({ isLocked: !allLocked });
    };

    const handleLayerChange = (action: 'front' | 'back' | 'forward' | 'backward') => {
        if (appState.selectedElementIds.length === 0) return;
        const selectedElements = elements.filter(el => appState.selectedElementIds.includes(el.id));
        if (selectedElements.some(el => el.isLocked)) return;

        let newElements = [...elements];
        const selectedIds = new Set(appState.selectedElementIds);

        const indices = newElements
            .map((el, index) => selectedIds.has(el.id) ? index : -1)
            .filter(index => index !== -1)
            .sort((a, b) => a - b);

        if (action === 'front') {
            const toMove = indices.map(i => newElements[i]);
            newElements = newElements.filter((_, i) => !selectedIds.has(newElements[i].id));
            newElements.push(...toMove);
        } else if (action === 'back') {
            const toMove = indices.map(i => newElements[i]);
            newElements = newElements.filter((_, i) => !selectedIds.has(newElements[i].id));
            newElements.unshift(...toMove);
        } else if (action === 'forward') {
            for (let i = indices.length - 1; i >= 0; i--) {
                const idx = indices[i];
                if (idx < newElements.length - 1) {
                    const nextEl = newElements[idx + 1];
                    if (!selectedIds.has(nextEl.id)) {
                        [newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]];
                    }
                }
            }
        } else if (action === 'backward') {
            for (let i = 0; i < indices.length; i++) {
                const idx = indices[i];
                if (idx > 0) {
                    const prevEl = newElements[idx - 1];
                    if (!selectedIds.has(prevEl.id)) {
                        [newElements[idx], newElements[idx - 1]] = [newElements[idx - 1], newElements[idx]];
                    }
                }
            }
        }

        updateElements(newElements, true);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleContextAction = (action: string) => {
        setContextMenu(null);
        switch (action) {
            case 'copy': copySelection(); break;
            case 'paste': pasteFromClipboard(); break;
            case 'cut': cutSelection(); break;
            case 'duplicate': duplicateSelection(); break;
            case 'delete': handleDelete(); break;
            case 'layer-front': handleLayerChange('front'); break;
            case 'layer-back': handleLayerChange('back'); break;
            case 'group': handleGroup(); break;
            case 'ungroup': handleUngroup(); break;
            case 'lock': updateSelectedElements({ isLocked: true }); break;
            case 'unlock': updateSelectedElements({ isLocked: false }); break;
        }
    };

    const handleAddIcon = (iconId: string) => {
        const iconDef = ARCHITECTURE_ICONS.find(i => i.id === iconId);
        if (!iconDef) return;

        const viewportCenterX = (window.innerWidth / appState.zoom / 2) - (appState.pan.x / appState.zoom);
        const viewportCenterY = (window.innerHeight / appState.zoom / 2) - (appState.pan.y / appState.zoom);

        const id = crypto.randomUUID();
        const newIcon: ExcalidrawElement = {
            id,
            type: 'icon',
            x: viewportCenterX - 25, // Center it (50x50 default size)
            y: viewportCenterY - 25,
            width: 50,
            height: 50,
            strokeColor: '#ffffff', // White stroke for icons usually
            backgroundColor: iconDef.defaultColor, // Use category color
            strokeWidth: 2,
            strokeStyle: 'solid',
            fillStyle: 'solid', // User usually wants icons solid? Or appState? Let's force solid for icons for now or they look weird hachured.
            opacity: 100,
            iconPath: iconDef.path,
            seed: Math.floor(Math.random() * 2 ** 31)
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
            setAppState(prev => ({
                ...prev,
                viewBackgroundColor: newTheme === 'dark' ? '#121212' : '#f8f9fa'
            }));
            return newTheme;
        });
    };

    const handleExport = () => {
        setIsExportModalOpen(true);
    };

    const shouldShowSnapPoints = (appState.tool === 'arrow' || appState.tool === 'line') ||
        (appState.isDragging && (tempElement?.type === 'arrow' || tempElement?.type === 'line')) ||
        (!!appState.resizingState && (elements.find(e => e.id === appState.resizingState?.elementId)?.type === 'arrow' || elements.find(e => e.id === appState.resizingState?.elementId)?.type === 'line'));

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.scale(dpr, dpr);
        const elementsToRender = tempElement ? [...elements, tempElement] : elements;
        renderScene(ctx, elementsToRender, appState.pan, appState.zoom, appState.selectedElementIds, highlightedElementId, appState.selectionBox, laserTrails, appState.editingElementId, shouldShowSnapPoints, theme, appState.showGrid);
    }, [elements, tempElement, appState.pan, appState.zoom, appState.selectedElementIds, theme, highlightedElementId, appState.selectionBox, laserTrails, appState.editingElementId, shouldShowSnapPoints, appState.showGrid]);

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current) {
                const dpr = window.devicePixelRatio || 1;
                canvasRef.current.width = window.innerWidth * dpr;
                canvasRef.current.height = window.innerHeight * dpr;
                canvasRef.current.style.width = `${window.innerWidth}px`;
                canvasRef.current.style.height = `${window.innerHeight}px`;
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.scale(dpr, dpr);
                    const elementsToRender = tempElement ? [...elements, tempElement] : elements;
                    renderScene(ctx, elementsToRender, appState.pan, appState.zoom, appState.selectedElementIds, highlightedElementId, appState.selectionBox, laserTrails, appState.editingElementId, shouldShowSnapPoints, theme, appState.showGrid);
                }
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [elements, tempElement, appState, highlightedElementId, laserTrails, appState.editingElementId, shouldShowSnapPoints]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (appState.editingElementId) {
                if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                    e.preventDefault();
                    setAppState(prev => ({ ...prev, editingElementId: null }));
                    return;
                }
                return;
            }
            const isCtrl = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;

            // Global Shortcuts
            if (isCtrl && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsQuickActionsOpen(prev => !prev);
                return;
            }

            if (e.key === '?' || (isShift && e.key === '/')) {
                e.preventDefault();
                setIsHelpOpen(prev => !prev);
                return;
            }

            if (isCtrl) {
                switch (e.key.toLowerCase()) {
                    case 'z': e.preventDefault(); if (e.shiftKey) redo(); else undo(); return;
                    case 'c':
                        e.preventDefault();
                        if (isShift) {
                            handleExport(); // Open modal for specific export/copy
                        } else {
                            copySelection();
                        }
                        return;
                    case 'x': e.preventDefault(); cutSelection(); return;
                    case 'v': e.preventDefault(); pasteFromClipboard(); return;
                    case 'd': e.preventDefault(); duplicateSelection(); return;
                    case 'a': e.preventDefault(); setAppState(prev => ({ ...prev, selectedElementIds: elements.map(el => el.id) })); return;
                    case 'g': e.preventDefault(); if (e.shiftKey) handleUngroup(); else handleGroup(); return;
                    case 'l': e.preventDefault(); if (isShift) handleToggleLock(); return;
                    case '0': e.preventDefault(); setAppState(prev => ({ ...prev, zoom: 1, pan: { x: 0, y: 0 } })); return;
                    case '+':
                    case '=':
                        e.preventDefault();
                        setAppState(prev => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.1) }));
                        return;
                    case '-':
                    case '_':
                        e.preventDefault();
                        setAppState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.1) }));
                        return;
                    case ']': e.preventDefault(); handleLayerChange(isShift ? 'front' : 'forward'); return;
                    case '[': e.preventDefault(); handleLayerChange(isShift ? 'back' : 'backward'); return;
                }
            }

            if (e.key.toLowerCase() === 'g' && !isCtrl) {
                e.preventDefault();
                setAppState(prev => ({ ...prev, showGrid: !prev.showGrid }));
                return;
            }

            const tool = TOOLS.find(t => t.shortcut === e.key);
            if (tool) setAppState(prev => ({ ...prev, tool: tool.id }));
            if (e.key === 'Delete' || e.key === 'Backspace') handleDelete();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [appState.selectedElementIds, elements, appState.editingElementId, clipboard, undo, redo]);

    const handleGroup = () => {
        const selected = elements.filter(el => appState.selectedElementIds.includes(el.id));
        if (selected.length < 2) return;
        if (selected.some(el => el.isLocked)) return;

        const groupId = crypto.randomUUID();
        const updatedElements = elements.map(el => {
            if (appState.selectedElementIds.includes(el.id)) {
                return { ...el, groupIds: [...(el.groupIds || []), groupId] };
            }
            return el;
        });
        updateElements(updatedElements, true);
    };

    const handleUngroup = () => {
        if (appState.selectedElementIds.length === 0) return;
        const selected = elements.filter(el => appState.selectedElementIds.includes(el.id));
        if (selected.some(el => el.isLocked)) return;

        const updatedElements = elements.map(el => {
            if (appState.selectedElementIds.includes(el.id) && el.groupIds && el.groupIds.length > 0) {
                const newGroups = el.groupIds.slice(0, -1);
                return { ...el, groupIds: newGroups };
            }
            return el;
        });
        updateElements(updatedElements, true);
    };

    const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        const selected = elements.filter(el => appState.selectedElementIds.includes(el.id));
        if (selected.length < 2) return;
        if (selected.some(el => el.isLocked)) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        selected.forEach(el => {
            minX = Math.min(minX, el.x);
            maxX = Math.max(maxX, el.x + el.width);
            minY = Math.min(minY, el.y);
            maxY = Math.max(maxY, el.y + el.height);
        });
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const updatedElements = elements.map(el => {
            if (appState.selectedElementIds.includes(el.id)) {
                let newX = el.x;
                let newY = el.y;
                switch (type) {
                    case 'left': newX = minX; break;
                    case 'center': newX = centerX - el.width / 2; break;
                    case 'right': newX = maxX - el.width; break;
                    case 'top': newY = minY; break;
                    case 'middle': newY = centerY - el.height / 2; break;
                    case 'bottom': newY = maxY - el.height; break;
                }
                return { ...el, x: newX, y: newY };
            }
            return el;
        });
        updateElements(updatedElements, true);
    };

    const getPointerPos = (e: React.MouseEvent) => {
        return {
            x: (e.clientX - appState.pan.x) / appState.zoom,
            y: (e.clientY - appState.pan.y) / appState.zoom
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (contextMenu) setContextMenu(null);
        if (appState.editingElementId) {
            setAppState(prev => ({ ...prev, editingElementId: null }));
            return;
        }
        if (e.button === 1 || (appState.tool === 'selection' && e.buttons === 4)) return;

        if (e.button === 2) {
            const pos = getPointerPos(e);
            const element = getElementAtPosition(pos.x, pos.y, elements);
            if (element && !appState.selectedElementIds.includes(element.id)) {
                setAppState(prev => ({ ...prev, selectedElementIds: [element.id] }));
            }
            return;
        }

        const pos = getPointerPos(e);

        // --- Resizing Check ---
        if (appState.tool === 'selection' && appState.selectedElementIds.length === 1) {
            const selectedId = appState.selectedElementIds[0];
            const selectedEl = elements.find(el => el.id === selectedId);
            if (selectedEl) {
                // Check if locked
                if (selectedEl.isLocked) {
                    // If locked, skip
                } else {
                    let handle = getResizeHandleAtPosition(pos.x, pos.y, selectedEl, appState.zoom);

                    // Handle Midpoint Creation
                    if (typeof handle === 'string' && handle.startsWith('m:')) {
                        const idx = parseInt(handle.split(':')[1]);
                        if (!isNaN(idx) && selectedEl.points) {
                            const p1 = selectedEl.points[idx];
                            const p2 = selectedEl.points[idx + 1];
                            const midX = (p1.x + p2.x) / 2;
                            const midY = (p1.y + p2.y) / 2;

                            const newPoints = [...selectedEl.points];
                            newPoints.splice(idx + 1, 0, { x: midX, y: midY });

                            const newElement = { ...selectedEl, points: newPoints };
                            updateElements(elements.map(el => el.id === selectedEl.id ? newElement : el));
                            handle = `p:${idx + 1}`;

                            setAppState(prev => ({
                                ...prev,
                                isDragging: true,
                                resizingState: {
                                    elementId: selectedEl.id,
                                    handle: handle as any,
                                    startMousePos: pos,
                                    originalElement: newElement
                                }
                            }));
                            return;
                        }
                    }

                    if (handle) {
                        setAppState(prev => ({
                            ...prev,
                            isDragging: true,
                            resizingState: {
                                elementId: selectedEl.id,
                                handle,
                                startMousePos: pos,
                                originalElement: { ...selectedEl, points: selectedEl.points ? [...selectedEl.points] : undefined }
                            }
                        }));
                        return;
                    }

                    const connectorKey = getConnectorHandleAtPosition(pos.x, pos.y, selectedEl, appState.zoom);
                    if (connectorKey) {
                        const anchorMap: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
                            'n': 'top', 'e': 'right', 's': 'bottom', 'w': 'left'
                        };
                        const anchor = anchorMap[connectorKey as string];
                        const startPoint = getAnchorPosition(selectedEl, anchor);

                        setAppState(prev => ({ ...prev, tool: 'arrow', isDragging: true, selectionStart: pos }));

                        const id = crypto.randomUUID();
                        const newArrow: ExcalidrawElement = {
                            id,
                            type: 'arrow',
                            x: startPoint.x,
                            y: startPoint.y,
                            width: 0,
                            height: 0,
                            strokeColor: appState.strokeColor,
                            backgroundColor: appState.backgroundColor,
                            strokeWidth: appState.strokeWidth,
                            strokeStyle: appState.strokeStyle,
                            fillStyle: appState.fillStyle,
                            opacity: appState.opacity,
                            points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                            startBinding: { elementId: selectedId, anchor },
                            seed: Math.floor(Math.random() * 2 ** 31)
                        };
                        setTempElement(newArrow);
                        return;
                    }
                }
            }
        }

        if (appState.tool === 'selection') {
            const element = getElementAtPosition(pos.x, pos.y, elements);
            if (element) {
                let idsToSelect = [element.id];
                if (element.groupIds && element.groupIds.length > 0) {
                    const latestGroupId = element.groupIds[element.groupIds.length - 1];
                    idsToSelect = elements.filter(el => el.groupIds && el.groupIds.includes(latestGroupId)).map(el => el.id);
                }

                if (e.shiftKey) {
                    const isSelected = appState.selectedElementIds.includes(element.id);
                    let newSelectedIds = [...appState.selectedElementIds];
                    if (isSelected) newSelectedIds = newSelectedIds.filter(id => !idsToSelect.includes(id));
                    else newSelectedIds = [...newSelectedIds, ...idsToSelect];
                    setAppState(prev => ({ ...prev, selectedElementIds: newSelectedIds, isDragging: false }));
                } else {
                    if (!appState.selectedElementIds.includes(element.id)) {
                        setAppState(prev => ({ ...prev, selectedElementIds: idsToSelect, isDragging: true, selectionStart: pos }));
                    } else {
                        setAppState(prev => ({ ...prev, isDragging: true, selectionStart: pos }));
                    }
                }
            } else {
                if (!e.shiftKey) {
                    setAppState(prev => ({ ...prev, selectedElementIds: [], selectionBox: { x: pos.x, y: pos.y, width: 0, height: 0 }, selectionStart: pos }));
                } else {
                    setAppState(prev => ({ ...prev, selectionBox: { x: pos.x, y: pos.y, width: 0, height: 0 }, selectionStart: pos }));
                }
            }
            return;
        }

        if (appState.tool === 'eraser') {
            const element = getElementAtPosition(pos.x, pos.y, elements);
            if (element && !element.isLocked) {
                updateElements(elements.filter(el => el.id !== element.id), true);
            }
            setAppState(prev => ({ ...prev, isDragging: true, selectionStart: pos }));
            return;
        }

        if (appState.tool === 'text') {
            e.preventDefault();
            const id = crypto.randomUUID();
            const newEl: ExcalidrawElement = {
                id, type: 'text', x: pos.x, y: pos.y, width: 20, height: 24, strokeColor: appState.strokeColor, backgroundColor: appState.backgroundColor, strokeWidth: 1, opacity: appState.opacity, text: "", fontSize: 20, fontFamily: 1, fontWeight: 400, fontStyle: 'normal', strokeStyle: "solid", seed: Math.floor(Math.random() * 2 ** 31), fillStyle: appState.fillStyle
            };
            setElements([...elements, newEl]);
            setAppState(prev => ({ ...prev, tool: 'selection', editingElementId: id, selectedElementIds: [id], isDragging: false }));
            document.body.style.cursor = 'text';
            return;
        }

        setAppState(prev => ({ ...prev, isDragging: true, selectionStart: pos }));
        const id = crypto.randomUUID();
        let initialPoints = (appState.tool === 'arrow' || appState.tool === 'line' || appState.tool === 'freedraw') ? [{ x: 0, y: 0 }] : undefined;

        // Check for start binding if arrow/line
        let startBinding: Binding | undefined = undefined;
        let startX = pos.x;
        let startY = pos.y;

        if (appState.tool === 'arrow' || appState.tool === 'line') {
            const hovered = getElementAtPosition(pos.x, pos.y, elements);
            if (hovered) {
                const snap = getClosestSnapPoint(pos.x, pos.y, hovered);
                if (snap) {
                    startX = snap.x;
                    startY = snap.y;
                    startBinding = { elementId: hovered.id, anchor: snap.anchor };
                    // Reset points relative to new start
                    initialPoints = [{ x: 0, y: 0 }];
                }
            }
        }

        let name: string | undefined = undefined;
        if (appState.tool === 'frame') {
            const frameCount = elements.filter(e => e.type === 'frame').length + 1;
            name = `Frame ${frameCount}`;
        }

        const newElement: ExcalidrawElement = {
            id,
            type: appState.tool as any,
            x: startX,
            y: startY,
            width: 0,
            height: 0,
            strokeColor: appState.strokeColor,
            backgroundColor: appState.tool === 'frame' ? 'transparent' : appState.backgroundColor,
            strokeWidth: appState.strokeWidth,
            strokeStyle: appState.tool === 'frame' ? 'solid' : appState.strokeStyle, // Set stroke style
            fillStyle: appState.tool === 'frame' ? 'solid' : appState.fillStyle,
            opacity: appState.opacity,
            points: initialPoints,
            startBinding,
            name,
            seed: Math.floor(Math.random() * 2 ** 31),
            roundness: appState.tool === 'rectangle' ? 12 : 0
        };
        setTempElement(newElement);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        const pos = getPointerPos(e);
        const element = getElementAtPosition(pos.x, pos.y, elements);
        if (element) {
            // Allow editing for Text elements AND Frames
            if (element.type === 'text' || element.type === 'frame') {
                setAppState(prev => ({ ...prev, editingElementId: element.id }));
            }
        } else {
            // Double click on empty space -> Create Text
            const id = crypto.randomUUID();
            const newEl: ExcalidrawElement = {
                id,
                type: 'text',
                x: pos.x,
                y: pos.y,
                width: 20,
                height: 24,
                strokeColor: appState.strokeColor,
                backgroundColor: appState.backgroundColor,
                strokeWidth: 1,
                opacity: appState.opacity,
                text: "",
                fontSize: 20,
                fontFamily: 1,
                fontWeight: 400,
                fontStyle: 'normal',
                strokeStyle: "solid",
                seed: Math.floor(Math.random() * 2 ** 31)
            };

            setElements(prev => [...prev, newEl]);
            setAppState(prev => ({
                ...prev,
                tool: 'selection', // Switch to selection so we don't keep creating text with single clicks if tool was text
                editingElementId: id,
                selectedElementIds: [id]
            }));
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        let pos = getPointerPos(e);
        if (appState.snapToGrid) {
            pos = {
                x: Math.round(pos.x / 20) * 20,
                y: Math.round(pos.y / 20) * 20
            };
        }
        const hoveredEl = getElementAtPosition(pos.x, pos.y, elements);

        // --- Cursor Updates & Highlight Logic ---
        if (!appState.isDragging) {
            if (appState.tool === 'selection') {
                setHighlightedElementId(hoveredEl ? hoveredEl.id : null);

                if (hoveredEl) {
                    document.body.style.cursor = 'move';
                } else {
                    document.body.style.cursor = 'default';
                }

                if (appState.selectedElementIds.length === 1) {
                    const selectedEl = elements.find(el => el.id === appState.selectedElementIds[0]);
                    const handle = getResizeHandleAtPosition(pos.x, pos.y, selectedEl, appState.zoom);
                    if (handle) {
                        document.body.style.cursor = getCursorForHandle(handle);
                        return;
                    }
                    const conn = getConnectorHandleAtPosition(pos.x, pos.y, selectedEl, appState.zoom);
                    if (conn) {
                        document.body.style.cursor = 'copy';
                        return;
                    }
                }
            } else if (appState.tool === 'arrow' || appState.tool === 'line') {
                setHighlightedElementId(hoveredEl ? hoveredEl.id : null);
                document.body.style.cursor = 'crosshair';
            } else if (appState.tool === 'text') {
                document.body.style.cursor = 'text';
            } else if (appState.tool === 'eraser') {
                setHighlightedElementId(hoveredEl ? hoveredEl.id : null);
                document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l12-12c1-1 2.5-1 3.4 0l4.3 4.3c1 1 1 2.5 0 3.4l-7 7\'/%3E%3Cpath d=\'M5 11l9 9\'/%3E%3Cpath d=\'m15 5 4 4\'/%3E%3Cpath d=\'M22 21H7\'/%3E%3C/svg%3E") 0 24, auto';
            } else {
                setHighlightedElementId(null);
                document.body.style.cursor = 'crosshair';
            }
        }
        else {
            // Dragging logic
            if (appState.tool === 'eraser' && e.buttons === 1) {
                const element = getElementAtPosition(pos.x, pos.y, elements);
                if (element && !element.isLocked) {
                    const newElements = elements.filter(el => el.id !== element.id);
                    if (newElements.length !== elements.length) {
                        updateElements(newElements, false); // Don't save history for every tiny drag step
                    }
                }
                return;
            }

            if (tempElement && (tempElement.type === 'arrow' || tempElement.type === 'line')) {
                setHighlightedElementId(hoveredEl ? hoveredEl.id : null);
            } else if (appState.resizingState) {
                const el = appState.resizingState.originalElement;
                if (el.type === 'arrow' || el.type === 'line') {
                    setHighlightedElementId(hoveredEl ? hoveredEl.id : null);
                }
            }
        }

        // --- Resizing Logic ---
        if (appState.resizingState && appState.isDragging) {
            const { originalElement, handle } = appState.resizingState;
            let newPos = pos;
            let binding: Binding | undefined = undefined;

            // Dynamic Binding Logic
            if ((originalElement.type === 'arrow' || originalElement.type === 'line') && (handle === 'start' || handle === 'end')) {
                if (hoveredEl) {
                    const fixedIdx = handle === 'start' ? originalElement.points!.length - 1 : 0;
                    const fixedPointRel = originalElement.points![fixedIdx];
                    const fixedPointAbs = {
                        x: originalElement.x + fixedPointRel.x,
                        y: originalElement.y + fixedPointRel.y
                    };
                    const intersect = getIntersectingPoint(hoveredEl, fixedPointAbs);
                    newPos = intersect;
                    // @ts-ignore
                    binding = { elementId: hoveredEl.id, anchor: 'center' };
                }
            }

            const updatedElement = resizeElement(handle, originalElement, newPos, e.shiftKey);

            setElements(prev => prev.map(el => {
                if (el.id === originalElement.id) {
                    let res = { ...el, ...updatedElement };
                    if (handle === 'start') res.startBinding = binding;
                    if (handle === 'end') res.endBinding = binding;
                    return res;
                }
                return el;
            }));
            return;
        }

        if (appState.tool === 'laser' && appState.isDragging) {
            currentLaserRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
            setLaserTrails(prev => [...prev, currentLaserRef.current]);
            return;
        }

        if (e.buttons === 4 || (appState.tool === 'selection' && e.buttons === 2)) {
            setAppState(prev => ({ ...prev, pan: { x: prev.pan.x + e.movementX, y: prev.pan.y + e.movementY } }));
            return;
        }

        if (appState.selectionBox && appState.selectionStart) {
            const width = pos.x - appState.selectionStart.x;
            const height = pos.y - appState.selectionStart.y;
            const newBox = { x: appState.selectionStart.x, y: appState.selectionStart.y, width, height };
            setAppState(prev => ({ ...prev, selectionBox: newBox }));
            const elementsInBox = getElementsWithinRect(newBox.x, newBox.y, newBox.width, newBox.height, elements);
            if (e.shiftKey) {
                const newIds = Array.from(new Set([...appState.selectedElementIds, ...elementsInBox.map(e => e.id)]));
                setAppState(prev => ({ ...prev, selectedElementIds: newIds }));
            } else {
                setAppState(prev => ({ ...prev, selectedElementIds: elementsInBox.map(e => e.id) }));
            }
            return;
        }

        if (appState.isDragging && appState.selectionStart && appState.tool === 'selection') {
            const dx = pos.x - appState.selectionStart.x;
            const dy = pos.y - appState.selectionStart.y;

            if (dx === 0 && dy === 0) return;

            if (appState.selectedElementIds.length > 0) {
                const updatedElementsMap = new Map<string, ExcalidrawElement>();
                const allElementsMap = new Map<string, ExcalidrawElement>(elements.map(e => [e.id, e]));
                const selectedIds = new Set(appState.selectedElementIds);

                const selectedFrameIds = elements
                    .filter(e => selectedIds.has(e.id) && e.type === 'frame')
                    .map(e => e.id);

                const elementsToMove = elements.filter(el => {
                    if (el.isLocked) return false;
                    return selectedIds.has(el.id) || (el.frameId && selectedFrameIds.includes(el.frameId));
                });

                const elementsToMoveIds = new Set(elementsToMove.map(e => e.id));

                // Single pass to move and bind
                const nextElements = elements.map(el => {
                    let subject = el;
                    if (elementsToMoveIds.has(el.id)) {
                        subject = { ...el, x: el.x + dx, y: el.y + dy };
                        updatedElementsMap.set(el.id, subject);
                    }
                    return subject;
                });

                const finalElements = nextElements.map(el => {
                    if ((el.type === 'arrow' || el.type === 'line') && el.points) {
                        let newX = el.x;
                        let newY = el.y;
                        let newPoints = [...el.points];
                        let updatedStart = false;
                        let updatedEnd = false;

                        // Start Binding
                        if (el.startBinding && updatedElementsMap.has(el.startBinding.elementId)) {
                            const target = updatedElementsMap.get(el.startBinding.elementId)!;
                            const anchorPos = getAnchorPosition(target, el.startBinding.anchor);
                            const oldAbsX = newX;
                            const oldAbsY = newY;
                            newX = anchorPos.x;
                            newY = anchorPos.y;
                            updatedStart = true;

                            if (!elementsToMoveIds.has(el.id)) {
                                const shiftX = newX - oldAbsX;
                                const shiftY = newY - oldAbsY;
                                newPoints = newPoints.map((p, i) => i === 0 ? { x: 0, y: 0 } : { x: p.x - shiftX, y: p.y - shiftY });
                            } else {
                                newPoints[0] = { x: 0, y: 0 };
                            }
                        }

                        // End Binding
                        if (el.endBinding && updatedElementsMap.has(el.endBinding.elementId)) {
                            const target = updatedElementsMap.get(el.endBinding.elementId)!;
                            const anchorPos = getAnchorPosition(target, el.endBinding.anchor);
                            newPoints[newPoints.length - 1] = { x: anchorPos.x - newX, y: anchorPos.y - newY };
                            updatedEnd = true;
                        }

                        // Smart Routing (if both bound and at least one moved)
                        if ((updatedStart || updatedEnd) && el.startBinding && el.endBinding) {
                            const startEl = updatedElementsMap.get(el.startBinding.elementId) || allElementsMap.get(el.startBinding.elementId);
                            const endEl = updatedElementsMap.get(el.endBinding.elementId) || allElementsMap.get(el.endBinding.elementId);
                            if (startEl && endEl) {
                                const { start, end } = getSmartAnchors(startEl, endEl);
                                const startP = getAnchorPosition(startEl, start);
                                const endP = getAnchorPosition(endEl, end);
                                newX = startP.x;
                                newY = startP.y;
                                newPoints = generateOrthogonalPoints(startP, endP, start, end, startEl, endEl);
                                return { ...el, x: newX, y: newY, points: newPoints, startBinding: { ...el.startBinding, anchor: start }, endBinding: { ...el.endBinding, anchor: end } };
                            }
                        }

                        if (updatedStart || updatedEnd) {
                            return { ...el, x: newX, y: newY, points: newPoints };
                        }
                    }
                    return el;
                });

                setElements(finalElements);
                setAppState(prev => ({ ...prev, selectionStart: pos }));
            }
            return;
        }

        if (appState.isDragging && tempElement && appState.selectionStart) {
            const currentX = pos.x;
            const currentY = pos.y;
            const startX = appState.selectionStart.x;
            const startY = appState.selectionStart.y;

            let width = currentX - startX;
            let height = currentY - startY;

            if (tempElement.type === 'arrow' || tempElement.type === 'line') {
                const points = tempElement.points ? [...tempElement.points] : [{ x: 0, y: 0 }];
                if (points.length < 2) points.push({ x: 0, y: 0 });

                if (hoveredEl) {
                    const snap = getClosestSnapPoint(pos.x, pos.y, hoveredEl);
                    if (snap) {
                        width = snap.x - tempElement.x;
                        height = snap.y - tempElement.y;
                    }
                }

                points[points.length - 1] = { x: width, y: height };
                setTempElement({ ...tempElement, width, height, points });
            } else if (tempElement.type === 'freedraw') {
                const points = [...(tempElement.points || []), { x: width, y: height }];
                setTempElement({ ...tempElement, width, height, points });
            } else {
                let x = startX;
                let y = startY;

                if (e.shiftKey) {
                    const d = Math.max(Math.abs(width), Math.abs(height));
                    width = width < 0 ? -d : d;
                    height = height < 0 ? -d : d;
                }

                if (width < 0) { x += width; width = Math.abs(width); }
                if (height < 0) { y += height; height = Math.abs(height); }

                setTempElement({ ...tempElement, x, y, width, height });
            }
        }

        // Safety: ensure cursor is crosshair if drawing, pencil if freedraw, etc.
        if (appState.isDragging && tempElement) {
            if (tempElement.type === 'freedraw') document.body.style.cursor = 'crosshair';
            else if (['arrow', 'line'].includes(tempElement.type)) document.body.style.cursor = 'crosshair';
            else document.body.style.cursor = 'crosshair';
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (appState.isDragging) {
            if (appState.resizingState) {
                saveHistory(elements);
            } else if (tempElement) {
                let finalElement = { ...tempElement };
                const dist = finalElement.points && finalElement.points.length > 1
                    ? Math.hypot(finalElement.points[finalElement.points.length - 1].x, finalElement.points[finalElement.points.length - 1].y)
                    : Math.hypot(finalElement.width, finalElement.height);

                // Ignore tiny elements from accidental clicks (especially from connector dots)
                if (dist < 8) {
                    setTempElement(null);
                    setAppState(prev => ({ ...prev, isDragging: false, selectionStart: null, selectionBox: null, resizingState: null }));
                    return;
                }

                // Commit Arrow/Line bindings
                if ((finalElement.type === 'arrow' || finalElement.type === 'line')) {
                    const pos = finalElement.points && finalElement.points.length > 0
                        ? { x: finalElement.x + finalElement.points[finalElement.points.length - 1].x, y: finalElement.y + finalElement.points[finalElement.points.length - 1].y }
                        : { x: finalElement.x, y: finalElement.y };

                    const endHovered = getElementAtPosition(pos.x, pos.y, elements);
                    if (endHovered && endHovered.id !== finalElement.id) {
                        const snap = getClosestSnapPoint(pos.x, pos.y, endHovered);
                        if (snap) {
                            finalElement.endBinding = { elementId: endHovered.id, anchor: snap.anchor };
                            // Snap the point
                            if (finalElement.points) {
                                finalElement.points[finalElement.points.length - 1] = {
                                    x: snap.x - finalElement.x,
                                    y: snap.y - finalElement.y
                                };
                            }
                        }
                    } else if (finalElement.startBinding && !finalElement.endBinding) {
                        // --- Smart Duplicate on Drop ---
                        // If we dragged from a shape but dropped in empty space, duplicate the source shape!
                        const sourceEl = elements.find(el => el.id === finalElement.startBinding!.elementId);
                        if (sourceEl && ['rectangle', 'ellipse', 'diamond', 'frame'].includes(sourceEl.type)) {
                            const cloneId = crypto.randomUUID();

                            // Determine Drop Position (Center of clone at Arrow Tip)
                            const cloneX = pos.x - (sourceEl.width / 2);
                            const cloneY = pos.y - (sourceEl.height / 2);

                            const cloneEl: ExcalidrawElement = {
                                ...sourceEl,
                                id: cloneId,
                                x: cloneX,
                                y: cloneY,
                                // Reset bindings if any on source
                                startBinding: undefined,
                                endBinding: undefined,
                                groupIds: [], // Don't copy groups
                                name: sourceEl.type === 'frame' ? `${sourceEl.name} (Copy)` : undefined
                            };

                            // Update Arrow to bind to new clone
                            const snap = getClosestSnapPoint(pos.x, pos.y, cloneEl);
                            if (snap) {
                                finalElement.endBinding = { elementId: cloneId, anchor: snap.anchor };
                                if (finalElement.points) {
                                    finalElement.points[finalElement.points.length - 1] = {
                                        x: snap.x - finalElement.x,
                                        y: snap.y - finalElement.y
                                    };
                                }
                            }

                            // Add clone to elements
                            setElements(prev => [...prev, cloneEl]);
                        }
                    }
                }

                // Logic to update elements (Frame Genesis or Insert into Frame)
                let nextElements = [...elements, finalElement];

                if (finalElement.type === 'frame') {
                    // Frame Creation: Capture existing elements inside the new frame
                    nextElements = defineFrameGroups(nextElements, finalElement);
                } else {
                    // Other Element Creation: Check if dropped inside an existing frame
                    const enclosingFrame = findEnclosingFrame(finalElement, elements);
                    if (enclosingFrame) {
                        finalElement.frameId = enclosingFrame.id;
                        nextElements = nextElements.map(el => el.id === finalElement.id ? { ...el, frameId: enclosingFrame.id } : el);
                    }
                }

                // Final Set State
                setElements(nextElements);

                // History & Selection
                if (finalElement.width > 2 || finalElement.height > 2 || (finalElement.points && finalElement.points.length > 1) || finalElement.type === 'text' || finalElement.type === 'icon') {
                    saveHistory(nextElements);
                    if (['rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'frame', 'icon'].includes(appState.tool)) {
                        setAppState(prev => ({ ...prev, tool: 'selection', selectedElementIds: [finalElement.id] }));
                    }
                }
            } else if (appState.tool === 'selection' && appState.selectedElementIds.length > 0) {
                // Handle Drop (Drag capture)
                const draggedEls = elements.filter(el => appState.selectedElementIds.includes(el.id));
                const updatedForFrames = handleDragToFrame(elements, draggedEls);

                if (updatedForFrames) {
                    setElements(updatedForFrames);
                    saveHistory(updatedForFrames);
                } else {
                    // Even if no frame update, we finished a drag, so save history of the movement
                    saveHistory(elements);
                }
            }
        }
        setAppState(prev => ({ ...prev, isDragging: false, selectionStart: null, selectionBox: null, resizingState: null }));
        setTempElement(null);
        setHighlightedElementId(null);
        currentLaserRef.current = [];
        document.body.style.cursor = 'default';

        // Final save history for eraser if we dragged
        if (appState.tool === 'eraser' && appState.isDragging) {
            saveHistory(elements);
        }
    };


    // --- Fix: Handle Text Blur (Remove empty text) ---
    const handleTextBlur = () => {
        if (appState.editingElementId) {
            const el = elements.find(e => e.id === appState.editingElementId);
            if (el && el.type === 'text') {
                if (!el.text || el.text.trim() === '') {
                    // Remove empty text element
                    updateElements(elements.filter(e => e.id !== el.id));
                } else {
                    // Save history for non-empty text
                    saveHistory(elements);
                }
            } else if (el && el.type === 'frame') {
                saveHistory(elements);
            }
            setAppState(prev => ({ ...prev, editingElementId: null }));
        }
    };

    return (
        <div
            className="relative w-full h-screen overflow-hidden bg-[#f8f9fa] dark:bg-[#121212] touch-none select-none text-gray-900 dark:text-gray-100 transition-colors duration-200"
            style={{ backgroundColor: appState.viewBackgroundColor }}
            onContextMenu={handleContextMenu}
        >
            {/* --- Main Menu (Top Right) --- */}
            <div className="fixed top-6 right-6 z-50">
                <MainMenu
                    appState={appState}
                    setAppState={setAppState}
                    onClearCanvas={() => {
                        if (window.confirm('Are you sure you want to clear the canvas?')) {
                            setElements([]);
                            clearHistory();
                        }
                    }}
                    theme={theme}
                    onThemeChange={handleToggleTheme}
                    onOpenHelp={() => setIsHelpOpen(true)}
                    onExport={handleExport}
                />
            </div>

            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                className="absolute inset-0 z-0 touch-none block"
            />

            {appState.editingElementId && (() => {
                const el = elements.find(e => e.id === appState.editingElementId);
                if (el) {
                    const isFrame = el.type === 'frame';
                    const textValue = isFrame ? (el.name || "Frame") : (el.text || "");

                    // Fix: Tighter line height for text editing to match rendering
                    const style: React.CSSProperties = isFrame ? {
                        left: (el.x * appState.zoom) + appState.pan.x,
                        top: ((el.y - 24) * appState.zoom) + appState.pan.y,
                        fontSize: 14 * appState.zoom,
                        fontFamily: 'sans-serif',
                        color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
                        minWidth: 50 * appState.zoom,
                    } : {
                        left: (el.x * appState.zoom) + appState.pan.x,
                        top: (el.y * appState.zoom) + appState.pan.y,
                        fontSize: (el.fontSize || 20) * appState.zoom,
                        fontFamily: getFontFamilyString(el.fontFamily),
                        fontWeight: el.fontWeight,
                        fontStyle: el.fontStyle,
                        color: el.strokeColor,
                        // Ensure min width/height for usability
                        minWidth: 20 * appState.zoom,
                        minHeight: (el.fontSize || 20) * 1.25 * appState.zoom,
                        width: Math.max((el.width || 10) * appState.zoom, 50 * appState.zoom),
                        height: Math.max((el.height || 20) * appState.zoom, (el.fontSize || 20) * 1.25 * appState.zoom),
                        transformOrigin: 'top left',
                        lineHeight: '1.25',
                        padding: 0,
                        margin: 0
                    };

                    return (
                        <textarea
                            ref={textAreaRef}
                            className="fixed z-10 bg-transparent outline-none resize-none overflow-hidden border-none whitespace-pre"
                            style={style}
                            value={textValue}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (isFrame) {
                                    updateElements(elements.map(item => item.id === el.id ? { ...item, name: val } : item));
                                } else {
                                    // Fix: Trim trailing newline for measurement to prevent ghost lines?
                                    // Actually, just measure EXACTLY what we have.
                                    // Renderer uses 1.25 line height.
                                    const metrics = measureText(val, el.fontSize || 20, el.fontFamily || 1, el.fontWeight, el.fontStyle);
                                    updateElements(elements.map(item => item.id === el.id ? { ...item, text: val, width: metrics.width, height: metrics.height } : item));
                                }
                            }}
                            onBlur={handleTextBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                }
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                }
                            }}
                            autoFocus
                            spellCheck={false}
                        />
                    );
                }
                return null;
            })()}

            <Toolbar
                activeTool={appState.tool}
                onSelectTool={(tool) => setAppState(prev => ({ ...prev, tool, selectedElementIds: [] }))}
                onOpenLibrary={() => setIsLibraryOpen(true)}
            />

            <PropertiesPanel
                appState={appState}
                setAppState={setAppState}
                elements={elements}
                onUpdateElement={updateSelectedElements}
                undo={undo}
                redo={redo}
                clearCanvas={() => {
                    setElements([]);
                    clearHistory();
                }}
                openGemini={() => setIsGeminiOpen(true)}
                onLayerChange={handleLayerChange}
                onGroup={handleGroup}
                onUngroup={handleUngroup}
                onAlign={handleAlign}
                onToggleLock={handleToggleLock}
            />

            {/* --- Zoom Indicator (Bottom Left) --- */}
            <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-lg shadow-sm text-xs font-medium text-gray-600 dark:text-gray-300">
                    <button
                        className="hover:text-violet-500 font-bold"
                        onClick={() => setAppState(s => ({ ...s, zoom: Math.max(0.1, s.zoom - 0.1) }))}
                    >-</button>
                    <span className="w-8 text-center">{Math.round(appState.zoom * 100)}%</span>
                    <button
                        className="hover:text-violet-500 font-bold"
                        onClick={() => setAppState(s => ({ ...s, zoom: Math.min(5, s.zoom + 0.1) }))}
                    >+</button>
                </div>
            </div>

            {/* Existing Dialogs/Modals */}
            <IconLibrary
                isOpen={isLibraryOpen}
                onClose={() => setIsLibraryOpen(false)}
                onSelectIcon={handleAddIcon}
            />

            <QuickActions
                isOpen={isQuickActionsOpen}
                onClose={() => setIsQuickActionsOpen(false)}
                onSelectTool={(tool) => setAppState(prev => ({ ...prev, tool }))}
                onAction={handleQuickAction}
                currentTheme={theme}
            />

            <HelpDialog
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
            />
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                elements={elements}
                selectedElementIds={appState.selectedElementIds}
                viewBackgroundColor={appState.viewBackgroundColor}
                theme={theme}
            />

            <ContextMenu
                position={contextMenu}
                onClose={() => setContextMenu(null)}
                onAction={handleContextAction}
                hasSelection={appState.selectedElementIds.length > 0}
                hasMultipleSelection={appState.selectedElementIds.length > 1}
                hasClipboard={!!clipboard}
                isGrouped={elements.some(el => appState.selectedElementIds.includes(el.id) && el.groupIds && el.groupIds.length > 0)}
                isLocked={!!(elements.find(el => appState.selectedElementIds.includes(el.id))?.isLocked)}
            />

            <GeminiModal
                isOpen={isGeminiOpen}
                onClose={() => setIsGeminiOpen(false)}
                onElementsGenerated={(newEls) => {
                    if (newEls.length > 0) {
                        const xs = newEls.map(e => e.x);
                        const ys = newEls.map(e => e.y);
                        const minX = Math.min(...xs);
                        const minY = Math.min(...ys);
                        const maxX = Math.max(...xs);
                        const maxY = Math.max(...ys);

                        const width = maxX - minX;
                        const height = maxY - minY;

                        const viewportCenterX = (window.innerWidth / appState.zoom / 2) - (appState.pan.x / appState.zoom);
                        const viewportCenterY = (window.innerHeight / appState.zoom / 2) - (appState.pan.y / appState.zoom);

                        const offsetX = viewportCenterX - (minX + width / 2);
                        const offsetY = viewportCenterY - (minY + height / 2);

                        const adjustedEls = newEls.map(el => ({
                            ...el,
                            x: el.x + offsetX,
                            y: el.y + offsetY
                        }));
                        updateElements([...elements, ...adjustedEls], true);
                    }
                }}
            />
        </div>
    );
};

export default EditorPage;
