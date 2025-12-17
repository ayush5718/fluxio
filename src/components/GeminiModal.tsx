import React, { useState } from "react";
import { generateDiagram } from "../services/geminiService";
import { ExcalidrawElement } from "../types";
import { X, Loader2, Sparkles } from "lucide-react";

interface GeminiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onElementsGenerated: (elements: ExcalidrawElement[]) => void;
}

const GeminiModal: React.FC<GeminiModalProps> = ({ isOpen, onClose, onElementsGenerated }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const elements = await generateDiagram(prompt);
      onElementsGenerated(elements);
      onClose();
      setPrompt("");
    } catch (err: any) {
      setError("Failed to generate diagram. Please check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-brand/10">
          <div className="flex items-center gap-2 text-brand">
            <Sparkles size={18} />
            <h2 className="font-bold">Gemini Diagram Gen</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Describe the diagram you want (e.g., "A flowchart for a user login system" or "Architecture of a React app").
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand outline-none resize-none dark:bg-gray-900 dark:text-white"
            autoFocus
          />

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || loading}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GeminiModal;
