
import React, { useState, useRef } from 'react';
import { User, AppSettings, EntityType, CompanyProfile, Branch, CostCenter, Department, Project, TaxRegime, Contact, Account } from '../types';
import { CreditCard, Shield, Plus, Trash2, Building, Briefcase, FolderKanban, MapPin, Calculator, SmilePlus, CheckCircle, MessageSquare, Bell, Smartphone, Send, FileText, Mail, Wrench, BrainCircuit, Glasses, AlertTriangle, Info, Search, Percent, RefreshCw, Phone, ExternalLink, CreditCard as BillingIcon, FileUp, Loader2, Download, Landmark } from 'lucide-react';
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
      accounts: Account[]; // Adicionado
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
  
  const settings = user.settings || { includeCreditCardsInTotal: true, activeModules: {} };

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
                  const type = doc.length > 11 ? 'PJ' : 'PF';
                  
                  return {
                      id: crypto.randomUUID(),
                      externalId: getVal(['Identificador externo', 'ID Externo', 'external_id']),
                      name: getVal(['Nome', 'Razão Social', 'Cliente']) || 'Contato Sem Nome',
                      email: getVal(['Email', 'E-mail']).toLowerCase(),
                      phone: getVal(['Celular', 'Fone', 'Telefone', 'WhatsApp', 'Zap']),
                      document: doc,
                      fantasyName: getVal(['Empresa', 'Nome Fantasia', 'Fantasia']) || undefined,
                      type: type as 'PF' | 'PJ',
                      street: getVal(['Rua', 'Logradouro', 'Endereco', 'Endereço']),
                      number: getVal(['Número', 'nº', 'Numero']),
                      complement: getVal(['Complemento']),
                      neighborhood: getVal(['Bairro', 'Distrito']),
                      city: getVal(['Cidade', 'Municipio', 'Município']),
                      zipCode: getVal(['CEP', 'ZipCode']).replace(/\D/g, ''),
                      state: getVal(['Estado', 'UF']).toUpperCase().substring(0, 2),
                  };
              });

              await api.saveBulkContacts(newContacts);
              showAlert(`${newContacts.length} contatos importados com sucesso!`, "success");
              if (fileInputRef.current) fileInputRef.current.value = '';
          } catch (err) {
              console.error(err);
              showAlert("Erro ao processar arquivo XLS. Verifique o formato.", "error");
          } finally {
              setImporting(false);
          }
      };

      reader.readAsArrayBuffer(file);
  };

  const isPJ = user.entityType === EntityType.BUSINESS;
  const familyId = user.familyId || (user as any).family_id;
  const isAdmin = user.id === familyId;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações de Negócio</h1>
        <p className="text-gray-500">Gerencie a identidade, regras comerciais e assinatura da sua organização.</p>
      </div>

      <div className="space-y-6">
        
        {/* Gestão de Assinatura e Módulos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-indigo-600">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <BillingIcon className="w-5 h-5 text-indigo-600" />
                    Plano e Módulos Profissionais
                </h2>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                    {user.plan}
                </span>
            </div>
            <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 space-y-4">
                    <p className="text-sm text-gray-600 leading-relaxed">
                        A ativação de especialidades (Ótica, Odonto, Serviços) e a gestão de cobrança agora são realizadas no <strong>Portal de Assinante</strong>.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${settings.activeModules?.optical ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                            <Glasses className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">Ótica {settings.activeModules?.optical ? 'Ativo' : 'Inativo'}</span>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${settings.activeModules?.odonto ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                            <SmilePlus className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">Odonto {settings.activeModules?.odonto ? 'Ativo' : 'Inativo'}</span>
                        </div>
                    </div>
                </div>
                
                {isAdmin ? (
                    <div className="shrink-0">
                        <a 
                            href="https://billing.finmanager.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" /> Ir para Portal de Gestão
                        </a>
                    </div>
                ) : (
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3 max-w-xs">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-[10px] font-bold text-amber-800 leading-tight uppercase">
                            Apenas o administrador da conta pode alterar módulos ou planos de assinatura.
                        </p>
                    </div>
                )}
            </div>
        </div>

        {/* Regras Comerciais & Financeiro */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-emerald-600" />
                    Regras Comerciais & Financeiras
                </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest ml-1">Desconto Máximo Permitido (%)</label>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Percent className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <input 
                                type="number" 
                                min="0" max="100" 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-black focus:ring-2 focus:ring-indigo-500 outline-none" 
                                value={settings.maxDiscountPct || 0} 
                                onChange={e => handleUpdateSettingField('maxDiscountPct', Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Vendedores não poderão salvar vendas com descontos acima deste valor.</p>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest ml-1">Conta Principal de Recebimento</label>
                    <div className="relative">
                        <Landmark className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <select 
                            value={settings.defaultAccountId || ''} 
                            onChange={e => handleUpdateSettingField('defaultAccountId', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Selecione uma conta...</option>
                            {pjData.accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(2)})</option>
                            ))}
                        </select>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Conta onde serão creditadas as vendas automáticas.</p>
                </div>
            </div>
        </div>

        {/* Importação de Dados */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FileUp className="w-5 h-5 text-blue-600" />
                    Importação de Contatos
                </h2>
            </div>
            <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1 space-y-4">
                        <p className="text-sm text-gray-600">
                            Importe sua base de clientes e contatos via arquivo Excel (.xlsx). 
                            Certifique-se de que o arquivo segue o modelo de colunas padrão.
                        </p>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase text-gray-400">
                            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Auto-mapeamento</span>
                            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Validação de CPF/CNPJ</span>
                        </div>
                    </div>
                    <div className="shrink-0 w-full md:w-auto">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            className="hidden" 
                            accept=".xlsx, .xls"
                            onChange={handleImportXls}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            className="w-full bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                            {importing ? 'Processando XLS...' : 'Selecionar Arquivo XLS'}
                        </button>
                    </div>
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
