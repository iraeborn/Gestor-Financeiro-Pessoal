
import React, { useState } from 'react';
import { User, AppSettings, EntityType, CompanyProfile, Branch, CostCenter, Department, Project, TaxRegime } from '../types';
import { CreditCard, Shield, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, Users, MessageSquare, Bell, Smartphone, Send, FileText, Mail, Wrench, BrainCircuit, Glasses } from 'lucide-react';
import { updateSettings, consultCnpj } from '../services/storageService';
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

  // Email Form State
  const [emailConfig, setEmailConfig] = useState(settings.email || {
      enabled: false,
      email: user.email,
      notifyDueToday: true,
      notifyDueTomorrow: true,
      notifyOverdue: true,
      notifyWeeklyReport: true
  });
  const [testingEmail, setTestingEmail] = useState(false);

  // PJ Forms State
  const [companyForm, setCompanyForm] = useState(pjData.companyProfile || { 
      tradeName: '', legalName: '', cnpj: '', 
      taxRegime: TaxRegime.SIMPLES, cnae: '', secondaryCnaes: '', 
      zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '', phone: '', email: '',
      hasEmployees: false, issuesInvoices: false 
  });
  const [loadingCnpj, setLoadingCnpj] = useState(false);

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

  const handleToggleModule = async (moduleKey: 'odonto' | 'services' | 'intelligence' | 'optical') => {
      const currentActive = settings.activeModules?.[moduleKey] || false;
      const newSettings = { 
          ...settings, 
          activeModules: { ...settings.activeModules, [moduleKey]: !currentActive } 
      };
      try {
          await updateSettings(newSettings);
          onUpdateSettings(newSettings);
          let label = moduleKey === 'odonto' ? 'Odonto' : moduleKey === 'services' ? 'Serviços' : moduleKey === 'intelligence' ? 'Inteligência' : 'Ótica';
          if (!currentActive) showAlert(`Módulo ${label} ativado!`, "success");
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
          showAlert("Configurações WhatsApp salvas!", "success");
      } catch (e) {
          showAlert("Erro ao salvar.", "error");
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

  // Email Handlers
  const handleSaveEmail = async () => {
      const newSettings = { ...settings, email: emailConfig };
      try {
          await updateSettings(newSettings);
          onUpdateSettings(newSettings);
          showAlert("Configurações de Email salvas!", "success");
      } catch (e) {
          showAlert("Erro ao salvar.", "error");
      }
  };

  const handleTestEmail = async () => {
      if (!emailConfig.email) {
          showAlert("Informe um email.", "warning");
          return;
      }
      setTestingEmail(false);
      try {
          const token = localStorage.getItem('token');
          const res = await fetch('/api/test-email', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': token ? `Bearer ${token}` : ''
              },
              body: JSON.stringify({ email: emailConfig.email })
          });
          if (res.ok) {
              showAlert("Email de teste enviado!", "success");
          } else {
              const data = await res.json();
              showAlert("Erro: " + data.error, "error");
          }
      } catch (e) {
          showAlert("Erro de conexão.", "error");
      } finally {
          setTestingEmail(false);
      }
  };

  const handleConsultCnpj = async () => {
      if (!companyForm.cnpj || companyForm.cnpj.length < 14) return;
      setLoadingCnpj(true);
      try {
          const data = await consultCnpj(companyForm.cnpj);
          if (data) {
              // Mapear CNAEs Secundários
              let secCnaesStr = '';
              if (data.cnaes_secundarios && Array.isArray(data.cnaes_secundarios)) {
                  secCnaesStr = data.cnaes_secundarios.map((item: any) => `${item.codigo} - ${item.descricao}`).join('\n');
              }

              setCompanyForm(prev => ({
                  ...prev,
                  tradeName: data.nome_fantasia || data.razao_social,
                  legalName: data.razao_social,
                  cnae: `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`,
                  secondaryCnaes: secCnaesStr,
                  zipCode: data.cep,
                  street: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro}`.trim(),
                  number: data.numero,
                  neighborhood: data.bairro,
                  city: data.municipio,
                  state: data.uf,
                  phone: data.ddd_telefone_1,
                  email: data.email
              }));
              showAlert("Dados carregados com sucesso!", "success");
          }
      } catch (e) {
          showAlert("CNPJ não encontrado.", "error");
      } finally {
          setLoadingCnpj(false);
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

        {/* --- MÓDULOS ADICIONAIS --- */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-sky-500">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-sky-600" />
                    Gestão de Módulos do Sistema
                </h2>
            </div>
            <div className="p-6 space-y-6">
                {/* Módulo Inteligência */}
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <BrainCircuit className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Módulo Inteligência (IA Gemini)</h3>
                            <p className="text-sm text-gray-500 max-w-md mt-1">
                                Ativa o Consultor IA e o Gestor de Elite para diagnósticos avançados e conversa em tempo real sobre suas finanças.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleToggleModule('intelligence')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 ${settings.activeModules?.intelligence ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {settings.activeModules?.intelligence ? <><CheckCircle className="w-4 h-4" /> Ativado</> : "Ativar"}
                    </button>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Módulo Ótica */}
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Glasses className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Módulo Ótica (Receitas e Laboratório)</h3>
                            <p className="text-sm text-gray-500 max-w-md mt-1">
                                Gestão clínica de receitas óticas, venda guiada de óculos e controle de laboratório (OS).
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleToggleModule('optical')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 ${settings.activeModules?.optical ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {settings.activeModules?.optical ? <><CheckCircle className="w-4 h-4" /> Ativado</> : "Ativar"}
                    </button>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Módulo Serviços & Vendas */}
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                            <Wrench className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Módulo Serviços & Vendas (OS, Contratos)</h3>
                            <p className="text-sm text-gray-500 max-w-md mt-1">
                                Gestão de ordens de serviço, contratos recorrentes, pedidos de venda/compra e emissão de notas fiscais.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleToggleModule('services')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 ${settings.activeModules?.services ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {settings.activeModules?.services ? <><CheckCircle className="w-4 h-4" /> Ativado</> : "Ativar"}
                    </button>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Módulo Odonto */}
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                            <SmilePlus className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Módulo Odonto (Clínica)</h3>
                            <p className="text-sm text-gray-500 max-w-md mt-1">
                                Gestão completa de pacientes, agendamentos e procedimentos. Integração automática com o financeiro ao realizar atendimentos.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleToggleModule('odonto')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 ${settings.activeModules?.odonto ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {settings.activeModules?.odonto ? <><CheckCircle className="w-4 h-4" /> Ativado</> : "Ativar"}
                    </button>
                </div>
            </div>
        </div>

        {/* --- NOTIFICAÇÕES (GRID: WhatsApp & Email) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WhatsApp */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-600" />
                        WhatsApp
                    </h2>
                </div>
                <div className="p-6 space-y-6 flex-1 flex flex-col">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-gray-400" /> Número
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                placeholder="5511999999999"
                                value={waConfig.phoneNumber}
                                onChange={e => setWaConfig({ ...waConfig, phoneNumber: e.target.value.replace(/\D/g, '') })}
                                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            />
                            <button 
                                onClick={handleTestWhatsApp}
                                disabled={testingWa || !waConfig.phoneNumber}
                                className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 disabled:opacity-50"
                            >
                                {testingWa ? '...' : 'Testar'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-emerald-50/50 p-4 rounded-xl space-y-3 border border-emerald-100/50 flex-1">
                        <p className="text-xs font-bold text-emerald-800 uppercase mb-2">Alertas Automáticos</p>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas Vencendo Hoje</span>
                            <input type="checkbox" checked={waConfig.notifyDueToday} onChange={e => setWaConfig({ ...waConfig, notifyDueToday: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"/>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas Vencendo Amanhã</span>
                            <input type="checkbox" checked={waConfig.notifyDueTomorrow} onChange={e => setWaConfig({ ...waConfig, notifyDueTomorrow: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"/>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas em Atraso</span>
                            <input type="checkbox" checked={waConfig.notifyOverdue} onChange={e => setWaConfig({ ...waConfig, notifyOverdue: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"/>
                        </label>
                    </div>

                    <button onClick={handleSaveWhatsApp} className="w-full bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors">Salvar WhatsApp</button>
                </div>
            </div>

            {/* Email */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        E-mail
                    </h2>
                </div>
                <div className="p-6 space-y-6 flex-1 flex flex-col">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" /> Endereço de Recebimento
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="email"
                                placeholder="seu@email.com"
                                value={emailConfig.email}
                                onChange={e => setEmailConfig({ ...emailConfig, email: e.target.value })}
                                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                            <button 
                                onClick={handleTestEmail}
                                disabled={testingEmail || !emailConfig.email}
                                className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 disabled:opacity-50"
                            >
                                {testingEmail ? '...' : 'Testar'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50/50 p-4 rounded-xl space-y-3 border border-blue-100/50 flex-1">
                        <p className="text-xs font-bold text-blue-800 uppercase mb-2">Alertas Automáticos</p>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700 font-bold">Ativar Notificações por E-mail</span>
                            <input type="checkbox" checked={emailConfig.enabled} onChange={e => setEmailConfig({ ...emailConfig, enabled: e.target.checked })} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                        </label>
                        
                        <div className="h-px bg-blue-100 my-2"></div>

                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas Vencendo Hoje</span>
                            <input type="checkbox" checked={emailConfig.notifyDueToday} onChange={e => setEmailConfig({ ...emailConfig, notifyDueToday: e.target.checked })} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas Vencendo Amanhã</span>
                            <input type="checkbox" checked={emailConfig.notifyDueTomorrow} onChange={e => setEmailConfig({ ...emailConfig, notifyDueTomorrow: e.target.checked })} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Contas em Atraso (Vencidas)</span>
                            <input type="checkbox" checked={emailConfig.notifyOverdue} onChange={e => setEmailConfig({ ...emailConfig, notifyOverdue: e.target.checked })} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">Relatório Semanal de Fluxo</span>
                            <input type="checkbox" checked={emailConfig.notifyWeeklyReport} onChange={e => setEmailConfig({ ...emailConfig, notifyWeeklyReport: e.target.checked })} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                        </label>
                    </div>

                    <button onClick={handleSaveEmail} className="w-full bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors">Salvar Configurações de E-mail</button>
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
                                <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={companyForm.cnpj}
                                        onChange={e => setCompanyForm({...companyForm, cnpj: e.target.value.replace(/\D/g, '')})}
                                        className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Somente números"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleConsultCnpj}
                                        disabled={loadingCnpj}
                                        className="bg-gray-100 text-gray-600 px-3 rounded-lg text-sm font-medium hover:bg-gray-200"
                                        title="Buscar na Receita"
                                    >
                                        {loadingCnpj ? '...' : <FileText className="w-4 h-4"/>}
                                    </button>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Razão Social</label>
                                <input 
                                    type="text"
                                    value={companyForm.legalName}
                                    onChange={e => setCompanyForm({...companyForm, legalName: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Nome Fantasia</label>
                                <input 
                                    type="text"
                                    value={companyForm.tradeName}
                                    onChange={e => setCompanyForm({...companyForm, tradeName: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
                                <input 
                                    type="text"
                                    value={companyForm.phone}
                                    onChange={e => setCompanyForm({...companyForm, phone: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            
                            {/* Endereço */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">CEP</label>
                                <input 
                                    type="text"
                                    value={companyForm.zipCode}
                                    onChange={e => setCompanyForm({...companyForm, zipCode: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Logradouro</label>
                                <input 
                                    type="text"
                                    value={companyForm.street}
                                    onChange={e => setCompanyForm({...companyForm, street: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Número</label>
                                <input 
                                    type="text"
                                    value={companyForm.number}
                                    onChange={e => setCompanyForm({...companyForm, number: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Bairro</label>
                                <input 
                                    type="text"
                                    value={companyForm.neighborhood}
                                    onChange={e => setCompanyForm({...companyForm, neighborhood: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Cidade / UF</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={companyForm.city}
                                        onChange={e => setCompanyForm({...companyForm, city: e.target.value})}
                                        placeholder="Cidade"
                                        className="flex-1 rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <input 
                                        type="text" 
                                        value={companyForm.state}
                                        onChange={e => setCompanyForm({...companyForm, state: e.target.value.toUpperCase()})}
                                        placeholder="UF"
                                        className="w-16 rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Novos Campos Fiscais */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Regime Tributário</label>
                                <select
                                    value={companyForm.taxRegime}
                                    onChange={e => setCompanyForm({...companyForm, taxRegime: e.target.value as TaxRegime})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm bg-white"
                                >
                                    <option value={TaxRegime.MEI}>MEI</option>
                                    <option value={TaxRegime.SIMPLES}>Simples Nacional</option>
                                    <option value={TaxRegime.PRESUMIDO}>Lucro Presumido</option>
                                    <option value={TaxRegime.REAL}>Lucro Real</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">CNAE Principal</label>
                                <input 
                                    type="text"
                                    value={companyForm.cnae}
                                    onChange={e => setCompanyForm({...companyForm, cnae: e.target.value})}
                                    className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            
                            {companyForm.secondaryCnaes && (
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">CNAEs Secundários</label>
                                    <textarea 
                                        value={companyForm.secondaryCnaes}
                                        readOnly
                                        className="w-full rounded-lg border border-gray-200 p-2 text-xs bg-gray-50 h-20 overflow-y-auto resize-none"
                                    />
                                </div>
                            )}

                            <div className="md:col-span-3 flex gap-6 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={companyForm.hasEmployees}
                                        onChange={e => setCompanyForm({...companyForm, hasEmployees: e.target.checked})}
                                        className="rounded text-indigo-600 focus:ring-indigo-500" 
                                    />
                                    <span className="text-sm text-gray-700">Possui Funcionários?</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={companyForm.issuesInvoices}
                                        onChange={e => setCompanyForm({...companyForm, issuesInvoices: e.target.checked})}
                                        className="rounded text-indigo-600 focus:ring-indigo-500" 
                                    />
                                    <span className="text-sm text-gray-700">Emite Nota Fiscal?</span>
                                </label>
                                <div className="flex-1 flex justify-end">
                                    <button type="submit" className="bg-indigo-600 text-white px-6 rounded-lg text-sm font-medium hover:bg-indigo-700 py-2">Salvar Dados da Empresa</button>
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
            </>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
