
import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { ARCHITECTURE_ICONS } from '../utils/icons';

interface IconLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectIcon: (iconId: string) => void;
}

const IconLibrary: React.FC<IconLibraryProps> = ({ isOpen, onClose, onSelectIcon }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');

    if (!isOpen) return null;

    const categories = ['all', ...Array.from(new Set(ARCHITECTURE_ICONS.map(i => i.category)))];

    const filteredIcons = ARCHITECTURE_ICONS.filter(icon => {
        const matchesSearch = icon.label.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || icon.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col h-[70vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">Architecture Icons</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X size={20} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search icons..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand outline-none text-sm"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors
                            ${selectedCategory === cat
                                        ? 'bg-brand/10 text-brand'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}
                        `}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50 dark:bg-black/20">
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                        {filteredIcons.map(icon => (
                            <button
                                key={icon.id}
                                onClick={() => onSelectIcon(icon.id)}
                                className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all shadow-sm hover:shadow-md"
                            >
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110"
                                    style={{ backgroundColor: icon.defaultColor }}
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d={icon.path} />
                                    </svg>
                                </div>
                                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 text-center leading-tight">
                                    {icon.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default IconLibrary;
