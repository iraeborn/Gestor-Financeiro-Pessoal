
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, AppSettings, AccountType, Contact, Category, EntityType } from '../types';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import PaymentConfirmationModal from './PaymentConfirmationModal';
import StatCard from './StatCard';
import { Search, Filter, Download, Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { useConfirm } from './AlertSystem';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  contacts: Contact[];
  categories: Category[]; 
  settings?: AppSettings;
  userEntity?: EntityType;
  pjData?: any; 
  onDelete: (id: string) => void;
  onEdit: (t: Transaction, newContact?: Contact, newCategory?: Category) => void;
  onToggleStatus: (t: Transaction) => void;
  onAdd: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  onUpdateAttachments?: (t: Transaction, urls: string[]) => void;
}

const TransactionsView: React.FC<TransactionsViewProps> = ({ 
  transactions, 
  accounts,
  contacts,
  categories,
  settings,
  userEntity = EntityType.PERSONAL,
  pjData,
  onDelete, 
  onEdit, 
  onToggleStatus,
  onAdd,
  onUpdateAttachments
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [transactionToPay, setTransactionToPay] = useState<Transaction | null>(null);

  // --- Lógica de Filtragem ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Filtro por Mês
      if (!t.date.startsWith(monthFilter)) return false;

      // Filtro por Termo de Busca
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase()) && !t.category.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Filtro por Tipo
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;

      // Filtro por Status
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

      // Filtro por Conta
      if (accountFilter !== 'ALL') {
        const matchesSource = t.accountId === accountFilter;
        const matchesDest = t.type === TransactionType.TRANSFER && t.destinationAccountId === accountFilter;
        if (!matchesSource && !matchesDest) return false;
      }

      return true;
    });
  }, [transactions, searchTerm, typeFilter, statusFilter, accountFilter, monthFilter]);

  // --- Cálculos Estritamente Baseados no Filtro ---
  
  // 1. Receitas do Período
  const filteredIncome = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactions]);

  // 2. Despesas do Período
  const filteredExpense = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactions]);

  // 3. Resultado Líquido (Receitas - Despesas) no Período
  const periodBalance = filteredIncome - filteredExpense;

  // 4. Pendências Líquidas (O que ainda vai entrar ou sair na seleção)
  const filteredPendingNet = useMemo(() => {
    return filteredTransactions
      .filter(t => t.status !== TransactionStatus.PAID)
      .reduce((acc, t) => {
          if (t.type === TransactionType.INCOME) return acc + t.amount;
          if (t.type === TransactionType.EXPENSE) return acc - t.amount;
          return acc;
      }, 0);
  }, [filteredTransactions]);

  const handleOpenEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setIsModalOpen(true);
  };

  const handleSave = (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => {
    if (editingTransaction) {
        onEdit({ ...t, id: editingTransaction.id }, newContact, newCategory);
    } else {
        onAdd(t, newContact, newCategory);
    }
    setEditingTransaction(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const handleStatusToggle = (t: Transaction) => {
    if (t.status !== TransactionStatus.PAID) {
        setTransactionToPay(t);
        setPaymentModalOpen(true);
    } else {
        onToggleStatus(t);
    }
  };

  const handleConfirmPayment = (t: Transaction, finalAmount: number) => {
     const updatedTransaction = { ...t, status: TransactionStatus.PAID, amount: finalAmount };
     onEdit(updatedTransaction);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lançamentos</h1>
          <p className="text-gray-500">Gerencie e audite suas movimentações detalhadas.</p>
        </div>
        <button 
          onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Novo Lançamento
        </button>
      </div>

      {/* Stats Cards Row - 100% Reativos aos Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Receitas no Período" 
          amount={filteredIncome} 
          type="positive" 
          icon={<TrendingUp className="w-5 h-5 text-emerald-600"/>}
          subtitle="Soma das entradas filtradas"
        />
        <StatCard 
          title="Despesas no Período" 
          amount={filteredExpense} 
          type="negative" 
          icon={<TrendingDown className="w-5 h-5 text-rose-600"/>}
          subtitle="Soma das saídas filtradas"
        />
        <StatCard 
          title="Resultado do Período" 
          amount={periodBalance} 
          type={periodBalance >= 0 ? 'info' : 'negative'} 
          icon={<Scale className="w-5 h-5 text-blue-600"/>}
          subtitle="Receitas menos Despesas"
        />
        <StatCard 
          title="Projeção de Pendentes" 
          amount={filteredPendingNet} 
          type={filteredPendingNet >= 0 ? 'neutral' : 'negative'} 
          icon={<CalendarClock className="w-5 h-5 text-indigo-600"/>}
          subtitle="Balanço dos itens não pagos"
        />
      </div>

      {/* Toolbar de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <input 
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
          />

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none max-w-[150px]"
          >
            <option value="ALL">Todas Contas</option>
            {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="ALL">Tipos</option>
            <option value={TransactionType.INCOME}>Receitas</option>
            <option value={TransactionType.EXPENSE}>Despesas</option>
            <option value={TransactionType.TRANSFER}>Transf.</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="ALL">Status</option>
            <option value={TransactionStatus.PAID}>Pagos</option>
            <option value={TransactionStatus.PENDING}>Pendentes</option>
            <option value={TransactionStatus.OVERDUE}>Atrasados</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 px-2">
        <span>Exibindo {filteredTransactions.length} registros no filtro atual</span>
      </div>

      <TransactionList 
        transactions={filteredTransactions} 
        accounts={accounts} 
        contacts={contacts}
        onDelete={onDelete}
        onEdit={handleOpenEdit}
        onToggleStatus={handleStatusToggle}
        onUpdateAttachments={onUpdateAttachments}
      />

      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSave={handleSave}
        accounts={accounts}
        contacts={contacts}
        categories={categories}
        initialData={editingTransaction}
        userEntity={userEntity}
        branches={pjData?.branches}
        costCenters={pjData?.costCenters}
        departments={pjData?.departments}
        projects={pjData?.projects}
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

export default TransactionsView;
