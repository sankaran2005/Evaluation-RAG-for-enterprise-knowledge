import React from 'react';
import { X, FileText, Layers, Hash } from 'lucide-react';

export default function ChunkModal({ isOpen, onClose, document, chunks, loading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-card border border-dark-border rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">{document?.filename || 'Document Chunks'}</h3>
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <span>{chunks.length} total chunks indexed</span>
                <span>•</span>
                <span>ID: {document?.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              Loading document chunks from vector index...
            </div>
          ) : chunks.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No chunks found for this document.
            </div>
          ) : (
            chunks.map((chunk, index) => (
              <div
                key={chunk.chunk_id || index}
                className="p-4 rounded-lg bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Chunk #{chunk.chunk_index !== undefined ? chunk.chunk_index : index}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      Page {chunk.page_number || 1}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    {chunk.char_length || chunk.text?.length || 0} chars • {chunk.word_count || chunk.text?.split(' ').length || 0} words
                  </span>
                </div>
                <div className="text-xs font-mono text-gray-300 leading-relaxed bg-black/40 p-3 rounded border border-gray-900 whitespace-pre-wrap">
                  {chunk.text}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-dark-border bg-gray-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
