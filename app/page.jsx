'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, User, Bot } from 'lucide-react';
import { useChat } from 'ai/react';

export default function ChatInterface() {
  const [mode, setMode] = useState('standard'); 
  const [isRecording, setIsRecording] = useState(false);
  
  const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading } = useChat({
    api: '/api/chat',
    body: { mode }
  });

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header with MIT Branding */}
      <header className="bg-gradient-to-r from-orange-600 to-orange-800 text-white p-4 shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MIT Bengaluru Virtual Assistant</h1>
          <p className="text-sm opacity-80">Empowered by AI</p>
        </div>
        <select 
          className="bg-white/20 border border-white/30 rounded px-3 py-1 text-white outline-none"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="standard" className="text-black">Standard Mode</option>
          <option value="interview" className="text-black">Interview Coach</option>
        </select>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400">
            <p>How can I assist you today?</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={\`flex \${msg.role === 'user' ? 'justify-end' : 'justify-start'}\`}>
            <div className={\`max-w-[75%] rounded-2xl p-4 shadow-sm \${
              msg.role === 'user' 
                ? 'bg-orange-600 text-white rounded-br-none' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
            }\`}>
              <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
                {msg.role === 'user' ? <User size={14}/> : <Bot size={14}/>}
                <span>{msg.role === 'user' ? 'You' : 'MIT Assistant'}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
               <div className="bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-none p-4 shadow-sm animate-pulse">
                   <div className="flex items-center gap-2 mb-1 opacity-70 text-xs"><Bot size={14}/><span>MIT Assistant</span></div>
                   <p className="whitespace-pre-wrap leading-relaxed">...</p>
               </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-2 bg-gray-100 rounded-full p-2 pr-4 shadow-inner">
          <button 
            type="button"
            className={\`p-3 rounded-full transition-colors \${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:bg-gray-200'}\`}
            onClick={() => setIsRecording(!isRecording)}
            title="Toggle Voice Input"
          >
            <Mic size={20} />
          </button>
          
          <input 
            type="text" 
            className="flex-1 bg-transparent outline-none px-2"
            placeholder="Ask about courses, faculty, or placements..."
            value={input}
            onChange={handleInputChange}
          />
          
          <button 
            type="submit"
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white p-3 rounded-full transition-transform active:scale-95 shadow-md flex items-center justify-center"
          >
            <Send size={18} className="translate-x-[1px]" />
          </button>
        </form>
      </footer>
    </div>
  );
}
