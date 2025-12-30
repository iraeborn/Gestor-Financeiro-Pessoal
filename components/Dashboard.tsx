
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Transaction, TransactionType, TransactionStatus, Contact, EntityType, Category, ViewMode, AppSettings } from '../types';
import StatCard from './StatCard';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import { CashFlowChart, ExpensesByCategory } from './Charts';
import { Plus, Wallet, CalendarClock, TrendingUp, TrendingDown, Target, ArrowRight, BrainCircuit, Sparkles, Loader2, Landmark, Receipt, AlertCircle, BarChart3, Scale } from 'lucide-react';
import { getManagerDiagnostic } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface DashboardProps {
  state: AppState;
  settings?: AppSettings;
  userPermissions?: string[] | 'ALL';
  userEntity?: EntityType;
  onAddTransaction: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (t: Transaction, newContact?: Contact, newCategory?: Category) => void;
  onUpdateStatus: (t: Transaction) => void;
  onChangeView: (view: ViewMode) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  state, settings, userPermissions = 'ALL', userEntity, onAddTransaction, onDeleteTransaction, onEditTransaction, onUpdateStatus, onChangeView
}) => {
  const [isTransModalOpen, setTransModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [loadingDiag, setLoadingDiag] = useState(false);

  const hasIntelligencePermission = userPermissions === 'ALL' || (Array.isArray(userPermissions) && userPermissions.includes('DIAG_HUB'));
  const hasIntelligenceModule = settings?.activeModules?.intelligence === true;
  const showIntelligenceCard = hasIntelligenceModule && hasIntelligencePermission;

  useEffect(() => {
    const fetchDiag = async () => {
      if (showIntelligenceCard && state && state.transactions && state.transactions.length > 0) {
        setLoadingDiag(true);
        try {
          const res = await getManagerDiagnostic(state);
          setDiagnostic(res);
        } catch (e) { console.error("Falha no diagnóstico IA:", e); }
        setLoadingDiag(false);
      }
    };
    fetchDiag();
  }, [state?.transactions?.length, showIntelligenceCard]);

  // --- LÓGICA DE CÁLCULO DOS 11 PILARES ---
  const metrics = useMemo(() => {
    const accounts = state.accounts || [];
    const transactions = state.transactions || [];

    // 1. Saldo em Caixa (Líquido Disponível)
    const saldoEmCaixa = accounts.reduce((acc, a) => acc + a.balance, 0);

    // Período Atual (Mês)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // 2. Entradas do Período (Liquidadas)
    const entradasLiquidadas = transactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID && t.date >= firstDay)
        .reduce((acc, t) => acc + t.amount, 0);

    // 3. Saídas do Período (Liquidadas)
    const saidasLiquidadas = transactions
        .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.date >= firstDay)
        .reduce((acc, t) => acc + t.amount, 0);

    // 4. Resultado (Lucro/Prejuízo)
    const resultado = entradasLiquidadas - saidasLiquidadas;

    // 5. Contas a Receber (Pendentes)
    const contasAReceber = transactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
        .reduce((acc, t) => acc + t.amount, 0);

    // 6. Contas a Pagar (Pendentes/Atrasadas)
    const contasAPagar = transactions
        .filter(t => t.type === TransactionType.EXPENSE && (t.status === TransactionStatus.PENDING || t.status === TransactionStatus.OVERDUE))
        .reduce((acc, t) => acc + t.amount, 0);

    // 7. Saldo Projetado
    const saldoProjetado = saldoEmCaixa + contasAReceber - contasAPagar;

    // 8 & 9. Médias (Últimos 90 dias)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const tmaStr = threeMonthsAgo.toISOString().split('T')[0];
    
    const histEntradas = transactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID && t.date >= tmaStr).reduce((acc, t) => acc + t.amount, 0);
    const histSaidas = transactions.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.date >= tmaStr).reduce((acc, t) => acc + t.amount, 0);
    
    const receitaMedia = histEntradas / 3;
    const custoMedio = histSaidas / 3;

    return { saldoEmCaixa, entradasLiquidadas, saidasLiquidadas, resultado, contasAReceber, contasAPagar, saldoProjetado, receitaMedia, custoMedio };
  }, [state]);

  if (!state) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestão Financeira</h1>
          <p className="text-gray-500 font-medium italic">"Se você não pode medir, você não pode gerenciar."</p>
        </div>
        <button 
          onClick={() => { setEditingTransaction(null); setTransModalOpen(true); }}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200"
        >
          <Plus className="w-5 h-5" /> Novo Lançamento
        </button>
      </div>

      {/* BLOCO DE INTELIGÊNCIA IA */}
      {showIntelligenceCard && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/10">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <BrainCircuit className="w-64 h-64" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200">Diagnóstico do Gestor Senior</span>
                </div>
                {loadingDiag ? (
                  <div className="flex items-center gap-4 py-6">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    <span className="text-lg text-indigo-100 font-medium animate-pulse">Analisando seus 11 pilares financeiros...</span>
                  </div>
                ) : diagnostic ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
                      <ReactMarkdown>{diagnostic}</ReactMarkdown>
                  </div>
                ) : <p className="text-sm text-indigo-200/60 italic">Gere movimentações para habilitar a análise estratégica.</p>}
            </div>
        </div>
      )}

      {/* GRADE DE INDICADORES CHAVE (OS 11 PILARES) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pilar 1: Saldo Real */}
        <StatCard title="Saldo em Caixa" amount={metrics.saldoEmCaixa} type="neutral" icon={<Landmark className="w-6 h-6 text-indigo-600"/>} subtitle="Disponível agora" />
        
        {/* Pilar 7: Saldo Projetado */}
        <StatCard title="Saldo Projetado" amount={metrics.saldoProjetado} type={metrics.saldoProjetado >= 0 ? 'info' : 'negative'} icon={<CalendarClock className="w-6 h-6 text-blue-600"/>} subtitle="Líquido após pagar tudo" />
        
        {/* Pilares 2 & 3: Performance Mensal */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-black uppercase text-gray-400 tracking-widest">Performance Mês</p>
                <BarChart3 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Entradas:</span><span className="font-bold text-emerald-600">+{metrics.entradasLiquidadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Saídas:</span><span className="font-bold text-rose-600">-{metrics.saidasLiquidadas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-50">
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase text-gray-400">Resultado Líquido</span>
                    <span className={`text-lg font-black ${metrics.resultado >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {metrics.resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
            </div>
        </div>

        {/* Pilares 5 & 6: Compromissos */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-black uppercase text-gray-400 tracking-widest">Pendências</p>
                <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-500">A Receber:</span><span className="font-bold text-blue-600">{metrics.contasAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">A Pagar:</span><span className="font-bold text-rose-500">{metrics.contasAPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase text-amber-600">Aguardando Liquidação</span>
            </div>
        </div>
      </div>

      {/* MÉTODOS DE MÉDIA E PONTO DE EQUILÍBRIO (PJ) */}
      {userEntity === EntityType.BUSINESS && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-2xl shadow-sm"><TrendingUp className="w-6 h-6 text-indigo-600"/></div>
                      <div>
                          <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Receita Média (90 dias)</p>
                          <h4 className="text-xl font-black text-indigo-900">{metrics.receitaMedia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Custo Médio</p>
                      <h4 className="text-lg font-bold text-slate-700">{metrics.custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
                  </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-2xl shadow-sm"><Scale className="w-6 h-6 text-slate-600"/></div>
                      <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ponto de Equilíbrio Estimado</p>
                          <h4 className="text-xl font-black text-slate-800">{metrics.custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
                      </div>
                  </div>
                  <div className="px-3 py-1 bg-white rounded-full border border-slate-200 text-[10px] font-bold text-slate-500 uppercase">Sobrevivência</div>
              </div>
          </div>
      )}

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Fluxo de Caixa (Realizado)
          </h3>
          <CashFlowChart transactions={state.transactions} />
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-500" />
              Top Categorias
          </h3>
          <ExpensesByCategory transactions={state.transactions} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h3 className="text-lg font-black text-gray-800">Extrato Recente</h3>
            <button onClick={() => onChangeView('FIN_TRANSACTIONS')} className="text-indigo-600 hover:text-indigo-800 text-sm font-black flex items-center gap-2 uppercase tracking-widest">Ver Todos Lançamentos <ArrowRight className="w-4 h-4" /></button>
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
        userEntity={userEntity}
        initialData={editingTransaction}
      />
    </div>
  );
};

export default Dashboard;
