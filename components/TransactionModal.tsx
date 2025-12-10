
import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Tag, CreditCard, Repeat, AlertCircle } from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus, Account, RecurrenceFrequency } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
  accounts: Account[];
  initialData?: Transaction | null;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, accounts, initialData }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: TransactionType.EXPENSE,
    category: 'Geral',
    date: new Date().toISOString().split('T')[0],
    status: TransactionStatus.PAID,
    accountId: '',
    isRecurring: false,
    recurrenceFrequency: 'MONTHLY' as RecurrenceFrequency,
    recurrenceEndDate: ''
  });

  const hasAccounts = accounts && accounts.length > 0;

  useEffect(() => {
    if (initialData) {
      setFormData({
        description: initialData.description,
        amount: initialData.amount.toString(),
        type: initialData.type,
        category: initialData.category,
        date: initialData.date,
        status: initialData.status,
        accountId: initialData.accountId,
        isRecurring: initialData.isRecurring,
        recurrenceFrequency: initialData.recurrenceFrequency || 'MONTHLY',
        recurrenceEndDate: initialData.recurrenceEndDate || ''
      });
    } else {
      // Reset defaults
      setFormData({
        description: '',
        amount: '',
        type: TransactionType.EXPENSE,
        category: 'Geral',
        date: new Date().toISOString().split('T')[0],
        status: TransactionStatus.PAID,
        accountId: accounts.length > 0 ? accounts[0].id : '',
        isRecurring: false,
        recurrenceFrequency: 'MONTHLY',
        recurrenceEndDate: ''
      });
    }
  }, [initialData, isOpen, accounts]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accountId) {
        alert("Atenção: Você precisa selecionar uma conta (Banco, Carteira, etc.) para registrar uma transação. Se não houver contas, cadastre uma primeiro.");
        return;
    }

    onSave({
      description: formData.description,
      amount: parseFloat(formData.amount),
      type: formData.type,
      category: formData.category,
      date: formData.date,
      status: formData.status,
      accountId: formData.accountId,
      isRecurring: formData.isRecurring,
      recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : undefined,
      recurrenceEndDate: (formData.isRecurring && formData.recurrenceEndDate) ? formData.recurrenceEndDate : undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">
            {initialData ? 'Editar Transação' : 'Nova Transação'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Selection */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: TransactionType.EXPENSE })}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.type === TransactionType.EXPENSE
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: TransactionType.INCOME })}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.type === TransactionType.INCOME
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Receita
            </button>
          </div>

          {/* Amount */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 font-bold">R$</span>
            </div>
            <input
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="pl-10 block w-full rounded-xl border-gray-200 border py-3 text-lg font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="0,00"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Ex: Supermercado"
            />
          </div>

          {/* Category & Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
              <div className="relative">
                <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  list="categories"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="block w-full rounded-lg border-gray-200 border pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <datalist id="categories">
                  <option value="Alimentação" />
                  <option value="Moradia" />
                  <option value="Transporte" />
                  <option value="Saúde" />
                  <option value="Lazer" />
                  <option value="Salário" />
                  <option value="Investimentos" />
                </datalist>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="block w-full rounded-lg border-gray-200 border pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Account & Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Conta</label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className={`block w-full rounded-lg border pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none ${!hasAccounts ? 'border-red-300 text-red-500 bg-red-50' : 'border-gray-200'}`}
                >
                  {hasAccounts ? (
                    accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))
                  ) : (
                    <option value="">Nenhuma conta disponível</option>
                  )}
                </select>
                {!hasAccounts && (
                   <div className="absolute top-10 left-0 w-full">
                       <p className="text-[10px] text-red-500 flex items-center gap-1">
                           <AlertCircle className="w-3 h-3" />
                           Cadastre uma conta primeiro
                       </p>
                   </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value={TransactionStatus.PAID}>Pago / Recebido</option>
                <option value={TransactionStatus.PENDING}>Pendente</option>
                <option value={TransactionStatus.OVERDUE}>Atrasado</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recurring"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <label htmlFor="recurring" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5" />
                Conta recorrente?
              </label>
            </div>
            
            {formData.isRecurring && (
              <div className="mt-3 grid grid-cols-2 gap-4 animate-fade-in p-3 bg-gray-50 rounded-xl">
                 <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Frequência</label>
                    <select
                      value={formData.recurrenceFrequency}
                      onChange={(e) => setFormData({ ...formData, recurrenceFrequency: e.target.value as RecurrenceFrequency })}
                      className="block w-full rounded-lg border-gray-200 border px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="WEEKLY">Semanal</option>
                      <option value="MONTHLY">Mensal</option>
                      <option value="YEARLY">Anual</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Data de Término (Opcional)</label>
                    <input
                      type="date"
                      value={formData.recurrenceEndDate}
                      onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                      className="block w-full rounded-lg border-gray-200 border px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Deixe vazio se for contínuo.</p>
                 </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!hasAccounts}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salvar Transação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
