
import React, { useState, useEffect } from 'react';
import { AppState } from '../types';
import { getDiagnosticByType } from '../services/geminiService';
// Fix: Added missing Info icon import
import { BrainCircuit, Sparkles, ShieldAlert, TrendingUp, HeartPulse, Loader2, ArrowRight, Award, MessageSquare, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DiagnosticViewProps {
  state: AppState;
}

type DiagnosticType = 'SUMMARY' | 'HEALTH' | 'RISK' | 'INVEST';

const DiagnosticView: React.FC<DiagnosticViewProps> = ({ state }) => {
  const [activeType, setActiveType] = useState<DiagnosticType>('SUMMARY');
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const diagnosticOptions = [
    { id: 'SUMMARY', label: 'Resumo Executivo', icon: BrainCircuit, color: 'bg-indigo-600', desc: 'Visão geral seca e estratégica do seu momento atual.' },
    { id: 'HEALTH', label: 'Saúde & Fôlego', icon: HeartPulse, color: 'bg-emerald-600', desc: 'Análise de fluxo de caixa e progresso de metas.' },
    { id: 'RISK', label: 'Radar de Riscos', icon: ShieldAlert, color: 'bg-rose-600', desc: 'Identificação de ameaças, atrasos e insolvência.' },
    { id: 'INVEST', label: 'Oportunidades', icon: TrendingUp, color: 'bg-amber-600', desc: 'Onde economizar para investir e crescer rápido.' },
  ];

  const runDiagnostic = async (type: DiagnosticType) => {
    if (loading[type]) return;
    
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      const res = await getDiagnosticByType(state, type);
      setResults(prev => ({ ...prev, [type]: res }));
      setActiveType(type);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  useEffect(() => {
    // Roda o resumo inicial se ainda não houver
    if (!results.SUMMARY) runDiagnostic('SUMMARY');
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600"><BrainCircuit className="w-8 h-8"/></div>
              Gestor de Elite IA
          </h1>
          <p className="text-gray-500">Módulo de inteligência avançada para decisões baseadas em dados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {diagnosticOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => runDiagnostic(opt.id as DiagnosticType)}
            className={`p-5 rounded-3xl border-2 transition-all text-left flex flex-col justify-between group h-full ${
              activeType === opt.id 
                ? 'border-indigo-500 bg-white shadow-xl shadow-indigo-100' 
                : 'border-transparent bg-white hover:border-indigo-200 shadow-sm'
            }`}
          >
            <div>
                <div className={`w-12 h-12 ${opt.color} text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    <opt.icon className="w-6 h-6" />
                </div>
                <h3 className="font-black text-gray-900 uppercase tracking-tight">{opt.label}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{opt.desc}</p>
            </div>
            
            <div className="mt-6 flex items-center justify-between">
                {loading[opt.id] ? (
                    <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase">
                        <Loader2 className="w-3 h-3 animate-spin" /> Analisando...
                    </div>
                ) : results[opt.id] ? (
                    <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase">
                        <Award className="w-3 h-3" /> Relatório Pronto
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-gray-300 text-[10px] font-black uppercase">
                        Pedir Análise <ArrowRight className="w-3 h-3" />
                    </div>
                )}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
                <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${diagnosticOptions.find(o => o.id === activeType)?.color} text-white shadow-md`}>
                            {React.createElement(diagnosticOptions.find(o => o.id === activeType)?.icon || BrainCircuit, { className: 'w-6 h-6' })}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">{diagnosticOptions.find(o => o.id === activeType)?.label}</h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Processado pelo Gemini 3.0 Flash</p>
                        </div>
                    </div>
                    <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
                
                <div className="p-8 flex-1">
                    {loading[activeType] ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                            <div>
                                <p className="text-lg font-bold text-gray-800">O Gestor de Elite está pensando...</p>
                                <p className="text-sm text-gray-400">Cruzando lançamentos, metas e saldos em tempo real.</p>
                            </div>
                        </div>
                    ) : results[activeType] ? (
                        <div className="prose prose-indigo max-w-none animate-fade-in">
                            <ReactMarkdown>{results[activeType]}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-20 text-gray-300">
                            <BrainCircuit className="w-16 h-16 mb-4 opacity-20" />
                            <p>Selecione um card acima para gerar um diagnóstico especializado.</p>
                        </div>
                    )}
                </div>
                
                {results[activeType] && !loading[activeType] && (
                    <div className="p-6 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-700 text-sm font-bold">
                            <Info className="w-4 h-4" />
                            <span>Esta análise foi gerada com base nos seus dados reais.</span>
                        </div>
                        <button className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline">
                            Exportar PDF <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                    Consultor Particular
                </h3>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Precisa de um plano de ação específico? Nosso consultor IA pode conversar com você sobre qualquer detalhe financeiro.
                </p>
                <button className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/20">
                    Iniciar Conversa <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h4 className="font-bold text-gray-800 text-sm mb-4">Dados Enviados para IA</h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Saldo Consolidado</span>
                        <span className="font-bold text-gray-900">R$ {state.accounts.reduce((acc,a)=>acc+a.balance,0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Contas em Aberto</span>
                        <span className="font-bold text-gray-900">{state.transactions.filter(t=>t.status === 'PENDING').length} registros</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Metas Ativas</span>
                        <span className="font-bold text-gray-900">{state.goals.length} planos</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticView;
