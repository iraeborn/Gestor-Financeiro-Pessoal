
import React, { useState } from 'react';
import { AppState, Transaction, ViewMode, TransactionType, TransactionStatus, Account } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import AccountModal from './AccountModal';
import SmartAdvisor from './SmartAdvisor';
import Reports from './Reports'; // Import the new Reports component
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, Pencil, Trash2, MoreHorizontal } from 'lucide-react';

interface DashboardProps {
  state: AppState;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (t: Transaction) => void;
  onUpdateStatus: (t: Transaction) => void;
  onSaveAccount: (a: Account) => void;
  onDeleteAccount: (id: string) => void;
  currentView: ViewMode;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  state, 
  onAddTransaction, 
  onDeleteTransaction, 
  onEditTransaction, 
  onUpdateStatus, 
  onSaveAccount,
  onDeleteAccount,
  currentView 
}) => {
  const [isTransModalOpen, setTransModalOpen] = useState(false);
  const [isAccModalOpen, setAccModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // --- Calculations for "Dual View" ---
  const currentRealBalance = state.accounts.reduce((acc, curr) => acc + curr.balance, 0);

  // Projected: Real Balance + (Pending Income) - (Pending Expenses)
  const pendingIncome = state.transactions
    .filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID)
    .reduce((acc, t) => acc + t.amount, 0);

  const pendingExpenses = state.transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID)
    .reduce((acc, t) => acc + t.amount, 0);

  const projectedBalance = currentRealBalance + pendingIncome - pendingExpenses;

  // Monthly stats
  const currentMonth = new Date().getMonth();
  const incomeMonth = state.transactions
    .filter(t => t.type === TransactionType.INCOME && new Date(t.date).getMonth() === currentMonth)
    .reduce((acc, t) => acc + t.amount, 0);
    
  const expenseMonth = state.transactions
    .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).getMonth() === currentMonth)
    .reduce((acc, t) => acc + t.amount, 0);

  // Transaction Handlers
  const handleEditTrans = (t: Transaction) => {
    setEditingTransaction(t);
    setTransModalOpen(true);
  };

  const handleSaveTrans = (t: Omit<Transaction, 'id'>) => {
    if (editingTransaction) {
        onEditTransaction({ ...t, id: editingTransaction.id });
    } else {
        onAddTransaction(t);
    }
    setEditingTransaction(null);
  };

  // Account Handlers
  const handleEditAccount = (a: Account) => {
    setEditingAccount(a);
    setAccModalOpen(true);
  };

  const handleSaveAcc = (a: Account) => {
    onSaveAccount(a);
    setEditingAccount(null);
  };

  const closeTransModal = () => {
      setTransModalOpen(false);
      setEditingTransaction(null);
  };
  
  const closeAccModal = () => {
    setAccModalOpen(false);
    setEditingAccount(null);
  };

  if (currentView === 'ADVISOR') {
    return <SmartAdvisor data={state} />;
  }

  // Use the new Reports component
  if (currentView === 'REPORTS') {
    return <Reports transactions={state.transactions} />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-gray-500">Controle Duplo: Real vs. Projetado</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setTransModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <Plus className="w-5 h-5" />
            Nova Transação
          </button>
        </div>
      </div>

      {/* Dual View Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Saldo Real (Disponível)" 
          amount={currentRealBalance} 
          type="neutral" 
          icon={<Wallet className="w-6 h-6 text-indigo-600"/>}
          subtitle="Caixa atual em todas as contas"
        />
        <StatCard 
          title="Saldo Projetado" 
          amount={projectedBalance} 
          type={projectedBalance >= 0 ? 'info' : 'negative'} 
          icon={<CalendarClock className="w-6 h-6 text-blue-600"/>}
          subtitle="Após quitar pendências"
        />
        <StatCard 
          title="Receitas (Mês)" 
          amount={incomeMonth} 
          type="positive" 
          icon={<TrendingUp className="w-6 h-6 text-emerald-600"/>}
        />
        <StatCard 
          title="Despesas (Mês)" 
          amount={expenseMonth} 
          type="negative" 
          icon={<TrendingDown className="w-6 h-6 text-rose-600"/>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Transaction List */}
          <div className="xl:col-span-2 space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">Lançamentos Recentes</h3>
             </div>
             <TransactionList 
                transactions={state.transactions} 
                onDelete={onDeleteTransaction}
                onEdit={handleEditTrans}
                onToggleStatus={onUpdateStatus}
             />
          </div>

          {/* Side Panels: Accounts & Goals */}
          <div className="space-y-6">
            {/* Accounts Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-gray-400"/> Contas
                </h3>
                <button 
                  onClick={() => setAccModalOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-indigo-600 transition-colors"
                  title="Adicionar Conta"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-3">
                {state.accounts.map(acc => (
                  <div key={acc.id} className="group relative p-3 bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all shadow-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-800">{acc.name}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{acc.type === 'WALLET' ? 'Carteira' : acc.type === 'BANK' ? 'Banco' : acc.type === 'CARD' ? 'Cartão' : 'Investimento'}</p>
                      </div>
                      <span className={`font-bold ${acc.balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.balance)}
                      </span>
                    </div>
                    {/* Action Buttons */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-md shadow-sm">
                      <button 
                        onClick={() => handleEditAccount(acc)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => onDeleteAccount(acc.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {state.accounts.length === 0 && (
                   <div className="text-center py-4 text-gray-400 text-sm">Nenhuma conta cadastrada.</div>
                )}
              </div>
            </div>

            {/* Goals Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-gray-400"/> Metas
              </h3>
              <div className="space-y-4">
                {state.goals.map(goal => {
                   const percent = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                   return (
                    <div key={goal.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{goal.name}</span>
                        <span className="text-gray-500">{Math.round(percent)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                         <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(goal.currentAmount)}</span>
                         <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(goal.targetAmount)}</span>
                      </div>
                    </div>
                   );
                })}
              </div>
            </div>
          </div>
        </div>

      <TransactionModal 
        isOpen={isTransModalOpen} 
        onClose={closeTransModal} 
        onSave={handleSaveTrans}
        accounts={state.accounts}
        initialData={editingTransaction}
      />
      
      <AccountModal 
        isOpen={isAccModalOpen} 
        onClose={closeAccModal} 
        onSave={handleSaveAcc}
        initialData={editingAccount}
      />
    </div>
  );
};

export default Dashboard;
