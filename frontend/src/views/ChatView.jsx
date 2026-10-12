import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  BookOpen, 
  Sparkles, 
  FileText, 
  CheckCircle,
  HelpCircle,
  CornerDownLeft
} from 'lucide-react';
import { api } from '../api';
import CitationDrawer from '../components/CitationDrawer';

export default function ChatView({ documents, stats, onRefreshStats }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [activeCitations, setActiveCitations] = useState([]);
  const [activeCitationQuestion, setActiveCitationQuestion] = useState('');
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      const res = await api.getChatHistory();
      if (res.history && res.history.length > 0) {
        // Format history into UI message pairs
        const formatted = [];
        // res.history is in DESC order, reverse for chronological order
        const sorted = [...res.history].reverse();
        sorted.forEach((item) => {
          formatted.push({
            role: 'user',
            content: item.question,
          });
          formatted.push({
            role: 'assistant',
            content: item.answer,
            citations: item.citations || [],
            groundedness_score: item.groundedness_score,
            latency_ms: item.latency_ms,
            model_used: item.model_used,
          });
        });
        setMessages(formatted);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuestion = input.trim();
    setInput('');

    // Append user message immediately
    const newMessages = [...messages, { role: 'user', content: userQuestion }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await api.sendMessage({
        question: userQuestion,
        document_id: selectedDocId || undefined,
      });

      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: res.answer,
          citations: res.citations || [],
          groundedness_score: res.groundedness_score,
          hallucination_rate: res.hallucination_rate,
          latency_ms: res.total_latency_ms,
          model_used: res.model_used,
          search_time_ms: res.search_time_ms,
          generation_time_ms: res.generation_time_ms,
          retrieved_chunks: res.retrieved_chunks || []
        }
      ]);

      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Error generating grounded response: ${err.message}`,
          isError: true,
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all conversation history?')) return;
    try {
      await api.clearChatHistory();
      setMessages([]);
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      alert(`Clear failed: ${err.message}`);
    }
  };

  const openCitationModal = (citations, question) => {
    setActiveCitations(citations);
    setActiveCitationQuestion(question);
    setIsCitationDrawerOpen(true);
  };

  const suggestedQuestions = [
    "What is the company 401(k) matching policy and vesting schedule?",
    "How many days of PTO do employees receive and what is the rollover limit?",
    "What is the mandatory timeline for reporting a security incident?",
    "What are our disaster recovery RPO and RTO targets?",
    "What is the secret recipe for Coca-Cola syrup? (Hallucination Test)"
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-dark-card border border-dark-border rounded-xl overflow-hidden animate-fade-in">
      {/* Chat Top Bar */}
      <div className="px-6 py-3 border-b border-dark-border bg-gray-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-white">Enterprise Knowledge QA</h3>
            <p className="text-[11px] text-gray-400">Strictly grounded semantic retrieval</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Document filter dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="">All Knowledge Documents</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleClearHistory}
            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-white mb-2">
              Verified Enterprise AI Assistant
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              Ask any question about company policies, IT protocols, or infrastructure specs.
              The system retrieves verified excerpts and explicitly cites sources. If the answer is not in the documents, it will abstain instead of hallucinating.
            </p>

            <div className="w-full space-y-2 text-left">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                Suggested Prompts:
              </span>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(q);
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-xs text-gray-300 transition flex items-center justify-between"
                >
                  <span className="truncate">{q}</span>
                  <CornerDownLeft className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed space-y-2.5 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-900/90 text-gray-200 border border-gray-800 rounded-bl-none'
                }`}
              >
                {/* Author Label */}
                <div className="flex items-center justify-between gap-4 text-[10px] text-gray-400 mb-1">
                  <span className="font-semibold uppercase tracking-wider text-gray-400">
                    {msg.role === 'user' ? 'You' : 'Grounded Assistant'}
                  </span>
                  {msg.latency_ms !== undefined && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-gray-400">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {msg.latency_ms}ms
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="whitespace-pre-wrap font-sans text-xs">
                  {msg.content}
                </div>

                {/* Assistant Metadata & Citations */}
                {msg.role === 'assistant' && !msg.isError && (
                  <div className="pt-2 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      {msg.groundedness_score >= 0.7 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                          Grounded ({Math.round(msg.groundedness_score * 100)}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium text-[10px]">
                          <AlertTriangle className="w-3 h-3" />
                          Low Grounding Score
                        </span>
                      )}

                      {msg.citations && msg.citations.length > 0 && (
                        <button
                          onClick={() => openCitationModal(msg.citations, messages[index - 1]?.content || '')}
                          className="px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 font-medium text-[10px] flex items-center gap-1 transition"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>{msg.citations.length} Verified Citation(s)</span>
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] text-gray-500 font-mono">
                      FAISS top-k: {msg.retrieved_chunks?.length || 4}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-start">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-bl-none p-4 max-w-sm text-xs text-gray-400 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Searching vector embeddings & synthesizing answer...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="p-4 border-t border-dark-border bg-gray-900/60 flex items-center gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about uploaded enterprise policies, SLAs, or technical specs..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50 shadow-lg shadow-blue-500/20"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Citations Drawer */}
      <CitationDrawer
        isOpen={isCitationDrawerOpen}
        onClose={() => setIsCitationDrawerOpen(false)}
        citations={activeCitations}
        question={activeCitationQuestion}
      />
    </div>
  );
}
