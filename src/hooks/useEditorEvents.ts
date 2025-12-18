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
    generateOrthogonalPoints
} from '../utils/geometry';

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

    const getPointerPosLocal = useCallback((e: React.MouseEvent) => {
        return {
            x: (e.clientX - appState.pan.x) / appState.zoom,
            y: (e.clientY - appState.pan.y) / appState.zoom
        };
    }, [appState.pan, appState.zoom]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (appState.editingElementId) {
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
                        points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                        startBinding: { elementId: selectedId, anchor },
                        seed: Math.floor(Math.random() * 2 ** 31),
                        roughness: appState.roughness
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
        let initialPoints = (appState.tool === 'arrow' || appState.tool === 'line' || appState.tool === 'freedraw') ? [{ x: 0, y: 0 }] : undefined;

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
            id, type: appState.tool as any, x: startX, y: startY, width: 0, height: 0,
            strokeColor: appState.strokeColor, backgroundColor: appState.tool === 'frame' ? 'transparent' : appState.backgroundColor,
            strokeWidth: appState.strokeWidth, strokeStyle: appState.tool === 'frame' ? 'solid' : appState.strokeStyle,
            fillStyle: appState.tool === 'frame' ? 'solid' : appState.fillStyle, opacity: appState.opacity,
            points: initialPoints, startBinding, name, seed: Math.floor(Math.random() * 2 ** 31),
            roundness: appState.tool === 'rectangle' ? 12 : 0
        };
        setTempElement(newElement);
    }, [appState, elements, getPointerPosLocal, setAppState, setElements, setTempElement, setEraserTrail]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
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
                document.body.style.cursor = hoveredEl ? 'move' : 'default';
            } else {
                setHighlightedElementId(null);
                document.body.style.cursor = appState.tool === 'text' ? 'text' : 'crosshair';
            }
        } else {
            // Dragging
            if (appState.tool === 'eraser' && e.buttons === 1) {
                setEraserTrail(prev => [...prev.slice(-40), pos]);
                const element = getElementAtPosition(pos.x, pos.y, elements);
                if (element && !element.isLocked && !appState.pendingDeletionIds.includes(element.id)) {
                    setAppState(prev => ({ ...prev, pendingDeletionIds: [...prev.pendingDeletionIds, element.id] }));
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

            if (appState.tool === 'laser' && e.buttons === 1) {
                currentLaserRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
                // Note: laserTrails update omitted here for brevity, handled by requestAnimationFrame in app
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
                setAppState(prev => ({ ...prev, selectedElementIds: e.shiftKey ? Array.from(new Set([...prev.selectedElementIds, ...elementsInBox.map(e => e.id)])) : elementsInBox.map(e => e.id) }));
                return;
            }

            if (appState.selectionStart && appState.tool === 'selection' && appState.selectedElementIds.length > 0) {
                const dx = pos.x - appState.selectionStart.x;
                const dy = pos.y - appState.selectionStart.y;
                if (dx === 0 && dy === 0) return;

                const selectedIds = new Set(appState.selectedElementIds);
                const elementsToMove = elements.filter(el => !el.isLocked && (selectedIds.has(el.id) || (el.frameId && selectedIds.has(el.frameId))));
                const moveIds = new Set(elementsToMove.map(e => e.id));

                // First, move the selected elements
                let updated = elements.map(el => {
                    if (moveIds.has(el.id)) return { ...el, x: el.x + dx, y: el.y + dy };
                    return el;
                });

                // Then, update any arrows bound to moved elements
                updated = updated.map(el => {
                    if (el.type !== 'arrow' && el.type !== 'line') return el;
                    if (!el.points || el.points.length < 2) return el;

                    const hasStartBinding = el.startBinding && moveIds.has(el.startBinding.elementId);
                    const hasEndBinding = el.endBinding && moveIds.has(el.endBinding.elementId);

                    if (!hasStartBinding && !hasEndBinding) return el;

                    let newEl = { ...el, points: [...el.points] };

                    // Get bound elements
                    const startBoundEl = el.startBinding ? updated.find(e => e.id === el.startBinding!.elementId) : null;
                    const endBoundEl = el.endBinding ? updated.find(e => e.id === el.endBinding!.elementId) : null;

                    // Calculate anchor positions
                    let startPos = { x: el.x, y: el.y };
                    let endPos = { x: el.x + el.points[el.points.length - 1].x, y: el.y + el.points[el.points.length - 1].y };

                    if (startBoundEl && el.startBinding) {
                        startPos = getAnchorPosition(startBoundEl, el.startBinding.anchor);
                    }
                    if (endBoundEl && el.endBinding) {
                        endPos = getAnchorPosition(endBoundEl, el.endBinding.anchor);
                    }

                    // If both ends are bound, use smart routing with dynamic anchors
                    if (startBoundEl && endBoundEl && el.startBinding && el.endBinding) {
                        // Dynamically recalculate optimal anchors
                        const smartAnchors = getSmartAnchors(startBoundEl, endBoundEl);

                        // Update bindings with optimal anchors
                        newEl.startBinding = { ...el.startBinding, anchor: smartAnchors.start };
                        newEl.endBinding = { ...el.endBinding, anchor: smartAnchors.end };

                        const startPos = getAnchorPosition(startBoundEl, smartAnchors.start);
                        const endPos = getAnchorPosition(endBoundEl, smartAnchors.end);

                        // Use orthogonal elbow routing with smart anchors
                        const newPoints = generateOrthogonalPoints(
                            startPos,
                            endPos,
                            smartAnchors.start as any,
                            smartAnchors.end as any,
                            startBoundEl,
                            endBoundEl,
                            30
                        );
                        newEl.x = startPos.x;
                        newEl.y = startPos.y;
                        newEl.points = newPoints;
                    } else {
                        // Only one end bound - simple update
                        if (hasStartBinding && startBoundEl) {
                            const oldStart = { x: el.x, y: el.y };
                            const offsetX = startPos.x - oldStart.x;
                            const offsetY = startPos.y - oldStart.y;
                            newEl.x = startPos.x;
                            newEl.y = startPos.y;
                            newEl.points = newEl.points.map((p, i) =>
                                i === 0 ? { x: 0, y: 0 } : { x: p.x - offsetX, y: p.y - offsetY }
                            );
                        }
                        if (hasEndBinding) {
                            const endPointIdx = newEl.points.length - 1;
                            newEl.points[endPointIdx] = {
                                x: endPos.x - newEl.x,
                                y: endPos.y - newEl.y
                            };
                        }
                    }

                    // Recalculate width/height based on points
                    const xs = newEl.points.map(p => p.x);
                    const ys = newEl.points.map(p => p.y);
                    newEl.width = Math.max(...xs) - Math.min(...xs);
                    newEl.height = Math.max(...ys) - Math.min(...ys);

                    return newEl;
                });

                setElements(updated);
                setAppState(prev => ({ ...prev, selectionStart: pos }));
                return;
            }

            if (tempElement && appState.selectionStart) {
                let width = pos.x - appState.selectionStart.x;
                let height = pos.y - appState.selectionStart.y;

                if (tempElement.type === 'arrow' || tempElement.type === 'line') {
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

                    points[points.length - 1] = { x: width, y: height };
                    setTempElement({ ...tempElement, width, height, points });
                } else if (tempElement.type === 'freedraw') {
                    const points = [...(tempElement.points || []), { x: width, y: height }];
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
    }, [appState, elements, getPointerPosLocal, setAppState, setElements, setTempElement, setCursorPos, setHighlightedElementId, setEraserTrail, currentLaserRef]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (!appState.isDragging) {
            setAppState(prev => ({ ...prev, isDragging: false, selectionBox: null, selectionStart: null }));
            return;
        }

        if (appState.resizingState) {
            saveHistory(elements);
        } else if (tempElement) {
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
                            final.points[final.points.length - 1] = { x: snap.x - final.x, y: snap.y - final.y };
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
        } else if (appState.tool === 'selection' && appState.selectedElementIds.length > 0) {
            const moved = elements.filter(el => appState.selectedElementIds.includes(el.id));
            const frameUpdated = handleDragToFrame(elements, moved);
            if (frameUpdated) { setElements(frameUpdated); saveHistory(frameUpdated); }
            else saveHistory(elements);
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

        setAppState(prev => ({ ...prev, isDragging: false, selectionStart: null, selectionBox: null, resizingState: null }));
        setTempElement(null);
        setHighlightedElementId(null);
        currentLaserRef.current = [];
    }, [appState, elements, tempElement, setAppState, setElements, setTempElement, setHighlightedElementId, setEraserTrail, currentLaserRef, saveHistory, defineFrameGroups, handleDragToFrame]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        const pos = getPointerPosLocal(e);
        const element = getElementAtPosition(pos.x, pos.y, elements);
        if (element && (element.type === 'text' || element.type === 'frame')) {
            setAppState(prev => ({ ...prev, editingElementId: element.id }));
        } else if (!element) {
            const id = crypto.randomUUID();
            const newEl: ExcalidrawElement = {
                id, type: 'text', x: pos.x, y: pos.y, width: 20, height: 24, strokeColor: appState.strokeColor, backgroundColor: appState.backgroundColor, strokeWidth: 1, opacity: appState.opacity, text: "", fontSize: 20, fontFamily: 1, fontWeight: 400, fontStyle: 'normal', strokeStyle: "solid", seed: Math.floor(Math.random() * 2 ** 31)
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
