
import React, { useState, useEffect } from 'react';
import { X, Wallet, Building, CreditCard, TrendingUp, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { Account, AccountType } from '../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: Account) => void;
  initialData?: Account | null;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: AccountType.BANK,
    balance: '0',
    creditLimit: '',
    closingDay: '',
    dueDay: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        type: initialData.type,
        balance: initialData.balance.toString(),
        creditLimit: initialData.creditLimit ? initialData.creditLimit.toString() : '',
        closingDay: initialData.closingDay ? initialData.closingDay.toString() : '',
        dueDay: initialData.dueDay ? initialData.dueDay.toString() : ''
      });
    } else {
      setFormData({
        name: '',
        type: AccountType.BANK,
        balance: '0',
        creditLimit: '',
        closingDay: '',
        dueDay: ''
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialData ? initialData.id : crypto.randomUUID(),
      name: formData.name,
      type: formData.type,
      balance: parseFloat(formData.balance),
      creditLimit: formData.type === AccountType.CARD && formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
      closingDay: formData.type === AccountType.CARD && formData.closingDay ? parseInt(formData.closingDay) : undefined,
      dueDay: formData.type === AccountType.CARD && formData.dueDay ? parseInt(formData.dueDay) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">
            {initialData ? 'Editar Conta' : 'Nova Conta'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Conta</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Ex: Nubank, Carteira..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
            <div className="relative">
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
                className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none"
              >
                <option value={AccountType.WALLET}>Carteira Física</option>
                <option value={AccountType.BANK}>Conta Bancária</option>
                <option value={AccountType.CARD}>Cartão de Crédito</option>
                <option value={AccountType.INVESTMENT}>Investimento</option>
              </select>
              <div className="absolute right-3 top-2.5 pointer-events-none text-gray-400">
                {formData.type === AccountType.WALLET && <Wallet className="w-4 h-4" />}
                {formData.type === AccountType.BANK && <Building className="w-4 h-4" />}
                {formData.type === AccountType.CARD && <CreditCard className="w-4 h-4" />}
                {formData.type === AccountType.INVESTMENT && <TrendingUp className="w-4 h-4" />}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Saldo / Fatura Atual (R$)</label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="number"
                step="0.01"
                required
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                className="pl-9 block w-full rounded-lg border-gray-200 border py-2 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
                {formData.type === AccountType.CARD 
                    ? "Para cartões, insira o valor da fatura atual negativo (ex: -150.00)."
                    : "Saldo atual disponível."}
            </p>
          </div>

          {/* Campos Específicos para Cartão */}
          {formData.type === AccountType.CARD && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Detalhes do Cartão</span>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Limite Total (R$)</label>
                    <input
                        type="number"
                        step="0.01"
                        value={formData.creditLimit}
                        onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                        className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Ex: 5000.00"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Dia Fechamento</label>
                        <div className="relative">
                            <Calendar className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                            <input
                                type="number"
                                min="1"
                                max="31"
                                value={formData.closingDay}
                                onChange={(e) => setFormData({ ...formData, closingDay: e.target.value })}
                                className="pl-8 block w-full rounded-lg border-gray-200 border py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                placeholder="Dia"
                            />
                        </div>
                        <p className="text-[9px] text-gray-400 mt-0.5">Melhor dia compra</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Dia Vencimento</label>
                        <div className="relative">
                            <AlertCircle className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                            <input
                                type="number"
                                min="1"
                                max="31"
                                value={formData.dueDay}
                                onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
                                className="pl-8 block w-full rounded-lg border-gray-200 border py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                placeholder="Dia"
                            />
                        </div>
                      </div>
                  </div>
              </div>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-2"
          >
            Salvar Conta
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccountModal;
