
import React, { useState, useEffect } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Contact, EntityType, Category, ViewMode, AppSettings } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import { CashFlowChart, ExpensesByCategory } from './Charts';
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, ArrowRight, BrainCircuit, Sparkles, Loader2, Award } from 'lucide-react';
import { getManagerDiagnostic } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface DashboardProps {
  state: AppState;
  settings?: AppSettings;
  userEntity?: EntityType;
  onAddTransaction: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (t: Transaction, newContact?: Contact, newCategory?: Category) => void;
  onUpdateStatus: (t: Transaction) => void;
  onChangeView: (view: ViewMode) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  state, settings, userEntity, onAddTransaction, onDeleteTransaction, onEditTransaction, onUpdateStatus, onChangeView
}) => {
  const [isTransModalOpen, setTransModalOpen] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [loadingDiag, setLoadingDiag] = useState(false);

  useEffect(() => {
    const fetchDiag = async () => {
      if (state.transactions.length > 0) {
        setLoadingDiag(true);
        try {
          const res = await getManagerDiagnostic(state);
          setDiagnostic(res);
        } catch (e) { console.error(e); }
        setLoadingDiag(false);
      }
    };
    fetchDiag();
  }, [state.transactions.length, state.accounts.length]);

  const currentRealBalance = state.accounts.reduce((acc, curr) => curr.balance + acc, 0);
  const pendingIncome = state.transactions.filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
  const pendingExpenses = state.transactions.filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
  const projectedBalance = currentRealBalance + pendingIncome - pendingExpenses;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Painel de Gestão</h1>
          <p className="text-gray-500">Inteligência aplicada à sua saúde financeira.</p>
        </div>
        <button 
          onClick={() => setTransModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
        >
          <Plus className="w-5 h-5" /> Novo Lançamento
        </button>
      </div>

      {/* IA ADVISOR WIDGET - THE ELITE CFO LOOK */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <BrainCircuit className="w-48 h-48" />
          </div>
          <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Diagnóstico do Gestor de Elite</span>
                </div>
                {diagnostic && !loadingDiag && (
                    <div className="bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30 flex items-center gap-2 text-xs font-bold text-indigo-300">
                        <Award className="w-4 h-4" /> Relatório Atualizado
                    </div>
                )}
              </div>
              
              {loadingDiag ? (
                <div className="flex items-center gap-3 py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  <span className="text-sm text-indigo-100 font-medium italic">Analisando fluxo de caixa e projetando saúde financeira...</span>
                </div>
              ) : diagnostic ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{diagnostic}</ReactMarkdown>
                    </div>
                    <div className="flex flex-col justify-center items-center lg:items-end border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
                        <p className="text-[10px] text-indigo-300 uppercase font-bold mb-2">Quer um plano detalhado?</p>
                        <button 
                            onClick={() => onChangeView('FIN_ADVISOR')}
                            className="w-full lg:w-auto bg-white text-indigo-900 px-4 py-2 rounded-xl text-xs font-extrabold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                        >
                            Consultoria Direta <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
              ) : (
                <div className="py-6 text-indigo-200/60 flex items-center gap-3">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10"><TrendingUp className="w-6 h-6"/></div>
                    <p className="text-sm">Lance suas primeiras movimentações para que o Gestor IA possa auditar sua conta e sugerir melhorias de lucro.</p>
                </div>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Saldo em Caixa" amount={currentRealBalance} type="neutral" icon={<Wallet className="w-6 h-6 text-indigo-600"/>} />
        <StatCard title="Saldo Projetado" amount={projectedBalance} type={projectedBalance >= 0 ? 'info' : 'negative'} icon={<CalendarClock className="w-6 h-6 text-blue-600"/>} subtitle="Até final do mês" />
        <StatCard title="Patrimônio em Metas" amount={state.goals.reduce((acc,g)=>acc+g.currentAmount, 0)} type="positive" icon={<Target className="w-6 h-6 text-emerald-600"/>} />
        <StatCard title="Contas Pendentes" amount={pendingExpenses} type="negative" icon={<TrendingDown className="w-6 h-6 text-rose-600"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500"/> Fluxo de Caixa Mensal
          </h3>
          <CashFlowChart transactions={state.transactions} />
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-500"/> Distribuição de Despesas
          </h3>
          <ExpensesByCategory transactions={state.transactions} />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Últimos Lançamentos</h3>
            <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1">
                Ver Tudo <ArrowRight className="w-4 h-4" />
            </button>
        </div>
        <TransactionList 
            transactions={state.transactions.slice(0, 10)} 
            accounts={state.accounts} 
            contacts={state.contacts} 
            onDelete={onDeleteTransaction}
            onEdit={(t) => onEditTransaction(t)}
            onToggleStatus={onUpdateStatus}
        />
      </div>

      <TransactionModal 
        isOpen={isTransModalOpen} 
        onClose={() => setTransModalOpen(false)} 
        onSave={(t, c, cat) => {
            onAddTransaction(t, c, cat);
            setTransModalOpen(false);
        }}
        accounts={state.accounts}
        contacts={state.contacts}
        categories={state.categories}
        userEntity={userEntity}
      />
    </div>
  );
};

export default Dashboard;
