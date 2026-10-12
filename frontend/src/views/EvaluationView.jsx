import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Play, 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Layers, 
  Info,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../api';

export default function EvaluationView({ onRefreshStats }) {
  const [benchmarkQuestions, setBenchmarkQuestions] = useState([]);
  const [evaluationReport, setEvaluationReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [topK, setTopK] = useState(4);
  const [pastRuns, setPastRuns] = useState([]);

  useEffect(() => {
    loadBenchmark();
    loadPastRuns();
  }, []);

  const loadBenchmark = async () => {
    try {
      const res = await api.getBenchmark();
      setBenchmarkQuestions(res.benchmark_questions || []);
    } catch (err) {
      console.error('Failed to load benchmark questions:', err);
    }
  };

  const loadPastRuns = async () => {
    try {
      const res = await api.getEvaluationRuns();
      setPastRuns(res.runs || []);
    } catch (err) {
      console.error('Failed to load runs:', err);
    }
  };

  const handleRunEvaluation = async () => {
    setLoading(true);
    try {
      const report = await api.runEvaluation(topK);
      setEvaluationReport(report);
      loadPastRuns();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      alert(`Benchmark execution failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!evaluationReport || !evaluationReport.test_cases) return;
    const headers = ["ID", "Category", "Question", "Expected Answer", "RAG Answer", "Precision", "Recall", "F1", "Groundedness", "Hallucination Rate", "Latency_ms"];
    const rows = evaluationReport.test_cases.map((t, idx) => [
      `q${idx + 1}`,
      `"${t.category || 'General'}"`,
      `"${t.question.replace(/"/g, '""')}"`,
      `"${t.expected_answer.replace(/"/g, '""')}"`,
      `"${t.rag.answer.replace(/"/g, '""')}"`,
      t.retrieval_metrics.precision,
      t.retrieval_metrics.recall,
      t.retrieval_metrics.f1,
      t.rag.groundedness,
      t.rag.hallucination_rate,
      t.total_time_ms
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rag_evaluation_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    if (!evaluationReport) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(evaluationReport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `rag_evaluation_report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const categories = ['All', ...new Set(benchmarkQuestions.map(q => q.category))];

  const filteredTestCases = evaluationReport?.test_cases?.filter(tc => {
    if (selectedCategory === 'All') return true;
    return tc.category === selectedCategory;
  }) || [];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Controller Card */}
      <div className="p-6 rounded-xl bg-dark-card border border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Empirical Evaluation Engine</span>
          </div>
          <h3 className="text-base font-bold text-white">RAG Benchmark Studio</h3>
          <p className="text-xs text-gray-400 max-w-xl">
            Execute a multi-metric evaluation across {benchmarkQuestions.length} enterprise test cases.
            Calculates exact Precision@K, Recall@K, F1-Score, MRR, Context Faithfulness, and Hallucination Reduction without fabricated data.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-300 bg-gray-900 px-3 py-2 rounded-lg border border-gray-800">
            <span>Top-K:</span>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-transparent text-white font-mono font-semibold focus:outline-none"
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="6">6</option>
            </select>
          </div>

          <button
            onClick={handleRunEvaluation}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Evaluating Suite...' : 'Run Benchmark'}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards (When report is available) */}
      {evaluationReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Precision */}
            <div className="p-4 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-[11px] text-gray-400">Precision@{topK}</span>
              <p className="text-xl font-bold text-blue-400 mt-1">
                {(evaluationReport.retrieval.precision * 100).toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-500">Relevant retrieved</span>
            </div>

            {/* Recall */}
            <div className="p-4 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-[11px] text-gray-400">Recall@{topK}</span>
              <p className="text-xl font-bold text-indigo-400 mt-1">
                {(evaluationReport.retrieval.recall * 100).toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-500">Ground truth coverage</span>
            </div>

            {/* F1 */}
            <div className="p-4 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-[11px] text-gray-400">F1-Score</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">
                {(evaluationReport.retrieval.f1 * 100).toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-500">Harmonic mean</span>
            </div>

            {/* MRR */}
            <div className="p-4 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-[11px] text-gray-400">MRR</span>
              <p className="text-xl font-bold text-purple-400 mt-1">
                {evaluationReport.retrieval.mrr.toFixed(3)}
              </p>
              <span className="text-[10px] text-gray-500">Mean Recip. Rank</span>
            </div>

            {/* Groundedness */}
            <div className="p-4 rounded-xl bg-dark-card border border-dark-border">
              <span className="text-[11px] text-gray-400">Faithfulness</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">
                {(evaluationReport.rag_generation.avg_groundedness * 100).toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-500">Context backed</span>
            </div>

            {/* Hallucination Reduction */}
            <div className="p-4 rounded-xl bg-dark-card border border-emerald-500/30 bg-emerald-500/5">
              <span className="text-[11px] text-emerald-400 font-medium">Hallucination Drop</span>
              <p className="text-xl font-black text-emerald-400 mt-1">
                {evaluationReport.comparison.hallucination_reduction_pct}%
              </p>
              <span className="text-[10px] text-emerald-500/80">vs Ungrounded LLM</span>
            </div>
          </div>

          {/* Export & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-dark-card border border-dark-border">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">Category Filter:</span>
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      selectedCategory === c
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs text-gray-200 font-medium flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={exportJSON}
                className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs text-gray-200 font-medium flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Test Cases Table */}
          <div className="rounded-xl bg-dark-card border border-dark-border overflow-hidden">
            <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Benchmark Test Cases Breakdown</h4>
                <p className="text-xs text-gray-400">{filteredTestCases.length} individual evaluation evaluations logged</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-900/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-dark-border">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Question & Ground Truth</th>
                    <th className="px-4 py-3">RAG Answer</th>
                    <th className="px-4 py-3">Precision@K</th>
                    <th className="px-4 py-3">Faithfulness</th>
                    <th className="px-4 py-3">Hallucination</th>
                    <th className="px-4 py-3">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-gray-300">
                  {filteredTestCases.map((tc, idx) => (
                    <tr key={idx} className="hover:bg-gray-900/40 transition">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-900 border border-gray-800 text-gray-300">
                          {tc.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 max-w-xs space-y-1">
                        <p className="font-medium text-white">{tc.question}</p>
                        <p className="text-[11px] text-gray-500 italic">Expected: {tc.expected_answer}</p>
                      </td>
                      <td className="px-4 py-4 max-w-sm">
                        <div className="p-2 rounded bg-black/40 border border-gray-900 text-[11px] text-gray-300 line-clamp-3">
                          {tc.rag.answer}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono">
                        <span className={`font-semibold ${tc.retrieval_metrics.precision >= 0.5 ? 'text-blue-400' : 'text-gray-400'}`}>
                          {(tc.retrieval_metrics.precision * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono">
                        <span className={`font-semibold ${tc.rag.groundedness >= 0.7 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {(tc.rag.groundedness * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {tc.rag.hallucination_rate <= 0.3 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" /> None
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> High
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono text-gray-400 whitespace-nowrap">
                        {tc.total_time_ms} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Methodology & Scientific Transparency */}
      <div className="p-6 rounded-xl bg-gray-900/30 border border-gray-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
          <Info className="w-4 h-4 text-blue-400" />
          <span>Evaluation Methodology & Scientific Limitations</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Metrics are computed empirically on actual queries executing through the FAISS index and sentence embeddings.
          Precision@K and Recall@K measure whether retrieved chunks match annotated source document identifiers.
          Context Faithfulness calculates the proportion of claims backed by retrieved text.
          Out-of-domain questions intentionally test the system's ability to abstain ("Information not found") rather than hallucinating policies.
        </p>
      </div>
    </div>
  );
}
