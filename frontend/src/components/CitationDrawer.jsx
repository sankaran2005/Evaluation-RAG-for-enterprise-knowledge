import React from 'react';
import { X, BookOpen, ExternalLink, Percent, ShieldCheck } from 'lucide-react';

export default function CitationDrawer({ isOpen, onClose, citations, question }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-card border border-dark-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between bg-gray-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Verified Source Citations</h3>
              <p className="text-xs text-gray-400">{citations.length} corporate references grounding this response</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {citations.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              No citations attached to this response. The information might not have been found in the documents.
            </div>
          ) : (
            citations.map((cite, index) => (
              <div
                key={cite.chunk_id || index}
                className="p-4 rounded-lg bg-gray-900/70 border border-gray-800 space-y-2 hover:border-gray-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-[11px] font-bold">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-gray-200">
                      {cite.document}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {Math.round((cite.similarity_score || 0.85) * 100)}% Match
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      Page {cite.page || 1}
                    </span>
                  </div>
                </div>

                <div className="bg-black/50 p-3 rounded-lg border border-gray-800/80">
                  <p className="text-xs text-gray-300 italic leading-relaxed">
                    "{cite.quote}"
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                  <span>Chunk Reference: {cite.chunk_id}</span>
                  <span>Rank #{cite.rank || index + 1}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
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
