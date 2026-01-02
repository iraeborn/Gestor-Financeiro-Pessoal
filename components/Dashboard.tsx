
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Contact, EntityType, Category, ViewMode, AppSettings, User } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import { CashFlowChart, ExpensesByCategory } from './Charts';
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, ArrowRight, BrainCircuit, Sparkles, Loader2, Landmark, Receipt, AlertCircle, BarChart3, Scale, Eye, Glasses, Monitor, Heart, Activity, Stethoscope, SmilePlus } from 'lucide-react';
import { getManagerDiagnostic } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface DashboardProps {
  state: AppState;
  settings?: AppSettings;
  currentUser?: User;
  onAddTransaction: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (t: Transaction, newContact?: Contact, newCategory?: Category) => void;
  onUpdateStatus: (t: Transaction) => void;
  onChangeView: (view: ViewMode) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  state, settings, currentUser, onAddTransaction, onDeleteTransaction, onEditTransaction, onUpdateStatus, onChangeView
}) => {
  const [isTransModalOpen, setTransModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [loadingDiag, setLoadingDiag] = useState(false);

  const activeModules = settings?.activeModules || {};
  const isOptical = activeModules.optical === true;
  const isOdonto = activeModules.odonto === true;

  useEffect(() => {
    const fetchDiag = async () => {
      const showIntelligence = activeModules.intelligence && (currentUser?.role === 'ADMIN' || currentUser?.role === 'FIN_MANAGER');
      if (showIntelligence && state && state.transactions && state.transactions.length > 0) {
        setLoadingDiag(true);
        try {
          const res = await getManagerDiagnostic(state);
          setDiagnostic(res);
        } catch (e) { console.error("IA Error:", e); }
        setLoadingDiag(false);
      }
    };
    fetchDiag();
  }, [state?.transactions?.length, activeModules.intelligence, currentUser?.role]);

  const metrics = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const accounts = state.accounts || [];
    const transactions = state.transactions || [];

    const saldoReal = accounts.reduce((acc, a) => acc + a.balance, 0);
    const entradasMes = transactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID && t.date >= firstDay)
        .reduce((acc, t) => acc + t.amount, 0);
    const saidasMes = transactions
        .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.date >= firstDay)
        .reduce((acc, t) => acc + t.amount, 0);

    // Métricas Clínicas/Profissionais Dinâmicas
    const profStats = {
        optical: {
            labPendentes: state.serviceOrders?.filter(o => o.moduleTag === 'optical' && ['ABERTA', 'EM_EXECUCAO'].includes(o.status)).length || 0,
            rxNovas: state.opticalRxs?.filter(rx => rx.rxDate >= firstDay).length || 0
        },
        odonto: {
            agendaHoje: state.serviceAppointments?.filter(sa => sa.date.split('T')[0] === now.toISOString().split('T')[0]).length || 0,
            pacientesMes: state.serviceClients?.filter(c => c.moduleTag === 'odonto').length || 0
        }
    };

    return { saldoReal, entradasMes, saidasMes, profStats };
  }, [state]);

  if (!state) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard Executivo</h1>
          <p className="text-gray-500 font-medium">Bom dia, <span className="text-indigo-600 font-bold">{currentUser?.name}</span>. Veja seus indicadores.</p>
        </div>
        <button 
          onClick={() => { setEditingTransaction(null); setTransModalOpen(true); }}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200"
        >
          <Plus className="w-5 h-5" /> Novo Lançamento
        </button>
      </div>

      {/* CARDS DINÂMICOS POR PERFIL PROFISSIONAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card Financeiro Base (Sempre Visível) */}
          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Saldo Consolidado</p>
                  <Landmark className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-black text-gray-900">
                  {metrics.saldoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Saldo em todas as contas</p>
          </div>

          {/* Cards de Especialidade - ÓTICA */}
          {isOptical && (
              <>
                <div onClick={() => onChangeView('SRV_OS')} className="bg-indigo-600 p-5 rounded-[2rem] text-white shadow-lg shadow-indigo-100 cursor-pointer hover:scale-[1.02] transition-all border border-indigo-500 group relative overflow-hidden">
                    <Monitor className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 group-hover:rotate-12 transition-transform" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Lab Ótico (Pendentes)</p>
                    <h4 className="text-3xl font-black mt-1">{metrics.profStats.optical.labPendentes}</h4>
                    <div className="mt-4 flex items-center gap-1 text-[10px] font-bold bg-white/20 w-fit px-2 py-0.5 rounded-full uppercase">Ver Ordens <ArrowRight className="w-3 h-3"/></div>
                </div>
                <div onClick={() => onChangeView('OPTICAL_RX')} className="bg-white p-5 rounded-[2rem] border-2 border-indigo-100 shadow-sm cursor-pointer hover:border-indigo-600 transition-all group relative overflow-hidden">
                    <Eye className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-50 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Receitas RX (Mês)</p>
                    <h4 className="text-3xl font-black text-indigo-900 mt-1">{metrics.profStats.optical.rxNovas}</h4>
                    <p className="text-[10px] font-bold text-indigo-500 mt-2 uppercase">Novas prescrições</p>
                </div>
              </>
          )}

          {/* Cards de Especialidade - ODONTO */}
          {isOdonto && (
              <>
                <div onClick={() => onChangeView('ODONTO_AGENDA')} className="bg-sky-500 p-5 rounded-[2rem] text-white shadow-lg shadow-sky-100 cursor-pointer hover:scale-[1.02] transition-all border border-sky-400 group relative overflow-hidden">
                    <CalendarClock className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Agenda de Hoje</p>
                    <h4 className="text-3xl font-black mt-1">{metrics.profStats.odonto.agendaHoje}</h4>
                    <div className="mt-4 flex items-center gap-1 text-[10px] font-bold bg-white/20 w-fit px-2 py-0.5 rounded-full uppercase">Abrir Agenda <ArrowRight className="w-3 h-3"/></div>
                </div>
                <div onClick={() => onChangeView('ODONTO_PATIENTS')} className="bg-white p-5 rounded-[2rem] border-2 border-sky-100 shadow-sm cursor-pointer hover:border-sky-500 transition-all group relative overflow-hidden">
                    <SmilePlus className="absolute -right-4 -bottom-4 w-24 h-24 text-sky-50 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pacientes Ativos</p>
                    <h4 className="text-3xl font-black text-sky-900 mt-1">{metrics.profStats.odonto.pacientesMes}</h4>
                    <p className="text-[10px] font-bold text-sky-500 mt-2 uppercase">Gestão de prontuários</p>
                </div>
              </>
          )}

          {/* Card de Faturamento (Sempre Visível) */}
          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-all">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Faturamento Mês</p>
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-emerald-600">
                  {metrics.entradasMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Líquido realizado</p>
          </div>
      </div>

      {/* BLOCO DE INTELIGÊNCIA IA */}
      {activeModules.intelligence && diagnostic && (
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/10">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <BrainCircuit className="w-64 h-64" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200">Análise do Gestor IA</span>
                </div>
                {loadingDiag ? (
                  <div className="flex items-center gap-4 py-6">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    <span className="text-lg text-indigo-100 font-medium animate-pulse">Processando perfil profissional...</span>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
                      <ReactMarkdown>{diagnostic}</ReactMarkdown>
                  </div>
                )}
            </div>
        </div>
      )}

      {/* GRÁFICOS E LISTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2 uppercase tracking-tighter">
              <Activity className="w-5 h-5 text-emerald-500" />
              Fluxo de Caixa
          </h3>
          <CashFlowChart transactions={state.transactions} />
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2 uppercase tracking-tighter">
              <Receipt className="w-5 h-5 text-indigo-500" />
              Gastos por Categoria
          </h3>
          <ExpensesByCategory transactions={state.transactions} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Últimas Movimentações</h3>
            <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">Extrato Completo <ArrowRight className="w-4 h-4" /></button>
        </div>
        <TransactionList 
            transactions={state.transactions.slice(0, 8)} 
            accounts={state.accounts} 
            contacts={state.contacts || []} 
            onDelete={onDeleteTransaction}
            onEdit={(t) => { setEditingTransaction(t); setTransModalOpen(true); }}
            onToggleStatus={onUpdateStatus}
        />
      </div>

      <TransactionModal 
        isOpen={isTransModalOpen} 
        onClose={() => setTransModalOpen(false)} 
        onSave={(t, nc, ncat) => { if(editingTransaction) onEditTransaction({...t, id: editingTransaction.id}, nc, ncat); else onAddTransaction(t, nc, ncat); setTransModalOpen(false); }}
        accounts={state.accounts}
        contacts={state.contacts || []}
        categories={state.categories || []}
        initialData={editingTransaction}
      />
    </div>
  );
};

export default Dashboard;
