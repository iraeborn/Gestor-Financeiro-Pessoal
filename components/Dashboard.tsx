
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Contact, Category, ViewMode, AppSettings, User, AccountType } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import { CashFlowChart, BalanceHistoryChart } from './Charts';
import { Plus, TrendingUp, ArrowRight, ShieldCheck, Landmark, AlertCircle, Wallet, PiggyBank, Sparkles, BrainCircuit } from 'lucide-react';
import { getManagerDiagnostic } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface DashboardProps {
  state: AppState;
  settings?: AppSettings;
  currentUser: User;
  onAddTransaction: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (t: Transaction, newContact?: Contact, newCategory?: Category) => void;
  onUpdateStatus: (t: Transaction) => void;
  onChangeView: (view: ViewMode) => void;
  onNewTransaction: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  state, settings, currentUser, onDeleteTransaction, onEditTransaction, onUpdateStatus, onChangeView, onNewTransaction
}) => {
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [loadingDiag, setLoadingDiag] = useState(false);
  
  const isAIEnabled = settings?.aiMonitoringEnabled ?? true;

  useEffect(() => {
    const fetchDiag = async () => {
      if (!isAIEnabled) {
          setDiagnostic('');
          return;
      }

      if (state?.transactions?.length > 0) {
        setLoadingDiag(true);
        try {
          const res = await getManagerDiagnostic(state);
          setDiagnostic(res);
        } catch (e) { 
            console.error("IA Error:", e);
            setDiagnostic("Houve um problema ao processar seu diagnóstico de elite. Tente novamente em instantes.");
        }
        setLoadingDiag(false);
      }
    };
    fetchDiag();
  }, [state?.transactions?.length, isAIEnabled]);

  const metrics = useMemo(() => {
    const accounts = state.accounts || [];
    const transactions = state.transactions || [];

    const saldoDisponivel = accounts
        .filter(a => a.type !== AccountType.CARD)
        .reduce((acc, a) => acc + (Number(a.balance) || 0), 0);

    const dividaCartao = accounts
        .filter(a => a.type === AccountType.CARD)
        .reduce((acc, a) => acc + Math.abs(a.balance < 0 ? a.balance : 0), 0);

    const patrimonioLiquido = saldoDisponivel - dividaCartao;

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const l30Str = last30Days.toISOString().split('T')[0];

    const gastosMensais = transactions
        .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.date >= l30Str)
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const mesesReserva = gastosMensais > 0 ? (patrimonioLiquido / gastosMensais).toFixed(1) : '∞';

    const recentTransactions = [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8);

    return { patrimonioLiquido, saldoDisponivel, dividaCartao, mesesReserva, recentTransactions };
  }, [state]);

  const formatBRL = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel de Patrimônio</h1>
          <p className="text-slate-500 font-medium">Gestão estratégica de ativos e liquidez.</p>
        </div>
        <button 
            onClick={onNewTransaction}
            className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
        >
            <Plus className="w-5 h-5" /> Novo Registro
        </button>
      </div>

      {/* Grid Patrimonial Principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform duration-500"><Landmark className="w-24 h-24" /></div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Patrimônio Líquido</p>
              <h3 className="text-3xl font-black">{formatBRL(metrics.patrimonioLiquido)}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-4">Ativos - Passivos</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-all group">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Reserva de Emergência</p>
                  <PiggyBank className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-3xl font-black text-slate-900">{metrics.mesesReserva} <span className="text-sm text-slate-400">Meses</span></h3>
              <p className="text-[10px] text-emerald-600 font-bold uppercase mt-4">Fôlego de Sobrevivência</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-all group">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Disponível em Conta</p>
                  <Wallet className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-900">{formatBRL(metrics.saldoDisponivel)}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-4">Liquidez Imediata</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:border-rose-200 transition-all group">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dívida de Cartão</p>
                  <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-3xl font-black text-rose-600">{formatBRL(metrics.dividaCartao)}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-4">Passivos a Curto Prazo</p>
          </div>
      </div>

      {/* Consultor IA e Lista de Transações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className={`${isAIEnabled ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-8`}>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-full">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Movimentações Recentes</h3>
                    <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black flex items-center gap-2 uppercase tracking-widest transition-all">Ver Extrato <ArrowRight className="w-4 h-4" /></button>
                </div>
                <TransactionList 
                    transactions={metrics.recentTransactions} 
                    accounts={state.accounts} 
                    contacts={state.contacts || []} 
                    onDelete={onDeleteTransaction}
                    onEdit={onEditTransaction}
                    onToggleStatus={onUpdateStatus}
                />
            </div>
        </div>

        {isAIEnabled && (
            <div className="space-y-8 animate-fade-in">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden min-h-[400px] flex flex-col">
                    <div className="absolute top-0 right-0 p-6 opacity-20"><BrainCircuit className="w-24 h-24" /></div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-lg"><Sparkles className="w-7 h-7 text-white" /></div>
                        <div>
                            <h4 className="text-xl font-black">Advisor de Elite</h4>
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Análise via Gemini Pro</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 text-sm font-medium leading-relaxed prose prose-invert">
                        {loadingDiag ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50 py-10">
                                <RefreshCw className="w-8 h-8 animate-spin" />
                                <span className="text-xs font-black uppercase tracking-widest">Processando Ativos...</span>
                            </div>
                        ) : (
                            <ReactMarkdown>{diagnostic || "Aguardando novos lançamentos para um diagnóstico preciso de patrimônio."}</ReactMarkdown>
                        )}
                    </div>

                    <button 
                        onClick={() => onChangeView('FIN_ADVISOR')}
                        className="mt-8 w-full bg-white text-indigo-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 shadow-xl"
                    >
                        Conversar com Gestor <ArrowRight className="w-3 h-3" />
                    </button>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-6">Metas de Curto Prazo</h4>
                    <div className="space-y-6">
                        {state.goals.slice(0, 3).map(goal => {
                            const current = Number(goal.currentAmount || goal.current_amount || 0);
                            const target = Number(goal.targetAmount || 1);
                            const pct = Math.min(100, Math.round((current/target)*100));
                            return (
                                <div key={goal.id} className="space-y-2">
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-slate-600">{goal.name}</span>
                                        <span className="text-indigo-600">{pct}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                        {state.goals.length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma meta ativa no momento.</p>}
                        <button onClick={() => onChangeView('FIN_GOALS')} className="w-full text-center py-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline mt-2">Gerenciar Metas</button>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Histórico de Evolução Patrimonial - Agora por último */}
      <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 animate-fade-in">
          <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-3 uppercase tracking-tighter">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              Histórico de Evolução Patrimonial
          </h3>
          <BalanceHistoryChart accounts={state.accounts} transactions={state.transactions} />
      </div>
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M21 3v9h-9"/></svg>
);

export default Dashboard;
