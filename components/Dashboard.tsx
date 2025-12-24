
import React, { useState, useEffect } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Contact, EntityType, Category, ViewMode, AppSettings } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import { CashFlowChart, ExpensesByCategory } from './Charts';
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, ArrowRight, BrainCircuit, Sparkles, Loader2 } from 'lucide-react';
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
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [loadingDiag, setLoadingDiag] = useState(false);

  useEffect(() => {
    const fetchDiag = async () => {
      if (state && state.transactions && state.transactions.length > 0) {
        setLoadingDiag(true);
        try {
          const res = await getManagerDiagnostic(state);
          setDiagnostic(res);
        } catch (e) { console.error("Falha no diagnóstico IA:", e); }
        setLoadingDiag(false);
      }
    };
    fetchDiag();
  }, [state?.transactions?.length]);

  if (!state) return null;

  const accounts = state.accounts || [];
  const transactions = state.transactions || [];
  const goals = state.goals || [];

  const currentRealBalance = accounts.reduce((acc, curr) => curr.balance + acc, 0);
  const pendingIncome = transactions.filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
  const pendingExpenses = transactions.filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
  const projectedBalance = currentRealBalance + pendingIncome - pendingExpenses;

  // Patrimônio em Metas: Valor Inicial + Aportes Liquidados
  const totalInGoals = goals.reduce((acc, goal) => {
      const contributions = transactions
        .filter(t => t.goalId === goal.id && t.status === TransactionStatus.PAID)
        .reduce((sum, t) => sum + t.amount, 0);
      return acc + (goal.currentAmount || 0) + contributions;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Painel de Gestão</h1>
          <p className="text-gray-500">Inteligência aplicada à sua saúde financeira.</p>
        </div>
        <button 
          onClick={() => { setEditingTransaction(null); setTransModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
        >
          <Plus className="w-5 h-5" /> Novo Lançamento
        </button>
      </div>

      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <BrainCircuit className="w-48 h-48" />
          </div>
          <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Resumo do Gestor de Elite</span>
              </div>
              {loadingDiag ? (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span className="text-sm text-indigo-100 italic">Sincronizando diagnóstico...</span>
                </div>
              ) : diagnostic ? (
                <div className="prose prose-invert prose-sm max-w-none line-clamp-3">
                    <ReactMarkdown>{diagnostic}</ReactMarkdown>
                </div>
              ) : <p className="text-sm text-indigo-200/60">Lance movimentações para ver o diagnóstico.</p>}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Saldo em Caixa" amount={currentRealBalance} type="neutral" icon={<Wallet className="w-6 h-6 text-indigo-600"/>} />
        <StatCard title="Saldo Projetado" amount={projectedBalance} type={projectedBalance >= 0 ? 'info' : 'negative'} icon={<CalendarClock className="w-6 h-6 text-blue-600"/>} subtitle="Até final do mês" />
        <StatCard title="Patrimônio em Metas" amount={totalInGoals} type="positive" icon={<Target className="w-6 h-6 text-emerald-600"/>} />
        <StatCard title="Contas Pendentes" amount={pendingExpenses} type="negative" icon={<TrendingDown className="w-6 h-6 text-rose-600"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Fluxo de Caixa Mensal</h3>
          <CashFlowChart transactions={transactions} />
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Categorias</h3>
          <ExpensesByCategory transactions={transactions} />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Últimos Lançamentos</h3>
            <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1">Ver Tudo <ArrowRight className="w-4 h-4" /></button>
        </div>
        <TransactionList 
            transactions={transactions.slice(0, 10)} 
            accounts={accounts} 
            contacts={state.contacts || []} 
            onDelete={onDeleteTransaction}
            onEdit={(t) => { setEditingTransaction(t); setTransModalOpen(true); }}
            onToggleStatus={onUpdateStatus}
        />
      </div>

      <TransactionModal 
        isOpen={isTransModalOpen} 
        onClose={() => setTransModalOpen(false)} 
        onSave={(t, nc, ncat) => { if(editingTransaction) onEditTransaction({...t, id: editingTransaction.id}, nc, ncat); else onAddTransaction(t, nc, ncat); setTransModalOpen(false); }}
        accounts={accounts}
        contacts={state.contacts || []}
        categories={state.categories || []}
        userEntity={userEntity}
        initialData={editingTransaction}
      />
    </div>
  );
};

export default Dashboard;
