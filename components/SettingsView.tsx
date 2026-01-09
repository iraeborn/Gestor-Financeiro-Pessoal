
import React, { useState, useRef } from 'react';
import { User, AppSettings, EntityType, CompanyProfile, Branch, CostCenter, Department, Project, TaxRegime, Contact, Account } from '../types';
import { CreditCard, Shield, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, MessageSquare, Bell, Smartphone, Send, FileText, Mail, Wrench, BrainCircuit, Glasses, AlertTriangle, Info, Search, Percent, RefreshCw, Phone, ExternalLink, CreditCard as BillingIcon, FileUp, Loader2, Download, Landmark, ListChecks, Sparkles } from 'lucide-react';
import { updateSettings, consultCnpj, api } from '../services/storageService';
import { useAlert } from './AlertSystem';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  user: User;
  pjData: {
      companyProfile?: CompanyProfile | null;
      branches: Branch[];
      costCenters: CostCenter[];
      departments: Department[];
      projects: Project[];
      accounts: Account[];
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  
  const settings = user.settings || { 
    includeCreditCardsInTotal: true, 
    aiMonitoringEnabled: true,
    activeModules: {},
    installmentRules: {
        creditCard: { defaultInstallments: 1, interestRate: 0 },
        boleto: { maxInstallments: 12 }
    }
  };

  const [companyForm, setCompanyForm] = useState(pjData.companyProfile || { 
      tradeName: '', legalName: '', cnpj: '', 
      taxRegime: TaxRegime.SIMPLES, cnae: '', secondaryCnaes: '', 
      zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '', phone: '', email: '',
      hasEmployees: false, issuesInvoices: false 
  });
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  const handleUpdateSettingField = async (field: keyof AppSettings, value: any) => {
      const newSettings = { ...settings, [field]: value };
      try {
          await updateSettings(newSettings);
          onUpdateSettings(newSettings);
          showAlert("Configuração atualizada!", "success");
      } catch (e) {
          showAlert("Erro ao salvar configuração.", "error");
      }
  };

  const handleUpdateInstallmentRules = async (method: 'creditCard' | 'boleto', field: string, value: any) => {
    const newRules = { 
        ...settings.installmentRules, 
        [method]: { 
            ...(settings.installmentRules as any)[method], 
            [field]: value 
        } 
    };
    handleUpdateSettingField('installmentRules', newRules);
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

  const handleImportXls = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImporting(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const data = new Uint8Array(evt.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const json = XLSX.utils.sheet_to_json(worksheet) as any[];
              if (json.length === 0) {
                  showAlert("O arquivo parece estar vazio.", "warning");
                  setImporting(false);
                  return;
              }
              const newContacts: Contact[] = json.map(row => {
                  const getVal = (possibleKeys: string[]) => {
                      const foundKey = Object.keys(row).find(k => possibleKeys.some(pk => k.trim().toLowerCase() === pk.trim().toLowerCase()));
                      return foundKey ? String(row[foundKey]).trim() : '';
                  };
                  const doc = getVal(['CPF ou CNPJ', 'Documento', 'CPF', 'CNPJ']).replace(/\D/g, '');
                  return {
                      id: crypto.randomUUID(),
                      name: getVal(['Nome', 'Razão Social', 'Cliente']) || 'Contato Sem Nome',
                      email: getVal(['Email', 'E-mail']).toLowerCase(),
                      phone: getVal(['Celular', 'Fone', 'Telefone', 'WhatsApp', 'Zap']),
                      document: doc,
                      type: doc.length > 11 ? 'PJ' : 'PF' as any,
                  };
              });
              await api.saveBulkContacts(newContacts);
              showAlert(`${newContacts.length} contatos importados!`, "success");
          } catch (err) { showAlert("Erro ao processar XLS.", "error"); } finally { setImporting(false); }
      };
      reader.readAsArrayBuffer(file);
  };

  const isPJ = user.entityType === EntityType.BUSINESS;
  const familyId = user.familyId || (user as any).family_id;
  const isAdmin = user.id === familyId;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Ajustes de Organização</h1>
        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">Configurações de infraestrutura e regras de negócio</p>
      </div>

      <div className="space-y-6">

        {/* Inteligência Artificial */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-indigo-50/30">
                <h2 className="text-lg font-black text-indigo-900 flex items-center gap-3 uppercase tracking-tighter">
                    <BrainCircuit className="w-5 h-5 text-indigo-600" />
                    Inteligência Artificial (IA)
                </h2>
            </div>
            <div className="p-8">
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-700">Sugestões e Monitoramento IA</p>
                            <Sparkles className="w-4 h-4 text-amber-500" />
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium max-w-md">Ao ativar, o sistema utilizará o Gemini Pro 3.0 para sugerir títulos de vendas, gerar diagnósticos de saúde do caixa e riscos patrimoniais.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={settings.aiMonitoringEnabled ?? true} 
                            onChange={e => handleUpdateSettingField('aiMonitoringEnabled', e.target.checked)} 
                        />
                        <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                    </label>
                </div>
            </div>
        </div>
        
        {/* Regras Bancárias e Parcelamento */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                    <ListChecks className="w-5 h-5 text-indigo-600" />
                    Regras de Parcelamento
                </h2>
            </div>
            <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Cartão de Crédito */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="w-4 h-4 text-indigo-600" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Cartão de Crédito</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Juros Padrão p/ Cliente (%)</label>
                                <div className="relative">
                                    <Percent className="absolute left-3 top-3 w-4 h-4 text-slate-300" />
                                    <input 
                                        type="number" step="0.1" 
                                        className="w-full pl-9 py-2.5 bg-white rounded-xl text-xs font-black outline-none border border-slate-200 focus:border-indigo-500" 
                                        value={settings.installmentRules?.creditCard.interestRate || 0}
                                        onChange={e => handleUpdateInstallmentRules('creditCard', 'interestRate', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Parcelas Sugeridas</label>
                                <input 
                                    type="number" 
                                    className="w-full px-4 py-2.5 bg-white rounded-xl text-xs font-black outline-none border border-slate-200 focus:border-indigo-500" 
                                    value={settings.installmentRules?.creditCard.defaultInstallments || 1}
                                    onChange={e => handleUpdateInstallmentRules('creditCard', 'defaultInstallments', parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Boleto */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-emerald-600" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Boleto Bancário</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Número Máximo de Parcelas</label>
                                <input 
                                    type="number" 
                                    className="w-full px-4 py-2.5 bg-white rounded-xl text-xs font-black outline-none border border-slate-200 focus:border-emerald-500" 
                                    value={settings.installmentRules?.boleto.maxInstallments || 12}
                                    onChange={e => handleUpdateInstallmentRules('boleto', 'maxInstallments', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-2 items-start">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[9px] font-bold text-amber-800 leading-tight uppercase">Boletos não possuem juros automáticos por parcela por padrão.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Regras Comerciais */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                    <Calculator className="w-5 h-5 text-indigo-600" />
                    Regras Comerciais
                </h2>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest ml-1">Desconto Máximo Vendedor (%)</label>
                    <div className="relative">
                        <Percent className="absolute left-3 top-3 w-4 h-4 text-slate-300" />
                        <input 
                            type="number" 
                            className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none" 
                            value={settings.maxDiscountPct || 0} 
                            onChange={e => handleUpdateSettingField('maxDiscountPct', Number(e.target.value))}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest ml-1">Conta Padrão de Crédito</label>
                    <div className="relative">
                        <Landmark className="absolute left-3 top-3 w-4 h-4 text-slate-300" />
                        <select 
                            value={settings.defaultAccountId || ''} 
                            onChange={e => handleUpdateSettingField('defaultAccountId', e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Selecione...</option>
                            {pjData.accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>

        {/* Importação */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                    <FileUp className="w-5 h-5 text-indigo-600" />
                    Manutenção de Dados
                </h2>
            </div>
            <div className="p-8">
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-700">Importação em Massa (XLSX)</p>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">Suba sua planilha de clientes para uma migração imediata.</p>
                    </div>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-xl shadow-indigo-100"
                    >
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                        {importing ? 'Processando...' : 'Selecionar Arquivo'}
                        <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportXls} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
