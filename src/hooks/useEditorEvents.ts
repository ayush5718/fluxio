import React from 'react';
import { useRef, useCallback } from 'react';
import { AppState, ExcalidrawElement, Point, Binding } from '../types';
import {
    getElementAtPosition,
    getPointerPos,
    getResizeHandleAtPosition,
    getConnectorHandleAtPosition,
    getAnchorPosition,
    getCursorForHandle,
    hitTest,
    getElementsWithinRect,
    resizeElement,
    getClosestSnapPoint,
    getIntersectingPoint,
    getSmartAnchors,
    generateOrthogonalPoints,
    isPointInElementBounds
} from '../utils/geometry';

const CURSOR_THEME_COLOR = '%236965db';

const MOVE_CURSOR = `url("data:image/svg+xml;utf8,<svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'><circle cx='16' cy='16' r='10' fill='white' stroke='${CURSOR_THEME_COLOR}' stroke-width='1'/><path d='M16 10V22M16 10L14 12M16 10L18 12M16 22L14 20M16 22L18 20M10 16H22M10 16L12 14M10 16L12 18M22 16L20 14M22 16L20 18' stroke='${CURSOR_THEME_COLOR}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>") 16 16, move`;

const GRABBING_CURSOR = `url("data:image/svg+xml;utf8,<svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'><circle cx='16' cy='16' r='10' fill='${CURSOR_THEME_COLOR}' stroke='white' stroke-width='1'/><path d='M16 10V22M16 10L14 12M16 10L18 12M16 22L14 20M16 22L18 20M10 16H22M10 16L12 14M10 16L12 18M22 16L20 14M22 16L20 18' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>") 16 16, move`;

interface UseEditorEventsProps {
    elements: ExcalidrawElement[];
    setElements: React.Dispatch<React.SetStateAction<ExcalidrawElement[]>>;
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    tempElement: ExcalidrawElement | null;
    setTempElement: React.Dispatch<React.SetStateAction<ExcalidrawElement | null>>;
    setCursorPos: React.Dispatch<React.SetStateAction<Point | null>>;
    setHighlightedElementId: React.Dispatch<React.SetStateAction<string | null>>;
    setEraserTrail: React.Dispatch<React.SetStateAction<Point[]>>;
    setLaserTrails: React.Dispatch<React.SetStateAction<{ x: number, y: number, time: number }[][]>>;
    currentLaserRef: React.MutableRefObject<{ x: number, y: number, time: number }[]>;
    saveHistory: (elements: ExcalidrawElement[]) => void;
    defineFrameGroups: (elements: ExcalidrawElement[], frame: ExcalidrawElement) => ExcalidrawElement[];
    handleDragToFrame: (elements: ExcalidrawElement[], movedElements: ExcalidrawElement[]) => ExcalidrawElement[] | null;
}

export const useEditorEvents = (props: UseEditorEventsProps) => {
    const {
        elements, setElements,
        appState, setAppState,
        tempElement, setTempElement,
        setCursorPos, setHighlightedElementId,
        setEraserTrail, setLaserTrails, currentLaserRef,
        saveHistory, defineFrameGroups, handleDragToFrame
    } = props;

    const getPointerPosLocal = useCallback((e: React.PointerEvent | React.MouseEvent) => {
        return {
            x: (e.clientX - appState.pan.x) / appState.zoom,
            y: (e.clientY - appState.pan.y) / appState.zoom,
            pressure: (e as React.PointerEvent).pressure !== undefined ? (e as React.PointerEvent).pressure : 0.5
        };
    }, [appState.pan, appState.zoom]);

    const handleMouseDown = useCallback((e: React.PointerEvent) => {
        // Don't interfere with textarea clicks - let textarea handle its own events
        if (appState.editingElementId && (e.target as HTMLElement).tagName === 'TEXTAREA') {
            return;
        }

        if (appState.editingElementId) {
            const el = elements.find(e => e.id === appState.editingElementId);
            if (el && el.type === 'text' && (!el.text || el.text.trim() === '')) {
                setElements(prev => prev.filter(e => e.id !== el.id));
            }
            setAppState(prev => ({ ...prev, editingElementId: null }));
            return;
        }
        if (e.button === 1 || (appState.tool === 'selection' && e.buttons === 4)) return;

        const pos = getPointerPosLocal(e);

        if (e.button === 2) {
            const element = getElementAtPosition(pos.x, pos.y, elements);
            if (element && !appState.selectedElementIds.includes(element.id)) {
                setAppState(prev => ({ ...prev, selectedElementIds: [element.id] }));
            }
            return;
        }

        // Resizing handles check
        if (appState.tool === 'selection' && appState.selectedElementIds.length === 1) {
            const selectedId = appState.selectedElementIds[0];
            const selectedEl = elements.find(el => el.id === selectedId);
            if (selectedEl && !selectedEl.isLocked) {
                let handle = getResizeHandleAtPosition(pos.x, pos.y, selectedEl, appState.zoom);

                // Midpoint addition logic removed for brevity or can be kept
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
                        points: [{ x: 0, y: 0, pressure: pos.pressure }, { x: 1, y: 1, pressure: pos.pressure }],
                        startBinding: { elementId: selectedId, anchor },
                        seed: Math.floor(Math.random() * 2 ** 31),
                        roughness: appState.roughness,
                        simulatePressure: true
                    };
                    setTempElement(newArrow);
                    return;
                }
            }
        }

        if (appState.tool === 'eraser') {
            setEraserTrail([pos]);
            setAppState(prev => ({ ...prev, isDragging: true, selectionStart: pos }));
            return;
        }

        if (appState.tool === 'laser') {
            // Initialize new laser trail
            currentLaserRef.current = [{ x: pos.x, y: pos.y, time: Date.now() }];
            setLaserTrails(prev => [...prev, currentLaserRef.current]);
            setAppState(prev => ({ ...prev, isDragging: true, selectionStart: pos }));
            return;
        }

        if (appState.tool === 'selection') {
            // Greedy hit-test for already selected elements
            const selectedIds = new Set(appState.selectedElementIds);
            const selectedElements = elements.filter(el => selectedIds.has(el.id));
            const greedyHit = selectedElements.find(el => isPointInElementBounds(pos.x, pos.y, el));

            const element = greedyHit || getElementAtPosition(pos.x, pos.y, elements);
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
                // Clicking empty space - start selection box
                if (!e.shiftKey) {
                    setAppState(prev => ({ ...prev, selectedElementIds: [], selectionBox: { x: pos.x, y: pos.y, width: 0, height: 0 }, selectionStart: pos, isDragging: true }));
                } else {
                    setAppState(prev => ({ ...prev, selectionBox: { x: pos.x, y: pos.y, width: 0, height: 0 }, selectionStart: pos, isDragging: true }));
                }
            }
            return;
        }

        if (appState.tool === 'text') {
            const id = crypto.randomUUID();
            const newEl: ExcalidrawElement = {
                id, type: 'text', x: pos.x, y: pos.y, width: 20, height: 24, strokeColor: appState.strokeColor, backgroundColor: appState.backgroundColor, strokeWidth: 1, opacity: appState.opacity, text: "", fontSize: 20, fontFamily: 1, fontWeight: 400, fontStyle: 'normal', strokeStyle: "solid", seed: Math.floor(Math.random() * 2 ** 31), fillStyle: appState.fillStyle, roughness: appState.roughness
            };
            setElements(prev => [...prev, newEl]);
            setAppState(prev => ({ ...prev, tool: 'selection', editingElementId: id, selectedElementIds: [id], isDragging: false }));
            return;
        }

        setAppState(prev => ({ ...prev, isDragging: true, selectionStart: pos }));
        const id = crypto.randomUUID();
        let initialPoints = (appState.tool === 'arrow' || appState.tool === 'line' || appState.tool === 'freedraw') ? [{ x: 0, y: 0, pressure: pos.pressure }] : undefined;

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
                    initialPoints = [{ x: 0, y: 0, pressure: pos.pressure }];
                }
            }
        }

        let name: string | undefined = undefined;
        if (appState.tool === 'frame') {
            const frameCount = elements.filter(e => e.type === 'frame').length + 1;
            name = `Frame ${frameCount}`;
        }

        const newElement: ExcalidrawElement = {
            id, type: appState.tool as any, x: startX, y: startY, width: 0, height: 0,
            strokeColor: appState.strokeColor, backgroundColor: appState.tool === 'frame' ? 'transparent' : appState.backgroundColor,
            strokeWidth: appState.strokeWidth, strokeStyle: appState.tool === 'frame' ? 'solid' : appState.strokeStyle,
            fillStyle: appState.tool === 'frame' ? 'solid' : appState.fillStyle, opacity: appState.opacity,
            points: initialPoints, startBinding, name, seed: Math.floor(Math.random() * 2 ** 31),
            roundness: appState.tool === 'rectangle' ? 12 : 0,
            simulatePressure: true
        };
        setTempElement(newElement);
    }, [appState, elements, getPointerPosLocal, setAppState, setElements, setTempElement, setEraserTrail]);

    const handleMouseMove = useCallback((e: React.PointerEvent) => {
        let pos = getPointerPosLocal(e);
        setCursorPos(pos);

        if (appState.snapToGrid) {
            pos = {
                x: Math.round(pos.x / 20) * 20,
                y: Math.round(pos.y / 20) * 20
            };
        }

        const hoveredEl = getElementAtPosition(pos.x, pos.y, elements);

        if (!appState.isDragging) {
            if (appState.tool === 'selection') {
                setHighlightedElementId(hoveredEl ? hoveredEl.id : null);
                if (appState.selectedElementIds.length === 1) {
                    const selectedEl = elements.find(el => el.id === appState.selectedElementIds[0]);
                    const handle = getResizeHandleAtPosition(pos.x, pos.y, selectedEl, appState.zoom);
                    if (handle) {
                        document.body.style.cursor = getCursorForHandle(handle);
                        return;
                    }
                }
                const connectorHandle = appState.selectedElementIds.length === 1 ? getConnectorHandleAtPosition(pos.x, pos.y, elements.find(el => el.id === appState.selectedElementIds[0])!, appState.zoom) : null;
                if (connectorHandle) {
                    document.body.style.cursor = 'crosshair';
                    return;
                }
                // Show grab cursor when hovering over an element OR within the bounds of a selected element
                const selectedIds = new Set(appState.selectedElementIds);
                const isOverSelectedBounds = elements.some(el => selectedIds.has(el.id) && isPointInElementBounds(pos.x, pos.y, el));

                if ((hoveredEl && !hoveredEl.isLocked) || isOverSelectedBounds) {
                    document.body.style.cursor = MOVE_CURSOR;
                } else {
                    document.body.style.cursor = 'default';
                }
            } else {
                setHighlightedElementId(null);
                document.body.style.cursor = appState.tool === 'text' ? 'text' : 'crosshair';
            }
        } else {
            // Dragging
            if (appState.tool === 'eraser' && e.buttons === 1) {
                // Optimize eraser trail - only keep last 20 points for performance
                setEraserTrail(prev => {
                    const newTrail = [...prev, pos];
                    return newTrail.slice(-20); // Keep only last 20 points
                });

                // Throttle element deletion checks for better performance
                const element = getElementAtPosition(pos.x, pos.y, elements);
                if (element && !element.isLocked && !appState.pendingDeletionIds.includes(element.id)) {
                    setAppState(prev => ({
                        ...prev,
                        pendingDeletionIds: [...prev.pendingDeletionIds, element.id]
                    }));
                }
                return;
            }

            if (appState.resizingState) {
                const { originalElement, handle } = appState.resizingState;
                let newPos = pos;
                let binding: Binding | undefined = undefined;

                if ((originalElement.type === 'arrow' || originalElement.type === 'line') && (handle === 'start' || handle === 'end')) {
                    if (hoveredEl) {
                        const fixedIdx = handle === 'start' ? originalElement.points!.length - 1 : 0;
                        const fixedPointRel = originalElement.points![fixedIdx];
                        const fixedPointAbs = { x: originalElement.x + fixedPointRel.x, y: originalElement.y + fixedPointRel.y };
                        newPos = getIntersectingPoint(hoveredEl, fixedPointAbs);
                        binding = { elementId: hoveredEl.id, anchor: 'center' };
                    }
                }

                /*
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
                */
                return;
            }

            if (appState.tool === 'laser' && e.buttons === 1) {
                const newPoint = { x: pos.x, y: pos.y, time: Date.now() };
                currentLaserRef.current.push(newPoint);
                // Update laser trails state for rendering
                setLaserTrails(prev => {
                    // If current trail exists in state, update it, otherwise add new trail
                    const hasCurrentTrail = prev.some(trail => trail === currentLaserRef.current);
                    if (hasCurrentTrail) {
                        return prev.map(trail => trail === currentLaserRef.current ? currentLaserRef.current : trail);
                    } else {
                        return [...prev, currentLaserRef.current];
                    }
                });
                return;
            }

            if (e.buttons === 4 || (appState.tool === 'selection' && e.buttons === 2)) {
                setAppState(prev => ({ ...prev, pan: { x: prev.pan.x + e.movementX, y: prev.pan.y + e.movementY } }));
                return;
            }

            // Selection box (marquee selection) - prioritize this over element dragging
            if (appState.selectionBox && appState.selectionStart && appState.tool === 'selection') {
                const x = Math.min(pos.x, appState.selectionStart.x);
                const y = Math.min(pos.y, appState.selectionStart.y);
                const width = Math.abs(pos.x - appState.selectionStart.x);
                const height = Math.abs(pos.y - appState.selectionStart.y);
                const newBox = { x, y, width, height };
                setAppState(prev => ({ ...prev, selectionBox: newBox }));
                const elementsInBox = getElementsWithinRect(newBox.x, newBox.y, newBox.width, newBox.height, elements);
                setAppState(prev => ({
                    ...prev,
                    selectedElementIds: e.shiftKey
                        ? Array.from(new Set([...prev.selectedElementIds, ...elementsInBox.map(el => el.id)]))
                        : elementsInBox.map(el => el.id)
                }));
                return;
            }

            // Element dragging - only if no selection box is active
            if (appState.selectionStart && appState.tool === 'selection' && appState.selectedElementIds.length > 0 && !appState.selectionBox) {
                const dx = pos.x - appState.selectionStart.x;
                const dy = pos.y - appState.selectionStart.y;
                if (dx === 0 && dy === 0) return;

                // Professional Smoothness: Instead of updating the massive 'elements' array
                // and triggering a full RoughJS static redraw, we just update a light 'offset'
                // and let the dynamic layer handle the preview.
                // setAppState(prev => ({ ...prev, draggingOffset: { x: dx, y: dy } }));
                // Set cursor to grabbing during drag
                document.body.style.cursor = GRABBING_CURSOR;
                return;
            }

            if (tempElement && appState.selectionStart) {
                let width = pos.x - appState.selectionStart.x;
                let height = pos.y - appState.selectionStart.y;

                if (tempElement.type === 'freedraw') {
                    // For freedraw, add points continuously for smooth sketching
                    const relativeX = pos.x - tempElement.x;
                    const relativeY = pos.y - tempElement.y;
                    const currentPoints = tempElement.points || [];
                    const lastPoint = currentPoints.length > 0
                        ? currentPoints[currentPoints.length - 1]
                        : { x: 0, y: 0 };

                    // Add point if moved (lower threshold for smoother curves)
                    const dist = Math.hypot(relativeX - lastPoint.x, relativeY - lastPoint.y);
                    if (dist > 0.5) { // Lower threshold for smoother curves
                        // Add the new point
                        const newPoints = [...currentPoints, { x: relativeX, y: relativeY, pressure: pos.pressure }];

                        // Calculate bounding box from all points
                        const xs = newPoints.map(p => p.x);
                        const ys = newPoints.map(p => p.y);
                        const minX = Math.min(...xs);
                        const minY = Math.min(...ys);
                        const maxX = Math.max(...xs);
                        const maxY = Math.max(...ys);

                        // Update element bounds
                        const newWidth = Math.max(maxX - minX, 1);
                        const newHeight = Math.max(maxY - minY, 1);

                        // Keep points relative to original start position (don't normalize during drawing)
                        // Only normalize on final commit
                        setTempElement({
                            ...tempElement,
                            width: newWidth,
                            height: newHeight,
                            points: newPoints
                        });
                    }
                    return;
                } else if (tempElement.type === 'arrow' || tempElement.type === 'line') {
                    const points = [...(tempElement.points || [{ x: 0, y: 0 }])];
                    if (points.length < 2) points.push({ x: 0, y: 0 });

                    // Calculate the arrow tip position
                    const tipX = tempElement.x + width;
                    const tipY = tempElement.y + height;

                    // Find element at arrow tip, excluding the source element
                    const sourceElementId = tempElement.startBinding?.elementId;
                    const targetEl = elements.find(el => {
                        if (el.id === sourceElementId) return false;
                        if (el.isLocked) return false;
                        const hit = hitTest(tipX, tipY, el);
                        return hit === 'stroke' || (hit === 'fill' && el.backgroundColor !== 'transparent');
                    });

                    if (targetEl) {
                        setHighlightedElementId(targetEl.id);
                        const snap = getClosestSnapPoint(tipX, tipY, targetEl);
                        if (snap) {
                            width = snap.x - tempElement.x;
                            height = snap.y - tempElement.y;
                        }
                    } else {
                        setHighlightedElementId(null);
                    }

                    points[points.length - 1] = { x: width, y: height, pressure: pos.pressure };
                    setTempElement({ ...tempElement, width, height, points });
                } else {
                    let x = appState.selectionStart.x;
                    let y = appState.selectionStart.y;
                    if (e.shiftKey) { const d = Math.max(Math.abs(width), Math.abs(height)); width = width < 0 ? -d : d; height = height < 0 ? -d : d; }
                    if (width < 0) { x += width; width = Math.abs(width); }
                    if (height < 0) { y += height; height = Math.abs(height); }
                    setTempElement({ ...tempElement, x, y, width, height });
                }
            }
        }
    }, [appState, elements, getPointerPosLocal, setAppState, setElements, setTempElement, setCursorPos, setHighlightedElementId, setEraserTrail, setLaserTrails, currentLaserRef]);

    const handleMouseUp = useCallback((e: React.PointerEvent) => {
        // Reset cursor
        document.body.style.cursor = '';
        const pos = getPointerPosLocal(e);

        if (!appState.isDragging) {
            setAppState(prev => ({ ...prev, isDragging: false, selectionBox: null, selectionStart: null }));
            return;
        }

        if (appState.resizingState) {
            const { originalElement, handle } = appState.resizingState;
            const updatedFields = resizeElement(handle, originalElement, pos, e.shiftKey);
            const final = { ...originalElement, ...updatedFields } as ExcalidrawElement;
            const nextElements = elements.map(el => el.id === final.id ? final : el);
            setElements(nextElements);
            saveHistory(nextElements);
        } else if (tempElement) {
            // For freedraw, check if we have enough points
            if (tempElement.type === 'freedraw') {
                if (!tempElement.points || tempElement.points.length < 2) {
                    setTempElement(null);
                    setAppState(prev => ({ ...prev, isDragging: false, selectionStart: null, selectionBox: null, resizingState: null }));
                    return;
                }

                // Normalize freedraw points on final commit
                const points = tempElement.points;
                const xs = points.map(p => p.x);
                const ys = points.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);

                // Normalize points to start from (0,0)
                const normalizedPoints = points.map(p => ({ x: p.x - minX, y: p.y - minY }));
                const newX = tempElement.x + minX;
                const newY = tempElement.y + minY;
                const maxX = Math.max(...xs);
                const maxY = Math.max(...ys);
                const newWidth = Math.max(maxX - minX, 1);
                const newHeight = Math.max(maxY - minY, 1);

                let final = {
                    ...tempElement,
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                    points: normalizedPoints
                };

                let nextElements = [...elements, final];
                setElements(nextElements);
                saveHistory(nextElements);
                setAppState(prev => ({ ...prev, tool: 'selection', selectedElementIds: [final.id] }));
                setTempElement(null);
                setAppState(prev => ({ ...prev, isDragging: false, selectionStart: null, selectionBox: null, resizingState: null }));
                return;
            }

            const dist = tempElement.points ? Math.hypot(tempElement.points[tempElement.points.length - 1].x, tempElement.points[tempElement.points.length - 1].y) : Math.hypot(tempElement.width, tempElement.height);
            if (dist < 5 && tempElement.type !== 'text' && tempElement.type !== 'icon') {
                setTempElement(null);
            } else {
                let final = { ...tempElement };

                // Set endBinding if arrow/line released over an element
                if ((final.type === 'arrow' || final.type === 'line') && final.points && final.points.length >= 2) {
                    const endPoint = final.points[final.points.length - 1];
                    const endX = final.x + endPoint.x;
                    const endY = final.y + endPoint.y;
                    const hoveredEl = getElementAtPosition(endX, endY, elements);
                    if (hoveredEl && hoveredEl.id !== final.startBinding?.elementId) {
                        const snap = getClosestSnapPoint(endX, endY, hoveredEl);
                        if (snap) {
                            final.endBinding = { elementId: hoveredEl.id, anchor: snap.anchor };
                            // Adjust the end point to snap to the anchor
                            final.points = [...final.points];
                            final.points[final.points.length - 1] = { x: snap.x - final.x, y: snap.y - final.y, pressure: pos.pressure };
                        }
                    }
                }

                let nextElements = [...elements, final];

                if (final.type === 'frame') {
                    nextElements = defineFrameGroups(nextElements, final);
                } else {
                    const enc = findEnclosingFrame(final, elements);
                    if (enc) final.frameId = enc.id;
                }
                setElements(nextElements);
                saveHistory(nextElements);
                setAppState(prev => ({ ...prev, tool: 'selection', selectedElementIds: [final.id] }));
            }
        } else if (appState.tool === 'selection' && appState.selectedElementIds.length > 0 && appState.selectionStart && !appState.selectionBox) {
            const dx = pos.x - appState.selectionStart.x;
            const dy = pos.y - appState.selectionStart.y;
            const selectedIds = new Set(appState.selectedElementIds);

            // Apply the final move to the elements array
            const elementsToMove = elements.filter(el => !el.isLocked && (selectedIds.has(el.id) || (el.frameId && selectedIds.has(el.frameId))));
            const moveIds = new Set(elementsToMove.map(e => e.id));

            let updated = elements.map(el => {
                if (moveIds.has(el.id)) return { ...el, x: el.x + dx, y: el.y + dy };
                return el;
            });

            // Update connectors one final time
            updated = updated.map(el => {
                if (el.type !== 'arrow' && el.type !== 'line') return el;
                if (!el.points || el.points.length < 2) return el;
                const hasStartBinding = el.startBinding && moveIds.has(el.startBinding.elementId);
                const hasEndBinding = el.endBinding && moveIds.has(el.endBinding.elementId);
                if (!hasStartBinding && !hasEndBinding) return el;

                let newEl = { ...el, points: [...el.points] };
                const startBoundEl = el.startBinding ? updated.find(e => e.id === el.startBinding!.elementId) : null;
                const endBoundEl = el.endBinding ? updated.find(e => e.id === el.endBinding!.elementId) : null;
                let startPos = { x: el.x, y: el.y };
                let endPos = { x: el.x + el.points[el.points.length - 1].x, y: el.y + el.points[el.points.length - 1].y };

                if (startBoundEl && el.startBinding) startPos = getAnchorPosition(startBoundEl, el.startBinding.anchor);
                if (endBoundEl && el.endBinding) endPos = getAnchorPosition(endBoundEl, el.endBinding.anchor);

                if (startBoundEl && endBoundEl && el.startBinding && el.endBinding) {
                    const smartAnchors = getSmartAnchors(startBoundEl, endBoundEl);
                    newEl.startBinding = { ...el.startBinding, anchor: smartAnchors.start };
                    newEl.endBinding = { ...el.endBinding, anchor: smartAnchors.end };
                    const sP = getAnchorPosition(startBoundEl, smartAnchors.start);
                    const eP = getAnchorPosition(endBoundEl, smartAnchors.end);
                    newEl.points = generateOrthogonalPoints(sP, eP, smartAnchors.start as any, smartAnchors.end as any, startBoundEl, endBoundEl, 30);
                    newEl.x = sP.x; newEl.y = sP.y;
                } else {
                    if (hasStartBinding && startBoundEl) {
                        const oldStart = { x: el.x, y: el.y };
                        const offX = startPos.x - oldStart.x; const offY = startPos.y - oldStart.y;
                        newEl.x = startPos.x; newEl.y = startPos.y;
                        newEl.points = newEl.points.map((p, i) => i === 0 ? { x: 0, y: 0, pressure: p.pressure ?? 0.5 } : { x: p.x - offX, y: p.y - offY, pressure: p.pressure ?? 0.5 });
                    }
                    if (hasEndBinding) {
                        const endPointIdx = newEl.points.length - 1;
                        newEl.points[endPointIdx] = { x: endPos.x - newEl.x, y: endPos.y - newEl.y, pressure: newEl.points[endPointIdx].pressure ?? 0.5 };
                    }
                }
                const xs = newEl.points.map(p => p.x); const ys = newEl.points.map(p => p.y);
                newEl.width = Math.max(...xs) - Math.min(...xs); newEl.height = Math.max(...ys) - Math.min(...ys);
                return newEl;
            });

            setElements(updated);
            saveHistory(updated);

            // Check for frame update
            const moved = updated.filter(el => selectedIds.has(el.id));
            const frameUpdated = handleDragToFrame(updated, moved);
            if (frameUpdated) { setElements(frameUpdated); saveHistory(frameUpdated); }

            setAppState(prev => ({ ...prev, draggingOffset: null }));
        }

        if (appState.tool === 'eraser') {
            if (appState.pendingDeletionIds.length > 0) {
                const filtered = elements.filter(el => !appState.pendingDeletionIds.includes(el.id));
                setElements(filtered);
                saveHistory(filtered);
            }
            setAppState(prev => ({ ...prev, pendingDeletionIds: [] }));
            setEraserTrail([]);
        }

        if (appState.tool === 'laser') {
            // Finalize laser trail - it will fade out automatically
            currentLaserRef.current = [];
        }

        setAppState(prev => ({ ...prev, isDragging: false, selectionStart: null, selectionBox: null, resizingState: null }));
        setTempElement(null);
        setHighlightedElementId(null);
        currentLaserRef.current = [];
    }, [appState, elements, tempElement, setAppState, setElements, setTempElement, setHighlightedElementId, setEraserTrail, currentLaserRef, saveHistory, defineFrameGroups, handleDragToFrame]);

    const handleDoubleClick = useCallback((e: React.PointerEvent) => {
        // Don't interfere with textarea double-clicks
        if ((e.target as HTMLElement).tagName === 'TEXTAREA') {
            return;
        }

        const pos = getPointerPosLocal(e);
        const element = getElementAtPosition(pos.x, pos.y, elements);
        if (element && (element.type === 'text' || element.type === 'frame')) {
            // Start editing the text/frame
            setAppState(prev => ({ ...prev, editingElementId: element.id, selectedElementIds: [element.id] }));
        } else if (!element && appState.tool === 'selection') {
            // Double-click empty space to create new text (Excalidraw behavior)
            const id = crypto.randomUUID();
            const newEl: ExcalidrawElement = {
                id, type: 'text', x: pos.x, y: pos.y, width: 20, height: 24,
                strokeColor: appState.strokeColor, backgroundColor: appState.backgroundColor,
                strokeWidth: 1, opacity: appState.opacity, text: "", fontSize: 20,
                fontFamily: 1, fontWeight: 400, fontStyle: 'normal', strokeStyle: "solid",
                seed: Math.floor(Math.random() * 2 ** 31), fillStyle: appState.fillStyle,
                roughness: appState.roughness
            };
            setElements(prev => [...prev, newEl]);
            setAppState(prev => ({ ...prev, tool: 'selection', editingElementId: id, selectedElementIds: [id] }));
        }
    }, [appState, elements, getPointerPosLocal, setAppState, setElements]);

    return { handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick };
};

// Internal helpers needed by the hook if not exported from geometry
function findEnclosingFrame(element: ExcalidrawElement, elements: ExcalidrawElement[]) {
    return elements.find(el =>
        el.type === 'frame' &&
        element.x >= el.x &&
        element.y >= el.y &&
        element.x + element.width <= el.x + el.width &&
        element.y + element.height <= el.y + el.height
    );
}
