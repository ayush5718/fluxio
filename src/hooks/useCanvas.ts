import React, { useEffect, useRef } from 'react';
import { AppState, ExcalidrawElement, Point } from '../types';
import { renderStaticScene, renderDynamicScene } from '../utils/renderer';

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

    const lastRenderedElementsRef = useRef<ExcalidrawElement[]>([]);
    const lastRenderedStateRef = useRef<Partial<AppState>>({});
    const lastThemeRef = useRef<string>(theme);

    // Static Layer Effect (Redraw only when elements or view changes)
    useEffect(() => {
        const canvas = staticCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;

        // Re-scale if needed (redundant but safe)
        if (canvas.width !== window.innerWidth * dpr) {
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.scale(dpr, dpr);
        }

        renderStaticScene(
            ctx,
            elements,
            appState.pan,
            appState.zoom,
            theme,
            appState.showGrid,
            appState.viewBackgroundColor
        );
    }, [elements, appState.pan, appState.zoom, theme, appState.showGrid, appState.viewBackgroundColor, staticCanvasRef]);

    // Dynamic Layer Loop (Redraw on every state change that affects overlays)
    useEffect(() => {
        let animationFrameId: number;
        const canvas = dynamicCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            const dpr = window.devicePixelRatio || 1;
            if (canvas.width !== window.innerWidth * dpr) {
                canvas.width = window.innerWidth * dpr;
                canvas.height = window.innerHeight * dpr;
                canvas.style.width = `${window.innerWidth}px`;
                canvas.style.height = `${window.innerHeight}px`;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
                cursorPos
            );
            // We don't necessarily need an infinite loop if nothing is changing,
            // but for simplicity in this phase, we'll let React's useEffect handle the trigger.
            // In a more advanced version, we'd have a non-React state for the "active" items.
        };

        animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [
        elements,
        tempElement,
        appState,
        theme,
        highlightedElementId,
        laserTrails,
        eraserTrail,
        cursorPos,
        dynamicCanvasRef
    ]);

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
