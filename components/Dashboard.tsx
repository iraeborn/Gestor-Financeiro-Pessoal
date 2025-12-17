
import React, { useState, useEffect } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Account, ViewMode, AppSettings, AccountType, Contact, EntityType, Category } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import PaymentConfirmationModal from './PaymentConfirmationModal';
import { CashFlowChart, ExpensesByCategory, BalanceDistributionChart, BalanceHistoryChart } from './Charts';
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, ArrowRight, PieChart, BarChart3, Coins, Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import { analyzeFinances } from '../services/geminiService';

interface DashboardProps {
  state: AppState;
  settings?: AppSettings;
  userEntity?: EntityType;
  // Fix: Added newCategory to signature to match TransactionModal onSave output
  onAddTransaction: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  onDeleteTransaction: (id: string) => void;
  // Fix: Added newCategory to signature to match TransactionModal onSave output
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
            const insight = await analyzeFinances(state);
            setManagerInsight(insight);
            setLoadingInsight(false);
        }
    };
    fetchInsight();
  }, [state.transactions.length]); // Atualiza quando mudar o volume de dados

  const currentRealBalance = state.accounts.reduce((acc, curr) => curr.balance + acc, 0);
  const pendingIncome = state.transactions.filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
  const pendingExpenses = state.transactions.filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
  const projectedBalance = currentRealBalance + pendingIncome - pendingExpenses;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* HEADER E INSIGHT DO GESTOR */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Bom dia, Gestor</h1>
            <p className="text-gray-500">Aqui está o pulso das suas finanças agora.</p>
          </div>
          <button 
            onClick={() => setTransModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
          >
            <Plus className="w-5 h-5" /> Novo Lançamento
          </button>
        </div>

        {/* INSIGHT CARD */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BrainCircuit className="w-32 h-32" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4 text-indigo-300">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-widest">Diagnóstico do seu Gestor IA</span>
                </div>
                {loadingInsight ? (
                    <div className="flex items-center gap-3 py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                        <span className="text-sm text-indigo-200">Analisando movimentações e prevendo fluxo...</span>
                    </div>
                ) : (
                    <div className="text-sm leading-relaxed text-indigo-50 prose prose-invert max-w-none">
                        {managerInsight ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                    {managerInsight.split('###')[1] || managerInsight.substring(0, 200) + '...'}
                                </div>
                                <div className="flex flex-col justify-center items-center md:items-end">
                                    <button 
                                        onClick={() => onChangeView('FIN_ADVISOR')}
                                        className="text-xs font-bold bg-white text-indigo-900 px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors"
                                    >
                                        Conversar com Gestor Completo
                                    </button>
                                </div>
                            </div>
                        ) : "Nenhum insight disponível ainda. Comece a lançar para ver a mágica."}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Saldo em Conta" amount={currentRealBalance} type="neutral" icon={<Wallet className="w-6 h-6 text-indigo-600"/>} />
        <StatCard title="Saldo Projetado" amount={projectedBalance} type={projectedBalance >= 0 ? 'info' : 'negative'} icon={<CalendarClock className="w-6 h-6 text-blue-600"/>} subtitle="Até final do mês" />
        <StatCard title="Metas Ativas" amount={state.goals.reduce((acc,g)=>acc+g.currentAmount, 0)} type="positive" icon={<Target className="w-6 h-6 text-emerald-600"/>} subtitle={`${state.goals.length} objetivos`} />
        <StatCard title="Saídas Pendentes" amount={pendingExpenses} type="negative" icon={<TrendingDown className="w-6 h-6 text-rose-600"/>} />
      </div>

      {/* Charts Row */}
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

      {/* Recent List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Últimos Lançamentos</h3>
            <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1">
                Ver Extrato Completo <ArrowRight className="w-4 h-4" />
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
        // Fix: Correctly pass 3 arguments to avoid TypeScript error and ensure new category is handled
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
