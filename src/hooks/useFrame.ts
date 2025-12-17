import React, { useCallback } from 'react';
import { ExcalidrawElement, AppState } from '../types';
import { isElementInsideFrame, findEnclosingFrame } from '../utils/frameUtils';

export const useFrame = () => {

    const defineFrameGroups = useCallback((elements: ExcalidrawElement[], frame: ExcalidrawElement): ExcalidrawElement[] => {
        // 1. Genesis Capture: Find elements already inside the new frame
        // We expect 'elements' to ALREADY include the new frame (if checking against itself is handled)
        // or passed separately.
        // Let's assume 'elements' is the list of ALL elements including the frame.

        const newElements = elements.map(el => {
            if (el.id === frame.id) return el;
            // If already in a frame, Excalidraw allows nested frames? 
            // For now, let's assume flat structure or topmost frame wins, or specific logic.
            // If we draw a frame OVER items, we capture them.
            if (isElementInsideFrame(el, frame)) {
                // If it was in another frame, we might steal it?
                return { ...el, frameId: frame.id };
            }
            return el;
        });
        return newElements;
    }, []);

    const handleDragToFrame = useCallback((elements: ExcalidrawElement[], draggedElements: ExcalidrawElement[]): ExcalidrawElement[] | null => {
        // 2. Drag Capture: Check if dragged elements are dropped into a frame
        const draggedIds = new Set(draggedElements.map(e => e.id));
        const potentialFrames = elements.filter(el => el.type === 'frame' && !draggedIds.has(el.id));

        let hasUpdates = false;
        const updatedElements = elements.map(el => {
            if (!draggedIds.has(el.id)) return el;

            const enclosingFrame = findEnclosingFrame(el, potentialFrames);
            if (enclosingFrame) {
                if (el.frameId !== enclosingFrame.id) {
                    hasUpdates = true;
                    return { ...el, frameId: enclosingFrame.id };
                }
            } else {
                if (el.frameId) {
                    // Check if it's still inside its *current* frame.
                    // If we dragged it out, 'enclosingFrame' would be null or different.
                    // So if enclosingFrame is null, we dragged it out (or into void).
                    hasUpdates = true;
                    const { frameId, ...rest } = el;
                    return rest as ExcalidrawElement;
                }
            }
            return el;
        });

        return hasUpdates ? updatedElements : null;
    }, []);

    return {
        defineFrameGroups,
        handleDragToFrame
    };
};
