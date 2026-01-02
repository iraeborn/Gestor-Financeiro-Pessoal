
import React, { useState } from 'react';
import { User, AppSettings, EntityType, CompanyProfile, Branch, CostCenter, Department, Project, TaxRegime } from '../types';
// Added Search icon to imports from lucide-react
import { CreditCard, Shield, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, MessageSquare, Bell, Smartphone, Send, FileText, Mail, Wrench, BrainCircuit, Glasses, AlertTriangle, Info, Search } from 'lucide-react';
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
      
      // Lógica de Exclusividade Mútua solicitada pelo usuário
      let nextActiveModules = { ...settings.activeModules, [moduleKey]: !currentActive };
      
      if (!currentActive) { // Ativando um módulo
          if (moduleKey === 'odonto') {
              nextActiveModules.optical = false;
              if (settings.activeModules?.optical) showAlert("Módulo Ótica desativado automaticamente (conflito de fluxo).", "warning");
          } else if (moduleKey === 'optical') {
              nextActiveModules.odonto = false;
              if (settings.activeModules?.odonto) showAlert("Módulo Odonto desativado automaticamente (conflito de fluxo).", "warning");
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

  const handleConsultCnpj = async () => {
      if (!companyForm.cnpj || companyForm.cnpj.length < 14) return;
      setLoadingCnpj(true);
      try {
          const data = await consultCnpj(companyForm.cnpj);
          if (data) {
              setCompanyForm(prev => ({
                  ...prev,
                  tradeName: data.nome_fantasia || data.razao_social,
                  legalName: data.razao_social,
                  zipCode: data.cep,
                  city: data.municipio,
                  state: data.uf,
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

  const isPJ = user.entityType === EntityType.BUSINESS;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="text-gray-500">Personalize seu ambiente de trabalho e notificações.</p>
      </div>

      <div className="space-y-6">
        {/* Gestão de Módulos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-indigo-600">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-600" />
                    Módulos e Especialidades
                </h2>
                <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Regra de Exclusividade Ativa
                </div>
            </div>
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-5 rounded-2xl border-2 transition-all ${settings.activeModules?.optical ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <Glasses className={`w-8 h-8 ${settings.activeModules?.optical ? 'text-indigo-600' : 'text-gray-400'}`} />
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={!!settings.activeModules?.optical} onChange={() => handleToggleModule('optical')} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        <h4 className="font-bold text-gray-800">Especialidade: Ótica</h4>
                        <p className="text-xs text-gray-500 mt-1">Gestão de Receitas (RX) e Laboratório.</p>
                    </div>

                    <div className={`p-5 rounded-2xl border-2 transition-all ${settings.activeModules?.odonto ? 'border-sky-200 bg-sky-50/50' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <SmilePlus className={`w-8 h-8 ${settings.activeModules?.odonto ? 'text-sky-600' : 'text-gray-400'}`} />
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={!!settings.activeModules?.odonto} onChange={() => handleToggleModule('odonto')} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                            </label>
                        </div>
                        <h4 className="font-bold text-gray-800">Especialidade: Odonto</h4>
                        <p className="text-xs text-gray-500 mt-1">Odontograma e Prontuário Clínico.</p>
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <p className="text-xs text-blue-800 leading-relaxed">
                        <strong>Nota:</strong> Para garantir a integridade dos dados financeiros, os módulos profissionais são mutuamente exclusivos. Ativar um desativará o outro automaticamente.
                    </p>
                </div>
            </div>
        </div>

        {/* Dados Corporativos */}
        {isPJ && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-slate-800">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-slate-800" />
                        Identidade Visual e PJ
                    </h2>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSaveCompany} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">CNPJ</label>
                            <div className="flex gap-2">
                                <input type="text" value={companyForm.cnpj} onChange={e => setCompanyForm({...companyForm, cnpj: e.target.value})} className="flex-1 rounded-lg border border-gray-200 p-2 text-sm"/>
                                {/* Fixed missing Search icon on line 206 */}
                                <button type="button" onClick={handleConsultCnpj} className="bg-gray-100 text-gray-600 px-3 rounded-lg"><Search className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Razão Social</label>
                            <input type="text" value={companyForm.legalName} onChange={e => setCompanyForm({...companyForm, legalName: e.target.value})} className="w-full rounded-lg border border-gray-200 p-2 text-sm"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Nome Fantasia</label>
                            <input type="text" value={companyForm.tradeName} onChange={e => setCompanyForm({...companyForm, tradeName: e.target.value})} className="w-full rounded-lg border border-gray-200 p-2 text-sm"/>
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <button type="submit" className="bg-slate-900 text-white px-6 rounded-xl text-sm font-bold py-3 hover:bg-black transition-colors">Salvar Dados da Empresa</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
