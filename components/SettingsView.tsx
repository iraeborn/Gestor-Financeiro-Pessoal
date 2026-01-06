
import React, { useState } from 'react';
import { User, AppSettings, EntityType, CompanyProfile, Branch, CostCenter, Department, Project, TaxRegime } from '../types';
import { CreditCard, Shield, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, MessageSquare, Bell, Smartphone, Send, FileText, Mail, Wrench, BrainCircuit, Glasses, AlertTriangle, Info, Search, Percent, RefreshCw, Phone } from 'lucide-react';
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
      const cleanCnpj = companyForm.cnpj.replace(/\D/g, '');
      if (!cleanCnpj || cleanCnpj.length < 14) {
          showAlert("CNPJ inválido.", "warning");
          return;
      }
      setLoadingCnpj(true);
      try {
          const data = await consultCnpj(cleanCnpj);
          if (data) {
              setCompanyForm(prev => ({
                  ...prev,
                  tradeName: data.nome_fantasia || data.razao_social,
                  legalName: data.razao_social,
                  zipCode: data.cep,
                  street: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro}`.trim(),
                  number: data.numero,
                  neighborhood: data.bairro,
                  city: data.municipio,
                  state: data.uf,
                  email: data.email || prev.email,
                  phone: data.ddd_telefone_1 || prev.phone
              }));
              showAlert("Dados da Receita Federal carregados!", "success");
          }
      } catch (e) { showAlert("CNPJ não encontrado.", "error"); } finally { setLoadingCnpj(false); }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
      e.preventDefault();
      onSavePJEntity('company', { ...companyForm, id: pjData.companyProfile?.id || crypto.randomUUID() });
      showAlert("Identidade visual e fiscal atualizada!", "success");
  };

  const isPJ = user.entityType === EntityType.BUSINESS;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações de Negócio</h1>
        <p className="text-gray-500">Personalize os módulos, descontos e a identidade da sua organização.</p>
      </div>

      <div className="space-y-6">
        {/* Módulos */}
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

        {/* Identidade PJ */}
        {isPJ && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-slate-800" />
                        Identidade do Negócio (Fiscal & Social)
                    </h2>
                </div>
                <div className="p-8">
                    <form onSubmit={handleSaveCompany} className="space-y-10">
                        {/* Bloco 1: Fiscal */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2 border-b border-gray-50 pb-2">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Informações Fiscais</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-1">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">CNPJ da Sede</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Building className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                            <input 
                                                type="text" 
                                                value={companyForm.cnpj} 
                                                onChange={e => setCompanyForm({...companyForm, cnpj: e.target.value})} 
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Apenas números"
                                            />
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleConsultCnpj} 
                                            disabled={loadingCnpj}
                                            className="bg-indigo-600 text-white px-4 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50"
                                        >
                                            {loadingCnpj ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Regime Tributário</label>
                                    <select 
                                        value={companyForm.taxRegime} 
                                        onChange={e => setCompanyForm({...companyForm, taxRegime: e.target.value as TaxRegime})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none appearance-none cursor-pointer"
                                    >
                                        <option value={TaxRegime.SIMPLES}>Simples Nacional</option>
                                        <option value={TaxRegime.MEI}>MEI</option>
                                        <option value={TaxRegime.PRESUMIDO}>Lucro Presumido</option>
                                        <option value={TaxRegime.REAL}>Lucro Real</option>
                                    </select>
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Razão Social</label>
                                    <input 
                                        type="text" 
                                        value={companyForm.legalName} 
                                        onChange={e => setCompanyForm({...companyForm, legalName: e.target.value})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none"
                                    />
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Nome Fantasia</label>
                                    <input 
                                        type="text" 
                                        value={companyForm.tradeName} 
                                        onChange={e => setCompanyForm({...companyForm, tradeName: e.target.value})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bloco 2: Endereço */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2 border-b border-gray-50 pb-2">
                                <MapPin className="w-4 h-4 text-rose-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Localização e Sede</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">CEP</label>
                                    <input 
                                        type="text" 
                                        value={companyForm.zipCode} 
                                        onChange={e => setCompanyForm({...companyForm, zipCode: e.target.value})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Rua / Logradouro</label>
                                    <input 
                                        type="text" 
                                        value={companyForm.street} 
                                        onChange={e => setCompanyForm({...companyForm, street: e.target.value})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Número</label>
                                    <input 
                                        type="text" 
                                        value={companyForm.number} 
                                        onChange={e => setCompanyForm({...companyForm, number: e.target.value})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Bairro</label>
                                    <input 
                                        type="text" 
                                        value={companyForm.neighborhood} 
                                        onChange={e => setCompanyForm({...companyForm, neighborhood: e.target.value})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Cidade</label>
                                    <input 
                                        type="text" 
                                        value={companyForm.city} 
                                        onChange={e => setCompanyForm({...companyForm, city: e.target.value})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Estado (UF)</label>
                                    <input 
                                        type="text" 
                                        maxLength={2}
                                        value={companyForm.state} 
                                        onChange={e => setCompanyForm({...companyForm, state: e.target.value.toUpperCase()})} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none text-center"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bloco 3: Contato */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2 border-b border-gray-50 pb-2">
                                <Smartphone className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canais de Contato</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">E-mail Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="email" 
                                            value={companyForm.email} 
                                            onChange={e => setCompanyForm({...companyForm, email: e.target.value})} 
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold outline-none"
                                            placeholder="administrativo@empresa.com"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Telefone Principal</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="text" 
                                            value={companyForm.phone} 
                                            onChange={e => setCompanyForm({...companyForm, phone: e.target.value})} 
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold outline-none"
                                            placeholder="(00) 0000-0000"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 flex justify-end">
                            <button 
                                type="submit" 
                                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" /> Atualizar Identidade do Negócio
                            </button>
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
