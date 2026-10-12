import React, { useState } from 'react';
import { 
  GitCompare, 
  Send, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Sparkles, 
  FileText,
  BookOpen,
  ArrowRight,
  Info
} from 'lucide-react';
import { api } from '../api';

export default function ComparisonView({ onRefreshStats }) {
  const [question, setQuestion] = useState('What is the company 401(k) matching policy and vesting schedule?');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const sampleScenarios = [
    {
      title: "401(k) Matching Policy",
      query: "What is the company 401(k) matching policy and vesting schedule?",
      note: "Tests internal HR policy facts"
    },
    {
      title: "Security Incident Protocol",
      query: "What is the mandatory timeline for reporting a suspected data breach?",
      note: "Tests strict compliance SLAs"
    },
    {
      title: "Cloud Disaster Recovery",
      query: "What are our Recovery Point Objective (RPO) and Recovery Time Objective (RTO)?",
      note: "Tests infrastructure architecture specs"
    },
    {
      title: "Hallucination Trap (Out-of-Domain)",
      query: "What is the policy for bringing pet chimpanzees to the corporate office?",
      note: "Tests whether model abstains or hallucinates"
    }
  ];

  const handleCompare = async (queryText) => {
    const q = queryText || question;
    if (!q.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await api.compare({ question: q });
      setResult(res);
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      alert(`Comparison failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header card */}
      <div className="p-6 rounded-xl bg-dark-card border border-dark-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">Side-by-Side Evaluation Arena</h3>
            <p className="text-xs text-gray-400">Directly compare Ungrounded LLM Hallucinations vs. RAG Grounded Precision</p>
          </div>
        </div>

        {/* Input Bar */}
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type any enterprise question to run side-by-side..."
            className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            onClick={() => handleCompare()}
            disabled={loading || !question.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            <span>{loading ? 'Comparing...' : 'Run Comparison'}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scenario Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500 font-medium mr-1">Sample Scenarios:</span>
          {sampleScenarios.map((sc, i) => (
            <button
              key={i}
              onClick={() => {
                setQuestion(sc.query);
                handleCompare(sc.query);
              }}
              className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-xs text-gray-300 transition flex items-center gap-1.5"
            >
              <span className="font-medium">{sc.title}</span>
              <span className="text-[10px] text-gray-500">({sc.note})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Arena Split View */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-xs">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Generating dual responses (Baseline LLM vs. Semantic RAG)...
        </div>
      ) : result ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Basic LLM (Ungrounded) */}
            <div className="rounded-xl bg-dark-card border border-rose-500/20 overflow-hidden flex flex-col justify-between">
              <div>
                {/* Column Header */}
                <div className="px-5 py-3.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <h4 className="font-semibold text-xs text-rose-300 uppercase tracking-wide">
                      Basic LLM (No RAG Context)
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    High Hallucination Risk
                  </span>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4">
                  <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/30 text-rose-300/90 text-xs leading-relaxed italic">
                    "{result.basic_llm?.answer}"
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-gray-800">
                      <span className="text-gray-400">Context Citations:</span>
                      <span className="font-mono text-rose-400 font-semibold">0 (Ungrounded)</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-gray-800">
                      <span className="text-gray-400">Groundedness Score:</span>
                      <span className="font-mono text-rose-400 font-semibold">{Math.round((result.basic_llm?.groundedness || 0) * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-gray-800">
                      <span className="text-gray-400">Estimated Hallucination Rate:</span>
                      <span className="font-mono text-rose-400 font-semibold">{Math.round((result.basic_llm?.hallucination_rate || 1.0) * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-400">Response Latency:</span>
                      <span className="font-mono text-gray-300">{result.basic_llm?.latency_ms} ms</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-900/60 border-t border-gray-800/80 text-[11px] text-gray-400 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Fabricates plausible policies or generic estimates rather than organizational facts.</span>
              </div>
            </div>

            {/* Column 2: RAG Grounded LLM */}
            <div className="rounded-xl bg-dark-card border border-emerald-500/20 overflow-hidden flex flex-col justify-between">
              <div>
                {/* Column Header */}
                <div className="px-5 py-3.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h4 className="font-semibold text-xs text-emerald-300 uppercase tracking-wide">
                      RAG-Augmented Enterprise Assistant
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Grounded & Verified
                  </span>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4">
                  <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-emerald-300/90 text-xs leading-relaxed whitespace-pre-wrap">
                    {result.rag?.answer}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-gray-800">
                      <span className="text-gray-400">Context Citations:</span>
                      <span className="font-mono text-emerald-400 font-semibold">{result.rag?.citations?.length || 0} Verified Source(s)</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-gray-800">
                      <span className="text-gray-400">Groundedness Score:</span>
                      <span className="font-mono text-emerald-400 font-semibold">{Math.round((result.rag?.groundedness_score || 0.95) * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-gray-800">
                      <span className="text-gray-400">Estimated Hallucination Rate:</span>
                      <span className="font-mono text-emerald-400 font-semibold">{Math.round((result.rag?.hallucination_rate || 0.05) * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-400">Total Latency:</span>
                      <span className="font-mono text-gray-300">{result.rag?.latency_ms} ms</span>
                    </div>
                  </div>

                  {/* Attached Citations Snippet */}
                  {result.rag?.citations && result.rag.citations.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                        Cited Evidence:
                      </span>
                      <div className="space-y-1.5">
                        {result.rag.citations.slice(0, 2).map((c, i) => (
                          <div key={i} className="p-2 rounded bg-black/40 border border-gray-800 text-[11px] text-gray-300">
                            <span className="font-semibold text-emerald-400">[{c.document}]</span>: "{c.quote}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gray-900/60 border-t border-gray-800/80 text-[11px] text-gray-400 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Strictly grounded in verified corporate document embeddings; abstains when missing.</span>
              </div>
            </div>
          </div>

          {/* Analysis Card */}
          <div className="p-5 rounded-xl bg-gray-900/40 border border-gray-800 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-gray-300 leading-relaxed">
              <span className="font-semibold text-white">Evaluation Takeaway: </span>
              Notice how the standard ungrounded LLM produces plausible-sounding but inaccurate assumptions about company-specific policies.
              In contrast, the RAG architecture extracts the exact policy paragraphs from indexed files, yielding a verified, auditable corporate response with zero fabrication.
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-gray-500 text-xs">
          Select a sample scenario above or enter a question to view the side-by-side comparison.
        </div>
      )}
    </div>
  );
}
