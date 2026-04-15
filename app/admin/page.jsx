'use client';

import React, { useState, useEffect } from 'react';
import { UploadCloud, Trash2, Eye, BellRing, Database, FileText, X, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('knowledge');
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [announcement, setAnnouncement] = useState({ title: '', content: '' });
  const [announcements, setAnnouncements] = useState([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('info');

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState(null);       // { document, chunks }
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewChunkIdx, setPreviewChunkIdx] = useState(0);

  const showStatus = (msg, type = 'info') => {
    setStatusMsg(msg);
    setStatusType(type);
    setTimeout(() => setStatusMsg(''), 5000);
  };

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      } else {
        showStatus(`Failed to load documents: ${data.error}`, 'error');
      }
    } catch {
      showStatus('Network error loading documents.', 'error');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const fetchAnnouncements = async () => {
    setIsLoadingAnnouncements(true);
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (res.ok) setAnnouncements(data.announcements || []);
    } catch { /* non-fatal */ }
    finally { setIsLoadingAnnouncements(false); }
  };

  useEffect(() => { fetchDocuments(); fetchAnnouncements(); }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    showStatus('Uploading and processing document...');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.ok) {
        showStatus('Document successfully ingested into Vector DB!');
        await fetchDocuments();
      } else {
        showStatus(`Error: ${data.error} — ${data.details || ''}`, 'error');
      }
    } catch {
      showStatus('Network error during upload.', 'error');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document and all its embeddings?')) return;
    try {
      const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setDocuments(docs => docs.filter(doc => doc.id !== id));
        showStatus('Document and embeddings deleted.');
      } else {
        showStatus('Failed to delete document.', 'error');
      }
    } catch {
      showStatus('Network error during delete.', 'error');
    }
  };

  const handlePreview = async (doc) => {
    setIsLoadingPreview(true);
    setPreviewDoc(null);
    setPreviewChunkIdx(0);
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      const data = await res.json();
      if (res.ok) {
        setPreviewDoc(data);
      } else {
        showStatus(`Preview failed: ${data.error}`, 'error');
      }
    } catch {
      showStatus('Network error loading preview.', 'error');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    showStatus('Pushing announcement to Vector DB...');
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...announcement, postedBy: null })
      });
      if (response.ok) {
        showStatus('Announcement broadcasted and indexed!', 'success');
        setAnnouncement({ title: '', content: '' });
        await fetchAnnouncements();
      } else {
        const data = await response.json();
        showStatus(`Error: ${data.error}`, 'error');
      }
    } catch {
      showStatus('Failed to post announcement.', 'error');
    }
  };

  const getFileLabel = (fileType) => {
    if (!fileType) return 'Unknown';
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('xlsx')) return 'Excel';
    if (fileType.includes('word') || fileType.includes('docx')) return 'Word';
    if (fileType.includes('text') || fileType.includes('plain')) return 'Text';
    return fileType.split('/').pop().toUpperCase();
  };

  const closePreview = () => { setPreviewDoc(null); setPreviewChunkIdx(0); };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-orange-500 tracking-wide">MIT Admin</h2>
          <p className="text-xs text-slate-400 mt-1">Virtual Assistant portal</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'knowledge' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <Database size={18} /><span className="font-medium">Knowledge Base</span>
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'announcements' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <BellRing size={18} /><span className="font-medium">Announcements</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <a href="/" className="text-slate-400 hover:text-white text-sm transition-colors">← Back to Chat</a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-800">
            {activeTab === 'knowledge' ? 'Knowledge Base Manager' : 'Announcements Center'}
          </h1>
          {statusMsg && (
            <div className={`px-4 py-2 rounded-lg text-sm font-medium border animate-pulse ${statusType === 'error' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-orange-100 text-orange-800 border-orange-200'}`}>
              {statusMsg}
            </div>
          )}
        </header>

        {activeTab === 'knowledge' ? (
          <div className="space-y-6 max-w-5xl">
            {/* Upload Zone */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
              <label className={`cursor-pointer flex flex-col items-center justify-center border-2 border-dashed ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-orange-300 hover:bg-orange-50'} rounded-xl py-12 px-4 transition-all`}>
                <UploadCloud size={48} className={`mb-4 ${isUploading ? 'text-gray-400 animate-bounce' : 'text-orange-500'}`} />
                <span className="text-lg font-medium text-gray-700">
                  {isUploading ? 'Processing Document...' : 'Drag & Drop files here or click to browse'}
                </span>
                <span className="text-sm text-gray-400 mt-2">Supports .pdf, .xlsx, .txt, .docx</span>
                <input type="file" className="hidden" accept=".pdf,.txt,.xlsx,.docx" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            </div>

            {/* Document Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="font-semibold text-slate-700">Ingested Documents ({documents.length})</h2>
                <button onClick={fetchDocuments} disabled={isLoadingDocs} className="flex items-center gap-2 text-sm text-slate-500 hover:text-orange-600 transition-colors">
                  <RefreshCw size={14} className={isLoadingDocs ? 'animate-spin' : ''} />Refresh
                </button>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b">
                    <th className="p-4">Document Title</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Chunks</th>
                    <th className="p-4">Ingested At</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map(doc => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <FileText size={18} className="text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700 truncate max-w-xs">{doc.title}</span>
                      </td>
                      <td className="p-4">
                        <span className="bg-slate-100 px-2 py-1 rounded-full text-xs font-medium text-slate-600">
                          {getFileLabel(doc.file_type)}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-500">{doc.chunk_count ?? '—'} chunks</td>
                      <td className="p-4 text-sm text-slate-500">
                        {new Date(doc.upload_timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-4 text-right space-x-3">
                        <button onClick={() => handlePreview(doc)} className="text-blue-600 hover:text-blue-800 transition-colors" title="Preview document content">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleDelete(doc.id)} className="text-red-600 hover:text-red-800 transition-colors" title="Delete from Database & Vector Index">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && !isLoadingDocs && (
                    <tr><td colSpan="5" className="text-center p-8 text-gray-400">No documents ingested yet. Upload a file above to get started.</td></tr>
                  )}
                  {isLoadingDocs && (
                    <tr><td colSpan="5" className="text-center p-8 text-gray-400">Loading...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            {/* Post Form */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-6 text-slate-800">Push High-Priority Context</h2>
              <form onSubmit={handleAnnouncementSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Announcement Title</label>
                  <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    placeholder="e.g. End Semester Exam Scheduling Update"
                    value={announcement.title} onChange={e => setAnnouncement({...announcement, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Detailed Content</label>
                  <textarea required rows="6" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow resize-none"
                    placeholder="Enter the full context. This will be embedded into the vector DB for top-priority RAG retrieval."
                    value={announcement.content} onChange={e => setAnnouncement({...announcement, content: e.target.value})} />
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all active:scale-[0.98]">
                    Vectorize & Publish Announcement
                  </button>
                </div>
              </form>
            </div>

            {/* Live Announcements List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="font-semibold text-slate-700">Published Announcements ({announcements.length})</h2>
                <button onClick={fetchAnnouncements} disabled={isLoadingAnnouncements} className="flex items-center gap-2 text-sm text-slate-500 hover:text-orange-600 transition-colors">
                  <RefreshCw size={14} className={isLoadingAnnouncements ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              {isLoadingAnnouncements ? (
                <p className="text-center p-8 text-gray-400">Loading...</p>
              ) : announcements.length === 0 ? (
                <p className="text-center p-8 text-gray-400">No announcements yet. Post one above.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {announcements.map(a => (
                    <li key={a.id} className="p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{a.title}</p>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.content}</p>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                          {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Loading overlay while fetching preview */}
      {isLoadingPreview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
            <RefreshCw size={32} className="text-orange-500 animate-spin" />
            <p className="text-slate-600 font-medium">Loading preview...</p>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex-1 min-w-0 mr-4">
                <h3 className="text-base font-bold text-slate-800 truncate">{previewDoc.document.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {previewDoc.chunks.length} chunk{previewDoc.chunks.length !== 1 ? 's' : ''} stored
                  {previewDoc.chunks.length > 0 && ` · Viewing chunk ${previewChunkIdx + 1} of ${previewDoc.chunks.length}`}
                </p>
              </div>
              <button onClick={closePreview} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {previewDoc.chunks.length === 0 ? (
                <p className="text-slate-400 text-center py-12">No text chunks found for this document.</p>
              ) : (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Chunk {previewChunkIdx + 1}
                    </span>
                    <span className="text-xs text-slate-300">|</span>
                    <span className="text-xs text-slate-400">
                      {previewDoc.chunks[previewChunkIdx].content.length} characters
                    </span>
                  </div>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                    {previewDoc.chunks[previewChunkIdx].content}
                  </pre>
                </div>
              )}
            </div>

            {/* Pagination Footer */}
            {previewDoc.chunks.length > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => setPreviewChunkIdx(i => Math.max(0, i - 1))}
                  disabled={previewChunkIdx === 0}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} /> Previous
                </button>

                {/* Chunk dots for quick navigation */}
                <div className="flex gap-1.5">
                  {previewDoc.chunks.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewChunkIdx(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === previewChunkIdx ? 'bg-orange-500' : 'bg-slate-200 hover:bg-slate-400'}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setPreviewChunkIdx(i => Math.min(previewDoc.chunks.length - 1, i + 1))}
                  disabled={previewChunkIdx === previewDoc.chunks.length - 1}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
