import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import AdminPanel from './components/AdminPanel';

function App() {
  const [currentRoute, setCurrentRoute] = useState('chat'); // 'chat' | 'admin'

  return (
    <div className="min-h-screen relative">
      {/* Simple Dev Toggle to switch between modes easily */}
      <div className="absolute top-2 left-2 z-50">
        <button 
          onClick={() => setCurrentRoute(currentRoute === 'chat' ? 'admin' : 'chat')}
          className="bg-slate-800 text-white text-xs px-3 py-1 rounded-md opacity-50 hover:opacity-100 transition-opacity flex items-center justify-between"
          title="Dev Toggle"
        >
          {currentRoute === 'chat' ? 'Switch to Admin Panel' : 'Switch to Student Chat'}
        </button>
      </div>

      {currentRoute === 'chat' ? <ChatInterface /> : <AdminPanel />}
    </div>
  );
}

export default App;
