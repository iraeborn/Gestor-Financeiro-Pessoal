import React, { useState } from 'react';
import { analyzeFinances } from '../services/geminiService';
import { AppState } from '../types';
import { Sparkles, RefreshCcw, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // Actually, we'll implement a simple renderer or just use whitespace-pre-wrap for MVP if library not available.
// NOTE: Since I cannot add new npm packages, I will render Markdown simply by parsing common tags or just using <pre> for now, or just text.
// Better: I will use a simple text display with formatted css.

interface SmartAdvisorProps {
  data: AppState;
}

const SmartAdvisor: React.FC<SmartAdvisorProps> = ({ data }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const result = await analyzeFinances(data);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <BrainCircuit className="w-8 h-8" />
              Consultor Inteligente
            </h2>
            <p className="text-indigo-100 max-w-xl text-lg">
              Utilize nossa IA para identificar padrões ocultos, prever riscos de caixa e encontrar oportunidades de economia no seu histórico.
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? 'Analisando...' : 'Gerar Análise'}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 animate-fade-in">
          <div className="prose prose-indigo max-w-none">
            {/* Simple rendering for markdown-like text structure since we don't have a MD library */}
            {analysis.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold text-gray-800 mt-6 mb-3">{line.replace('## ', '')}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-semibold text-gray-700 mt-4 mb-2">{line.replace('### ', '')}</h3>;
              if (line.startsWith('**')) return <strong key={i} className="block text-indigo-900 mt-4">{line.replace(/\*\*/g, '')}</strong>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 text-gray-600 mb-1">{line.replace('- ', '')}</li>;
              if (line.match(/^\d+\./)) return <li key={i} className="ml-4 text-gray-600 mb-1 list-decimal">{line}</li>;
              return <p key={i} className="text-gray-600 leading-relaxed mb-2">{line}</p>;
            })}
          </div>
        </div>
      )}

      {!analysis && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Padrões de Gastos</h3>
            <p className="text-sm text-gray-500">Descubra assinaturas esquecidas e categorias onde você gasta mais do que imagina.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center">
             <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
              <RefreshCcw className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Previsão de Fluxo</h3>
            <p className="text-sm text-gray-500">Antecipe períodos de aperto financeiro com base nas contas agendadas.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center">
             <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Alertas Inteligentes</h3>
            <p className="text-sm text-gray-500">Receba avisos sobre riscos de juros e oportunidades de investimento.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartAdvisor;
