
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Contact, Category, ViewMode, AppSettings, User } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import { CashFlowChart, ExpensesByCategory } from './Charts';
import { Plus, TrendingUp, ArrowRight, Monitor, Eye, Activity, Receipt, Landmark, AlertCircle, ShieldAlert } from 'lucide-react';
import { getManagerDiagnostic } from '../services/geminiService';

interface DashboardProps {
  state: AppState;
  settings?: AppSettings;
  currentUser: User;
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
  
  const familyId = currentUser.familyId || (currentUser as any).family_id;
  const currentWorkspace = currentUser.workspaces?.find(w => w.id === familyId);
  const isAdmin = currentUser.id === familyId || currentWorkspace?.role === 'ADMIN';
  const isSalesperson = currentUser.role === 'SALES_OPTICAL';
  const permissions = Array.isArray(currentWorkspace?.permissions) ? currentWorkspace?.permissions : [];

  const canSeeFinance = isAdmin || permissions.includes('FIN_TRANSACTIONS') || permissions.includes('FIN_REPORTS');
  const canSeeAccounts = !isSalesperson && (isAdmin || permissions.includes('FIN_ACCOUNTS'));
  const canSeeOptical = (isAdmin || permissions.includes('OPTICAL_RX') || permissions.includes('SRV_OS')) && activeModules.optical;
  const canSeeOS = isAdmin || permissions.includes('SRV_OS');
  const canManageTrans = isAdmin || permissions.includes('FIN_TRANSACTIONS') || isSalesperson;

  useEffect(() => {
    const fetchDiag = async () => {
      const showIntelligence = activeModules.intelligence && !isSalesperson && (isAdmin || permissions.includes('FIN_ADVISOR') || permissions.includes('DIAG_HUB'));
      if (showIntelligence && state?.transactions?.length > 0) {
        setLoadingDiag(true);
        try {
          const res = await getManagerDiagnostic(state);
          setDiagnostic(res);
        } catch (e) { console.error("IA Error:", e); }
        setLoadingDiag(false);
      }
    };
    fetchDiag();
  }, [state?.transactions?.length, activeModules.intelligence, isAdmin, permissions, isSalesperson]);

  const metrics = useMemo(() => {
    const now = new Date();
    const firstDay = now.toISOString().split('T')[0].substring(0, 8) + '01';
    
    const transactions = state.transactions || [];
    const accounts = state.accounts || [];

    const saldoReal = isSalesperson ? 0 : accounts.reduce((acc, a) => acc + a.balance, 0);
    const entradasMes = transactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID && t.date >= firstDay)
        .reduce((acc, t) => acc + t.amount, 0);
    
    const opticalStats = {
        labPendentes: state.serviceOrders?.filter(o => o.moduleTag === 'optical' && ['ABERTA', 'EM_EXECUCAO'].includes(o.status)).length || 0,
        rxNovas: state.opticalRxs?.filter(rx => rx.rxDate >= firstDay).length || 0,
        osAtrasadas: state.serviceOrders?.filter(o => o.moduleTag === 'optical' && o.endDate && o.endDate < now.toISOString().split('T')[0] && o.status !== 'FINALIZADA').length || 0
    };

    return { saldoReal, entradasMes, opticalStats, currentTransactions: transactions };
  }, [state, isSalesperson]);

  const recentTransactions = useMemo(() => {
      return [...metrics.currentTransactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
  }, [metrics.currentTransactions]);

  if (!state) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Painel de Controle</h1>
          <p className="text-gray-500 font-medium">
            Bem vindo, <span className="text-indigo-600 font-bold">{currentUser.name}</span>. Perfil: <span className="text-slate-800 font-bold">{isAdmin ? 'Administrador' : currentWorkspace?.role || 'Membro'}</span>.
          </p>
        </div>
        {canManageTrans && (
            <button 
                onClick={() => { setEditingTransaction(null); setTransModalOpen(true); }}
                className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200"
            >
                <Plus className="w-5 h-5" /> Novo Lançamento
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {canSeeFinance && (
              <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
                  <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Meu Faturamento</p>
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900">
                      {metrics.entradasMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Acumulado no mês</p>
              </div>
          )}

          {canSeeOptical && (
              <>
                <div onClick={() => canSeeOS && onChangeView('OPTICAL_LAB')} className="bg-indigo-600 p-5 rounded-[2rem] text-white shadow-lg shadow-indigo-100 cursor-pointer hover:scale-[1.02] transition-all border border-indigo-500 group relative overflow-hidden">
                    <Monitor className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 group-hover:rotate-12 transition-transform" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Lab (Em Montagem)</p>
                    <h4 className="text-3xl font-black mt-1">{metrics.opticalStats.labPendentes}</h4>
                    <div className="mt-4 flex items-center gap-1 text-[10px] font-bold bg-white/20 w-fit px-2 py-0.5 rounded-full uppercase">Gerenciar OS <ArrowRight className="w-3 h-3"/></div>
                </div>
                <div onClick={() => onChangeView('OPTICAL_RX')} className="bg-white p-5 rounded-[2rem] border-2 border-indigo-100 shadow-sm cursor-pointer hover:border-indigo-600 transition-all group relative overflow-hidden">
                    <Eye className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-50 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Receitas RX Ativas</p>
                    <h4 className="text-3xl font-black text-indigo-900 mt-1">{metrics.opticalStats.rxNovas}</h4>
                    <p className="text-[10px] font-bold text-indigo-500 mt-2 uppercase">Histórico do mês</p>
                </div>
              </>
          )}

          {canSeeAccounts ? (
              <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
                  <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Saldo Disponível</p>
                      <Landmark className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900">
                      {metrics.saldoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Consolidação de contas</p>
              </div>
          ) : (
              !isSalesperson && (
                <div className="bg-gray-50/50 p-5 rounded-[2rem] border border-dashed border-gray-200 flex flex-col justify-center items-center text-center">
                    <ShieldAlert className="w-6 h-6 text-gray-300 mb-2" />
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Informações Restritas</p>
                    <p className="text-[8px] text-gray-300 mt-1 uppercase">Apenas Administradores</p>
                </div>
              )
          )}
      </div>

      {canSeeFinance && !isSalesperson && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2 uppercase tracking-tighter">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  Evolução do Faturamento
              </h3>
              <CashFlowChart transactions={metrics.currentTransactions} />
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2 uppercase tracking-tighter">
                  <Receipt className="w-5 h-5 text-indigo-500" />
                  Composição de Gastos
              </h3>
              <ExpensesByCategory transactions={metrics.currentTransactions} />
            </div>
          </div>
      )}

      {(permissions.includes('FIN_TRANSACTIONS') || isAdmin || isSalesperson) && (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Meus Lançamentos Recentes</h3>
                <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">Ver Extrato <ArrowRight className="w-4 h-4" /></button>
            </div>
            <TransactionList 
                transactions={recentTransactions} 
                accounts={state.accounts} 
                contacts={state.contacts || []} 
                onDelete={onDeleteTransaction}
                onEdit={(t) => { setEditingTransaction(t); setTransModalOpen(true); }}
                onToggleStatus={onUpdateStatus}
            />
          </div>
      )}

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
