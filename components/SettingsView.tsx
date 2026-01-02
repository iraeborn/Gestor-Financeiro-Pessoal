
import React, { useState } from 'react';
import { User, AppSettings, EntityType, CompanyProfile, Branch, CostCenter, Department, Project, TaxRegime } from '../types';
import { CreditCard, Shield, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, MessageSquare, Bell, Smartphone, Send, FileText, Mail, Wrench, BrainCircuit, Glasses, AlertTriangle, Info } from 'lucide-react';
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
  onSavePJEntity: (type: 'company' | 'branch' | 'costCenter' | 'department' | 'project', data: any) => void;
  onDeletePJEntity: (type: 'branch' | 'costCenter' | 'department' | 'project', id: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
    user, pjData, onUpdateSettings, 
    onSavePJEntity, onDeletePJEntity
}) => {
  const { showAlert } = useAlert();
  const settings = user.settings || { includeCreditCardsInTotal: true, activeModules: {} };

  const [waConfig, setWaConfig] = useState(settings.whatsapp || {
      enabled: false,
      phoneNumber: '',
      notifyDueToday: true,
      notifyDueTomorrow: true,
      notifyOverdue: false
  });
  const [testingWa, setTestingWa] = useState(false);

  const [emailConfig, setEmailConfig] = useState(settings.email || {
      enabled: false,
      email: user.email,
      notifyDueToday: true,
      notifyDueTomorrow: true,
      notifyOverdue: true,
      notifyWeeklyReport: true
  });
  const [testingEmail, setTestingEmail] = useState(false);

  const [companyForm, setCompanyForm] = useState(pjData.companyProfile || { 
      tradeName: '', legalName: '', cnpj: '', 
      taxRegime: TaxRegime.SIMPLES, cnae: '', secondaryCnaes: '', 
      zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '', phone: '', email: '',
      hasEmployees: false, issuesInvoices: false 
  });
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState(''); 
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
      
      // Lógica de Exclusividade Mútua: Módulos profissionais não podem coexistir para evitar conflito de fluxo
      let nextActiveModules = { ...settings.activeModules, [moduleKey]: !currentActive };
      
      if (!currentActive) { // Ativando um módulo
          if (moduleKey === 'odonto') {
              nextActiveModules.optical = false;
              if (settings.activeModules?.optical) showAlert("Módulo Ótica desativado para ativar Odontologia.", "warning");
          } else if (moduleKey === 'optical') {
              nextActiveModules.odonto = false;
              if (settings.activeModules?.odonto) showAlert("Módulo Odontologia desativado para ativar Ótica.", "warning");
          }
      }

      const newSettings = { 
          ...settings, 
          activeModules: nextActiveModules 
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
          if (res.ok) showAlert("Mensagem de teste enviada!", "success");
          else {
              const data = await res.json();
              showAlert("Erro: " + data.error, "error");
          }
      } catch (e) { showAlert("Erro de conexão.", "error"); } finally { setTestingWa(false); }
  };

  const handleSaveEmail = async () => {
      const newSettings = { ...settings, email: emailConfig };
      try {
          await updateSettings(newSettings);
          onUpdateSettings(newSettings);
          showAlert("Configurações de Email salvas!", "success");
      } catch (e) { showAlert("Erro ao salvar.", "error"); }
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
          if (res.ok) showAlert("Email de teste enviado!", "success");
          else {
              const data = await res.json();
              showAlert("Erro: " + data.error, "error");
          }
      } catch (e) { showAlert("Erro de conexão.", "error"); } finally { setTestingEmail(false); }
  };

  const handleConsultCnpj = async () => {
      if (!companyForm.cnpj || companyForm.cnpj.length < 14) return;
      setLoadingCnpj(true);
      try {
          const data = await consultCnpj(companyForm.cnpj);
          if (data) {
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
      } catch (e) { showAlert("CNPJ não encontrado.", "error"); } finally { setLoadingCnpj(false); }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
      e.preventDefault();
      onSavePJEntity('company', { ...companyForm, id: pjData.companyProfile?.id || crypto.randomUUID() });
  };

  const handleAddItem = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newItemName.trim()) return;
      const id = crypto.randomUUID();
      if (activeTab === 'BRANCH') onSavePJEntity('branch', { id, name: newItemName, code: newItemCode });
      else if (activeTab === 'CC') onSavePJEntity('costCenter', { id, name: newItemName, code: newItemCode });
      else if (activeTab === 'DEPT') onSavePJEntity('department', { id, name: newItemName });
      else if (activeTab === 'PROJ') onSavePJEntity('project', { id, name: newItemName });
      setNewItemName('');
      setNewItemCode('');
  };

  const isPJ = user.entityType === EntityType.BUSINESS;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie suas preferências e módulos profissionais.</p>
      </div>

      <div className="space-y-6">
        
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-indigo-600">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    Preferências de Cálculo
                </h2>
            </div>
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><CreditCard className="w-6 h-6" /></div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Incluir Cartões no Saldo Total</h3>
                            <p className="text-sm text-gray-500 max-w-md mt-1">Soma dívidas e créditos no saldo real e projetado.</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.includeCreditCardsInTotal} onChange={handleToggleCreditCard} />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-sky-500">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-sky-600" />
                    Gestão de Módulos Profissionais
                </h2>
                <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Regra de Exclusividade Ativa
                </div>
            </div>
            <div className="p-6 space-y-6">
                {/* Módulo Serviços - Base */}
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-sky-50 text-sky-600 rounded-lg"><Wrench className="w-6 h-6" /></div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Módulo Serviços & Vendas (Base Operacional)</h3>
                            <p className="text-sm text-gray-500 max-w-md mt-1">Necessário para gerenciar ordens de serviço, contratos e vendas em qualquer profissão.</p>
                        </div>
                    </div>
                    <button onClick={() => handleToggleModule('services')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 ${settings.activeModules?.services ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{settings.activeModules?.services ? <><CheckCircle className="w-4 h-4" /> Ativado</> : "Ativar"}</button>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Exclusividade Professional */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-5 rounded-2xl border-2 transition-all ${settings.activeModules?.optical ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <Glasses className={`w-8 h-8 ${settings.activeModules?.optical ? 'text-indigo-600' : 'text-gray-400'}`} />
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={!!settings.activeModules?.optical} onChange={() => handleToggleModule('optical')} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        <h4 className="font-bold text-gray-800">Especialidade: Ótica</h4>
                        <p className="text-xs text-gray-500 mt-1">Inclui Prontuário RX e Venda de Lentes/Armações.</p>
                    </div>

                    <div className={`p-5 rounded-2xl border-2 transition-all ${settings.activeModules?.odonto ? 'border-sky-200 bg-sky-50/50' : 'border-gray-100 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <SmilePlus className={`w-8 h-8 ${settings.activeModules?.odonto ? 'text-sky-600' : 'text-gray-400'}`} />
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={!!settings.activeModules?.odonto} onChange={() => handleToggleModule('odonto')} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                            </label>
                        </div>
                        <h4 className="font-bold text-gray-800">Especialidade: Odonto</h4>
                        <p className="text-xs text-gray-500 mt-1">Inclui Odontograma, Anamnese e Agenda Clínica.</p>
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <p className="text-xs text-blue-800 leading-relaxed">
                        <strong>Nota de Navegação:</strong> Ao ativar uma especialidade, as funções básicas de venda e laboratório serão unificadas no módulo <strong>Serviços & Vendas</strong> para evitar repetição de menus e centralizar o faturamento.
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50"><h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-emerald-600" /> WhatsApp</h2></div>
                <div className="p-6 space-y-6 flex-1 flex flex-col">
                    <div><label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Smartphone className="w-4 h-4 text-gray-400" /> Número</label>
                    <div className="flex gap-2"><input type="text" placeholder="5511999999999" value={waConfig.phoneNumber} onChange={e => setWaConfig({ ...waConfig, phoneNumber: e.target.value.replace(/\D/g, '') })} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm"/><button onClick={handleTestWhatsApp} disabled={testingWa || !waConfig.phoneNumber} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">{testingWa ? '...' : 'Testar'}</button></div></div>
                    <div className="bg-emerald-50/50 p-4 rounded-xl space-y-3 flex-1">
                        <p className="text-xs font-bold text-emerald-800 uppercase mb-2">Alertas</p>
                        <label className="flex items-center justify-between cursor-pointer"><span className="text-sm text-gray-700">Vencendo Hoje</span><input type="checkbox" checked={waConfig.notifyDueToday} onChange={e => setWaConfig({ ...waConfig, notifyDueToday: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded"/></label>
                        <label className="flex items-center justify-between cursor-pointer"><span className="text-sm text-gray-700">Atrasados</span><input type="checkbox" checked={waConfig.notifyOverdue} onChange={e => setWaConfig({ ...waConfig, notifyOverdue: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded"/></label>
                    </div>
                    <button onClick={handleSaveWhatsApp} className="w-full bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold">Salvar WhatsApp</button>
                </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50"><h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Mail className="w-5 h-5 text-blue-600" /> E-mail</h2></div>
                <div className="p-6 space-y-6 flex-1 flex flex-col">
                    <div><label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /> Endereço</label>
                    <div className="flex gap-2"><input type="email" placeholder="seu@email.com" value={emailConfig.email} onChange={e => setEmailConfig({ ...emailConfig, email: e.target.value })} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm"/><button onClick={handleTestEmail} disabled={testingEmail || !emailConfig.email} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">{testingEmail ? '...' : 'Testar'}</button></div></div>
                    <div className="bg-blue-50/50 p-4 rounded-xl space-y-3 flex-1">
                        <p className="text-xs font-bold text-blue-800 uppercase mb-2">Alertas</p>
                        <label className="flex items-center justify-between cursor-pointer"><span className="text-sm text-gray-700">Vencendo Hoje</span><input type="checkbox" checked={emailConfig.notifyDueToday} onChange={e => setEmailConfig({ ...emailConfig, notifyDueToday: e.target.checked })} className="w-4 h-4 text-blue-600 rounded"/></label>
                        <label className="flex items-center justify-between cursor-pointer"><span className="text-sm text-gray-700">Relatório Semanal</span><input type="checkbox" checked={emailConfig.notifyWeeklyReport} onChange={e => setEmailConfig({ ...emailConfig, notifyWeeklyReport: e.target.checked })} className="w-4 h-4 text-blue-600 rounded"/></label>
                    </div>
                    <button onClick={handleSaveEmail} className="w-full bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Salvar E-mail</button>
                </div>
            </div>
        </div>

        {isPJ && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-indigo-600">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50"><h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Briefcase className="w-5 h-5 text-indigo-600" /> Dados Corporativos</h2></div>
                <div className="p-6">
                    <form onSubmit={handleSaveCompany} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label><div className="flex gap-2"><input type="text" value={companyForm.cnpj} onChange={e => setCompanyForm({...companyForm, cnpj: e.target.value.replace(/\D/g, '')})} className="w-full rounded-lg border border-gray-200 p-2 text-sm"/><button type="button" onClick={handleConsultCnpj} disabled={loadingCnpj} className="bg-gray-100 text-gray-600 px-3 rounded-lg"><FileText className="w-4 h-4"/></button></div></div>
                        <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Razão Social</label><input type="text" value={companyForm.legalName} onChange={e => setCompanyForm({...companyForm, legalName: e.target.value})} className="w-full rounded-lg border border-gray-200 p-2 text-sm"/></div>
                        <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Nome Fantasia</label><input type="text" value={companyForm.tradeName} onChange={e => setCompanyForm({...companyForm, tradeName: e.target.value})} className="w-full rounded-lg border border-gray-200 p-2 text-sm"/></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Regime Tributário</label><select value={companyForm.taxRegime} onChange={e => setCompanyForm({...companyForm, taxRegime: e.target.value as TaxRegime})} className="w-full rounded-lg border border-gray-200 p-2 text-sm bg-white"><option value={TaxRegime.MEI}>MEI</option><option value={TaxRegime.SIMPLES}>Simples</option><option value={TaxRegime.PRESUMIDO}>Presumido</option></select></div>
                        <div className="md:col-span-3 flex justify-end"><button type="submit" className="bg-indigo-600 text-white px-6 rounded-lg text-sm font-medium py-2">Salvar Dados da Empresa</button></div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
