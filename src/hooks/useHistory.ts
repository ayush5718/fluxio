import { useState } from 'react';
import { ExcalidrawElement } from '../types';

export const useHistory = (initialElements: ExcalidrawElement[] = []) => {
    const [history, setHistory] = useState<ExcalidrawElement[][]>([initialElements]);
    const [historyStep, setHistoryStep] = useState(0);

    const saveHistory = (newElements: ExcalidrawElement[]) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newElements);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    };

    const undo = () => {
        if (historyStep > 0) {
            const newStep = historyStep - 1;
            setHistoryStep(newStep);
            return history[newStep];
        }
        return null;
    };

    const redo = () => {
        if (historyStep < history.length - 1) {
            const newStep = historyStep + 1;
            setHistoryStep(newStep);
            return history[newStep];
        }
        return null;
    };

    const clearHistory = () => {
        setHistory([[]]);
        setHistoryStep(0);
    };

    return {
        saveHistory,
        undo,
        redo,
        clearHistory,
        canUndo: historyStep > 0,
        canRedo: historyStep < history.length - 1
    };
};
