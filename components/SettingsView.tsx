
import React, { useState } from 'react';
import { User, AppSettings, Category, TransactionType } from '../types';
import { CreditCard, Users, Shield, Tag, Plus, Trash2 } from 'lucide-react';
import { updateSettings } from '../services/storageService';

interface SettingsViewProps {
  user: User;
  categories: Category[];
  onUpdateSettings: (s: AppSettings) => void;
  onOpenCollab: () => void;
  onSaveCategory: (c: Category) => void;
  onDeleteCategory: (id: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
    user, categories, onUpdateSettings, onOpenCollab, onSaveCategory, onDeleteCategory 
}) => {
  const settings = user.settings || { includeCreditCardsInTotal: true };
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>(TransactionType.EXPENSE);

  const handleToggleCreditCard = async () => {
    const newSettings = { ...settings, includeCreditCardsInTotal: !settings.includeCreditCardsInTotal };
    try {
        await updateSettings(newSettings);
        onUpdateSettings(newSettings);
    } catch (e) {
        alert("Erro ao salvar configuração.");
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCatName.trim()) return;
      onSaveCategory({
          id: crypto.randomUUID(),
          name: newCatName.trim(),
          type: newCatType
      });
      setNewCatName('');
  };

  // Agrupar categorias por tipo para exibição
  const incomeCats = categories.filter(c => c.type === TransactionType.INCOME);
  const expenseCats = categories.filter(c => c.type === TransactionType.EXPENSE);
  const otherCats = categories.filter(c => !c.type || c.type === TransactionType.TRANSFER); // Legado ou sem tipo

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie suas preferências, categorias e colaborações.</p>
      </div>

      <div className="space-y-6">
        
        {/* Seção de Preferências de Cálculo */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    Preferências de Cálculo
                </h2>
            </div>
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Incluir Cartões no Saldo Total</h3>
                            <p className="text-sm text-gray-500 max-w-md mt-1">
                                Se ativado, o saldo (positivo ou negativo) dos cartões de crédito será somado ao seu "Saldo Real" e "Saldo Projetado". Desative se preferir ver apenas o dinheiro em conta.
                            </p>
                        </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={settings.includeCreditCardsInTotal}
                            onChange={handleToggleCreditCard}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
        </div>

        {/* Seção de Categorias */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-600" />
                    Gerenciar Categorias
                </h2>
            </div>
            <div className="p-6 space-y-6">
                
                {/* Form de Adicionar */}
                <form onSubmit={handleAddCategory} className="flex gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <input 
                        type="text" 
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Nova categoria (ex: Academia)"
                        className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <select
                        value={newCatType}
                        onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                        className="rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                        <option value={TransactionType.EXPENSE}>Despesa</option>
                        <option value={TransactionType.INCOME}>Receita</option>
                    </select>
                    <button 
                        type="submit"
                        disabled={!newCatName.trim()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Lista Despesas */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Despesas
                        </h4>
                        <div className="space-y-2">
                            {expenseCats.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 group border border-transparent hover:border-gray-200">
                                    <span className="text-gray-700">{cat.name}</span>
                                    <button 
                                        onClick={() => { if(confirm('Excluir categoria?')) onDeleteCategory(cat.id); }}
                                        className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Lista Receitas */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Receitas
                        </h4>
                        <div className="space-y-2">
                            {incomeCats.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 group border border-transparent hover:border-gray-200">
                                    <span className="text-gray-700">{cat.name}</span>
                                    <button 
                                        onClick={() => { if(confirm('Excluir categoria?')) onDeleteCategory(cat.id); }}
                                        className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Seção de Família */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Família e Colaboração
                </h2>
            </div>
            <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h3 className="font-semibold text-gray-900">Gerenciar Grupo Familiar</h3>
                        <p className="text-sm text-gray-500 max-w-md mt-1">
                            Convide pessoas para visualizar e gerenciar as mesmas finanças que você ou entre em um grupo existente.
                        </p>
                    </div>
                    <button 
                        onClick={onOpenCollab}
                        className="px-5 py-2.5 bg-indigo-50 text-indigo-700 font-semibold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200"
                    >
                        Abrir Colaboração
                    </button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsView;
