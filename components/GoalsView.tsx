
import React, { useState, useEffect } from 'react';
import { FinancialGoal, Account, TransactionType, TransactionStatus, Transaction } from '../types';
import { Target, Plus, Trash2, Calendar, DollarSign, CheckCircle, AlertTriangle, ArrowRight, Lightbulb, Wallet } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface GoalsViewProps {
  goals: FinancialGoal[];
  accounts: Account[];
  transactions: Transaction[];
  onSaveGoal: (g: FinancialGoal) => void;
  onDeleteGoal: (id: string) => void;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
}

const GoalsView: React.FC<GoalsViewProps> = ({ goals, accounts, transactions, onSaveGoal, onDeleteGoal, onAddTransaction }) => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContribModalOpen, setIsContribModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<FinancialGoal | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', targetAmount: '', currentAmount: '0', deadline: '' });
  const [contribData, setContribData] = useState({ amount: '', accountId: '', date: new Date().toISOString().split('T')[0] });

  const getGoalRealProgress = (goal: FinancialGoal) => {
      const contributions = transactions
          .filter(t => t.goalId === goal.id && t.status === TransactionStatus.PAID)
          .reduce((acc, t) => acc + t.amount, 0);
      return (goal.currentAmount || 0) + contributions;
  };

  const handleSaveGoal = (e: React.FormEvent) => {
      e.preventDefault();
      onSaveGoal({
          id: formData.id || crypto.randomUUID(),
          name: formData.name,
          targetAmount: parseFloat(formData.targetAmount),
          currentAmount: parseFloat(formData.currentAmount),
          deadline: formData.deadline
      });
      setIsModalOpen(false);
      showAlert("Meta salva!");
  };

  const handleSaveContrib = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedGoal) return;
      onAddTransaction({
          description: `Aporte: ${selectedGoal.name}`,
          amount: parseFloat(contribData.amount),
          type: TransactionType.EXPENSE,
          category: 'Investimentos/Metas',
          date: contribData.date,
          status: TransactionStatus.PAID,
          accountId: contribData.accountId,
          goalId: selectedGoal.id,
          isRecurring: false
      });
      setIsContribModalOpen(false);
      showAlert("Aporte realizado com sucesso!");
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Target className="w-6 h-6 text-indigo-600" /> Metas & Objetivos</h1>
          <p className="text-gray-500">Acompanhe seu progresso dinamicamente através de aportes.</p>
        </div>
        <button onClick={() => { setFormData({id:'', name:'', targetAmount:'', currentAmount:'0', deadline:''}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center gap-2"><Plus className="w-5 h-5"/> Nova Meta</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(goal => {
              const realAmount = getGoalRealProgress(goal);
              const percent = Math.min(100, Math.round((realAmount / goal.targetAmount) * 100));
              return (
                  <div key={goal.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">{goal.name}</h3>
                                <p className="text-xs text-gray-400">Até {new Date(goal.deadline).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-black text-xs ${percent >= 100 ? 'border-emerald-100 text-emerald-600' : 'border-indigo-50 text-indigo-600'}`}>{percent}%</div>
                        </div>
                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-sm font-bold text-gray-700"><span>Guardado</span><span>{formatCurrency(realAmount)}</span></div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden"><div className={`h-full transition-all duration-1000 ${percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${percent}%` }}></div></div>
                            <div className="flex justify-between text-[10px] text-gray-400 uppercase font-black"><span>Início: {formatCurrency(goal.currentAmount)}</span><span>Alvo: {formatCurrency(goal.targetAmount)}</span></div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => { setSelectedGoal(goal); setContribData({amount:'', accountId: accounts[0]?.id || '', date: new Date().toISOString().split('T')[0]}); setIsContribModalOpen(true); }} className="flex-1 bg-indigo-50 text-indigo-700 py-2 rounded-lg text-xs font-bold hover:bg-indigo-100">Aportar</button>
                          <button onClick={() => onDeleteGoal(goal.id)} className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100"><Trash2 className="w-4 h-4"/></button>
                      </div>
                  </div>
              );
          })}
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 animate-scale-up">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Configurar Objetivo</h2>
                  <form onSubmit={handleSaveGoal} className="space-y-4">
                      <input type="text" placeholder="Nome da Meta" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name:e.target.value})} required />
                      <input type="number" placeholder="Valor Alvo (R$)" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.targetAmount} onChange={e => setFormData({...formData, targetAmount:e.target.value})} required />
                      <input type="number" placeholder="Saldo Inicial (Opcional)" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.currentAmount} onChange={e => setFormData({...formData, currentAmount:e.target.value})} />
                      <input type="date" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.deadline} onChange={e => setFormData({...formData, deadline:e.target.value})} required />
                      <div className="flex gap-2 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold">Cancelar</button>
                          <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isContribModalOpen && selectedGoal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-8 animate-scale-up">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Novo Aporte</h2>
                  <p className="text-sm text-gray-500 mb-6">Para: {selectedGoal.name}</p>
                  <form onSubmit={handleSaveContrib} className="space-y-4">
                      <input type="number" step="0.01" placeholder="Valor (R$)" className="w-full border rounded-xl p-3 text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={contribData.amount} onChange={e => setContribData({...contribData, amount:e.target.value})} required />
                      <select className="w-full border rounded-xl p-3 bg-white" value={contribData.accountId} onChange={e => setContribData({...contribData, accountId:e.target.value})} required>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (R$ {a.balance.toFixed(2)})</option>)}
                      </select>
                      <input type="date" className="w-full border rounded-xl p-3" value={contribData.date} onChange={e => setContribData({...contribData, date:e.target.value})} required />
                      <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-colors mt-4">Confirmar Aporte</button>
                      <button type="button" onClick={() => setIsContribModalOpen(false)} className="w-full text-center py-2 text-sm text-gray-400 font-medium">Cancelar</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default GoalsView;
