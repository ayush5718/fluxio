import React, { useRef } from 'react';
import { AppState, ExcalidrawElement, Point } from '../types';
import { useCanvas } from '../hooks/useCanvas';

interface CanvasContainerProps {
    elements: ExcalidrawElement[];
    tempElement: ExcalidrawElement | null;
    appState: AppState;
    theme: 'light' | 'dark';
    highlightedElementId: string | null;
    laserTrails: { x: number; y: number; time: number }[][];
    eraserTrail: Point[];
    cursorPos: Point | null;
    handleMouseDown: (e: React.MouseEvent) => void;
    handleMouseMove: (e: React.MouseEvent) => void;
    handleMouseUp: (e: React.MouseEvent) => void;
    handleDoubleClick: (e: React.MouseEvent) => void;
    handleContextMenu: (e: React.MouseEvent) => void;
}

const CanvasContainer: React.FC<CanvasContainerProps> = (props) => {
    const staticCanvasRef = useRef<HTMLCanvasElement>(null);
    const dynamicCanvasRef = useRef<HTMLCanvasElement>(null);

    useCanvas(staticCanvasRef, dynamicCanvasRef, props);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <canvas
                ref={staticCanvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 1,
                    pointerEvents: 'none' // Static canvas doesn't need to capture events
                }}
            />
            <canvas
                ref={dynamicCanvasRef}
                onMouseDown={props.handleMouseDown}
                onMouseMove={props.handleMouseMove}
                onMouseUp={props.handleMouseUp}
                onDoubleClick={props.handleDoubleClick}
                onContextMenu={props.handleContextMenu}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 2,
                    touchAction: 'none',
                    cursor: props.appState.tool === 'selection' ? undefined : (props.appState.tool === 'text' ? 'text' : 'crosshair')
                }}
            />
        </div>
    );
};

export default CanvasContainer;
