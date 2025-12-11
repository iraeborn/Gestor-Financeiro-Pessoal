
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account } from '../types';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import StatCard from './StatCard';
import { Search, Filter, Download, Plus, Wallet, CalendarClock, TrendingUp, TrendingDown } from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  onToggleStatus: (t: Transaction) => void;
  onAdd: (t: Omit<Transaction, 'id'>) => void;
}

const TransactionsView: React.FC<TransactionsViewProps> = ({ 
  transactions, 
  accounts,
  onDelete, 
  onEdit, 
  onToggleStatus,
  onAdd
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // --- Calculations for StatCards ---
  const currentRealBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  const pendingIncome = transactions
    .filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID)
    .reduce((acc, t) => acc + t.amount, 0);

  const pendingExpenses = transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID)
    .reduce((acc, t) => acc + t.amount, 0);

  const projectedBalance = currentRealBalance + pendingIncome - pendingExpenses;

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const incomeMonth = transactions
    .filter(t => {
        const d = new Date(t.date);
        return t.type === TransactionType.INCOME && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, t) => acc + t.amount, 0);

  const expenseMonth = transactions
    .filter(t => {
        const d = new Date(t.date);
        return t.type === TransactionType.EXPENSE && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, t) => acc + t.amount, 0);

  // --- Filtering Logic ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Filter by Month
      if (!t.date.startsWith(monthFilter)) return false;

      // Filter by Search Term
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase()) && !t.category.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Filter by Type
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;

      // Filter by Status
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

      // Filter by Account
      if (accountFilter !== 'ALL') {
        const matchesSource = t.accountId === accountFilter;
        // Para transferências, queremos ver se a conta selecionada é a origem OU o destino
        const matchesDest = t.type === TransactionType.TRANSFER && t.destinationAccountId === accountFilter;
        
        if (!matchesSource && !matchesDest) return false;
      }

      return true;
    });
  }, [transactions, searchTerm, typeFilter, statusFilter, accountFilter, monthFilter]);

  const totalFiltered = filteredTransactions.reduce((acc, t) => {
    // Se estivermos filtrando por uma conta específica e for uma transferência:
    if (accountFilter !== 'ALL' && t.type === TransactionType.TRANSFER) {
        // Se a conta selecionada for a de origem, é uma saída (subtrai)
        if (t.accountId === accountFilter) return acc - t.amount;
        // Se a conta selecionada for a de destino, é uma entrada (soma)
        if (t.destinationAccountId === accountFilter) return acc + t.amount;
    }

    // Lógica padrão
    return t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount;
  }, 0);

  const handleOpenEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setIsModalOpen(true);
  };

  const handleSave = (t: Omit<Transaction, 'id'>) => {
    if (editingTransaction) {
        onEdit({ ...t, id: editingTransaction.id });
    } else {
        onAdd(t);
    }
    setEditingTransaction(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lançamentos</h1>
          <p className="text-gray-500">Gerencie e audite suas movimentações detalhadas.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Novo Lançamento
        </button>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Saldo Real" 
          amount={currentRealBalance} 
          type="neutral" 
          icon={<Wallet className="w-5 h-5 text-indigo-600"/>}
          subtitle="Disponível agora"
        />
        <StatCard 
          title="Saldo Projetado" 
          amount={projectedBalance} 
          type={projectedBalance >= 0 ? 'info' : 'negative'} 
          icon={<CalendarClock className="w-5 h-5 text-blue-600"/>}
          subtitle="Após pendências"
        />
        <StatCard 
          title="Receitas (Mês)" 
          amount={incomeMonth} 
          type="positive" 
          icon={<TrendingUp className="w-5 h-5 text-emerald-600"/>}
        />
        <StatCard 
          title="Despesas (Mês)" 
          amount={expenseMonth} 
          type="negative" 
          icon={<TrendingDown className="w-5 h-5 text-rose-600"/>}
        />
      </div>

      {/* Toolbar de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
        
        {/* Busca */}
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

        {/* Filtros Dropdown */}
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <input 
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none max-w-[150px]"
          >
            <option value="ALL">Todas as Contas</option>
            {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value={TransactionType.INCOME}>Receitas</option>
            <option value={TransactionType.EXPENSE}>Despesas</option>
            <option value={TransactionType.TRANSFER}>Transferências</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value={TransactionStatus.PAID}>Pagos</option>
            <option value={TransactionStatus.PENDING}>Pendentes</option>
            <option value={TransactionStatus.OVERDUE}>Atrasados</option>
          </select>
        </div>
      </div>

      {/* Resumo Rápido da Seleção */}
      <div className="flex items-center justify-between text-sm text-gray-500 px-2">
        <span>Exibindo {filteredTransactions.length} registros</span>
        <span className={totalFiltered >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
          Saldo da Seleção: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFiltered)}
        </span>
      </div>

      <TransactionList 
        transactions={filteredTransactions} 
        onDelete={onDelete}
        onEdit={handleOpenEdit}
        onToggleStatus={onToggleStatus}
      />

      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSave={handleSave}
        accounts={accounts}
        initialData={editingTransaction}
      />
    </div>
  );
};

export default TransactionsView;
