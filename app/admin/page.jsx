'use client';

import React, { useState, useEffect } from 'react';
import { UploadCloud, Trash2, Eye, BellRing, Database, FileText } from 'lucide-react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('knowledge'); // 'knowledge' | 'announcements'
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [announcement, setAnnouncement] = useState({ title: '', content: '' });
  const [statusMsg, setStatusMsg] = useState('');

  // Simulating document fetch 
  useEffect(() => {
    // Mock data for UI demonstration
    setDocuments([
      { id: '1', title: 'MIT_Placement_Stats_2025.xlsx', file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upload_timestamp: new Date().toISOString() },
      { id: '2', title: 'CSE_Syllabus_Outline.pdf', file_type: 'application/pdf', upload_timestamp: new Date(Date.now() - 86400000).toISOString() }
    ]);
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatusMsg('Uploading and processing document...');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', 'admin-uuid-placeholder');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (response.ok) {
        setStatusMsg('Document successfully ingested into Vector DB!');
        setDocuments(prev => [{
          id: data.documentId || Math.random().toString(),
          title: file.name,
          file_type: file.type,
          upload_timestamp: new Date().toISOString()
        }, ...prev]);
      } else {
        setStatusMsg(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatusMsg('Network error during upload.');
    } finally {
      setIsUploading(false);
      setTimeout(() => setStatusMsg(''), 5000);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setDocuments(docs => docs.filter(doc => doc.id !== id));
        setStatusMsg('Document and embeddings deleted globally.');
      }
    } catch (err) {
      setStatusMsg('Failed to delete document.');
    }
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg('Pushing announcement to Vector DB...');
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...announcement,
          postedBy: 'admin-uuid-placeholder'
        })
      });
      
      if (response.ok) {
        setStatusMsg('Announcement broadcasted and indexed successfully!');
        setAnnouncement({ title: '', content: '' });
      }
    } catch (err) {
      setStatusMsg('Failed to post announcement.');
    }
    setTimeout(() => setStatusMsg(''), 5000);
  };

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
            <Database size={18} />
            <span className="font-medium">Knowledge Base</span>
          </button>
          <button 
            onClick={() => setActiveTab('announcements')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'announcements' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <BellRing size={18} />
            <span className="font-medium">Announcements</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-800">
            {activeTab === 'knowledge' ? 'Knowledge Base Manager' : 'Announcements Center'}
          </h1>
          {statusMsg && (
            <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg text-sm font-medium border border-orange-200 animate-pulse">
              {statusMsg}
            </div>
          )}
        </header>

        {activeTab === 'knowledge' ? (
          <div className="space-y-6 max-w-5xl">
            {/* Upload Zone */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
              <label className={`cursor-pointer flex flex-col items-center justify-center border-2 border-dashed ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-orange-300 hover:bg-orange-50'} rounded-xl py-12 px-4 transition-all`}>
                <UploadCloud size={48} className={`mb-4 ${isUploading ? 'text-gray-400' : 'text-orange-500'}`} />
                <span className="text-lg font-medium text-gray-700">
                  {isUploading ? 'Processing Document...' : 'Drag & Drop files here or click to browse'}
                </span>
                <span className="text-sm text-gray-400 mt-2">Supports .pdf, .xlsx, .txt, .docx</span>
                <input type="file" className="hidden" accept=".pdf,.txt,.xlsx,.docx" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            </div>

            {/* Document Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b">
                    <th className="p-4">Document Title</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Ingested At</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map(doc => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <FileText size={18} className="text-slate-400" />
                        <span className="font-medium text-slate-700">{doc.title}</span>
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        {doc.file_type.split('/').pop().substring(0, 15)}...
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        {new Date(doc.upload_timestamp).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right space-x-3">
                        <button className="text-blue-600 hover:text-blue-800 transition-colors" title="View Metadata">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleDelete(doc.id)} className="text-red-600 hover:text-red-800 transition-colors" title="Delete from Database & Vector Index">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan="4" className="text-center p-8 text-gray-500">No documents ingested yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-6 text-slate-800">Push High-Priority Context</h2>
              <form onSubmit={handleAnnouncementSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Announcement Title</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    placeholder="e.g. End Semester Exam Scheduling Update"
                    value={announcement.title}
                    onChange={e => setAnnouncement({...announcement, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Detailed Content</label>
                  <textarea 
                    required
                    rows="6"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow resize-none"
                    placeholder="Enter the full context. This will be embedded natively into the vector base for top-priority RAG retrieval."
                    value={announcement.content}
                    onChange={e => setAnnouncement({...announcement, content: e.target.value})}
                  ></textarea>
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all active:scale-[0.98]">
                    Vectorize & Publish Announcement
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
