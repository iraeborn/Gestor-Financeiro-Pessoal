
import React, { useState } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Account, ViewMode, AppSettings, AccountType, Contact } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import AccountModal from './AccountModal';
import PaymentConfirmationModal from './PaymentConfirmationModal';
import { CashFlowChart, ExpensesByCategory, BalanceDistributionChart } from './Charts';
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, Pencil, Trash2, ArrowRight, PieChart, BarChart3, Coins } from 'lucide-react';

interface DashboardProps {
  state: AppState;
  settings?: AppSettings;
  onAddTransaction: (t: Omit<Transaction, 'id'>, newContact?: Contact) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (t: Transaction, newContact?: Contact) => void;
  onUpdateStatus: (t: Transaction) => void;
  onSaveAccount: (a: Account) => void;
  onDeleteAccount: (id: string) => void;
  onChangeView: (view: ViewMode) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  state, 
  settings,
  onAddTransaction, 
  onDeleteTransaction, 
  onEditTransaction, 
  onUpdateStatus, 
  onSaveAccount,
  onDeleteAccount,
  onChangeView
}) => {
  const [isTransModalOpen, setTransModalOpen] = useState(false);
  const [isAccModalOpen, setAccModalOpen] = useState(false);
  
  // Payment Confirmation Modal State
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [transactionToPay, setTransactionToPay] = useState<Transaction | null>(null);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [recentLimit, setRecentLimit] = useState(5); 

  const includeCards = settings?.includeCreditCardsInTotal ?? true;

  // --- Calculations ---
  const currentRealBalance = state.accounts.reduce((acc, curr) => {
    if (!includeCards && curr.type === AccountType.CARD) return acc;
    return acc + curr.balance;
  }, 0);

  const pendingIncome = state.transactions
    .filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID)
    .reduce((acc, t) => acc + t.amount, 0);

  const pendingExpenses = state.transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID)
    .reduce((acc, t) => acc + t.amount, 0);

  const projectedBalance = currentRealBalance + pendingIncome - pendingExpenses;

  const currentMonth = new Date().getMonth();
  const incomeMonth = state.transactions
    .filter(t => t.type === TransactionType.INCOME && new Date(t.date).getMonth() === currentMonth)
    .reduce((acc, t) => acc + t.amount, 0);
    
  const expenseMonth = state.transactions
    .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).getMonth() === currentMonth)
    .reduce((acc, t) => acc + t.amount, 0);

  // --- Handlers ---
  const handleEditTrans = (t: Transaction) => {
    setEditingTransaction(t);
    setTransModalOpen(true);
  };

  const handleSaveTrans = (t: Omit<Transaction, 'id'>, newContact?: Contact) => {
    if (editingTransaction) {
        onEditTransaction({ ...t, id: editingTransaction.id }, newContact);
    } else {
        onAddTransaction(t, newContact);
    }
    setEditingTransaction(null);
  };

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

  // Intercept the status toggle to show payment modal if needed
  const handleStatusToggle = (t: Transaction) => {
    // If it's NOT paid, we are about to pay it. Open modal.
    if (t.status !== TransactionStatus.PAID) {
        setTransactionToPay(t);
        setPaymentModalOpen(true);
    } else {
        // If unmarking as paid, just proceed with normal toggle
        onUpdateStatus(t);
    }
  };

  const handleConfirmPayment = (t: Transaction, finalAmount: number) => {
     // We need to update both status and amount
     const updatedTransaction = {
         ...t,
         status: TransactionStatus.PAID,
         amount: finalAmount
     };
     onEditTransaction(updatedTransaction);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-gray-500">Resumo financeiro e análise visual.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setTransModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <Plus className="w-5 h-5" />
            Lançamento Rápido
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Saldo Real" 
          amount={currentRealBalance} 
          type="neutral" 
          icon={<Wallet className="w-6 h-6 text-indigo-600"/>}
          subtitle={includeCards ? "Disponível agora" : "Sem Cartões de Crédito"}
        />
        <StatCard 
          title="Saldo Projetado" 
          amount={projectedBalance} 
          type={projectedBalance >= 0 ? 'info' : 'negative'} 
          icon={<CalendarClock className="w-6 h-6 text-blue-600"/>}
          subtitle="Após pendências"
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fluxo de Caixa */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500"/> Fluxo Recente
          </h3>
          <CashFlowChart transactions={state.transactions} />
        </div>

        {/* Despesas por Categoria */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
           <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-rose-500"/> Top Despesas
          </h3>
          <ExpensesByCategory transactions={state.transactions} />
        </div>

         {/* Distribuição de Saldo */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
           <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-500"/> Composição de Saldo
          </h3>
          <BalanceDistributionChart accounts={state.accounts} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column: Recent Activity */}
          <div className="xl:col-span-2 space-y-6">
             {/* Recent Transactions Feed */}
             <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Últimas Movimentações</h3>
                  <div className="flex items-center gap-3">
                    <select
                      value={recentLimit}
                      onChange={(e) => setRecentLimit(Number(e.target.value))}
                      className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600"
                    >
                      <option value={5}>5 itens</option>
                      <option value={10}>10 itens</option>
                      <option value={15}>15 itens</option>
                      <option value={20}>20 itens</option>
                    </select>
                    <button 
                      onClick={() => onChangeView('TRANSACTIONS')}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      Ver todas <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Dynamic limit based on user selection */}
                <TransactionList 
                  transactions={state.transactions.slice(0, recentLimit)} 
                  accounts={state.accounts} // Passando contas
                  contacts={state.contacts} // Passando contatos
                  onDelete={onDeleteTransaction}
                  onEdit={handleEditTrans}
                  onToggleStatus={handleStatusToggle}
                />
             </div>
          </div>

          {/* Right Column: Accounts & Goals */}
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
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{acc.type}</p>
                      </div>
                      <span className={`font-bold ${acc.balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.balance)}
                      </span>
                    </div>
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
        contacts={state.contacts}
        initialData={editingTransaction}
      />
      
      <AccountModal 
        isOpen={isAccModalOpen} 
        onClose={closeAccModal} 
        onSave={handleSaveAcc}
        initialData={editingAccount}
      />

      <PaymentConfirmationModal
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        transaction={transactionToPay}
        onConfirm={handleConfirmPayment}
      />
    </div>
  );
};

export default Dashboard;
