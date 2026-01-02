
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, AppSettings, Contact, Category, EntityType } from '../types';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import { Search, Plus, CalendarClock, TrendingUp, TrendingDown, Scale, ArrowRight, Filter, User, CreditCard, DollarSign, ListChecks, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

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

  // --- CÁLCULOS DE GESTÃO (FILTRADOS) ---
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

  const metrics = useMemo(() => {
    const paidIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
    const pendingIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
    
    const paidExpense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
    const pendingExpense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);

    const realResult = paidIncome - paidExpense;
    const projectedResult = (paidIncome + pendingIncome) - (paidExpense + pendingExpense);

    return {
        paidIncome, pendingIncome,
        paidExpense, pendingExpense,
        realResult, projectedResult,
        totalCount: filteredTransactions.length
    };
  }, [filteredTransactions]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Lançamentos</h1>
          <p className="text-gray-500 font-medium italic">Análise detalhada do fluxo do período.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${showAdvancedFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
                <Filter className="w-4 h-4" />
                {showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros'}
            </button>
            <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black shadow-xl shadow-slate-100 flex items-center gap-2 transition-all active:scale-95">
                <Plus className="w-5 h-5" /> Novo Lançamento
            </button>
        </div>
      </div>

      {/* REVISÃO DOS CARDS - ESTILO DASHBOARD GESTOR */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Resultado Realizado */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Resultado Caixa (Pago)</p>
                <Scale className={`w-5 h-5 ${metrics.realResult >= 0 ? 'text-indigo-500' : 'text-rose-500'}`} />
            </div>
            <h3 className={`text-2xl font-black ${metrics.realResult >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
                {formatCurrency(metrics.realResult)}
            </h3>
            <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Projetado: {formatCurrency(metrics.projectedResult)}</p>
            </div>
        </div>

        {/* Card 2: Entradas */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Entradas no Filtro</p>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="space-y-0.5">
                <p className="text-xl font-black text-emerald-600">+{formatCurrency(metrics.paidIncome + metrics.pendingIncome)}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {formatCurrency(metrics.paidIncome)} recebido
                </div>
            </div>
            <div className="mt-2 text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {formatCurrency(metrics.pendingIncome)} pendente
            </div>
        </div>

        {/* Card 3: Saídas */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-rose-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Saídas no Filtro</p>
                <TrendingDown className="w-5 h-5 text-rose-500" />
            </div>
            <div className="space-y-0.5">
                <p className="text-xl font-black text-rose-600">-{formatCurrency(metrics.paidExpense + metrics.pendingExpense)}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                    <CheckCircle2 className="w-3 h-3 text-rose-500" /> {formatCurrency(metrics.paidExpense)} pago
                </div>
            </div>
            <div className="mt-2 text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {formatCurrency(metrics.pendingExpense)} a pagar
            </div>
        </div>

        {/* Card 4: Status do Período */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Comprometimento</p>
                <AlertCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
                <p className="text-2xl font-black text-gray-800">{metrics.totalCount}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Lançamentos no período</p>
            </div>
            <div className="mt-3">
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-indigo-500 transition-all duration-1000" 
                        style={{ width: `${metrics.totalCount > 0 ? ((metrics.paidIncome + metrics.paidExpense) / (metrics.paidIncome + metrics.pendingIncome + metrics.paidExpense + metrics.pendingExpense || 1)) * 100 : 0}%` }}
                    ></div>
                </div>
                <p className="text-[9px] text-indigo-400 font-black uppercase mt-1">Volume Liquidado</p>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        {/* Barra Superior de Busca e Datas */}
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center gap-4 bg-gray-50/30">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3" />
            <input 
                type="text" 
                placeholder="Buscar por descrição..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white shadow-sm" 
            />
          </div>
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-200 shrink-0 shadow-sm">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 text-xs font-black uppercase outline-none border-none" />
            <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 text-xs font-black uppercase outline-none border-none" />
          </div>
        </div>

        {/* Filtros Avançados Expansíveis */}
        {showAdvancedFilters && (
            <div className="p-8 bg-gray-50/80 border-b border-gray-50 animate-slide-in-top">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Conta */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 ml-1">
                            <CreditCard className="w-3 h-3" /> Conta / Carteira
                        </label>
                        <select 
                            value={accountFilter} 
                            onChange={(e) => setAccountFilter(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="ALL">Todas as Contas</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    </div>

                    {/* Contato */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 ml-1">
                            <User className="w-3 h-3" /> Pessoa / Empresa
                        </label>
                        <select 
                            value={contactFilter} 
                            onChange={(e) => setContactFilter(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="ALL">Todos os Contatos</option>
                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Status e Tipo */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 ml-1">
                                <ListChecks className="w-3 h-3" /> Status
                            </label>
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none cursor-pointer"
                            >
                                <option value="ALL">Todos</option>
                                <option value={TransactionStatus.PAID}>Pago</option>
                                <option value={TransactionStatus.PENDING}>Pendente</option>
                                <option value={TransactionStatus.OVERDUE}>Atrasado</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 ml-1">
                                <TrendingUp className="w-3 h-3" /> Tipo
                            </label>
                            <select 
                                value={typeFilter} 
                                onChange={(e) => setTypeFilter(e.target.value as any)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none cursor-pointer"
                            >
                                <option value="ALL">Todos</option>
                                <option value={TransactionType.INCOME}>Receita</option>
                                <option value={TransactionType.EXPENSE}>Despesa</option>
                            </select>
                        </div>
                    </div>

                    {/* Valor */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 ml-1">
                            <DollarSign className="w-3 h-3" /> Faixa de Valor
                        </label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                placeholder="Min" 
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            />
                            <span className="text-gray-300">-</span>
                            <input 
                                type="number" 
                                placeholder="Max" 
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3">
                    <button 
                        onClick={resetFilters}
                        className="px-6 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors tracking-widest"
                    >
                        Limpar Filtros
                    </button>
                    <button 
                        onClick={() => setShowAdvancedFilters(false)}
                        className="bg-indigo-600 text-white px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                    >
                        Aplicar Estratégia
                    </button>
                </div>
            </div>
        )}
        
        <div className="px-2 pb-2">
            <TransactionList 
                transactions={filteredTransactions} 
                accounts={accounts} 
                contacts={contacts} 
                onDelete={onDelete} 
                onEdit={(t) => { setEditingTransaction(t); setIsModalOpen(true); }} 
                onToggleStatus={onToggleStatus} 
            />
        </div>
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
