
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, AppSettings, Contact, Category, EntityType, Branch, CostCenter, Department, Project } from '../types';
import TransactionList from './TransactionList';
import { Search, Plus, CalendarClock, TrendingUp, TrendingDown, Scale, ArrowRight, Filter, User, CreditCard, DollarSign, ListChecks, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  contacts: Contact[];
  categories: Category[]; 
  settings?: AppSettings;
  userEntity?: EntityType;
  branches?: Branch[];
  costCenters?: CostCenter[];
  departments?: Department[];
  projects?: Project[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  onToggleStatus: (t: Transaction) => void;
  onAdd: () => void;
}

const TransactionsView: React.FC<TransactionsViewProps> = ({ 
  transactions, accounts, contacts, categories, userEntity, branches = [], costCenters = [], departments = [], projects = [], onDelete, onEdit, onToggleStatus, onAdd
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
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Extrato & Fluxo</h1>
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
            <button onClick={onAdd} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black shadow-xl shadow-slate-100 flex items-center gap-2 transition-all active:scale-95">
                <Plus className="w-5 h-5" /> Novo Lançamento
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>

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
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Comprometimento</p>
                <AlertCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
                <p className="text-2xl font-black text-gray-800">{metrics.totalCount}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Lançamentos</p>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
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

        {showAdvancedFilters && (
            <div className="p-8 bg-gray-50/80 border-b border-gray-50 animate-slide-in-top">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                </div>
            </div>
        )}
        
        <div className="px-2 pb-2">
            <TransactionList 
                transactions={filteredTransactions} 
                accounts={accounts} 
                contacts={contacts} 
                onDelete={onDelete} 
                onEdit={onEdit} 
                onToggleStatus={onToggleStatus} 
            />
        </div>
      </div>
    </div>
  );
};

export default TransactionsView;
