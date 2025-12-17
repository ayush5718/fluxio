
import { ExcalidrawElement, Point, ResizeHandle } from "../types";
import { getSnapPoints, getResizeHandles } from "./geometry";

export const getFontFamilyString = (fontFamily?: number) => {
    switch (fontFamily) {
        case 2: return '"Inter", sans-serif';
        case 3: return '"JetBrains Mono", monospace';
        default: return '"Kalam", cursive';
    }
};

export const getFontString = ({ fontSize, fontFamily, fontWeight, fontStyle }: { fontSize: number, fontFamily: number, fontWeight?: number, fontStyle?: string }) => {
    const family = getFontFamilyString(fontFamily);
    const style = fontStyle || 'normal';
    const weight = fontWeight || 400;
    return `${style} ${weight} ${fontSize}px ${family}`;
};

/**
 * Splits text into lines based on maxWidth.
 * If maxWidth is not provided or 0, returns the original lines.
 */
export const wrapText = (text: string, font: string, maxWidth?: number) => {
    // If maxWidth is too small (e.g. newly created text), don't wrap tightly
    if (!maxWidth || maxWidth < 20) return text.split('\n');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return text.split('\n');
    ctx.font = font;

    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
            lines.push('');
            continue;
        }

        const words = paragraph.split(' ');
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
    }
    return lines;
};

export const measureText = (text: string, fontSize: number, fontFamily: number, fontWeight?: number, fontStyle?: string, maxWidth?: number) => {
    const font = getFontString({ fontSize, fontFamily, fontWeight, fontStyle });
    const lines = wrapText(text, font, maxWidth);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width: 0, height: 0, actualWidth: 0 };
    ctx.font = font;

    let calculatedWidth = 0;
    lines.forEach(line => {
        calculatedWidth = Math.max(calculatedWidth, ctx.measureText(line).width);
    });

    // Line height multiplier
    const lineHeight = fontSize * 1.25;
    const height = lines.length * lineHeight;

    // If maxWidth is provided, use it as width, otherwise use actual width
    return { width: maxWidth || calculatedWidth, height, actualWidth: calculatedWidth };
};

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, pan: { x: number, y: number }, zoom: number) => {
    const gridSize = 20 * zoom;
    const offsetX = pan.x % gridSize;
    const offsetY = pan.y % gridSize;

    ctx.save();
    ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#333' : '#f1f5f9';

    for (let x = offsetX; x < width; x += gridSize) {
        for (let y = offsetY; y < height; y += gridSize) {
            ctx.fillRect(x, y, 1 * zoom, 1 * zoom);
        }
    }
    ctx.restore();
};

const drawLockIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ef4444";

    // Simple lock shape
    const w = size;
    const h = size * 0.8;

    // Body
    ctx.fillRect(-w / 2, -h / 2 + h * 0.3, w, h * 0.7);

    // Shackle
    ctx.beginPath();
    ctx.arc(0, -h / 2 + h * 0.3, w * 0.3, Math.PI, 0);
    ctx.lineWidth = w * 0.15;
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();

    ctx.restore();
};

// --- Welcome Screen Logic ---
// --- Welcome Screen Logic ---
const drawWelcomeScreen = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const isDark = document.documentElement.classList.contains('dark');
    const primaryColor = isDark ? '#a78bfa' : '#7c3aed'; // Violet-ish
    const textColor = isDark ? '#94a3b8' : '#64748b'; // Gray-500
    const hintColor = isDark ? '#cbd5e1' : '#475569'; // Simple Hint Text

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 1. Center Logo Text
    ctx.font = 'bold 80px "Kalam", cursive';
    ctx.fillStyle = primaryColor;
    ctx.fillText("FLUXIO", width / 2, height / 2 - 80);

    // 2. Subtitle
    ctx.font = '24px "Kalam", cursive';
    ctx.fillStyle = textColor;
    ctx.fillText("AI-Enhanced Virtual Whiteboard", width / 2, height / 2 - 10);
    ctx.fillText("Your data is saved locally in your browser.", width / 2, height / 2 + 25);

    // 3. Simple Centered Help Text
    ctx.font = '16px "Inter", sans-serif';
    ctx.fillStyle = hintColor;

    let infoY = height / 2 + 100;
    const spacing = 28;

    const infoLines = [
        "Pick a tool from the top toolbar to start drawing.",
        "Use the menu (top-right) for background & dark mode.",
        "Need help? Click the question mark at the bottom-right."
    ];

    infoLines.forEach(line => {
        ctx.fillText(line, width / 2, infoY);
        infoY += spacing;
    });

    ctx.restore();
};

const isLight = (color: string) => {
    // Simple luminance check for text color contrast
    // This is a very basic approximation and might not be accurate for all colors
    const hex = color.startsWith('#') ? color.slice(1) : color;
    if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 128;
    } else if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 128;
    }
    return false; // Default to dark if color format is unknown
};

const drawText = (ctx: CanvasRenderingContext2D, element: ExcalidrawElement) => {
    const fontSize = element.fontSize || 20;
    const font = getFontString({
        fontSize,
        fontFamily: element.fontFamily || 1,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle
    });
    ctx.font = font;
    ctx.fillStyle = element.strokeColor;
    ctx.textBaseline = "top";

    // Use element width for wrapping
    const lines = wrapText(element.text || "", font, element.width);
    const lineHeight = fontSize * 1.25;

    lines.forEach((line, index) => {
        const lineWidth = ctx.measureText(line).width;
        let xOffset = 0;

        // Text Alignment
        if (element.textAlign === 'center') {
            xOffset = (element.width - lineWidth) / 2;
        } else if (element.textAlign === 'right') {
            xOffset = element.width - lineWidth;
        }

        ctx.fillText(line, element.x + xOffset, element.y + index * lineHeight);
    });
};

import rough from 'roughjs/bin/rough';

// ... (existing helper functions like getFontString, etc.)

export const renderScene = (
    ctx: CanvasRenderingContext2D,
    elements: ExcalidrawElement[],
    pan: { x: number; y: number },
    zoom: number,
    selectionIds: string[] = [],
    highlightedElementId: string | null = null,
    selectionBox: { x: number; y: number; width: number; height: number } | null = null,
    laserTrails: { x: number; y: number; time: number }[][] = [],
    editingElementId: string | null = null,
    showSnapPoints: boolean = false,
    theme: 'light' | 'dark' = 'light'
) => {
    // Clear canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw Grid
    drawGrid(ctx, ctx.canvas.width, ctx.canvas.height, pan, zoom);

    // If canvas is empty, draw welcome screen
    if (elements.length === 0) {
        drawWelcomeScreen(ctx, ctx.canvas.width / (window.devicePixelRatio || 1), ctx.canvas.height / (window.devicePixelRatio || 1));
    }

    ctx.restore();

    // Apply Pan and Zoom
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Initialize RoughJS
    const rc = rough.canvas(ctx.canvas);

    // Frame Map for Clipping Lookup
    const frameMap = new Map<string, ExcalidrawElement>();
    elements.forEach((el) => {
        if (el.type === 'frame') frameMap.set(el.id, el);
    });

    elements.forEach((element) => {
        // Skip if editing, but for Frames/Text we have specific logic
        if (editingElementId === element.id && element.type === 'text') return;

        ctx.save();
        ctx.globalAlpha = element.opacity / 100;

        // --- Frame Clipping Logic ---
        if (element.frameId) {
            const frame = frameMap.get(element.frameId);
            if (frame) {
                ctx.beginPath();
                // Match the frame's rounded corner radius (8px)
                // @ts-ignore
                if (ctx.roundRect) ctx.roundRect(frame.x, frame.y, frame.width, frame.height, 8);
                else ctx.rect(frame.x, frame.y, frame.width, frame.height);
                ctx.clip();
            }
        }

        // --- Adaptive Color Logic ---
        let adaptiveStrokeColor = element.strokeColor;
        let adaptiveBackgroundColor = element.backgroundColor;

        if (theme === 'dark') {
            if (element.strokeColor === '#000000' || element.strokeColor === 'black') {
                adaptiveStrokeColor = '#ffffff';
            }
            if (element.backgroundColor === '#000000' || element.backgroundColor === 'black') {
                adaptiveBackgroundColor = '#ffffff';
            }
        } else {
            if (element.strokeColor === '#ffffff' || element.strokeColor === 'white') {
                adaptiveStrokeColor = '#000000';
            }
            if (element.backgroundColor === '#ffffff' || element.backgroundColor === 'white') {
                adaptiveBackgroundColor = '#000000';
            }
        }

        // RoughJS Options
        const options = {
            seed: element.seed, // Deterministic Rendering!
            stroke: adaptiveStrokeColor,
            strokeWidth: element.strokeWidth,
            fill: adaptiveBackgroundColor !== 'transparent' ? adaptiveBackgroundColor : undefined,
            fillStyle: element.fillStyle || 'hachure', // Dynamic Fill Style
            fillWeight: element.strokeWidth / 2, // Adjust fill density
            hachureGap: 4,
            roughness: 1,
            bowing: 1,
            strokeLineDash: element.strokeStyle === 'dashed' ? [element.strokeWidth * 4, element.strokeWidth * 4] :
                element.strokeStyle === 'dotted' ? [element.strokeWidth, element.strokeWidth * 2] : undefined
        };

        if (element.type === 'text') {
            ctx.setLineDash([]);
            ctx.textBaseline = "top";
            ctx.fillStyle = adaptiveStrokeColor; // Use adaptive color for text too
            const fontSize = element.fontSize || 20;
            const font = getFontString({
                fontSize,
                fontFamily: element.fontFamily || 1,
                fontWeight: element.fontWeight,
                fontStyle: element.fontStyle
            });
            ctx.font = font;
            drawText(ctx, element);
        } else if (element.type === 'rectangle') {
            rc.rectangle(element.x, element.y, element.width, element.height, options);
        } else if (element.type === 'frame') {
            // Frames remain CLEAN and STRUCTURAL
            ctx.save();
            const frameColor = "#a8a29e";
            ctx.strokeStyle = frameColor;
            ctx.lineWidth = 1;

            const radius = 8;
            ctx.beginPath();
            // @ts-ignore
            if (ctx.roundRect) ctx.roundRect(element.x, element.y, element.width, element.height, radius);
            else ctx.rect(element.x, element.y, element.width, element.height);

            // Background for frame if set
            if (element.backgroundColor !== 'transparent') {
                // Frame background disabled as per user request
                // ctx.fillStyle = adaptiveBackgroundColor;
                // ctx.fill();
            }
            ctx.stroke();

            // Label
            if (element.name) {
                ctx.font = `bold ${14 / zoom}px "Inter", sans-serif`;
                ctx.fillStyle = frameColor;
                ctx.fillText(element.name, element.x, element.y - (12 / zoom));
            }
            ctx.restore();
        } else if (element.type === 'ellipse') {
            rc.ellipse(
                element.x + element.width / 2,
                element.y + element.height / 2,
                element.width,
                element.height,
                options
            );
        } else if (element.type === 'diamond') {
            const width = element.width;
            const height = element.height;
            rc.polygon([
                [element.x + width / 2, element.y],
                [element.x + width, element.y + height / 2],
                [element.x + width / 2, element.y + height],
                [element.x, element.y + height / 2]
            ], options);
        } else if (element.type === 'arrow' || element.type === 'line') {
            // For linear elements, we use RoughJS for the main path
            // But we need to handle points carefully
            if (element.points && element.points.length > 0) {
                const points = element.points.map(p => [element.x + p.x, element.y + p.y] as [number, number]);

                // Use linearPath for open lines/arrows
                rc.linearPath(points, options);

                // Arrowhead
                if (element.type === "arrow") {
                    const last = element.points[element.points.length - 1];
                    const prev = element.points[element.points.length - 2];
                    const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
                    const headLen = Math.min(20, Math.max(10, element.strokeWidth * 4));

                    // Calculate arrow head points
                    const x2 = element.x + last.x;
                    const y2 = element.y + last.y;
                    const x1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
                    const y1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
                    const x3 = x2 - headLen * Math.cos(angle + Math.PI / 6);
                    const y3 = y2 - headLen * Math.sin(angle + Math.PI / 6);

                    rc.linearPath([[x1, y1], [x2, y2], [x3, y3]], options);
                }
            }
        } else if (element.type === 'freedraw') {
            if (element.points && element.points.length > 0) {
                ctx.strokeStyle = adaptiveStrokeColor;
                ctx.lineWidth = element.strokeWidth;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(element.x + element.points[0].x, element.y + element.points[0].y);
                for (let i = 1; i < element.points.length; i++) {
                    ctx.lineTo(element.x + element.points[i].x, element.y + element.points[i].y);
                }
                ctx.stroke();
            }
        }
        ctx.restore();
    });

    // --- Selection UI ---
    elements.forEach(element => {
        if (selectionIds.includes(element.id)) {
            ctx.save();
            const selectionColor = element.isLocked ? "#ef4444" : "#8b5cf6";
            ctx.strokeStyle = selectionColor;
            ctx.lineWidth = 1 / zoom;
            ctx.setLineDash([]);

            const buffer = 8 / zoom;
            const isLinear = element.type === 'line' || element.type === 'arrow';

            // Draw Resize Handles
            if (selectionIds.length === 1 && !element.isLocked) {
                // Draw Selection Border (Padded Box)
                if (!isLinear) {
                    const cx = element.x + element.width / 2;
                    const cy = element.y + element.height / 2;
                    const p = buffer;

                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(element.angle || 0);

                    ctx.beginPath();
                    // Use roundRect for Excalidraw-like smoothed corners
                    // @ts-ignore
                    if (ctx.roundRect) {
                        ctx.roundRect(
                            -element.width / 2 - p,
                            -element.height / 2 - p,
                            element.width + p * 2,
                            element.height + p * 2,
                            8 / zoom
                        );
                    } else {
                        ctx.rect(
                            -element.width / 2 - p,
                            -element.height / 2 - p,
                            element.width + p * 2,
                            element.height + p * 2
                        );
                    }
                    ctx.stroke();
                    ctx.restore();
                }

                const handles = getResizeHandles(element);
                const handleSize = 8 / zoom;

                ctx.strokeStyle = selectionColor;
                ctx.lineWidth = 1 / zoom;

                const keys = Object.keys(handles) as ResizeHandle[];

                keys.forEach(key => {
                    // @ts-ignore
                    const p = handles[key];
                    let hx = p.x;
                    let hy = p.y;

                    if (!isLinear && !(typeof key === 'string' && key.startsWith('p:'))) {
                        if (key.includes('w')) hx -= buffer;
                        if (key.includes('e')) hx += buffer;
                        if (key.includes('n')) hy -= buffer;
                        if (key.includes('s')) hy += buffer;
                    }

                    ctx.beginPath();
                    if (typeof key === 'string' && (key.startsWith('p:') || key.startsWith('m:'))) {
                        // ... line handles ...
                        const isMid = key.startsWith('m:');
                        if (isMid) {
                            ctx.fillStyle = selectionColor;
                            ctx.globalAlpha = 0.5;
                            ctx.arc(hx, hy, handleSize / 2, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.globalAlpha = 1.0;
                        } else {
                            ctx.fillStyle = "#ffffff";
                            ctx.arc(hx, hy, handleSize / 1.5, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.stroke();
                        }
                    } else if (!isLinear) {
                        ctx.fillStyle = "#ffffff";
                        ctx.roundRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize, 2 / zoom);
                        ctx.fill();
                        ctx.stroke();

                        // --- Smart Connector Hints (N, E, S, W) ---
                        // Only draw if key is n, e, s, w
                        if (['n', 'e', 's', 'w'].includes(key as string)) {
                            const offset = 12 / zoom; // Distance from resize handle
                            ctx.beginPath();
                            ctx.fillStyle = selectionColor;

                            // Draw small triangle pointing out
                            const arrowSize = 4 / zoom;
                            let ax = hx, ay = hy;

                            if (key === 'n') ay -= offset;
                            if (key === 's') ay += offset;
                            if (key === 'w') ax -= offset;
                            if (key === 'e') ax += offset;

                            // Draw triangle/caret
                            if (key === 'n') {
                                ctx.moveTo(ax, ay - arrowSize);
                                ctx.lineTo(ax - arrowSize, ay + arrowSize);
                                ctx.lineTo(ax + arrowSize, ay + arrowSize);
                            } else if (key === 's') {
                                ctx.moveTo(ax, ay + arrowSize);
                                ctx.lineTo(ax - arrowSize, ay - arrowSize);
                                ctx.lineTo(ax + arrowSize, ay - arrowSize);
                            } else if (key === 'w') {
                                ctx.moveTo(ax - arrowSize, ay);
                                ctx.lineTo(ax + arrowSize, ay - arrowSize);
                                ctx.lineTo(ax + arrowSize, ay + arrowSize);
                            } else if (key === 'e') {
                                ctx.moveTo(ax + arrowSize, ay);
                                ctx.lineTo(ax - arrowSize, ay - arrowSize);
                                ctx.lineTo(ax - arrowSize, ay + arrowSize);
                            }
                            ctx.fill();
                        }
                    }
                });
            }
            ctx.restore();
        }
    });

    // Draw Snap Points on Highlighted Element
    if (highlightedElementId && showSnapPoints) {
        const element = elements.find(el => el.id === highlightedElementId);
        if (element && !element.isLocked && !selectionIds.includes(element.id)) {
            const snapPoints = getSnapPoints(element);
            ctx.save();
            ctx.fillStyle = "#a855f7";
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2 / zoom;

            snapPoints.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5 / zoom, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            });
            ctx.restore();
        }
    }

    // Draw Selection Box
    if (selectionBox) {
        ctx.save();
        ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 1 / zoom;
        ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
        ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
        ctx.restore();
    }

    // Draw Laser
    if (laserTrails.length > 0) {
        const now = Date.now();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        laserTrails.forEach(trail => {
            if (trail.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(trail[0].x, trail[0].y);
            for (let i = 1; i < trail.length; i++) {
                const point = trail[i];
                const age = now - point.time;
                const opacity = Math.max(0, 1 - age / 1000);
                if (opacity <= 0) continue;
                ctx.beginPath();
                if (i > 0) ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
                ctx.lineTo(point.x, point.y);
                ctx.strokeStyle = `rgba(220, 38, 38, ${opacity})`;
                ctx.lineWidth = 4 / zoom;
                ctx.stroke();
            }
        });
    }

    ctx.restore();
};
