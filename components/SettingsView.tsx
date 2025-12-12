
import React, { useState } from 'react';
import { User, AppSettings, Category, TransactionType, EntityType, CompanyProfile, Branch, CostCenter, Department, Project } from '../types';
import { CreditCard, Shield, Tag, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, Users } from 'lucide-react';
import { updateSettings } from '../services/storageService';

interface SettingsViewProps {
  user: User;
  categories: Category[];
  pjData: {
      companyProfile?: CompanyProfile | null;
      branches: Branch[];
      costCenters: CostCenter[];
      departments: Department[];
      projects: Project[];
  };
  onUpdateSettings: (s: AppSettings) => void;
  onOpenCollab: () => void; // Deprecated, but kept in prop signature to avoid breaking parent passing it
  onSaveCategory: (c: Category) => void;
  onDeleteCategory: (id: string) => void;
  // PJ Handlers
  onSavePJEntity: (type: 'company' | 'branch' | 'costCenter' | 'department' | 'project', data: any) => void;
  onDeletePJEntity: (type: 'branch' | 'costCenter' | 'department' | 'project', id: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
    user, categories, pjData, onUpdateSettings, onSaveCategory, onDeleteCategory,
    onSavePJEntity, onDeletePJEntity
}) => {
  const settings = user.settings || { includeCreditCardsInTotal: true, activeModules: {} };
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>(TransactionType.EXPENSE);

  // PJ Forms State
  const [companyForm, setCompanyForm] = useState(pjData.companyProfile || { tradeName: '', legalName: '', cnpj: '' });
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState(''); // For Branch/CostCenter
  const [activeTab, setActiveTab] = useState<'BRANCH' | 'CC' | 'DEPT' | 'PROJ'>('BRANCH');

  const handleToggleCreditCard = async () => {
    const newSettings = { ...settings, includeCreditCardsInTotal: !settings.includeCreditCardsInTotal };
    try {
        await updateSettings(newSettings);
        onUpdateSettings(newSettings);
    } catch (e) {
        alert("Erro ao salvar configuração.");
    }
  };

  const handleToggleOdonto = async () => {
      const isActive = settings.activeModules?.odonto;
      const newSettings = { 
          ...settings, 
          activeModules: { ...settings.activeModules, odonto: !isActive } 
      };
      try {
          await updateSettings(newSettings);
          onUpdateSettings(newSettings);
          if (!isActive) alert("Módulo Odonto ativado com sucesso! Acesse-o no menu lateral.");
      } catch (e) {
          alert("Erro ao alterar módulo.");
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

  const handleSaveCompany = (e: React.FormEvent) => {
      e.preventDefault();
      onSavePJEntity('company', { ...companyForm, id: pjData.companyProfile?.id || crypto.randomUUID() });
      alert('Dados da empresa salvos!');
  };

  const handleAddItem = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newItemName.trim()) return;
      const id = crypto.randomUUID();
      
      if (activeTab === 'BRANCH') {
          onSavePJEntity('branch', { id, name: newItemName, code: newItemCode });
      } else if (activeTab === 'CC') {
          onSavePJEntity('costCenter', { id, name: newItemName, code: newItemCode });
      } else if (activeTab === 'DEPT') {
          onSavePJEntity('department', { id, name: newItemName });
      } else if (activeTab === 'PROJ') {
          onSavePJEntity('project', { id, name: newItemName });
      }
      setNewItemName('');
      setNewItemCode('');
  };

  // Agrupar categorias por tipo para exibição
  const incomeCats = categories.filter(c => c.type === TransactionType.INCOME);
  const expenseCats = categories.filter(c => c.type === TransactionType.EXPENSE);

  const isPJ = user.entityType === EntityType.BUSINESS;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie suas preferências, categorias e dados corporativos.</p>
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

        {/* --- SEÇÃO EXCLUSIVA PJ --- */}
        {isPJ && (
            <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-indigo-600">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-indigo-600" />
                            Dados Corporativos
                        </h2>
                    </div>
                    
                    {/* Dados da Empresa */}
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Building className="w-4 h-4"/> Identificação da Empresa</h3>
                        <form onSubmit={handleSaveCompany} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Razão Social</label>
                                <input 
                                    type="text"
                                    value={companyForm.legalName}
                                    onChange={e => setCompanyForm({...companyForm, legalName: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Nome Fantasia</label>
                                <input 
                                    type="text"
                                    value={companyForm.tradeName}
                                    onChange={e => setCompanyForm({...companyForm, tradeName: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={companyForm.cnpj}
                                        onChange={e => setCompanyForm({...companyForm, cnpj: e.target.value})}
                                        className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <button type="submit" className="bg-indigo-600 text-white px-3 rounded-lg text-sm font-medium hover:bg-indigo-700">Salvar</button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Estrutura Organizacional */}
                    <div className="p-6">
                        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><FolderKanban className="w-4 h-4"/> Estrutura Organizacional</h3>
                        
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                            <button onClick={() => setActiveTab('BRANCH')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'BRANCH' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600'}`}>Filiais</button>
                            <button onClick={() => setActiveTab('CC')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'CC' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600'}`}>Centros de Custo</button>
                            <button onClick={() => setActiveTab('DEPT')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'DEPT' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600'}`}>Departamentos</button>
                            <button onClick={() => setActiveTab('PROJ')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'PROJ' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600'}`}>Projetos</button>
                        </div>

                        <form onSubmit={handleAddItem} className="flex gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
                            <input 
                                type="text" 
                                placeholder="Nome" 
                                value={newItemName} 
                                onChange={e => setNewItemName(e.target.value)}
                                className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                            />
                            {(activeTab === 'BRANCH' || activeTab === 'CC') && (
                                <input 
                                    type="text" 
                                    placeholder="Código (Opcional)" 
                                    value={newItemCode} 
                                    onChange={e => setNewItemCode(e.target.value)}
                                    className="w-32 rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                                />
                            )}
                            <button type="submit" className="bg-indigo-600 text-white px-3 rounded-md hover:bg-indigo-700"><Plus className="w-4 h-4" /></button>
                        </form>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {activeTab === 'BRANCH' && pjData.branches.map(i => (
                                <div key={i.id} className="flex justify-between items-center p-2 bg-white border border-gray-100 rounded hover:bg-gray-50">
                                    <span className="text-sm text-gray-700"><MapPin className="w-3 h-3 inline mr-1 text-gray-400"/> {i.name} {i.code && <span className="text-gray-400 text-xs">({i.code})</span>}</span>
                                    <button onClick={() => onDeletePJEntity('branch', i.id)} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            ))}
                            {activeTab === 'CC' && pjData.costCenters.map(i => (
                                <div key={i.id} className="flex justify-between items-center p-2 bg-white border border-gray-100 rounded hover:bg-gray-50">
                                    <span className="text-sm text-gray-700"><Calculator className="w-3 h-3 inline mr-1 text-gray-400"/> {i.name} {i.code && <span className="text-gray-400 text-xs">({i.code})</span>}</span>
                                    <button onClick={() => onDeletePJEntity('costCenter', i.id)} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            ))}
                            {activeTab === 'DEPT' && pjData.departments.map(i => (
                                <div key={i.id} className="flex justify-between items-center p-2 bg-white border border-gray-100 rounded hover:bg-gray-50">
                                    <span className="text-sm text-gray-700"><Users className="w-3 h-3 inline mr-1 text-gray-400"/> {i.name}</span>
                                    <button onClick={() => onDeletePJEntity('department', i.id)} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            ))}
                            {activeTab === 'PROJ' && pjData.projects.map(i => (
                                <div key={i.id} className="flex justify-between items-center p-2 bg-white border border-gray-100 rounded hover:bg-gray-50">
                                    <span className="text-sm text-gray-700"><FolderKanban className="w-3 h-3 inline mr-1 text-gray-400"/> {i.name}</span>
                                    <button onClick={() => onDeletePJEntity('project', i.id)} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            ))}
                            
                            {( (activeTab === 'BRANCH' && !pjData.branches.length) || 
                            (activeTab === 'CC' && !pjData.costCenters.length) ||
                            (activeTab === 'DEPT' && !pjData.departments.length) ||
                            (activeTab === 'PROJ' && !pjData.projects.length) 
                            ) && <p className="text-xs text-gray-400 text-center py-2">Nenhum item cadastrado.</p>}
                        </div>
                    </div>
                </div>

                {/* Add-ons & Modulos Extras */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-sky-500">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-sky-600" />
                            Módulos Adicionais
                        </h2>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                                    <SmilePlus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Módulo Odonto</h3>
                                    <p className="text-sm text-gray-500 max-w-md mt-1">
                                        Gestão completa de pacientes, agendamentos e procedimentos. Integração automática com o financeiro ao realizar atendimentos.
                                    </p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleToggleOdonto}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 ${settings.activeModules?.odonto ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {settings.activeModules?.odonto ? (
                                    <><CheckCircle className="w-4 h-4" /> Ativado</>
                                ) : (
                                    "Ativar"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </>
        )}

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

      </div>
    </div>
  );
};

export default SettingsView;
