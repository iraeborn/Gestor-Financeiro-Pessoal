import React, { useState, useEffect } from 'react';
import { X, Wallet, Building, CreditCard, TrendingUp, DollarSign } from 'lucide-react';
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
    balance: '0'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        type: initialData.type,
        balance: initialData.balance.toString()
      });
    } else {
      setFormData({
        name: '',
        type: AccountType.BANK,
        balance: '0'
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
      balance: parseFloat(formData.balance)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Saldo Atual (R$)</label>
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
            <p className="text-[10px] text-gray-400 mt-1">Para cartões, use negativo para indicar fatura atual.</p>
          </div>

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