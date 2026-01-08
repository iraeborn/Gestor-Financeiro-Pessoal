
import React, { useState } from 'react';
import { FinancialGoal, Account, TransactionType, TransactionStatus, Transaction } from '../types';
import { Target, Plus, Trash2, Calendar, DollarSign, CheckCircle, AlertTriangle, ArrowRight, Lightbulb, Wallet, X, Star, TrendingUp, Trophy, Sparkles } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface GoalsViewProps {
  goals: FinancialGoal[];
  accounts: Account[];
  transactions: Transaction[];
  onSaveGoal: (g: FinancialGoal) => void;
  onDeleteGoal: (id: string) => void;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
}

const GoalsView: React.FC<GoalsViewProps> = ({ goals = [], accounts = [], transactions = [], onSaveGoal, onDeleteGoal, onAddTransaction }) => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContribModalOpen, setIsContribModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<FinancialGoal | null>(null);
  
  const [formData, setFormData] = useState({ 
    id: '', 
    name: '', 
    targetAmount: '', 
    currentAmount: '0', 
    deadline: '' 
  });

  const [contribData, setContribData] = useState({ 
    amount: '', 
    accountId: '', 
    date: new Date().toISOString().split('T')[0] 
  });

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const getGoalRealProgress = (goal: FinancialGoal) => {
      if (!goal) return 0;
      const contributions = (transactions || [])
          .filter(t => t && t.goalId === goal.id && t.status === TransactionStatus.PAID)
          .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      return (Number(goal.currentAmount || goal.current_amount) || 0) + contributions;
  };

  const handleSaveGoal = (e: React.FormEvent) => {
      e.preventDefault();
      const targetVal = parseFloat(formData.targetAmount);
      if (isNaN(targetVal) || targetVal <= 0) return showAlert("O valor alvo deve ser maior que zero.", "warning");

      onSaveGoal({
          id: formData.id || crypto.randomUUID(),
          name: formData.name,
          targetAmount: targetVal,
          currentAmount: parseFloat(formData.currentAmount) || 0,
          deadline: formData.deadline
      } as FinancialGoal);
      
      setIsModalOpen(false);
      showAlert("Sua nova meta foi traçada!", "success");
  };

  const handleSaveContrib = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedGoal) return;
      const amt = parseFloat(contribData.amount);
      if (isNaN(amt) || amt <= 0) return showAlert("Informe um valor válido para o aporte.", "warning");

      onAddTransaction({
          description: `Aporte p/ Objetivo: ${selectedGoal.name}`,
          amount: amt,
          type: TransactionType.EXPENSE,
          category: 'Investimentos/Metas',
          date: contribData.date,
          status: TransactionStatus.PAID,
          accountId: contribData.accountId,
          goalId: selectedGoal.id,
          isRecurring: false
      });
      setIsContribModalOpen(false);
      showAlert("Investimento realizado com sucesso!", "success");
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100"><Trophy className="w-6 h-6" /></div>
              Metas & Conquistas
          </h1>
          <p className="text-gray-500 font-medium mt-1">Transforme seus sonhos em números e prazos reais.</p>
        </div>
        <button 
            onClick={() => { setFormData({id:'', name:'', targetAmount:'', currentAmount:'0', deadline:''}); setIsModalOpen(true); }} 
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black shadow-2xl shadow-slate-200 transition-all active:scale-95 flex items-center gap-3"
        >
            <Plus className="w-5 h-5"/> Criar Novo Plano
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {goals.filter(Boolean).map(goal => {
              const realAmount = getGoalRealProgress(goal);
              const percent = Math.min(100, Math.round((realAmount / (Number(goal.targetAmount) || 1)) * 100));
              const isCompleted = percent >= 100;

              return (
                  <div key={goal.id} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-full group relative overflow-hidden">
                      {isCompleted && <div className="absolute top-0 right-0 p-4"><Sparkles className="w-6 h-6 text-amber-400" /></div>}
                      
                      <div>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-gray-900 text-xl truncate pr-4">{goal.name}</h3>
                                <div className="flex items-center gap-2 mt-1 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Vence em {goal.deadline ? new Date(goal.deadline).toLocaleDateString('pt-BR') : '--/--'}
                                </div>
                            </div>
                            <div className={`w-14 h-14 rounded-2xl border-4 flex items-center justify-center font-black text-sm transition-colors ${isCompleted ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-indigo-50 text-indigo-600'}`}>
                                {percent}%
                            </div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-xs font-black uppercase tracking-tighter text-slate-400">
                                <span>Progresso Acumulado</span>
                                <span className={isCompleted ? 'text-emerald-600' : 'text-indigo-600'}>{formatCurrency(realAmount)}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden shadow-inner p-0.5">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-indigo-600 shadow-lg shadow-indigo-100'}`} 
                                    style={{ width: `${percent}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 uppercase font-black tracking-widest pt-1">
                                <span>Alvo: {formatCurrency(Number(goal.targetAmount))}</span>
                                <span>Faltam: {formatCurrency(Math.max(0, Number(goal.targetAmount) - realAmount))}</span>
                            </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                          <button 
                              onClick={() => { setSelectedGoal(goal); setContribData({amount:'', accountId: accounts[0]?.id || '', date: new Date().toISOString().split('T')[0]}); setIsContribModalOpen(true); }} 
                              disabled={isCompleted}
                              className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isCompleted ? 'bg-emerald-50 text-emerald-600 cursor-default' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white shadow-lg shadow-indigo-50'}`}
                          >
                              {isCompleted ? 'Meta Atingida!' : 'Investir agora'}
                          </button>
                          <button 
                            onClick={() => onDeleteGoal(goal.id)} 
                            className="p-4 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all border border-transparent hover:border-rose-100"
                          >
                              <Trash2 className="w-5 h-5"/>
                          </button>
                      </div>
                  </div>
              );
          })}
          
          {goals.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 animate-pulse">
                   <Target className="w-20 h-20 text-slate-100 mx-auto mb-4" />
                   <p className="text-slate-400 font-bold text-lg uppercase tracking-tight">Crie sua primeira meta financeira para começar.</p>
              </div>
          )}
      </div>

      {/* Modal: Configurar Meta */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-12 animate-scale-up border border-slate-100 relative overflow-hidden">
                  <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-6 h-6"/></button>
                  
                  <div className="mb-10">
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-indigo-600" /> Planejar Sonho
                    </h2>
                    <p className="text-gray-500 font-medium mt-2">Defina o que você quer conquistar e em quanto tempo.</p>
                  </div>

                  <form onSubmit={handleSaveGoal} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">O que você vai realizar?</label>
                        <input type="text" placeholder="Ex: Viagem Europa, Carro Novo, Reserva..." className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name:e.target.value})} required />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Quanto você quer poupar?</label>
                            <div className="relative">
                                <DollarSign className="w-4 h-4 absolute left-4 top-4 text-indigo-400" />
                                <input type="number" step="0.01" className="w-full pl-10 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.targetAmount} onChange={e => setFormData({...formData, targetAmount:e.target.value})} required />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Já tem algum valor?</label>
                            <div className="relative">
                                <Wallet className="w-4 h-4 absolute left-4 top-4 text-emerald-400" />
                                <input type="number" step="0.01" className="w-full pl-10 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.currentAmount} onChange={e => setFormData({...formData, currentAmount:e.target.value})} />
                            </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Qual o prazo final?</label>
                          <div className="relative">
                            <Calendar className="w-4 h-4 absolute left-4 top-4 text-indigo-300" />
                            <input type="date" className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.deadline} onChange={e => setFormData({...formData, deadline:e.target.value})} required />
                          </div>
                      </div>

                      <div className="flex gap-4 pt-8">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Descartar</button>
                          <button type="submit" className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Criar Plano Agora</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Modal: Aporte Financeiro */}
      {isContribModalOpen && selectedGoal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-12 animate-scale-up border border-slate-100 relative">
                  <button onClick={() => setIsContribModalOpen(false)} className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
                  
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-50"><TrendingUp className="w-8 h-8" /></div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Investir na Meta</h2>
                    <p className="text-sm text-gray-500 mt-2 font-bold uppercase tracking-widest">{selectedGoal.name}</p>
                  </div>

                  <form onSubmit={handleSaveContrib} className="space-y-6">
                      <div className="space-y-2 text-center">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Valor do Aporte</label>
                        <div className="relative group">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-emerald-600">R$</span>
                            <input type="number" step="0.01" autoFocus className="w-full pl-16 pr-6 py-6 bg-slate-50 border-none rounded-[2rem] text-3xl font-black text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-center shadow-inner" value={contribData.amount} onChange={e => setContribData({...contribData, amount:e.target.value})} required placeholder="0,00" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">De qual conta sai o dinheiro?</label>
                        <select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" value={contribData.accountId} onChange={e => setContribData({...contribData, accountId:e.target.value})} required>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Saldo: {formatCurrency(Number(a.balance))})</option>)}
                        </select>
                      </div>

                      <button type="submit" className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
                          <CheckCircle className="w-5 h-5" /> Confirmar Investimento
                      </button>
                      <button type="button" onClick={() => setIsContribModalOpen(false)} className="w-full text-center py-2 text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-gray-500 transition-colors">Cancelar</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default GoalsView;
