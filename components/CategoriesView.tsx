
import React, { useState } from 'react';
import { Category, TransactionType } from '../types';
import { Tag, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useAlert } from './AlertSystem';

interface CategoriesViewProps {
  categories: Category[];
  onSaveCategory: (c: Category) => void;
  onDeleteCategory: (id: string) => void;
}

const CategoriesView: React.FC<CategoriesViewProps> = ({ categories, onSaveCategory, onDeleteCategory }) => {
  const { showAlert } = useAlert();
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>(TransactionType.EXPENSE);

  const handleAddCategory = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCatName.trim()) return;
      
      // Check for duplicate names within same type
      const exists = categories.find(c => c.name.toLowerCase() === newCatName.trim().toLowerCase() && c.type === newCatType);
      if (exists) {
          showAlert("Já existe uma categoria com este nome para este tipo.", "warning");
          return;
      }

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

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-indigo-600" />
            Categorias Financeiras
        </h1>
        <p className="text-gray-500">Organize suas receitas e despesas para relatórios mais precisos.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800">
                Adicionar Nova Categoria
            </h2>
        </div>
        <div className="p-6">
            <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <input 
                    type="text" 
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nome da categoria (ex: Academia, Combustível)"
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
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Adicionar
                </button>
            </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lista Despesas */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-rose-50">
                    <h4 className="text-sm font-bold text-rose-700 uppercase flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span> Despesas
                    </h4>
                    <span className="text-xs font-semibold text-rose-600 bg-white px-2 py-1 rounded-md">{expenseCats.length}</span>
                </div>
                <div className="p-2 max-h-[500px] overflow-y-auto">
                    {expenseCats.length === 0 && <p className="text-gray-400 text-sm p-4 text-center">Nenhuma categoria cadastrada.</p>}
                    <div className="space-y-1">
                        {expenseCats.map(cat => (
                            <div key={cat.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 group border border-transparent hover:border-gray-100 transition-all">
                                <span className="text-gray-700 font-medium text-sm">{cat.name}</span>
                                <button 
                                    onClick={() => onDeleteCategory(cat.id)}
                                    className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                    title="Excluir"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista Receitas */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-emerald-50">
                    <h4 className="text-sm font-bold text-emerald-700 uppercase flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Receitas
                    </h4>
                    <span className="text-xs font-semibold text-emerald-600 bg-white px-2 py-1 rounded-md">{incomeCats.length}</span>
                </div>
                <div className="p-2 max-h-[500px] overflow-y-auto">
                    {incomeCats.length === 0 && <p className="text-gray-400 text-sm p-4 text-center">Nenhuma categoria cadastrada.</p>}
                    <div className="space-y-1">
                        {incomeCats.map(cat => (
                            <div key={cat.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 group border border-transparent hover:border-gray-100 transition-all">
                                <span className="text-gray-700 font-medium text-sm">{cat.name}</span>
                                <button 
                                    onClick={() => onDeleteCategory(cat.id)}
                                    className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                    title="Excluir"
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
  );
};

export default CategoriesView;
