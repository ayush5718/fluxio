import { ExcalidrawElement } from '../types';

/**
 * Checks if an element is completely inside a frame.
 */
export const isElementInsideFrame = (element: ExcalidrawElement, frame: ExcalidrawElement): boolean => {
    if (frame.type !== 'frame') return false;
    if (element.id === frame.id) return false;

    return (
        element.x >= frame.x &&
        element.x + (element.width || 0) <= frame.x + frame.width &&
        element.y >= frame.y &&
        element.y + (element.height || 0) <= frame.y + frame.height
    );
};

/**
 * Gets all elements that are completely inside a given frame.
 */
export const getElementsInsideFrame = (elements: ExcalidrawElement[], frame: ExcalidrawElement): ExcalidrawElement[] => {
    return elements.filter(element => isElementInsideFrame(element, frame));
};

/**
 * Finds the best matching frame for a given element (usually the smallest enclosing one).
 */
export const findEnclosingFrame = (element: ExcalidrawElement, elements: ExcalidrawElement[]): ExcalidrawElement | null => {
    const frames = elements.filter(el => el.type === 'frame');
    let bestFrame: ExcalidrawElement | null = null;
    let minArea = Infinity;

    for (const frame of frames) {
        if (isElementInsideFrame(element, frame)) {
            const area = frame.width * frame.height;
            if (area < minArea) {
                minArea = area;
                bestFrame = frame;
            }
        }
    }

    return bestFrame;
};

/**
 * Updates elements to be part of a frame or removed from one.
 * Returns a NEW array of elements.
 */
export const updateFrameMembership = (elements: ExcalidrawElement[], frame: ExcalidrawElement): ExcalidrawElement[] => {
    const elementsInside = getElementsInsideFrame(elements, frame);
    const insideIds = new Set(elementsInside.map(e => e.id));

    return elements.map(el => {
        // If element is inside the new frame, set its frameId
        if (insideIds.has(el.id)) {
            return { ...el, frameId: frame.id };
        }
        // If element WAS in this frame but is no longer inside, logic might be complex.
        // Usually, Genesis capture only adds.
        // Drag-out removes.
        return el;
    });
};

/**
 * Removes elements from a frame (e.g., when dragged out).
 */
export const removeElementsFromFrame = (elements: ExcalidrawElement[], elementIdsToRemove: string[]): ExcalidrawElement[] => {
    const idsSet = new Set(elementIdsToRemove);
    return elements.map(el => {
        if (idsSet.has(el.id)) {
            const { frameId, ...rest } = el;
            return rest as ExcalidrawElement;
        }
        return el;
    });
};
