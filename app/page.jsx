'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Mic, Send, User, Bot } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';

export default function ChatInterface() {
  const { messages, sendMessage, status } = useChat({ api: '/api/chat' });
  const isLoading = status === 'streaming' || status === 'submitted';
  const [inputValue, setInputValue] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helper to extract text from AI SDK v6 UI messages
  const getMessageContent = (msg) => {
    if (typeof msg.content === 'string' && msg.content) return msg.content;
    if (Array.isArray(msg.parts)) {
      return msg.parts
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join('');
    }
    return '';
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-600 to-orange-800 text-white p-4 shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MIT Bengaluru Virtual Assistant</h1>
          <p className="text-sm opacity-80">Empowered by AI · Ask me anything, including mock interviews</p>
        </div>
        <a
          href="/admin"
          className="text-sm border border-white/30 rounded px-3 py-1 text-white hover:bg-white/10 transition"
        >
          Manage Data
        </a>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
            <p className="text-lg">How can I assist you today?</p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {[
                'What courses does MIT Bengaluru offer?',
                'Tell me about placements',
                'Start a mock interview for a SWE role',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setInputValue(suggestion)}
                  className="text-sm bg-white border border-gray-200 rounded-full px-4 py-2 hover:border-orange-400 hover:text-orange-600 transition-colors shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user'
                ? 'bg-orange-600 text-white rounded-br-none'
                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
            }`}>
              <div className="flex items-center gap-2 mb-2 opacity-70 text-xs">
                {msg.role === 'user' ? <User size={14}/> : <Bot size={14}/>}
                <span>{msg.role === 'user' ? 'You' : 'MIT Assistant'}</span>
              </div>
              <div className={`prose prose-sm max-w-none leading-relaxed ${
                msg.role === 'user' ? 'prose-invert text-white' : 'text-slate-800'
              }`}>
                <ReactMarkdown>
                  {getMessageContent(msg)}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-none p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 opacity-70 text-xs"><Bot size={14}/><span>MIT Assistant</span></div>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '0ms' }}/>
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '150ms' }}/>
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '300ms' }}/>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t p-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const msg = inputValue.trim();
            if (!msg || isLoading) return;
            setInputValue('');
            await sendMessage({ text: msg });
          }}
          className="max-w-4xl mx-auto flex items-center gap-2 bg-gray-100 rounded-full p-2 pr-4 shadow-inner"
        >
          <input
            type="text"
            className="flex-1 bg-transparent outline-none px-3"
            placeholder="Ask about courses, placements, or say 'start a mock interview'..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white p-3 rounded-full transition-transform active:scale-95 shadow-md flex items-center justify-center"
          >
            <Send size={18} className="translate-x-[1px]" />
          </button>
        </form>
      </footer>
    </div>
  );
}
