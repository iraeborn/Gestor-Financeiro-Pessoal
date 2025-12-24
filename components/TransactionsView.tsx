
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, AppSettings, Contact, Category, EntityType } from '../types';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import PaymentConfirmationModal from './PaymentConfirmationModal';
import StatCard from './StatCard';
import { Search, Plus, CalendarClock, TrendingUp, TrendingDown, Scale, ArrowRight } from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  contacts: Contact[];
  categories: Category[]; 
  settings?: AppSettings;
  userEntity?: EntityType;
  onDelete: (id: string) => void;
  onEdit: (t: Transaction, newContact?: Contact, newCategory?: Category) => void;
  onToggleStatus: (t: Transaction) => void;
  onAdd: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
}

const TransactionsView: React.FC<TransactionsViewProps> = ({ 
  transactions, accounts, contacts, categories, userEntity, onDelete, onEdit, onToggleStatus, onAdd
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = t.date;
      if (tDate < startDate || tDate > endDate) return false;
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (accountFilter !== 'ALL' && t.accountId !== accountFilter) return false;
      return true;
    });
  }, [transactions, searchTerm, typeFilter, statusFilter, accountFilter, startDate, endDate]);

  const filteredIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
  const filteredExpense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
  const periodBalance = filteredIncome - filteredExpense;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Lançamentos</h1><p className="text-gray-500">Auditoria e controle detalhado por período.</p></div>
        <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2"><Plus className="w-5 h-5" /> Novo Lançamento</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receitas (Período)" amount={filteredIncome} type="positive" icon={<TrendingUp className="w-5 h-5 text-emerald-600"/>} />
        <StatCard title="Despesas (Período)" amount={filteredExpense} type="negative" icon={<TrendingDown className="w-5 h-5 text-rose-600"/>} />
        <StatCard title="Resultado (Período)" amount={periodBalance} type={periodBalance >= 0 ? 'info' : 'negative'} icon={<Scale className="w-5 h-5 text-blue-600"/>} />
        <StatCard title="Total Registros" amount={filteredTransactions.length} type="neutral" icon={<CalendarClock className="w-5 h-5 text-indigo-600"/>} subtitle="Lançamentos filtrados" />
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 relative"><Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" /><input type="text" placeholder="Buscar lançamentos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 outline-none" /></div>
        <div className="flex gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 shrink-0">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1.5 rounded-lg bg-white text-xs font-bold outline-none" />
            <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1.5 rounded-lg bg-white text-xs font-bold outline-none" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold outline-none"><option value="ALL">Todos Tipos</option><option value={TransactionType.INCOME}>Receitas</option><option value={TransactionType.EXPENSE}>Despesas</option></select>
        </div>
      </div>

      <TransactionList transactions={filteredTransactions} accounts={accounts} contacts={contacts} onDelete={onDelete} onEdit={(t) => { setEditingTransaction(t); setIsModalOpen(true); }} onToggleStatus={onToggleStatus} />

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={(t, nc, ncat) => { if(editingTransaction) onEdit(editingTransaction, nc, ncat); else onAdd(t, nc, ncat); setIsModalOpen(false); }} accounts={accounts} contacts={contacts} categories={categories} initialData={editingTransaction} userEntity={userEntity} />
    </div>
  );
};

export default TransactionsView;
