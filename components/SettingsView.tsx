
import React, { useState } from 'react';
import { User, AppSettings, EntityType, CompanyProfile, Branch, CostCenter, Department, Project, TaxRegime } from '../types';
import { CreditCard, Shield, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, MessageSquare, Bell, Smartphone, Send, FileText, Mail, Wrench, BrainCircuit, Glasses, AlertTriangle, Info, Search, Percent } from 'lucide-react';
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

  const [companyForm, setCompanyForm] = useState(pjData.companyProfile || { 
      tradeName: '', legalName: '', cnpj: '', 
      taxRegime: TaxRegime.SIMPLES, cnae: '', secondaryCnaes: '', 
      zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '', phone: '', email: '',
      hasEmployees: false, issuesInvoices: false 
  });
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  const handleToggleModule = async (moduleKey: 'odonto' | 'services' | 'intelligence' | 'optical') => {
      const currentActive = settings.activeModules?.[moduleKey] || false;
      
      let nextActiveModules = { ...settings.activeModules, [moduleKey]: !currentActive };
      
      if (!currentActive) { // Se estiver ativando
          if (moduleKey === 'odonto') {
              nextActiveModules.optical = false;
              if (settings.activeModules?.optical) showAlert("Módulo Ótica desativado para evitar conflito de fluxo.", "warning");
          } else if (moduleKey === 'optical') {
              nextActiveModules.odonto = false;
              if (settings.activeModules?.odonto) showAlert("Módulo Odonto desativado para priorizar fluxo ótico.", "warning");
          }
      }

      const newSettings = { ...settings, activeModules: nextActiveModules };

      try {
          await updateSettings(newSettings);
          onUpdateSettings(newSettings);
          let label = moduleKey === 'odonto' ? 'Odonto' : moduleKey === 'services' ? 'Serviços' : moduleKey === 'intelligence' ? 'Inteligência' : 'Ótica';
          if (!currentActive) showAlert(`Módulo ${label} ativado!`, "success");
      } catch (e) {
          showAlert("Erro ao alterar módulo.", "error");
      }
  };

  const handleUpdateDiscount = async (pct: number) => {
      const newSettings = { ...settings, maxDiscountPct: pct };
      try {
          await updateSettings(newSettings);
          onUpdateSettings(newSettings);
          showAlert("Limite de desconto atualizado!", "success");
      } catch (e) {
          showAlert("Erro ao salvar limite.", "error");
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
        <h1 className="text-2xl font-bold text-gray-900">Configurações de Negócio</h1>
        <p className="text-gray-500">Personalize os módulos, descontos e a identidade da sua organização.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-indigo-600">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-600" />
                    Especialidades Ativas
                </h2>
                <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Regra de Fluxo Exclusivo
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
                        <h4 className="font-bold text-gray-800">Módulo Ótica</h4>
                        <p className="text-xs text-gray-500 mt-1">Vendas de armações, lentes e laboratório.</p>
                    </div>

                    <div className={`p-5 rounded-2xl border-2 transition-all ${settings.activeModules?.odonto ? 'border-sky-200 bg-sky-50/50' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <SmilePlus className={`w-8 h-8 ${settings.activeModules?.odonto ? 'text-sky-600' : 'text-gray-400'}`} />
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={!!settings.activeModules?.odonto} onChange={() => handleToggleModule('odonto')} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                            </label>
                        </div>
                        <h4 className="font-bold text-gray-800">Módulo Odonto</h4>
                        <p className="text-xs text-gray-500 mt-1">Prontuário clínico e odontograma.</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Regras Comerciais */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Percent className="w-5 h-5 text-emerald-600" />
                    Regras Comerciais
                </h2>
            </div>
            <div className="p-6">
                <div className="max-w-xs">
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Desconto Máximo Permitido (%)</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            min="0" max="100" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none" 
                            value={settings.maxDiscountPct || 0} 
                            onChange={e => handleUpdateDiscount(Number(e.target.value))}
                        />
                        <span className="font-black text-gray-400">%</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Vendedores não poderão salvar vendas com descontos acima deste valor.</p>
                </div>
            </div>
        </div>

        {isPJ && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-slate-800" />
                        Dados da Empresa
                    </h2>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSaveCompany} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">CNPJ</label>
                            <div className="flex gap-2">
                                <input type="text" value={companyForm.cnpj} onChange={e => setCompanyForm({...companyForm, cnpj: e.target.value})} className="flex-1 rounded-lg border border-gray-200 p-2 text-sm"/>
                                <button type="button" onClick={handleConsultCnpj} className="bg-gray-100 text-gray-600 px-3 rounded-lg"><Search className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <button type="submit" className="bg-slate-900 text-white px-6 rounded-xl text-sm font-bold py-3 hover:bg-black transition-colors">Atualizar Identidade</button>
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
