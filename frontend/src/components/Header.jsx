import React from 'react';
import { Cpu, Zap, Activity, BookOpen, Layers } from 'lucide-react';

export default function Header({ activeTab, settings, stats }) {
  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Enterprise RAG Dashboard', subtitle: 'Live retrieval KPIs, document telemetry, and hallucination reduction' };
      case 'documents':
        return { title: 'Enterprise Knowledge Base', subtitle: 'Ingest PDF, DOCX, and TXT files with boundary-aware chunking' };
      case 'chat':
        return { title: 'AI Knowledge Assistant', subtitle: 'Accurate, source-grounded answers with verifiable citations' };
      case 'comparison':
        return { title: 'RAG vs Basic LLM Comparison', subtitle: 'Empirical side-by-side evaluation of hallucination mitigation' };
      case 'evaluation':
        return { title: 'Evaluation Studio & Benchmarks', subtitle: 'Precision@K, Recall@K, F1, MRR, and Groundedness metrics' };
      case 'settings':
        return { title: 'System & LLM Configuration', subtitle: 'Configure LLM providers, embedding models, and retrieval top-k' };
      default:
        return { title: 'Enterprise Knowledge Assistant', subtitle: 'Evaluating RAG for Enterprise Knowledge' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <header className="h-16 px-8 border-b border-dark-border bg-dark-bg/80 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight">{title}</h2>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Active Model Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-gray-400">LLM Provider:</span>
          <span className="font-semibold text-gray-200 uppercase text-[11px] tracking-wide">
            {settings?.default_llm_provider || 'local'}
          </span>
        </div>

        {/* Embedding Model */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-gray-400">Embeddings:</span>
          <span className="font-mono text-gray-200 text-[11px]">
            MiniLM-L6
          </span>
        </div>

        {/* System Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>System Ready</span>
        </div>
      </div>
    </header>
  );
}
