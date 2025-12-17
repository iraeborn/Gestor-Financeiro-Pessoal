
import React, { useState, useEffect } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Account, ViewMode, AppSettings, AccountType, Contact, EntityType, Category } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import { CashFlowChart, ExpensesByCategory } from './Charts';
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, ArrowRight, PieChart, BarChart3, Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import { analyzeFinances } from '../services/geminiService';
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
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [managerInsight, setManagerInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    const fetchInsight = async () => {
        if (state.transactions.length > 0) {
            setLoadingInsight(true);
            try {
                const insight = await analyzeFinances(state);
                setManagerInsight(insight);
            } catch (e) { console.error(e); }
            setLoadingInsight(false);
        }
    };
    fetchInsight();
  }, [state.transactions.length]);

  const currentRealBalance = state.accounts.reduce((acc, curr) => curr.balance + acc, 0);
  const pendingIncome = state.transactions.filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
  const pendingExpenses = state.transactions.filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
  const projectedBalance = currentRealBalance + pendingIncome - pendingExpenses;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Painel do Gestor</h1>
            <p className="text-gray-500">Monitorando sua saúde financeira em tempo real.</p>
          </div>
          <button 
            onClick={() => setTransModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
          >
            <Plus className="w-5 h-5" /> Novo Lançamento
          </button>
        </div>

        {/* IA MANAGER WIDGET */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <BrainCircuit className="w-40 h-40" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Relatório Estratégico IA</span>
                </div>
                
                {loadingInsight ? (
                    <div className="flex items-center gap-3 py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                        <span className="text-sm text-indigo-100">O Gestor está auditando suas contas...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-3 prose prose-invert prose-sm max-w-none">
                            {managerInsight ? (
                                <ReactMarkdown className="text-indigo-50 leading-relaxed">
                                    {managerInsight}
                                </ReactMarkdown>
                            ) : (
                                <p className="text-indigo-200/60">Lance suas primeiras movimentações para receber uma auditoria gratuita do Gestor IA.</p>
                            )}
                        </div>
                        <div className="flex flex-col justify-center items-center lg:items-end border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
                             <button 
                                onClick={() => onChangeView('FIN_ADVISOR')}
                                className="group flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                             >
                                Consultoria Completa
                                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Dinheiro em Caixa" amount={currentRealBalance} type="neutral" icon={<Wallet className="w-6 h-6 text-indigo-600"/>} />
        <StatCard title="Fluxo Projetado" amount={projectedBalance} type={projectedBalance >= 0 ? 'info' : 'negative'} icon={<CalendarClock className="w-6 h-6 text-blue-600"/>} subtitle="Considerando pendências" />
        <StatCard title="Capital em Metas" amount={state.goals.reduce((acc,g)=>acc+g.currentAmount, 0)} type="positive" icon={<Target className="w-6 h-6 text-emerald-600"/>} />
        <StatCard title="Saídas Pendentes" amount={pendingExpenses} type="negative" icon={<TrendingDown className="w-6 h-6 text-rose-600"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500"/> Fluxo de Caixa (Mensal)
          </h3>
          <CashFlowChart transactions={state.transactions} />
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-rose-500"/> Gastos por Categoria
          </h3>
          <ExpensesByCategory transactions={state.transactions} />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Lançamentos Recentes</h3>
            <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1">
                Ver Tudo <ArrowRight className="w-4 h-4" />
            </button>
        </div>
        <TransactionList 
            transactions={state.transactions.slice(0, 10)} 
            accounts={state.accounts} 
            contacts={state.contacts} 
            onDelete={onDeleteTransaction}
            onEdit={(t) => { setEditingTransaction(t); setTransModalOpen(true); }}
            onToggleStatus={onUpdateStatus}
        />
      </div>

      <TransactionModal 
        isOpen={isTransModalOpen} 
        onClose={() => { setTransModalOpen(false); setEditingTransaction(null); }} 
        onSave={(t, c, cat) => {
            if (editingTransaction) onEditTransaction({...t, id: editingTransaction.id}, c, cat);
            else onAddTransaction(t, c, cat);
            setTransModalOpen(false);
            setEditingTransaction(null);
        }}
        accounts={state.accounts}
        contacts={state.contacts}
        categories={state.categories}
        initialData={editingTransaction}
        userEntity={userEntity}
      />
    </div>
  );
};

export default Dashboard;
