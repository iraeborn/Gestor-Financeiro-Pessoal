
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
  const showIntelligence = activeModules.intelligence && (currentUser?.role === 'ADMIN' || currentUser?.role === 'FIN_MANAGER');

  useEffect(() => {
    const fetchDiag = async () => {
      if (showIntelligence && state && state.transactions && state.transactions.length > 0) {
        setLoadingDiag(true);
        try {
          const res = await getManagerDiagnostic(state);
          setDiagnostic(res);
        } catch (e) { console.error("Falha no diagnóstico IA:", e); }
        setLoadingDiag(false);
      }
    };
    fetchDiag();
  }, [state?.transactions?.length, showIntelligence]);

  // --- LÓGICA DE CÁLCULO DOS INDICADORES ---
  const metrics = useMemo(() => {
    const accounts = state.accounts || [];
    const transactions = state.transactions || [];
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // Filtro por módulo (opcional, dependendo do perfil do usuário logado)
    // Se o usuário for um Vendedor de Ótica, talvez queira ver apenas o faturamento de ótica
    const isOpticalUser = currentUser?.role === 'OPTICAL_MANAGER';
    const isOdontoUser = currentUser?.role === 'ODONTO_MANAGER';

    const filteredTransactions = transactions.filter(t => {
        if (isOpticalUser) return t.category.includes('Ótica') || (state.serviceOrders.some(os => os.id === t.id && os.moduleTag === 'optical'));
        if (isOdontoUser) return t.category.includes('Odonto') || (state.serviceAppointments.some(sa => sa.id === t.id && sa.moduleTag === 'odonto'));
        return true;
    });

    const saldoEmCaixa = accounts.reduce((acc, a) => acc + a.balance, 0);

    const entradasLiquidadas = filteredTransactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID && t.date >= firstDay)
        .reduce((acc, t) => acc + t.amount, 0);

    const saidasLiquidadas = filteredTransactions
        .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.date >= firstDay)
        .reduce((acc, t) => acc + t.amount, 0);

    const resultado = entradasLiquidadas - saidasLiquidadas;

    const contasAReceber = filteredTransactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
        .reduce((acc, t) => acc + t.amount, 0);

    const contasAPagar = filteredTransactions
        .filter(t => t.type === TransactionType.EXPENSE && (t.status === TransactionStatus.PENDING || t.status === TransactionStatus.OVERDUE))
        .reduce((acc, t) => acc + t.amount, 0);

    const saldoProjetado = saldoEmCaixa + contasAReceber - contasAPagar;

    // Métricas Clínicas/Profissionais
    const opticalStats = {
        rxAtivas: state.opticalRxs?.length || 0,
        labPendentes: state.serviceOrders?.filter(os => os.moduleTag === 'optical' && ['ABERTA', 'EM_EXECUCAO'].includes(os.status)).length || 0,
        vendasMes: state.commercialOrders?.filter(o => o.moduleTag === 'optical' && o.type === 'SALE' && o.date >= firstDay).length || 0
    };

    const odontoStats = {
        agendaHoje: state.serviceAppointments?.filter(sa => sa.date.split('T')[0] === now.toISOString().split('T')[0]).length || 0,
        planosAbertos: state.serviceClients?.reduce((acc, c) => acc + (c.treatmentPlans?.filter(p => p.status === 'OPEN').length || 0), 0) || 0,
        pacientesNovos: state.serviceClients?.length || 0
    };

    return { saldoEmCaixa, entradasLiquidadas, saidasLiquidadas, resultado, contasAReceber, contasAPagar, saldoProjetado, opticalStats, odontoStats };
  }, [state, currentUser]);

  if (!state) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard de Gestão</h1>
          <p className="text-gray-500 font-medium">Bem-vindo de volta, <span className="text-indigo-600 font-bold">{currentUser?.name}</span>.</p>
        </div>
        <button 
          onClick={() => { setEditingTransaction(null); setTransModalOpen(true); }}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200"
        >
          <Plus className="w-5 h-5" /> Novo Lançamento
        </button>
      </div>

      {/* BLOCO DE WIDGETS PROFISSIONAIS (Condicional por Módulo Ativo) */}
      {(activeModules.optical || activeModules.odonto) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-in-top">
              {activeModules.optical && (
                  <>
                    <div onClick={() => onChangeView('OPTICAL_RX')} className="bg-indigo-600 p-5 rounded-[2rem] text-white shadow-lg shadow-indigo-100 cursor-pointer hover:scale-[1.02] transition-all border border-indigo-500 group relative overflow-hidden">
                        <Eye className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 group-hover:rotate-12 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Receitas Clínicas</p>
                        <h4 className="text-3xl font-black mt-1">{metrics.opticalStats.rxAtivas}</h4>
                        <div className="mt-4 flex items-center gap-1 text-[10px] font-bold bg-white/20 w-fit px-2 py-0.5 rounded-full uppercase">Visualizar RX <ArrowRight className="w-3 h-3"/></div>
                    </div>
                    <div onClick={() => onChangeView('SRV_OS')} className="bg-white p-5 rounded-[2rem] border-2 border-indigo-100 shadow-sm cursor-pointer hover:border-indigo-600 transition-all group relative overflow-hidden">
                        <Monitor className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-50 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lab (Pendentes)</p>
                        <h4 className="text-3xl font-black text-indigo-900 mt-1">{metrics.opticalStats.labPendentes}</h4>
                        <p className="text-[10px] font-bold text-indigo-500 mt-2 uppercase">Serviços em montagem</p>
                    </div>
                  </>
              )}
              {activeModules.odonto && (
                  <>
                    <div onClick={() => onChangeView('ODONTO_AGENDA')} className="bg-sky-500 p-5 rounded-[2rem] text-white shadow-lg shadow-sky-100 cursor-pointer hover:scale-[1.02] transition-all border border-sky-400 group relative overflow-hidden">
                        <Stethoscope className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Agenda de Hoje</p>
                        <h4 className="text-3xl font-black mt-1">{metrics.odontoStats.agendaHoje}</h4>
                        <div className="mt-4 flex items-center gap-1 text-[10px] font-bold bg-white/20 w-fit px-2 py-0.5 rounded-full uppercase">Abrir Agenda <ArrowRight className="w-3 h-3"/></div>
                    </div>
                    <div onClick={() => onChangeView('ODONTO_PATIENTS')} className="bg-white p-5 rounded-[2rem] border-2 border-sky-100 shadow-sm cursor-pointer hover:border-sky-500 transition-all group relative overflow-hidden">
                        <SmilePlus className="absolute -right-4 -bottom-4 w-24 h-24 text-sky-50 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Planos em Aberto</p>
                        <h4 className="text-3xl font-black text-sky-900 mt-1">{metrics.odontoStats.planosAbertos}</h4>
                        <p className="text-[10px] font-bold text-sky-500 mt-2 uppercase">Tratamentos ativos</p>
                    </div>
                  </>
              )}
          </div>
      )}

      {/* BLOCO DE INTELIGÊNCIA IA (Visível para Admin e Gerentes) */}
      {showIntelligence && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/10">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <BrainCircuit className="w-64 h-64" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200">Análise Estratégica do Gestor IA</span>
                </div>
                {loadingDiag ? (
                  <div className="flex items-center gap-4 py-6">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    <span className="text-lg text-indigo-100 font-medium animate-pulse">Sincronizando dados profissionais e financeiros...</span>
                  </div>
                ) : diagnostic ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
                      <ReactMarkdown>{diagnostic}</ReactMarkdown>
                  </div>
                ) : <p className="text-sm text-indigo-200/60 italic">Realize movimentações para habilitar o consultor inteligente.</p>}
            </div>
        </div>
      )}

      {/* GRADE FINANCEIRA BASE (Compartilhada por todos) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Saldo Consolidado" amount={metrics.saldoEmCaixa} type="neutral" icon={<Landmark className="w-6 h-6 text-indigo-600"/>} subtitle="Disponível em todas as contas" />
        <StatCard title="Saldo Projetado" amount={metrics.saldoProjetado} type={metrics.saldoProjetado >= 0 ? 'info' : 'negative'} icon={<CalendarClock className="w-6 h-6 text-blue-600"/>} subtitle="Previsão para o fim do ciclo" />
        
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Resultado Mês</p>
                <BarChart3 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-gray-500">Entradas:</span><span className="font-bold text-emerald-600">+{metrics.entradasLiquidadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Saídas:</span><span className="font-bold text-rose-600">-{metrics.saidasLiquidadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-50">
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase text-gray-400">Net</span>
                    <span className={`text-lg font-black ${metrics.resultado >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {metrics.resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Compromissos</p>
                <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-gray-500">A Receber:</span><span className="font-bold text-blue-600">{metrics.contasAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">A Pagar:</span><span className="font-bold text-rose-500">{metrics.contasAPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase text-amber-600">Liquidação pendente</span>
            </div>
        </div>
      </div>

      {/* GRÁFICOS E LISTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2 uppercase tracking-tighter">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Fluxo de Caixa Consolidado
          </h3>
          <CashFlowChart transactions={state.transactions} />
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2 uppercase tracking-tighter">
              <Receipt className="w-5 h-5 text-indigo-500" />
              Categorias Frequentes
          </h3>
          <ExpensesByCategory transactions={state.transactions} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Movimentações Recentes</h3>
            <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">Visualizar Extrato <ArrowRight className="w-4 h-4" /></button>
        </div>
        <TransactionList 
            transactions={state.transactions.slice(0, 10)} 
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
