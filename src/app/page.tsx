'use strict';
'use client';

import { useChat } from 'ai/react';
import { Send, User, Sparkles, Settings2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const FREE_MODELS = [
  { id: 'openrouter/auto', name: 'OpenRouter Auto (Free)' },
  { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B (Free)' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)' },
  { id: 'google/gemma-7b-it:free', name: 'Gemma 7B (Free)' }
];

export default function Chat() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(FREE_MODELS[0].id);
  const [systemInstruction, setSystemInstruction] = useState('You are a helpful and polite AI assistant.');

  const { messages, input, handleInputChange, handleSubmit, error } = useChat({
    body: {
      model: selectedModel,
      systemInstruction
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, error]);

  return (
    <div className="flex flex-col h-[100dvh] bg-gradient-to-br from-[#fdfbfb] to-[#ebedee] text-gray-800 font-sans relative">
      {/* Sticky Header with Glassmorphism */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/40 border-b border-white/60 shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Sparkles className="w-5 h-5 text-amber-500 mr-2" />
          <h1 className="text-xl font-semibold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
            Golden Glass AI
          </h1>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="p-2 rounded-full hover:bg-white/50 transition-colors shadow-sm backdrop-blur-md border border-white/60 text-amber-600"
          aria-label="Settings"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </header>

      {/* Settings Panel Overlay */}
      {isSettingsOpen && (
        <div className="absolute top-[65px] left-0 right-0 z-10 p-4 bg-white/80 backdrop-blur-xl border-b border-white shadow-lg animate-in slide-in-from-top-2">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 block">AI Model</label>
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white/50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm shadow-inner transition-all"
              >
                {FREE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 block">System Instructions</label>
              <textarea 
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-white/50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm shadow-inner transition-all resize-none"
                placeholder="Tell the AI how it should behave..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70">
            <div className="p-4 rounded-full bg-white/50 shadow-inner">
              <Sparkles className="w-12 h-12 text-amber-500" />
            </div>
            <p className="text-lg">How can I assist you today?</p>
            <p className="text-sm text-gray-500 px-8">Using OpenRouter Free Tier. Tap the settings gear to customize model and instructions.</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex w-full ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-2xl shadow-sm backdrop-blur-md border ${
                m.role === 'user'
                  ? 'bg-amber-500/10 border-amber-500/20 rounded-br-sm text-gray-900'
                  : 'bg-white/60 border-white/80 rounded-bl-sm text-gray-800'
              }`}
            >
              <div className="flex items-center mb-2 space-x-2">
                {m.role === 'user' ? (
                  <>
                    <User className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">You</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-600 uppercase tracking-wider">AI</span>
                  </>
                )}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {m.content}
              </div>
            </div>
          </div>
        ))}
        
        {/* Error Handling */}
        {error && (
          <div className="flex w-full justify-center">
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-3 rounded-xl text-sm font-medium shadow-sm backdrop-blur-md">
              API ledu ra laude !
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white/40 backdrop-blur-md border-t border-white/60 z-10">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 max-w-4xl mx-auto relative"
        >
          <input
            className="flex-1 p-4 pr-14 rounded-full bg-white/70 border border-white/80 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
            value={input}
            placeholder="Type your message..."
            onChange={handleInputChange}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 p-3 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-full shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            aria-label="Send message"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
