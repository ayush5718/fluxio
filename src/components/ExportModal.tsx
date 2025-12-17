import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Copy, Image as ImageIcon, Check, MousePointer2, Monitor } from 'lucide-react';
import { ExcalidrawElement } from '../types';
import { exportToCanvas } from '../utils/renderer';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    elements: ExcalidrawElement[];
    selectedElementIds: string[];
    viewBackgroundColor: string;
    theme: 'light' | 'dark';
}

const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    elements,
    selectedElementIds,
    viewBackgroundColor,
    theme
}) => {
    const [exportBackground, setExportBackground] = useState(true);
    const [customColor, setCustomColor] = useState(viewBackgroundColor);
    const [exportPadding, setExportPadding] = useState(20);
    const [exportSelectionOnly, setExportSelectionOnly] = useState(selectedElementIds.length > 0);
    const [copied, setCopied] = useState(false);

    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const getElementsToExport = () => {
        if (exportSelectionOnly) {
            return elements.filter(el => selectedElementIds.includes(el.id));
        }
        return elements;
    };

    useEffect(() => {
        if (!isOpen) return;

        const elementsToExport = getElementsToExport();
        if (elementsToExport.length === 0) return;

        const canvas = exportToCanvas(elementsToExport, {
            exportBackground,
            viewBackgroundColor: customColor,
            exportPadding,
            theme
        });

        const previewCanvas = previewCanvasRef.current;
        if (previewCanvas) {
            const ctx = previewCanvas.getContext('2d');
            if (ctx) {
                previewCanvas.width = canvas.width;
                previewCanvas.height = canvas.height;
                ctx.drawImage(canvas, 0, 0);
            }
        }
    }, [isOpen, exportBackground, customColor, exportPadding, exportSelectionOnly, elements, selectedElementIds, theme]);

    if (!isOpen) return null;

    const handleDownload = () => {
        const elementsToExport = getElementsToExport();
        const canvas = exportToCanvas(elementsToExport, {
            exportBackground,
            viewBackgroundColor: customColor,
            exportPadding,
            theme
        });

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `fluxio-export-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
    };

    const handleCopy = async () => {
        const elementsToExport = getElementsToExport();
        const canvas = exportToCanvas(elementsToExport, {
            exportBackground,
            viewBackgroundColor: customColor,
            exportPadding,
            theme
        });

        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                } catch (err) {
                    console.error('Failed to copy image to clipboard:', err);
                    alert('Failed to copy image to clipboard. Try downloading instead.');
                }
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={containerRef}
                className="bg-white dark:bg-[#1e1e1e] w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Left Side: Preview */}
                <div className="flex-1 bg-gray-100 dark:bg-[#121212] p-8 flex items-center justify-center min-h-[300px] overflow-auto border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800">
                    <div className="relative shadow-lg max-w-full max-h-full">
                        <canvas
                            ref={previewCanvasRef}
                            className="max-w-full max-h-full object-contain rounded-sm"
                            style={{
                                backgroundImage: !exportBackground ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)' : 'none',
                                backgroundSize: '20px 20px'
                            }}
                        />
                    </div>
                </div>

                {/* Right Side: Options */}
                <div className="w-full md:w-80 p-6 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-indigo-500" />
                            Export Image
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4 flex-1">
                        {/* Area Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider">EXPORT AREA</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setExportSelectionOnly(false)}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${!exportSelectionOnly ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}
                                >
                                    <Monitor className="w-4 h-4" /> Scene
                                </button>
                                <button
                                    onClick={() => setExportSelectionOnly(true)}
                                    disabled={selectedElementIds.length === 0}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${exportSelectionOnly ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'} ${selectedElementIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <MousePointer2 className="w-4 h-4" /> Selection
                                </button>
                            </div>
                        </div>

                        {/* Background Options */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider">BACKGROUND</label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={exportBackground}
                                        onChange={(e) => setExportBackground(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 bg-transparent"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Include background</span>
                                </label>
                            </div>

                            {exportBackground && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {['#ffffff', '#f8f9fa', '#121212', '#f0f4ff', '#fffcf0'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setCustomColor(color)}
                                            className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${customColor === color ? 'border-indigo-500 scale-110' : 'border-transparent shadow-sm'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={customColor}
                                        onChange={(e) => setCustomColor(e.target.value)}
                                        className="w-8 h-8 rounded-full p-0 border-0 bg-transparent cursor-pointer hover:scale-110 transition-transform"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Padding Scale */}
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between">
                                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider">PADDING</label>
                                <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{exportPadding}px</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={exportPadding}
                                onChange={(e) => setExportPadding(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={handleCopy}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold transition-all shadow-sm"
                        >
                            {copied ? (
                                <><Check className="w-4 h-4 text-green-500" /> Copied!</>
                            ) : (
                                <><Copy className="w-4 h-4" /> Copy PNG to Clipboard</>
                            )}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-md active:scale-95"
                        >
                            <Download className="w-4 h-4" /> Download PNG
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
