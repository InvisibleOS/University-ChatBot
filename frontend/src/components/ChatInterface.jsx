import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Volume2, User, Bot } from 'lucide-react';

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState('standard'); // 'standard' or 'interview'
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initialize WebSocket for real-time streaming
    ws.current = new WebSocket('ws://localhost:8080/chat');
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'token') {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content += data.text;
          } else {
            newMessages.push({ role: 'assistant', content: data.text });
          }
          return newMessages;
        });
      }
    };

    return () => ws.current?.close();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMsg = { role: 'user', content: input };
    setMessages((prev) => [...prev, newMsg]);
    
    // Send via WebSocket
    ws.current.send(JSON.stringify({ type: 'message', content: input, mode }));
    setInput('');
  };

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
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2 bg-gray-100 rounded-full p-2 pr-4 shadow-inner">
          <button 
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
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          
          <button 
            className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-full transition-transform active:scale-95 shadow-md flex items-center justify-center"
            onClick={handleSend}
          >
            <Send size={18} className="translate-x-[1px]" />
          </button>
        </div>
      </footer>
    </div>
  );
}
