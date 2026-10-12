import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Key, 
  Sliders, 
  Save, 
  CheckCircle, 
  Layers, 
  ShieldCheck,
  Server
} from 'lucide-react';
import { api } from '../api';

export default function SettingsView({ onRefreshSettings, currentSettings }) {
  const [provider, setProvider] = useState('local');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [topK, setTopK] = useState(4);
  const [threshold, setThreshold] = useState(0.35);
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(100);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      setProvider(currentSettings.default_llm_provider || 'local');
      setOllamaUrl(currentSettings.ollama_base_url || 'http://localhost:11434');
      setTopK(currentSettings.default_top_k || 4);
      setThreshold(currentSettings.similarity_threshold !== undefined ? currentSettings.similarity_threshold : 0.35);
      setChunkSize(currentSettings.chunk_size || 500);
      setChunkOverlap(currentSettings.chunk_overlap || 100);
    }
  }, [currentSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaveSuccess(false);

    try {
      await api.updateSettings({
        default_llm_provider: provider,
        gemini_api_key: geminiKey || undefined,
        openai_api_key: openaiKey || undefined,
        ollama_base_url: ollamaUrl,
        default_top_k: Number(topK),
        similarity_threshold: Number(threshold),
        chunk_size: Number(chunkSize),
        chunk_overlap: Number(chunkOverlap)
      });

      setSaveSuccess(true);
      if (onRefreshSettings) onRefreshSettings();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in pb-12">
      <div className="p-6 rounded-xl bg-dark-card border border-dark-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">System & LLM Settings</h3>
            <p className="text-xs text-gray-400">Tune the enterprise retrieval pipeline, LLM generation providers, and vector indexing thresholds.</p>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Settings successfully updated and applied to the active RAG runtime!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* LLM Provider Selection Card */}
        <div className="p-6 rounded-xl bg-dark-card border border-dark-border space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>LLM Generation Provider</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Local Engine */}
            <div 
              onClick={() => setProvider('local')}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                provider === 'local' 
                  ? 'border-blue-500 bg-blue-500/10 text-white' 
                  : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white">Local Built-In Engine</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">Recommended</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Deterministic contextual answer extraction. 100% free, zero external API keys needed, works offline.
              </p>
            </div>

            {/* Google Gemini */}
            <div 
              onClick={() => setProvider('gemini')}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                provider === 'gemini' 
                  ? 'border-blue-500 bg-blue-500/10 text-white' 
                  : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white">Google Gemini</span>
                <span className="text-[10px] text-gray-400 font-mono">gemini-1.5-flash</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Google DeepMind Gemini API with strict system guardrails for grounded synthesis.
              </p>
            </div>

            {/* OpenAI */}
            <div 
              onClick={() => setProvider('openai')}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                provider === 'openai' 
                  ? 'border-blue-500 bg-blue-500/10 text-white' 
                  : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white">OpenAI</span>
                <span className="text-[10px] text-gray-400 font-mono">gpt-4o-mini</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                OpenAI GPT-4o-mini with system grounding instructions.
              </p>
            </div>

            {/* Ollama */}
            <div 
              onClick={() => setProvider('ollama')}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                provider === 'ollama' 
                  ? 'border-blue-500 bg-blue-500/10 text-white' 
                  : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white">Ollama Local</span>
                <span className="text-[10px] text-gray-400 font-mono">llama3.2</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Self-hosted Ollama server endpoint running open weights on your machine.
              </p>
            </div>
          </div>

          {/* Conditional API Key Fields */}
          {provider === 'gemini' && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Gemini API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={currentSettings?.has_gemini_key ? "•••••••••••••••• (Key Configured)" : "AIzaSy..."}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {provider === 'openai' && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-gray-300 mb-1">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={currentSettings?.has_openai_key ? "•••••••••••••••• (Key Configured)" : "sk-..."}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {provider === 'ollama' && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Ollama Endpoint URL
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          )}
        </div>

        {/* Vector Retrieval Parameters */}
        <div className="p-6 rounded-xl bg-dark-card border border-dark-border space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Retrieval & Chunking Hyperparameters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Top-K */}
            <div>
              <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                <span>Top-K Retrieved Chunks:</span>
                <span className="font-mono text-blue-400 font-bold">{topK}</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={topK}
                onChange={(e) => setTopK(e.target.value)}
                className="w-full accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Number of highest-similarity vector passages injected into context prompt.
              </span>
            </div>

            {/* Similarity Threshold */}
            <div>
              <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                <span>Similarity Threshold:</span>
                <span className="font-mono text-indigo-400 font-bold">{threshold}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full accent-indigo-500"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Minimum cosine similarity required to consider a passage relevant.
              </span>
            </div>

            {/* Chunk Size */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Chunk Size (Characters)
              </label>
              <input
                type="number"
                min="100"
                max="2000"
                step="50"
                value={chunkSize}
                onChange={(e) => setChunkSize(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Chunk Overlap */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Chunk Overlap (Characters)
              </label>
              <input
                type="number"
                min="0"
                max="500"
                step="25"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
