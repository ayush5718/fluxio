import React, { useCallback } from 'react';
import { ExcalidrawElement, AppState } from '../types';
import { isElementInsideFrame, findEnclosingFrame, doesElementOverlapFrame } from '../utils/frameUtils';

export const useFrame = () => {

    const defineFrameGroups = useCallback((elements: ExcalidrawElement[], frame: ExcalidrawElement): ExcalidrawElement[] => {
        // ... (Genesis Capture logic remains same, usually strict)
        const newElements = elements.map(el => {
            if (el.id === frame.id) return el;
            if (isElementInsideFrame(el, frame)) {
                return { ...el, frameId: frame.id };
            }
            return el;
        });
        return newElements;
    }, []);

    const handleDragToFrame = useCallback((elements: ExcalidrawElement[], draggedElements: ExcalidrawElement[]): ExcalidrawElement[] | null => {
        const draggedIds = new Set(draggedElements.map(e => e.id));
        const potentialFrames = elements.filter(el => el.type === 'frame' && !draggedIds.has(el.id));
        const frameMap = new Map(potentialFrames.map(f => [f.id, f]));

        let hasUpdates = false;
        const updatedElements = elements.map(el => {
            if (!draggedIds.has(el.id)) return el;

            // 1. Check strict containment in ANY frame (Priority: Enter new frame strictly)
            const enclosingFrame = findEnclosingFrame(el, potentialFrames);

            if (enclosingFrame) {
                // Strictly inside a frame
                if (el.frameId !== enclosingFrame.id) {
                    hasUpdates = true;
                    return { ...el, frameId: enclosingFrame.id };
                }
                return el; // Already correctly assigned
            }

            // 2. If not strictly inside any, check RETENTION (Sticky Exit)
            if (el.frameId) {
                const currentFrame = frameMap.get(el.frameId);
                if (currentFrame) {
                    // Check overlap threshold (0.50)
                    if (doesElementOverlapFrame(el, currentFrame, 0.50)) {
                        return el; // Retain (Still > 50% inside)
                    }
                }

                // If we get here, it's NOT strictly in new frame, and NOT enough in old frame.
                // Eject.
                hasUpdates = true;
                const { frameId, ...rest } = el;
                return rest as ExcalidrawElement;
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
