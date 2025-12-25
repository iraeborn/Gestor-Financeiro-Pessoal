
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, AppSettings, Contact, Category, EntityType } from '../types';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import StatCard from './StatCard';
import { Search, Plus, CalendarClock, TrendingUp, TrendingDown, Scale, ArrowRight, Filter, User, CreditCard, DollarSign, ListChecks } from 'lucide-react';

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
  const [contactFilter, setContactFilter] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = t.date;
      if (tDate < startDate || tDate > endDate) return false;
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (accountFilter !== 'ALL' && t.accountId !== accountFilter) return false;
      if (contactFilter !== 'ALL' && t.contactId !== contactFilter) return false;
      
      const val = Number(t.amount);
      if (minAmount && val < Number(minAmount)) return false;
      if (maxAmount && val > Number(maxAmount)) return false;

      return true;
    });
  }, [transactions, searchTerm, typeFilter, statusFilter, accountFilter, contactFilter, minAmount, maxAmount, startDate, endDate]);

  const filteredIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
  const filteredExpense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
  const periodBalance = filteredIncome - filteredExpense;

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setAccountFilter('ALL');
    setContactFilter('ALL');
    setMinAmount('');
    setMaxAmount('');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lançamentos</h1>
          <p className="text-gray-500">Auditoria e controle detalhado por período.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${showAdvancedFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
                <Filter className="w-4 h-4" />
                {showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros'}
            </button>
            <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2">
                <Plus className="w-5 h-5" /> Novo Lançamento
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receitas (Filtrado)" amount={filteredIncome} type="positive" icon={<TrendingUp className="w-5 h-5 text-emerald-600"/>} />
        <StatCard title="Despesas (Filtrado)" amount={filteredExpense} type="negative" icon={<TrendingDown className="w-5 h-5 text-rose-600"/>} />
        <StatCard title="Resultado (Filtrado)" amount={periodBalance} type={periodBalance >= 0 ? 'info' : 'negative'} icon={<Scale className="w-5 h-5 text-blue-600"/>} />
        <StatCard title="Lançamentos" amount={filteredTransactions.length} type="neutral" icon={<CalendarClock className="w-5 h-5 text-indigo-600"/>} subtitle="Total no filtro atual" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Barra Superior de Busca e Datas */}
        <div className="p-4 border-b border-gray-50 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            <input 
                type="text" 
                placeholder="Buscar por descrição..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
            />
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 shrink-0">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1.5 rounded-lg bg-white text-xs font-bold outline-none border border-gray-100 shadow-sm" />
            <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1.5 rounded-lg bg-white text-xs font-bold outline-none border border-gray-100 shadow-sm" />
          </div>
        </div>

        {/* Filtros Avançados Expansíveis */}
        {showAdvancedFilters && (
            <div className="p-6 bg-gray-50/50 border-b border-gray-50 animate-slide-in-top">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Conta */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
                            <CreditCard className="w-3 h-3" /> Conta / Carteira
                        </label>
                        <select 
                            value={accountFilter} 
                            onChange={(e) => setAccountFilter(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">Todas as Contas</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    </div>

                    {/* Contato */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
                            <User className="w-3 h-3" /> Pessoa / Empresa
                        </label>
                        <select 
                            value={contactFilter} 
                            onChange={(e) => setContactFilter(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">Todos os Contatos</option>
                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Status e Tipo */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
                                <ListChecks className="w-3 h-3" /> Status
                            </label>
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="ALL">Todos</option>
                                <option value={TransactionStatus.PAID}>Pago</option>
                                <option value={TransactionStatus.PENDING}>Pendente</option>
                                <option value={TransactionStatus.OVERDUE}>Atrasado</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
                                <TrendingUp className="w-3 h-3" /> Tipo
                            </label>
                            <select 
                                value={typeFilter} 
                                onChange={(e) => setTypeFilter(e.target.value as any)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="ALL">Todos</option>
                                <option value={TransactionType.INCOME}>Receita</option>
                                <option value={TransactionType.EXPENSE}>Despesa</option>
                            </select>
                        </div>
                    </div>

                    {/* Valor */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
                            <DollarSign className="w-3 h-3" /> Faixa de Valor
                        </label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                placeholder="Min" 
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-gray-300">-</span>
                            <input 
                                type="number" 
                                placeholder="Max" 
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-2">
                    <button 
                        onClick={resetFilters}
                        className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Limpar Filtros
                    </button>
                    <button 
                        onClick={() => setShowAdvancedFilters(false)}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                    >
                        Aplicar Filtros
                    </button>
                </div>
            </div>
        )}
        
        <TransactionList 
            transactions={filteredTransactions} 
            accounts={accounts} 
            contacts={contacts} 
            onDelete={onDelete} 
            onEdit={(t) => { setEditingTransaction(t); setIsModalOpen(true); }} 
            onToggleStatus={onToggleStatus} 
        />
      </div>

      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={(t, nc, ncat) => { if(editingTransaction) onEdit({...editingTransaction, ...t}, nc, ncat); else onAdd(t, nc, ncat); setIsModalOpen(false); }} 
        accounts={accounts} 
        contacts={contacts} 
        categories={categories} 
        initialData={editingTransaction} 
        userEntity={userEntity} 
      />
    </div>
  );
};

export default TransactionsView;
