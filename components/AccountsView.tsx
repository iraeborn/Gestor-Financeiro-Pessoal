
import React, { useState } from 'react';
import { Account, AccountType } from '../types';
import { Plus, Wallet, Building, CreditCard, TrendingUp, Utensils, Pencil, Trash2, Landmark } from 'lucide-react';
import AccountModal from './AccountModal';
import { useConfirm } from './AlertSystem';

interface AccountsViewProps {
  accounts: Account[];
  onSaveAccount: (a: Account) => void;
  onDeleteAccount: (id: string) => void;
}

const AccountsView: React.FC<AccountsViewProps> = ({ accounts, onSaveAccount, onDeleteAccount }) => {
  const { showConfirm } = useConfirm();
  const [isAccModalOpen, setAccModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const handleEditAccount = (a: Account) => {
    setEditingAccount(a);
    setAccModalOpen(true);
  };

  const handleCreateAccount = () => {
      setEditingAccount(null);
      setAccModalOpen(true);
  };

  const handleSaveAcc = (a: Account) => {
    onSaveAccount(a);
    setEditingAccount(null);
  };

  const handleDelete = async (id: string) => {
      const confirm = await showConfirm({
          title: "Excluir Conta",
          message: "Tem certeza que deseja excluir esta conta? Todas as transações vinculadas serão afetadas.",
          variant: "danger"
      });
      if (confirm) {
          onDeleteAccount(id);
      }
  };

  const closeAccModal = () => {
    setAccModalOpen(false);
    setEditingAccount(null);
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.WALLET: return <Wallet className="w-6 h-6 text-indigo-500" />;
      case AccountType.BANK: return <Building className="w-6 h-6 text-blue-500" />;
      case AccountType.CARD: return <CreditCard className="w-6 h-6 text-rose-500" />;
      case AccountType.INVESTMENT: return <TrendingUp className="w-6 h-6 text-emerald-500" />;
      case AccountType.MEAL_VOUCHER: return <Utensils className="w-6 h-6 text-orange-500" />;
      default: return <Wallet className="w-6 h-6 text-gray-400" />;
    }
  };

  const getAccountLabel = (type: AccountType) => {
      switch(type) {
          case AccountType.MEAL_VOUCHER: return 'Vale Alimentação';
          case AccountType.WALLET: return 'Carteira';
          case AccountType.BANK: return 'Conta Bancária';
          case AccountType.CARD: return 'Cartão de Crédito';
          case AccountType.INVESTMENT: return 'Investimento';
          default: return type;
      }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Landmark className="w-6 h-6 text-indigo-600" />
              Minhas Contas
          </h1>
          <p className="text-gray-500">Gerencie saldos, bancos, carteiras e vale-refeição.</p>
        </div>
        <button 
          onClick={handleCreateAccount}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Nova Conta
        </button>
      </div>

      {accounts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Wallet className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Nenhuma conta cadastrada</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-2 mb-6">
                  Comece adicionando uma conta bancária ou carteira para registrar suas transações.
              </p>
              <button onClick={handleCreateAccount} className="text-indigo-600 font-bold hover:underline">
                  Adicionar primeira conta
              </button>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map(acc => (
                  <div key={acc.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                  {getAccountIcon(acc.type)}
                              </div>
                              <div>
                                  <h3 className="font-bold text-gray-800 text-lg">{acc.name}</h3>
                                  <p className="text-xs text-gray-500 uppercase tracking-wide">{getAccountLabel(acc.type)}</p>
                              </div>
                          </div>
                      </div>

                      <div className="mt-2">
                          <p className="text-xs text-gray-400 font-medium uppercase mb-1">Saldo Atual</p>
                          <span className={`text-2xl font-bold ${acc.balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {formatCurrency(acc.balance)}
                          </span>
                      </div>

                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                              onClick={() => handleEditAccount(acc)}
                              className="p-2 bg-gray-100 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-lg transition-colors"
                              title="Editar"
                          >
                              <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                              onClick={() => handleDelete(acc.id)}
                              className="p-2 bg-gray-100 hover:bg-rose-50 text-gray-500 hover:text-rose-600 rounded-lg transition-colors"
                              title="Excluir"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      <AccountModal 
        isOpen={isAccModalOpen} 
        onClose={closeAccModal} 
        onSave={handleSaveAcc}
        initialData={editingAccount}
      />
    </div>
  );
};

export default AccountsView;
