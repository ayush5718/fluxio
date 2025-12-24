import React, { useEffect, useRef } from 'react';
import { AppState, ExcalidrawElement, Point } from '../types';
import { renderStaticScene, renderDynamicScene } from '../utils/renderer';
import { resizeElement } from '../utils/geometry';
import rough from 'roughjs';

interface UseCanvasProps {
    elements: ExcalidrawElement[];
    tempElement: ExcalidrawElement | null;
    appState: AppState;
    theme: 'light' | 'dark';
    highlightedElementId: string | null;
    laserTrails: { x: number; y: number; time: number }[][];
    eraserTrail: Point[];
    cursorPos: Point | null;
}

export const useCanvas = (
    staticCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    dynamicCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    props: UseCanvasProps
) => {
    const {
        elements,
        tempElement,
        appState,
        theme,
        highlightedElementId,
        laserTrails,
        eraserTrail,
        cursorPos
    } = props;

    const latestPropsRef = useRef(props);
    latestPropsRef.current = props;

    // Fast state for smooth dragging bypassing React's render frequency
    const nativePointerRef = useRef<Point>({ x: 0, y: 0 });
    const rcRef = useRef<any>(null);

    // Track native pointer moves globally
    useEffect(() => {
        const handleNativePointerMove = (e: PointerEvent) => {
            nativePointerRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('pointermove', handleNativePointerMove, { passive: true });
        return () => window.removeEventListener('pointermove', handleNativePointerMove);
    }, []);

    // Static Layer Effect (Redraw only when elements or view changes)
    useEffect(() => {
        const canvas = staticCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;

        // Re-scale if needed
        if (canvas.width !== window.innerWidth * dpr) {
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.scale(dpr, dpr);
        }

        const { appState, elements, theme } = latestPropsRef.current;
        const skipIds = [...appState.pendingDeletionIds];
        if (appState.editingElementId) skipIds.push(appState.editingElementId);

        // Only skip elements on the static layer if they are being dragged natively.
        // If they are being resized, the actual 'elements' array is updated via React, 
        // so we want them to render normally on the static layer.
        const isActuallyDragging = appState.isDragging &&
            appState.tool === 'selection' &&
            appState.selectedElementIds.length > 0 &&
            !appState.selectionBox &&
            !appState.resizingState;

        if (appState.draggingOffset || isActuallyDragging || appState.resizingState) {
            const selSet = new Set(appState.selectedElementIds);

            // If resizing, we definitely want to skip the element being resized
            if (appState.resizingState) {
                selSet.add(appState.resizingState.elementId);
            }

            const frameChildIds = elements
                .filter(el => el.frameId && selSet.has(el.frameId) && !el.isLocked)
                .map(el => el.id);

            const movingIds = new Set([...appState.selectedElementIds, ...frameChildIds]);
            skipIds.push(...Array.from(movingIds));

            elements.forEach(el => {
                if ((el.type === 'arrow' || el.type === 'line') && (
                    (el.startBinding && movingIds.has(el.startBinding.elementId)) ||
                    (el.endBinding && movingIds.has(el.endBinding.elementId))
                )) {
                    skipIds.push(el.id);
                }
            });
        }

        renderStaticScene(
            ctx,
            elements,
            appState.pan,
            appState.zoom,
            theme,
            appState.showGrid,
            appState.viewBackgroundColor,
            skipIds
        );
    }, [elements, appState.pan, appState.zoom, theme, appState.showGrid, appState.viewBackgroundColor, appState.draggingOffset, appState.selectedElementIds, appState.isDragging, staticCanvasRef]);

    // Dynamic Layer Loop (Continuous render loop for smooth interactions)
    useEffect(() => {
        let animationFrameId: number;
        let shouldContinue = true;
        const canvas = dynamicCanvasRef.current;
        if (!canvas) return;

        if (!rcRef.current) {
            rcRef.current = rough.canvas(canvas);
        }
        const ctx = canvas.getContext('2d', {
            desynchronized: true,
            alpha: true
        });
        if (!ctx) return;

        const render = () => {
            if (!shouldContinue) return;

            const { elements, tempElement, appState, theme, highlightedElementId, laserTrails, eraserTrail, cursorPos } = latestPropsRef.current;
            const dpr = window.devicePixelRatio || 1;

            if (canvas.width !== window.innerWidth * dpr) {
                canvas.width = window.innerWidth * dpr;
                canvas.height = window.innerHeight * dpr;
                canvas.style.width = `${window.innerWidth}px`;
                canvas.style.height = `${window.innerHeight}px`;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            // Fast Path: Calculate dragging offset natively if we are dragging
            let draggingOffsetOverride = undefined;
            if (appState.isDragging && appState.selectionStart && appState.tool === 'selection' && appState.selectedElementIds.length > 0 && !appState.selectionBox) {
                // Calculate position relative to canvas
                const canvas = dynamicCanvasRef.current;
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const currentNativeX = (nativePointerRef.current.x - rect.left - appState.pan.x) / appState.zoom;
                    const currentNativeY = (nativePointerRef.current.y - rect.top - appState.pan.y) / appState.zoom;

                    draggingOffsetOverride = {
                        x: currentNativeX - appState.selectionStart.x,
                        y: currentNativeY - appState.selectionStart.y
                    };
                }
            }

            // Fast Path: Calculate resize preview natively
            let resizingElementOverride = null;
            if (appState.resizingState) {
                const canvas = dynamicCanvasRef.current;
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const currentNativeX = (nativePointerRef.current.x - rect.left - appState.pan.x) / appState.zoom;
                    const currentNativeY = (nativePointerRef.current.y - rect.top - appState.pan.y) / appState.zoom;

                    const { originalElement, handle } = appState.resizingState;
                    const updatedFields = resizeElement(handle, originalElement, { x: currentNativeX, y: currentNativeY });
                    resizingElementOverride = {
                        ...originalElement,
                        ...updatedFields
                    } as ExcalidrawElement;
                }
            }

            renderDynamicScene(
                ctx,
                elements,
                tempElement,
                appState,
                theme,
                highlightedElementId,
                laserTrails,
                eraserTrail,
                cursorPos,
                rcRef.current,
                draggingOffsetOverride,
                resizingElementOverride
            );

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            shouldContinue = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [dynamicCanvasRef]);

    // Resize Handler
    useEffect(() => {
        const handleResize = () => {
            const dpr = window.devicePixelRatio || 1;
            [staticCanvasRef, dynamicCanvasRef].forEach(ref => {
                const canvas = ref.current;
                if (canvas) {
                    canvas.width = window.innerWidth * dpr;
                    canvas.height = window.innerHeight * dpr;
                    canvas.style.width = `${window.innerWidth}px`;
                    canvas.style.height = `${window.innerHeight}px`;
                    const ctx = canvas.getContext('2d');
                    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
            });
            // Force redraw of static
            const canvas = staticCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    renderStaticScene(
                        ctx,
                        elements,
                        appState.pan,
                        appState.zoom,
                        theme,
                        appState.showGrid,
                        appState.viewBackgroundColor
                    );
                }
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [elements, appState.pan, appState.zoom, theme, appState.showGrid, appState.viewBackgroundColor, staticCanvasRef, dynamicCanvasRef]);
};
