
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, AppSettings, Contact, Category, EntityType, Branch, CostCenter, Department, Project } from '../types';
import TransactionList from './TransactionList';
import { Search, Plus, CalendarClock, TrendingUp, TrendingDown, Scale, ArrowRight, Filter, User, CreditCard, DollarSign, ListChecks, CheckCircle2, Clock, AlertCircle, ShoppingBag, ArrowLeftRight, Settings2 } from 'lucide-react';

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
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'SALE' | 'MANUAL' | 'TRANSFER'>('ALL');
  
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
      if (branchFilter !== 'ALL' && t.branchId !== branchFilter) return false;
      
      if (originFilter !== 'ALL') {
          const isSale = t.description.includes('Receita Venda #');
          const isTransfer = t.type === TransactionType.TRANSFER;
          if (originFilter === 'SALE' && !isSale) return false;
          if (originFilter === 'TRANSFER' && !isTransfer) return false;
          if (originFilter === 'MANUAL' && (isSale || isTransfer)) return false;
      }

      return true;
    });
  }, [transactions, searchTerm, typeFilter, statusFilter, accountFilter, branchFilter, originFilter, startDate, endDate]);

  const metrics = useMemo(() => {
    const paidIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
    const paidExpense = filteredTransactions.filter(t => (t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER) && t.status === TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0);
    return { realResult: paidIncome - paidExpense, totalCount: filteredTransactions.length };
  }, [filteredTransactions]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Extrato Rastreável</h1>
          <p className="text-gray-500 font-medium italic">Fluxo financeiro integrado com a operação.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${showAdvancedFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Filter className="w-4 h-4" /> Filtros Avançados
            </button>
            <button onClick={onAdd} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black shadow-xl flex items-center gap-2 transition-all active:scale-95">
                <Plus className="w-5 h-5" /> Novo Lançamento
            </button>
        </div>
      </div>

      {showAdvancedFilters && (
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6 animate-slide-in-top">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Unidade / Filial</label>
                      <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold appearance-none">
                          <option value="ALL">Todas as Filiais</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Origem da Operação</label>
                      <select value={originFilter} onChange={e => setOriginFilter(e.target.value as any)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold appearance-none">
                          <option value="ALL">Qualquer Origem</option>
                          <option value="SALE">Apenas Vendas (PDV)</option>
                          <option value="TRANSFER">Transferências</option>
                          <option value="MANUAL">Lançamentos Diretos</option>
                      </select>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Status de Pagamento</label>
                      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold appearance-none">
                          <option value="ALL">Todos Status</option>
                          <option value="PAID">Pago / Liquidado</option>
                          <option value="PENDING">Pendente</option>
                          <option value="OVERDUE">Atrasado</option>
                      </select>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Tipo</label>
                      <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold appearance-none">
                          <option value="ALL">Receitas & Despesas</option>
                          <option value="INCOME">Apenas Receitas</option>
                          <option value="EXPENSE">Apenas Despesas</option>
                      </select>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center gap-4 bg-gray-50/30">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3" />
            <input type="text" placeholder="Buscar por descrição ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white shadow-sm" />
          </div>
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-200 shrink-0 shadow-sm">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 text-xs font-black uppercase outline-none border-none" />
            <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 text-xs font-black uppercase outline-none border-none" />
          </div>
        </div>
        
        <div className="px-2 pb-2">
            <TransactionList transactions={filteredTransactions} accounts={accounts} contacts={contacts} onDelete={onDelete} onEdit={onEdit} onToggleStatus={onToggleStatus} />
        </div>
      </div>
    </div>
  );
};

export default TransactionsView;
