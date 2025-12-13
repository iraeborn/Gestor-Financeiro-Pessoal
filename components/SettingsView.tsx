
import React, { useState } from 'react';
import { User, AppSettings, EntityType, CompanyProfile, Branch, CostCenter, Department, Project } from '../types';
import { CreditCard, Shield, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, Users, MessageSquare, Bell, Smartphone, Send } from 'lucide-react';
import { updateSettings } from '../services/storageService';
import { useAlert } from './AlertSystem';

interface SettingsViewProps {
  user: User;
  pjData: {
      companyProfile?: CompanyProfile | null;
      branches: Branch[];
      costCenters: CostCenter[];
      departments: Department[];
      projects: Project[];
  };
  onUpdateSettings: (s: AppSettings) => void;
  onOpenCollab: () => void; 
  // PJ Handlers
  onSavePJEntity: (type: 'company' | 'branch' | 'costCenter' | 'department' | 'project', data: any) => void;
  onDeletePJEntity: (type: 'branch' | 'costCenter' | 'department' | 'project', id: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
    user, pjData, onUpdateSettings, 
    onSavePJEntity, onDeletePJEntity
}) => {
  const { showAlert } = useAlert();
  const settings = user.settings || { includeCreditCardsInTotal: true, activeModules: {} };

  // Whatsapp Form State
  const [waConfig, setWaConfig] = useState(settings.whatsapp || {
      enabled: false,
      phoneNumber: '',
      notifyDueToday: true,
      notifyDueTomorrow: true,
      notifyOverdue: false
  });
  const [testingWa, setTestingWa] = useState(false);

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
        showAlert("Erro ao salvar configuração.", "error");
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
          if (!isActive) showAlert("Módulo Odonto ativado com sucesso!", "success");
      } catch (e) {
          showAlert("Erro ao alterar módulo.", "error");
      }
  };

  // WhatsApp Handlers
  const handleSaveWhatsApp = async () => {
      const newSettings = { ...settings, whatsapp: waConfig };
      try {
          await updateSettings(newSettings);
          onUpdateSettings(newSettings);
          showAlert("Configurações de notificação salvas!", "success");
      } catch (e) {
          showAlert("Erro ao salvar notificações.", "error");
      }
  };

  const handleTestWhatsApp = async () => {
      if (!waConfig.phoneNumber) {
          showAlert("Informe um número de telefone.", "warning");
          return;
      }
      setTestingWa(true);
      try {
          const token = localStorage.getItem('token');
          const res = await fetch('/api/test-whatsapp', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': token ? `Bearer ${token}` : ''
              },
              body: JSON.stringify({ phone: waConfig.phoneNumber })
          });
          const data = await res.json();
          if (res.ok) {
              showAlert("Mensagem de teste enviada!", "success");
          } else {
              showAlert("Erro: " + data.error, "error");
          }
      } catch (e) {
          showAlert("Erro de conexão.", "error");
      } finally {
          setTestingWa(false);
      }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
      e.preventDefault();
      onSavePJEntity('company', { ...companyForm, id: pjData.companyProfile?.id || crypto.randomUUID() });
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

  const isPJ = user.entityType === EntityType.BUSINESS;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie suas preferências e dados corporativos.</p>
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

        {/* --- NOTIFICAÇÕES WHATSAPP --- */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-600" />
                    Notificações e Alertas (WhatsApp)
                </h2>
            </div>
            <div className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-gray-400" />
                            Número do WhatsApp
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                placeholder="5511999999999 (com código país e DDD)"
                                value={waConfig.phoneNumber}
                                onChange={e => setWaConfig({ ...waConfig, phoneNumber: e.target.value.replace(/\D/g, '') })}
                                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <button 
                                onClick={handleTestWhatsApp}
                                disabled={testingWa || !waConfig.phoneNumber}
                                className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-2"
                            >
                                {testingWa ? 'Enviando...' : <><Send className="w-3 h-3" /> Testar</>}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            Insira apenas números. Certifique-se de incluir o código do país (55 para Brasil).
                        </p>
                    </div>
                    
                    <div className="flex-1 bg-emerald-50/50 p-4 rounded-xl space-y-3 border border-emerald-100/50">
                        <p className="text-xs font-bold text-emerald-800 uppercase mb-2 flex items-center gap-1">
                            <Bell className="w-3 h-3" /> Configurar Alertas Automáticos
                        </p>
                        
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas Vencendo Hoje</span>
                            <input 
                                type="checkbox"
                                checked={waConfig.notifyDueToday}
                                onChange={e => setWaConfig({ ...waConfig, notifyDueToday: e.target.checked })}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                        </label>
                        
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas Vencendo Amanhã</span>
                            <input 
                                type="checkbox"
                                checked={waConfig.notifyDueTomorrow}
                                onChange={e => setWaConfig({ ...waConfig, notifyDueTomorrow: e.target.checked })}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas em Atraso</span>
                            <input 
                                type="checkbox"
                                checked={waConfig.notifyOverdue}
                                onChange={e => setWaConfig({ ...waConfig, notifyOverdue: e.target.checked })}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                        </label>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button 
                        onClick={handleSaveWhatsApp}
                        className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                    >
                        Salvar Configurações
                    </button>
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
      </div>
    </div>
  );
};

export default SettingsView;