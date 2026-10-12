import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  Eye, 
  Download, 
  Sparkles, 
  CheckCircle, 
  AlertCircle,
  FileCode,
  FileArchive
} from 'lucide-react';
import { api } from '../api';
import ChunkModal from '../components/ChunkModal';

export default function DocumentsView({ documents, onRefresh, stats }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [isChunkModalOpen, setIsChunkModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
    }
  };

  const uploadFiles = async (fileList) => {
    setUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }

    try {
      const res = await api.uploadDocuments(formData);
      setUploadStatus({
        type: 'success',
        message: `Successfully processed and indexed ${res.uploaded?.length || 0} document(s).`
      });
      onRefresh();
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err.message || 'Failed to upload files.'
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId, filename) => {
    if (!confirm(`Are you sure you want to delete "${filename}" and its vector index embeddings?`)) return;
    try {
      await api.deleteDocument(docId);
      onRefresh();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleViewChunks = async (doc) => {
    setSelectedDoc(doc);
    setIsChunkModalOpen(true);
    setChunksLoading(true);
    try {
      const res = await api.getDocumentChunks(doc.id);
      setChunks(res.chunks || []);
    } catch (err) {
      alert(`Failed to load chunks: ${err.message}`);
    } finally {
      setChunksLoading(false);
    }
  };

  const handleLoadSamples = async () => {
    setUploading(true);
    try {
      await api.loadSampleDocuments();
      setUploadStatus({
        type: 'success',
        message: 'Pre-packaged enterprise documents loaded & indexed (PDF, DOCX, TXT).'
      });
      onRefresh();
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: `Failed to load samples: ${err.message}`
      });
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileBadge = (fileType) => {
    switch (fileType?.toUpperCase()) {
      case 'PDF':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">PDF</span>;
      case 'DOCX':
      case 'DOC':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">DOCX</span>;
      case 'TXT':
      case 'MD':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">TXT</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">{fileType}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Upload Zone & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drag and drop card */}
        <div 
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-2 p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            dragActive 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-gray-800 bg-dark-card hover:border-gray-700 hover:bg-gray-900/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md"
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">
            {uploading ? 'Processing & Indexing Documents...' : 'Click to Upload or Drag & Drop'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mb-3">
            Supports corporate PDF, Word (.docx), and Plain Text (.txt, .md). Files will be cleaned, split into chunks, and vectorized into FAISS.
          </p>
          <div className="flex gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800">PDF</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800">DOCX</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800">TXT</span>
          </div>
        </div>

        {/* Load Samples Quick Card */}
        <div className="p-6 rounded-xl bg-dark-card border border-dark-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Instant Demonstration</span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Sample Enterprise Knowledge</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Instantly seed verified company sample documents including:
            </p>
            <ul className="text-xs text-gray-300 space-y-1.5 font-mono mb-4">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Acme_HR_Benefits_Guide_2025.docx
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                Cybersecurity_Incident_Policy.pdf
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Cloud_Architecture_Guide.txt
              </li>
            </ul>
          </div>

          <button
            onClick={handleLoadSamples}
            disabled={uploading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Pre-Packaged Documents</span>
          </button>
        </div>
      </div>

      {/* Upload alert message */}
      {uploadStatus && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-xs ${
          uploadStatus.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
        }`}>
          {uploadStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{uploadStatus.message}</span>
        </div>
      )}

      {/* Document Catalog Table */}
      <div className="rounded-xl bg-dark-card border border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Indexed Enterprise Documents</h3>
            <p className="text-xs text-gray-400">{documents.length} verified corporate resources available for semantic retrieval</p>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Total Chunks: {stats?.documents?.chunks_count || 0}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-900/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-dark-border">
              <tr>
                <th className="px-6 py-3">Document Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">File Size</th>
                <th className="px-6 py-3">Vector Chunks</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-gray-300">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No documents uploaded yet. Upload a document or click "Load Pre-Packaged Documents" above.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-900/40 transition">
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="truncate max-w-xs">{doc.filename}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getFileBadge(doc.file_type)}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-400">
                      {formatBytes(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 font-mono text-blue-400 font-semibold">
                      {doc.chunk_count || 0}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Indexed
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleViewChunks(doc)}
                        className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                        title="Inspect Chunks"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Chunks</span>
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id, doc.filename)}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-medium transition inline-flex items-center gap-1 border border-rose-500/20"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chunk Modal */}
      <ChunkModal
        isOpen={isChunkModalOpen}
        onClose={() => setIsChunkModalOpen(false)}
        document={selectedDoc}
        chunks={chunks}
        loading={chunksLoading}
      />
    </div>
  );
}
