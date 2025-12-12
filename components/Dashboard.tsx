
import React, { useState } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Account, ViewMode, AppSettings, AccountType, Contact, EntityType } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import PaymentConfirmationModal from './PaymentConfirmationModal';
import { CashFlowChart, ExpensesByCategory, BalanceDistributionChart, BalanceHistoryChart } from './Charts';
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, ArrowRight, PieChart, BarChart3, Coins, Building, CreditCard, Utensils, Landmark } from 'lucide-react';

interface DashboardProps {
  state: AppState;
  settings?: AppSettings;
  // Inject User/PJ context to dashboard to pass to modal
  userEntity?: EntityType;
  onAddTransaction: (t: Omit<Transaction, 'id'>, newContact?: Contact) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (t: Transaction, newContact?: Contact) => void;
  onUpdateStatus: (t: Transaction) => void;
  onChangeView: (view: ViewMode) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  state, 
  settings,
  userEntity = EntityType.PERSONAL,
  onAddTransaction, 
  onDeleteTransaction, 
  onEditTransaction, 
  onUpdateStatus, 
  onChangeView
}) => {
  const [isTransModalOpen, setTransModalOpen] = useState(false);
  
  // Payment Confirmation Modal State
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [transactionToPay, setTransactionToPay] = useState<Transaction | null>(null);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
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

  const closeTransModal = () => {
      setTransModalOpen(false);
      setEditingTransaction(null);
  };
  
  const handleStatusToggle = (t: Transaction) => {
    if (t.status !== TransactionStatus.PAID) {
        setTransactionToPay(t);
        setPaymentModalOpen(true);
    } else {
        onUpdateStatus(t);
    }
  };

  const handleConfirmPayment = (t: Transaction, finalAmount: number) => {
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500"/> Fluxo Recente
          </h3>
          <CashFlowChart transactions={state.transactions} />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
           <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-rose-500"/> Top Despesas
          </h3>
          <ExpensesByCategory transactions={state.transactions} />
        </div>

         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 lg:col-span-1">
           <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-500"/> Composição de Saldo
          </h3>
          <BalanceDistributionChart accounts={state.accounts} />
        </div>
      </div>

      {/* SEÇÃO 1: ÚLTIMAS MOVIMENTAÇÕES (FULL WIDTH) */}
      <div className="w-full">
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
                onClick={() => onChangeView('FIN_TRANSACTIONS')}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
                Ver todas <ArrowRight className="w-4 h-4" />
            </button>
            </div>
        </div>
        <TransactionList 
            transactions={state.transactions.slice(0, recentLimit)} 
            accounts={state.accounts} 
            contacts={state.contacts} 
            onDelete={onDeleteTransaction}
            onEdit={handleEditTrans}
            onToggleStatus={handleStatusToggle}
        />
      </div>

      {/* SEÇÃO 2: RELATÓRIO DE SALDOS (70%) E METAS (30%) */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Relatório de Contas (Chart) - 70% */}
        <div className="lg:w-[70%] bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80 flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-gray-400"/> Evolução Patrimonial
                </h3>
                <button 
                    onClick={() => onChangeView('FIN_ACCOUNTS')}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    Gerenciar Contas
                </button>
            </div>
            
            <div className="flex-1 w-full">
                <BalanceHistoryChart accounts={state.accounts} transactions={state.transactions} />
            </div>
        </div>

        {/* Painel Metas - 30% */}
        <div className="lg:w-[30%] bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Target className="w-5 h-5 text-gray-400"/> Metas
                </h3>
                <button 
                    onClick={() => onChangeView('FIN_GOALS')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    Ver todas
                </button>
            </div>
            <div className="space-y-4">
                {state.goals.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma meta definida.</p>
                ) : (
                    state.goals.slice(0, 3).map(goal => {
                        const percent = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                        return (
                        <div key={goal.id}>
                            <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700 truncate max-w-[150px]" title={goal.name}>{goal.name}</span>
                            <span className="text-gray-500 text-xs">{Math.round(percent)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                            <div 
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${percent}%` }}
                            ></div>
                            </div>
                        </div>
                        );
                    })
                )}
            </div>
        </div>

      </div>

      <TransactionModal 
        isOpen={isTransModalOpen} 
        onClose={closeTransModal} 
        onSave={handleSaveTrans}
        accounts={state.accounts}
        contacts={state.contacts}
        categories={state.categories || []}
        initialData={editingTransaction}
        userEntity={userEntity}
        branches={state.branches}
        costCenters={state.costCenters}
        departments={state.departments}
        projects={state.projects}
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
