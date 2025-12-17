
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useHistory } from '../hooks/useHistory';
import Toolbar from '../components/Toolbar';
import PropertiesPanel from '../components/PropertiesPanel';
import GeminiModal from '../components/GeminiModal';
import ContextMenu from '../components/ContextMenu';
import IconLibrary from '../components/IconLibrary';
import QuickActions from '../components/QuickActions';
import HelpDialog from '../components/HelpDialog';
import { AppState, ExcalidrawElement, Point, ToolType, TOOLS, Binding } from '../types';
import { renderScene, getFontFamilyString, getFontString, measureText } from '../utils/renderer';
import { getElementAtPosition, getClosestSnapPoint, getAnchorPosition, getSnapPoints, getElementsWithinRect, getResizeHandleAtPosition, getCursorForHandle, resizeElement, generateOrthogonalPoints, getSmartAnchors } from '../utils/geometry';
import { findEnclosingFrame } from '../utils/frameUtils';
import { ARCHITECTURE_ICONS } from '../utils/icons';
import { useFrame } from '../hooks/useFrame';
import { Sun, Moon, HelpCircle } from 'lucide-react';

const EditorPage = () => {
    // --- State ---
    const [elements, setElements] = useState<ExcalidrawElement[]>([]);
    const [appState, setAppState] = useState<AppState>({
        tool: "selection",
        strokeColor: "#000000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        strokeStyle: "solid", // Initialized
        opacity: 100,
        pan: { x: 0, y: 0 },
        zoom: 1,
        isDragging: false,
        selectionStart: null,
        selectionBox: null,
        selectedElementIds: [],
        editingElementId: null,
        resizingState: null,
    });

    const [clipboard, setClipboard] = useState<ExcalidrawElement[] | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [highlightedElementId, setHighlightedElementId] = useState<string | null>(null);
    const [laserTrails, setLaserTrails] = useState<{ x: number, y: number, time: number }[][]>([]);
    const currentLaserRef = useRef<{ x: number, y: number, time: number }[]>([]);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
        }
        return 'light';
    });

    // History Hook
    const { saveHistory, undo: undoHistory, redo: redoHistory, clearHistory, canUndo, canRedo } = useHistory([]);

    // Frame Hook
    const { defineFrameGroups, handleDragToFrame } = useFrame();


    const [isGeminiOpen, setIsGeminiOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

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
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
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
        let animationFrameId: number;
        const loop = () => {
            if (laserTrails.length > 0) {
                const now = Date.now();
                const activeTrails = laserTrails.map(trail => {
                    if (trail === currentLaserRef.current && appState.isDragging && appState.tool === 'laser') {
                        return trail;
                    }
                    return trail.filter(p => now - p.time < 1000);
                }).filter(trail => trail.length > 0);
                setLaserTrails(activeTrails);
            }
            animationFrameId = requestAnimationFrame(loop);
        };
        if (laserTrails.length > 0) loop();
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
            groupIds: el.groupIds ? [...el.groupIds] : undefined
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
            y: el.y + offset
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
            opacity: 100,
            iconPath: iconDef.path
        };

        updateElements([...elements, newIcon], true);
        setAppState(prev => ({ ...prev, selectedElementIds: [id], tool: 'selection' }));
        setIsLibraryOpen(false);
    };

    const handleQuickAction = (action: string) => {
        switch (action) {
            case 'library': setIsLibraryOpen(true); break;
            case 'ai': setIsGeminiOpen(true); break;
            case 'theme': setTheme(t => t === 'light' ? 'dark' : 'light'); break;
            case 'clear':
                if (window.confirm('Clear canvas?')) {
                    setElements([]);
                    clearHistory();
                }
                break;
        }
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
        renderScene(ctx, elementsToRender, appState.pan, appState.zoom, appState.selectedElementIds, highlightedElementId, appState.selectionBox, laserTrails, appState.editingElementId, shouldShowSnapPoints);
    }, [elements, tempElement, appState.pan, appState.zoom, appState.selectedElementIds, theme, highlightedElementId, appState.selectionBox, laserTrails, appState.editingElementId, shouldShowSnapPoints]);

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
                    renderScene(ctx, elementsToRender, appState.pan, appState.zoom, appState.selectedElementIds, highlightedElementId, appState.selectionBox, laserTrails, appState.editingElementId, shouldShowSnapPoints);
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
                    case 'c': e.preventDefault(); copySelection(); return;
                    case 'x': e.preventDefault(); cutSelection(); return;
                    case 'v': e.preventDefault(); pasteFromClipboard(); return;
                    case 'd': e.preventDefault(); duplicateSelection(); return;
                    case 'a': e.preventDefault(); setAppState(prev => ({ ...prev, selectedElementIds: elements.map(el => el.id) })); return;
                    case 'g': e.preventDefault(); if (e.shiftKey) handleUngroup(); else handleGroup(); return;
                    case 'l': e.preventDefault(); if (isShift) handleToggleLock(); return;
                }
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
            const element = elements.find(el => el.id === appState.selectedElementIds[0]);
            if (element) {
                // Check if locked
                if (element.isLocked) {
                    // If locked, skip resizing
                } else {
                    let handle = getResizeHandleAtPosition(pos.x, pos.y, element, appState.zoom);

                    // Handle Midpoint Creation
                    if (typeof handle === 'string' && handle.startsWith('m:')) {
                        const idx = parseInt(handle.split(':')[1]);
                        if (!isNaN(idx) && element.points) {
                            const p1 = element.points[idx];
                            const p2 = element.points[idx + 1];
                            const midX = (p1.x + p2.x) / 2;
                            const midY = (p1.y + p2.y) / 2;

                            const newPoints = [...element.points];
                            newPoints.splice(idx + 1, 0, { x: midX, y: midY });

                            const newElement = { ...element, points: newPoints };
                            updateElements(elements.map(el => el.id === element.id ? newElement : el));
                            handle = `p:${idx + 1}`;

                            setAppState(prev => ({
                                ...prev,
                                isDragging: true,
                                resizingState: {
                                    elementId: element.id,
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
                                elementId: element.id,
                                handle,
                                startMousePos: pos,
                                originalElement: { ...element, points: element.points ? [...element.points] : undefined }
                            }
                        }));
                        return;
                    }
                }
            }
        }

        if (appState.tool === 'laser') {
            const startPoint = { x: pos.x, y: pos.y, time: Date.now() };
            currentLaserRef.current = [startPoint];
            setLaserTrails(prev => [...prev, currentLaserRef.current]);
            setAppState(prev => ({ ...prev, isDragging: true }));
            return;
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
            if (element && !element.isLocked) updateElements(elements.filter(el => el.id !== element.id), true);
            return;
        }

        if (appState.tool === 'text') {
            e.preventDefault();
            const id = crypto.randomUUID();
            const newEl: ExcalidrawElement = {
                id, type: 'text', x: pos.x, y: pos.y, width: 20, height: 24, strokeColor: appState.strokeColor, backgroundColor: appState.backgroundColor, strokeWidth: 1, opacity: appState.opacity, text: "", fontSize: 20, fontFamily: 1, fontWeight: 400, fontStyle: 'normal', strokeStyle: "solid"
            };
            setElements([...elements, newEl]);
            setAppState(prev => ({ ...prev, tool: 'selection', editingElementId: id, selectedElementIds: [id] }));
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
            backgroundColor: appState.backgroundColor,
            strokeWidth: appState.strokeWidth,
            strokeStyle: appState.strokeStyle, // Set stroke style
            opacity: appState.opacity,
            points: initialPoints,
            startBinding,
            name
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
                strokeStyle: "solid"
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
        const pos = getPointerPos(e);
        const hoveredEl = getElementAtPosition(pos.x, pos.y, elements);

        // --- Cursor Updates & Highlight Logic ---
        if (!appState.isDragging) {
            if (appState.tool === 'selection') {
                setHighlightedElementId(hoveredEl ? hoveredEl.id : null);

                if (appState.selectedElementIds.length === 1) {
                    const selectedEl = elements.find(el => el.id === appState.selectedElementIds[0]);
                    if (selectedEl && !selectedEl.isLocked) {
                        const handle = getResizeHandleAtPosition(pos.x, pos.y, selectedEl, appState.zoom);
                        if (handle) {
                            document.body.style.cursor = getCursorForHandle(handle);
                            return;
                        }
                    }
                }
                document.body.style.cursor = hoveredEl ? 'move' : 'default';
            } else if (appState.tool === 'arrow' || appState.tool === 'line') {
                setHighlightedElementId(hoveredEl ? hoveredEl.id : null);
                document.body.style.cursor = 'crosshair';
            } else {
                setHighlightedElementId(null);
                document.body.style.cursor = 'default';
            }
        } else {
            // Dragging logic for highlighting (snap targets)
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

            // Snapping for linear resize
            if ((originalElement.type === 'arrow' || originalElement.type === 'line') && (handle === 'start' || handle === 'end')) {
                if (hoveredEl) {
                    const snap = getClosestSnapPoint(pos.x, pos.y, hoveredEl);
                    if (snap) {
                        newPos = { x: snap.x, y: snap.y };
                        binding = { elementId: hoveredEl.id, anchor: snap.anchor };
                    }
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

            if (appState.selectedElementIds.length > 0) {
                const updatedMap = new Map<string, ExcalidrawElement>();

                const selectedFrameIds = elements
                    .filter(e => appState.selectedElementIds.includes(e.id) && e.type === 'frame')
                    .map(e => e.id);

                const elementsToMove = elements.filter(el => {
                    if (el.isLocked) return false;
                    const isSelected = appState.selectedElementIds.includes(el.id);
                    const isChildOfSelectedFrame = el.frameId && selectedFrameIds.includes(el.frameId);
                    return isSelected || isChildOfSelectedFrame;
                });

                const elementsToMoveIds = new Set(elementsToMove.map(e => e.id));

                const movedElements = elements.map(el => {
                    if (elementsToMoveIds.has(el.id)) {
                        const newEl = { ...el, x: el.x + dx, y: el.y + dy };
                        updatedMap.set(el.id, newEl);
                        return newEl;
                    }
                    return el;
                });

                const finalElements = movedElements.map(el => {
                    // Only update arrow/line if they have points
                    if ((el.type === 'arrow' || el.type === 'line') && el.points) {
                        let newX = el.x;
                        let newY = el.y;
                        let newPoints = [...el.points];

                        let startAnchorPos: Point | null = null;
                        let endAnchorPos: Point | null = null;
                        let updatedStart = false;
                        let updatedEnd = false;

                        // Start Binding
                        if (el.startBinding && updatedMap.has(el.startBinding.elementId)) {
                            const target = updatedMap.get(el.startBinding.elementId)!;
                            const anchor = getAnchorPosition(target, el.startBinding.anchor);
                            startAnchorPos = anchor;

                            const oldAbsX = newX;
                            const oldAbsY = newY;

                            newX = anchor.x;
                            newY = anchor.y;
                            updatedStart = true;

                            if (!elementsToMoveIds.has(el.id)) {
                                // If arrow didn't move globally, shift points to keep end in place relative to canvas
                                const shiftX = newX - oldAbsX;
                                const shiftY = newY - oldAbsY;
                                newPoints = newPoints.map((p, i) => {
                                    if (i === 0) return { x: 0, y: 0 };
                                    return { x: p.x - shiftX, y: p.y - shiftY };
                                });
                            } else {
                                // If arrow moved too, just ensure origin is correct
                                newPoints[0] = { x: 0, y: 0 };
                            }
                        } else {
                            // If start not bound, calculate its current absolute pos for potential orthogonal calc
                            startAnchorPos = { x: el.x, y: el.y };
                        }

                        // End Binding
                        if (el.endBinding && updatedMap.has(el.endBinding.elementId)) {
                            const target = updatedMap.get(el.endBinding.elementId)!;
                            const anchor = getAnchorPosition(target, el.endBinding.anchor);
                            endAnchorPos = anchor;

                            // End Point is relative to newX, newY
                            const relX = anchor.x - newX;
                            const relY = anchor.y - newY;

                            newPoints[newPoints.length - 1] = { x: relX, y: relY };
                            updatedEnd = true;
                        } else {
                            // End not bound, calculate current abs end
                            const lastP = el.points[el.points.length - 1];
                            endAnchorPos = { x: el.x + lastP.x, y: el.y + lastP.y };
                        }

                        // Smart Routing with Dynamic Anchors
                        if ((updatedStart || updatedEnd) && el.startBinding && el.endBinding && startAnchorPos && endAnchorPos) {
                            const startEl = updatedMap.get(el.startBinding.elementId) || elements.find(e => e.id === el.startBinding!.elementId);
                            const endEl = updatedMap.get(el.endBinding.elementId) || elements.find(e => e.id === el.endBinding!.elementId);

                            if (startEl && endEl) {
                                const { start, end } = getSmartAnchors(startEl, endEl);
                                el.startBinding = { ...el.startBinding, anchor: start };
                                el.endBinding = { ...el.endBinding, anchor: end };
                                startAnchorPos = getAnchorPosition(startEl, start);
                                endAnchorPos = getAnchorPosition(endEl, end);
                                newX = startAnchorPos.x;
                                newY = startAnchorPos.y;
                                newPoints = generateOrthogonalPoints(startAnchorPos, endAnchorPos, start, end, startEl, endEl);
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
                // For linear elements, we just set the end point
                const points = tempElement.points ? [...tempElement.points] : [{ x: 0, y: 0 }];
                if (points.length < 2) points.push({ x: 0, y: 0 });

                // Smart snap for endpoint
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
                // Shapes
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
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (appState.isDragging) {
            if (appState.resizingState) {
                saveHistory(elements);
            } else if (tempElement) {
                let finalElement = { ...tempElement };

                // Commit Arrow/Line bindings
                if ((finalElement.type === 'arrow' || finalElement.type === 'line')) {
                    const pos = getPointerPos(e);
                    const hoveredEl = getElementAtPosition(pos.x, pos.y, elements);
                    if (hoveredEl) {
                        const snap = getClosestSnapPoint(pos.x, pos.y, hoveredEl);
                        if (snap) {
                            finalElement.endBinding = { elementId: hoveredEl.id, anchor: snap.anchor };
                        }
                    }
                }

                // Logic to update elements (Frame Genesis or Insert into Frame)
                let nextElements = [...elements, finalElement];

                if (finalElement.type === 'frame') {
                    // Frame Creation: Capture existing elements inside the new frame
                    // Pass the FULL list including the new frame to defineFrameGroups
                    nextElements = defineFrameGroups(nextElements, finalElement);
                } else {
                    // Other Element Creation: Check if dropped inside an existing frame
                    const enclosingFrame = findEnclosingFrame(finalElement, elements);
                    if (enclosingFrame) {
                        finalElement.frameId = enclosingFrame.id;
                        // Re-create nextElements with potentially modified frameId in finalElement
                        // Note: finalElement matches the last item in nextElements by ref if we didn't clone above, 
                        // but we did spreads.
                        // Actually 'finalElement' is local. 'nextElements' has a COPY of 'finalElement' or reference?
                        // `[...elements, finalElement]` -> finalElement IS the reference.
                        // So updating finalElement.frameId works if we do it before spreading?
                        // Or we can map.
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
    };

    return (
        <div
            className="relative w-full h-screen overflow-hidden bg-[#f8f9fa] dark:bg-[#121212] touch-none select-none text-gray-900 dark:text-gray-100 transition-colors duration-200"
            onContextMenu={handleContextMenu}
        >
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

                    // Style for Frame name editing (above the frame) vs Text element editing
                    const style: React.CSSProperties = isFrame ? {
                        left: (el.x * appState.zoom) + appState.pan.x,
                        top: ((el.y - 24) * appState.zoom) + appState.pan.y, // Position above frame
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
                        width: Math.max((el.width || 10) * appState.zoom, 50 * appState.zoom),
                        height: Math.max((el.height || 20) * appState.zoom, 30 * appState.zoom),
                        lineHeight: 1.2,
                        transformOrigin: 'top left'
                    };

                    return (
                        <textarea
                            ref={textAreaRef}
                            className="fixed z-10 bg-transparent outline-none resize-none overflow-hidden p-0 m-0 border-none whitespace-pre"
                            style={style}
                            value={textValue}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (isFrame) {
                                    updateElements(elements.map(item => item.id === el.id ? { ...item, name: val } : item));
                                } else {
                                    const metrics = measureText(val, el.fontSize || 20, el.fontFamily || 1, el.fontWeight, el.fontStyle);
                                    updateElements(elements.map(item => item.id === el.id ? { ...item, text: val, width: metrics.width, height: metrics.height } : item));
                                }
                            }}
                            onBlur={() => setAppState(prev => ({ ...prev, editingElementId: null }))}
                            autoFocus
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
                    if (window.confirm('Are you sure you want to clear the canvas?')) {
                        setElements([]);
                        clearHistory();
                    }
                }}
                openGemini={() => setIsGeminiOpen(true)}
                onLayerChange={handleLayerChange}
                onGroup={handleGroup}
                onUngroup={handleUngroup}
                onAlign={handleAlign}
                onToggleLock={handleToggleLock}
            />

            <div className="fixed top-6 right-6 z-50 flex gap-2">
                <button
                    onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                    className="p-2.5 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-white/20 transition-all shadow-sm"
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
            </div>

            <button
                onClick={() => setIsHelpOpen(true)}
                className="fixed bottom-6 right-6 z-50 p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
                title="Help & Shortcuts (?)"
            >
                <HelpCircle size={24} />
            </button>

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
