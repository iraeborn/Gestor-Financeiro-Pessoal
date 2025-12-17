
import React, { useState, useEffect, useRef } from 'react';
import { analyzeFinances } from '../services/geminiService';
import { AppState } from '../types';
import { Sparkles, Send, BrainCircuit, User, Bot, Loader2, ArrowLeft } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface SmartAdvisorProps {
  data: AppState;
}

const SmartAdvisor: React.FC<SmartAdvisorProps> = ({ data }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Diagnóstico Inicial Automático
  useEffect(() => {
    const init = async () => {
        setLoading(true);
        const diag = await analyzeFinances(data);
        setMessages([{ role: 'assistant', content: diag }]);
        setLoading(false);
    };
    init();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
        const response = await analyzeFinances(data, userMsg);
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', content: "Desculpe, tive um lapso mental. Pode repetir?" }]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-indigo-600 rounded-t-3xl p-6 text-white shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <BrainCircuit className="w-7 h-7" />
              </div>
              <div>
                  <h2 className="text-xl font-bold">Gestor Pessoal IA</h2>
                  <p className="text-indigo-100 text-xs">Consultoria financeira 24/7</p>
              </div>
          </div>
          <Sparkles className="w-6 h-6 text-indigo-300 animate-pulse" />
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 bg-white border-x border-gray-100 overflow-y-auto p-6 space-y-6 scrollbar-thin"
      >
        {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100 shadow-sm'}`}>
                        <div className="prose prose-sm prose-indigo max-w-none prose-p:my-1">
                            {msg.content.split('\n').map((line, idx) => (
                                <p key={idx}>{line}</p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        ))}
        {loading && (
            <div className="flex justify-start">
                 <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl rounded-tl-none border border-gray-100 animate-pulse">
                        <div className="h-4 w-24 bg-gray-200 rounded"></div>
                    </div>
                 </div>
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-gray-50 p-4 rounded-b-3xl border-x border-b border-gray-200">
          <form onSubmit={handleSend} className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ex: Como posso sobrar R$ 500 este mês?"
                className="flex-1 bg-white border border-gray-200 rounded-2xl px-6 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
              />
              <button 
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                  <Send className="w-5 h-5" />
              </button>
          </form>
          <p className="text-[10px] text-gray-400 text-center mt-2 uppercase tracking-widest font-bold">Respostas geradas por IA • Sempre confira dados críticos</p>
      </div>
    </div>
  );
};

export default SmartAdvisor;
