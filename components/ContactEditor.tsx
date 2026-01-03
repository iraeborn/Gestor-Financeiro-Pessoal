
import React, { useState, useEffect } from 'react';
import { Contact, EntityType, AppSettings } from '../types';
/* Added missing Info icon import */
import { 
    User, Mail, Phone, FileText, Building, MapPin, 
    DollarSign, CreditCard, Shield, AlertTriangle, Briefcase, 
    RefreshCw, Search, ArrowLeft, Save, Glasses, Eye, 
    Activity, History, Tag, CheckCircle2, Info 
} from 'lucide-react';
import { consultCnpj } from '../services/storageService';
import { useAlert } from './AlertSystem';

interface ContactEditorProps {
    initialData?: Contact | null;
    settings?: AppSettings;
    onSave: (c: Contact) => void;
    onCancel: () => void;
}

type EditorTab = 'BASIC' | 'ADDRESS' | 'FINANCIAL' | 'OPTICAL';

const ContactEditor: React.FC<ContactEditorProps> = ({ initialData, settings, onSave, onCancel }) => {
    const { showAlert } = useAlert();
    const [activeTab, setActiveTab] = useState<EditorTab>('BASIC');
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    
    const isOpticalActive = settings?.activeModules?.optical === true;

    const [formData, setFormData] = useState<Partial<Contact>>({
        name: '',
        type: 'PF',
        email: '',
        phone: '',
        document: '',
        pixKey: '',
        zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '',
        creditLimit: 0, isDefaulter: false, isBlocked: false, defaultPaymentTerm: 0,
        opticalNotes: '', brandPreference: '', yearsOfUse: 0, opticalCategory: 'NORMAL'
    });

    useEffect(() => {
        if (initialData) {
            setFormData({ ...initialData });
        }
    }, [initialData]);

    const handleConsultCnpj = async () => {
        if (!formData.document || formData.document.length < 14) {
            showAlert("CNPJ inválido para consulta.", "warning");
            return;
        }
        setLoadingCnpj(true);
        try {
            const data = await consultCnpj(formData.document);
            if (data) {
                setFormData(prev => ({
                    ...prev,
                    name: data.razao_social,
                    fantasyName: data.nome_fantasia,
                    type: 'PJ',
                    zipCode: data.cep,
                    street: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro}`.trim(),
                    number: data.numero,
                    neighborhood: data.bairro,
                    city: data.municipio,
                    state: data.uf,
                    phone: data.ddd_telefone_1,
                    email: data.email ? data.email.toLowerCase() : prev.email
                }));
                showAlert("Dados carregados com sucesso!", "success");
            }
        } catch (e) {
            showAlert("Erro ao consultar CNPJ.", "error");
        } finally {
            setLoadingCnpj(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            showAlert("O nome é obrigatório.", "warning");
            return;
        }

        onSave({
            ...formData,
            id: initialData?.id || crypto.randomUUID(),
        } as Contact);
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            {/* Header da Página */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                            {initialData ? 'Editar Perfil' : 'Novo Cadastro'}
                        </h1>
                        <p className="text-gray-500 font-medium">{formData.name || 'Preencha os dados do contato'}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">Descartar</button>
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Salvar Cadastro
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Menu de Navegação por Módulos */}
                <div className="lg:col-span-1 space-y-2">
                    <button 
                        onClick={() => setActiveTab('BASIC')}
                        className={`w-full text-left px-5 py-4 rounded-2xl flex items-center gap-3 transition-all border ${activeTab === 'BASIC' ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-gray-600 border-transparent hover:bg-gray-50'}`}
                    >
                        <User className="w-5 h-5" />
                        <span className="font-bold text-sm">Dados Básicos</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('ADDRESS')}
                        className={`w-full text-left px-5 py-4 rounded-2xl flex items-center gap-3 transition-all border ${activeTab === 'ADDRESS' ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-gray-600 border-transparent hover:bg-gray-50'}`}
                    >
                        <MapPin className="w-5 h-5" />
                        <span className="font-bold text-sm">Endereço</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('FINANCIAL')}
                        className={`w-full text-left px-5 py-4 rounded-2xl flex items-center gap-3 transition-all border ${activeTab === 'FINANCIAL' ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-gray-600 border-transparent hover:bg-gray-50'}`}
                    >
                        <DollarSign className="w-5 h-5" />
                        <span className="font-bold text-sm">Financeiro</span>
                    </button>
                    {isOpticalActive && (
                        <button 
                            onClick={() => setActiveTab('OPTICAL')}
                            className={`w-full text-left px-5 py-4 rounded-2xl flex items-center gap-3 transition-all border ${activeTab === 'OPTICAL' ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-gray-600 border-transparent hover:bg-gray-50'}`}
                        >
                            <Glasses className="w-5 h-5" />
                            <span className="font-bold text-sm">Módulo Ótica</span>
                        </button>
                    )}
                </div>

                {/* Conteúdo do Editor */}
                <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-12 overflow-hidden">
                    {activeTab === 'BASIC' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex justify-center mb-8">
                                <div className="flex bg-indigo-50 p-1.5 rounded-2xl border border-indigo-100">
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData({...formData, type: 'PF'})}
                                        className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'PF' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-indigo-400 hover:bg-indigo-100/50'}`}
                                    >
                                        <User className="w-4 h-4" /> Pessoa Física
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData({...formData, type: 'PJ'})}
                                        className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'PJ' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-indigo-400 hover:bg-indigo-100/50'}`}
                                    >
                                        <Briefcase className="w-4 h-4" /> Pessoa Jurídica
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Documento ({formData.type === 'PJ' ? 'CNPJ' : 'CPF'})</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <FileText className="w-4 h-4 text-gray-300 absolute left-4 top-3.5" />
                                            <input
                                                type="text"
                                                value={formData.document}
                                                onChange={(e) => setFormData({ ...formData, document: e.target.value.replace(/\D/g, '') })}
                                                className="block w-full pl-11 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                                placeholder="Apenas números"
                                                maxLength={14}
                                            />
                                        </div>
                                        {formData.type === 'PJ' && (
                                            <button 
                                                type="button" 
                                                onClick={handleConsultCnpj} 
                                                disabled={loadingCnpj}
                                                className="bg-indigo-50 text-indigo-600 px-5 py-3.5 rounded-2xl text-sm font-black hover:bg-indigo-100 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                                            >
                                                {loadingCnpj ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Nome / Razão Social</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                    />
                                </div>
                            </div>

                            {formData.type === 'PJ' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
                                    <div className="md:col-span-1 space-y-2">
                                        <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Nome Fantasia</label>
                                        <input
                                            type="text"
                                            value={formData.fantasyName}
                                            onChange={(e) => setFormData({ ...formData, fantasyName: e.target.value })}
                                            className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">IE</label>
                                        <input
                                            type="text"
                                            value={formData.ie}
                                            onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                                            className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">IM</label>
                                        <input
                                            type="text"
                                            value={formData.im}
                                            onChange={(e) => setFormData({ ...formData, im: e.target.value })}
                                            className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Telefone / WhatsApp</label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-gray-300 absolute left-4 top-3.5" />
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="block w-full pl-11 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                            placeholder="(00) 00000-0000"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">E-mail de Contato</label>
                                    <div className="relative">
                                        <Mail className="w-4 h-4 text-gray-300 absolute left-4 top-3.5" />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="block w-full pl-11 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                            placeholder="exemplo@email.com"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ADDRESS' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">CEP</label>
                                    <input
                                        type="text"
                                        value={formData.zipCode}
                                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                        placeholder="00000-000"
                                    />
                                </div>
                                <div className="md:col-span-3 space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Rua / Logradouro</label>
                                    <div className="relative">
                                        <MapPin className="w-4 h-4 text-gray-300 absolute left-4 top-3.5" />
                                        <input
                                            type="text"
                                            value={formData.street}
                                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                            className="block w-full pl-11 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Número</label>
                                    <input
                                        type="text"
                                        value={formData.number}
                                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Bairro</label>
                                    <input
                                        type="text"
                                        value={formData.neighborhood}
                                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Cidade</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Estado (UF)</label>
                                    <input
                                        type="text"
                                        maxLength={2}
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm transition-all text-center"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'FINANCIAL' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-50 rounded-[2rem] border border-gray-100">
                                <label className="flex-1 flex items-center gap-4 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.isBlocked} 
                                        onChange={e => setFormData({...formData, isBlocked: e.target.checked})}
                                        className="w-6 h-6 text-rose-600 rounded-lg focus:ring-rose-500" 
                                    />
                                    <div>
                                        <span className={`block font-black uppercase text-[10px] tracking-widest ${formData.isBlocked ? 'text-rose-600' : 'text-gray-400'}`}>Bloqueio de Venda</span>
                                        <span className="text-xs text-gray-500">Impedir novos orçamentos para este cliente.</span>
                                    </div>
                                </label>
                                
                                <div className="w-px bg-gray-200 hidden md:block"></div>

                                <label className="flex-1 flex items-center gap-4 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.isDefaulter} 
                                        onChange={e => setFormData({...formData, isDefaulter: e.target.checked})}
                                        className="w-6 h-6 text-amber-600 rounded-lg focus:ring-amber-500" 
                                    />
                                    <div>
                                        <span className={`block font-black uppercase text-[10px] tracking-widest ${formData.isDefaulter ? 'text-amber-600' : 'text-gray-400'}`}>Sinal de Alerta</span>
                                        <span className="text-xs text-gray-500">Marcar como cliente com pendências financeiras.</span>
                                    </div>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Limite de Crédito Interno</label>
                                    <div className="relative">
                                        <DollarSign className="w-4 h-4 text-emerald-500 absolute left-4 top-3.5" />
                                        <input
                                            type="number"
                                            value={formData.creditLimit}
                                            onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                                            className="block w-full pl-11 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-black text-sm"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Chave Pix Favorecida</label>
                                    <div className="relative">
                                        <CheckCircle2 className="w-4 h-4 text-indigo-400 absolute left-4 top-3.5" />
                                        <input
                                            type="text"
                                            value={formData.pixKey}
                                            onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                                            className="block w-full pl-11 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Forma de Pagamento Padrão</label>
                                    <select 
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm appearance-none"
                                        value={formData.defaultPaymentMethod}
                                        onChange={(e) => setFormData({ ...formData, defaultPaymentMethod: e.target.value })}
                                    >
                                        <option value="">Selecione uma opção...</option>
                                        <option value="BOLETO">Boleto Bancário</option>
                                        <option value="PIX">Pix</option>
                                        <option value="CARD">Cartão de Crédito</option>
                                        <option value="CASH">Dinheiro</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Prazo Médio de Vencimento (Dias)</label>
                                    <input
                                        type="number"
                                        value={formData.defaultPaymentTerm}
                                        onChange={(e) => setFormData({ ...formData, defaultPaymentTerm: Number(e.target.value) })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                                        placeholder="Ex: 30"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'OPTICAL' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-lg">
                                    <Glasses className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-800">Prontuário Ótico</h3>
                                    <p className="text-sm text-gray-400 font-medium uppercase tracking-widest text-[10px]">Informações Técnicas do Paciente</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Anos de Uso de Correção</label>
                                    <input
                                        type="number"
                                        value={formData.yearsOfUse}
                                        onChange={(e) => setFormData({ ...formData, yearsOfUse: Number(e.target.value) })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Categoria de Cliente Ótico</label>
                                    <select 
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm appearance-none"
                                        value={formData.opticalCategory}
                                        onChange={(e) => setFormData({ ...formData, opticalCategory: e.target.value as any })}
                                    >
                                        <option value="NORMAL">Uso Regular</option>
                                        <option value="PREMIUM">Premium / Alta Fidelidade</option>
                                        <option value="KIDS">Infantil</option>
                                        <option value="SPORT">Esportivo / Segurança</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Preferência de Marcas / Estilos</label>
                                    <div className="relative">
                                        <Tag className="w-4 h-4 text-gray-300 absolute left-4 top-3.5" />
                                        <input
                                            type="text"
                                            value={formData.brandPreference}
                                            onChange={(e) => setFormData({ ...formData, brandPreference: e.target.value })}
                                            className="block w-full pl-11 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                                            placeholder="Ex: Oakley, Ray-Ban, Acetato..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Data da Última Consulta Oftalmológica</label>
                                    <input
                                        type="date"
                                        value={formData.lastConsultationDate}
                                        onChange={(e) => setFormData({ ...formData, lastConsultationDate: e.target.value })}
                                        className="block w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Observações Técnicas / Restrições (Alergias a metais, etc)</label>
                                <textarea 
                                    value={formData.opticalNotes}
                                    onChange={(e) => setFormData({ ...formData, opticalNotes: e.target.value })}
                                    className="block w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm min-h-[120px] shadow-inner"
                                    placeholder="Descreva detalhes específicos do histórico visual do cliente..."
                                />
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex items-start gap-4">
                                <Info className="w-6 h-6 text-indigo-600 shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-black uppercase text-[10px] text-indigo-700 tracking-widest mb-1">Dica do Gestor</h4>
                                    <p className="text-xs text-indigo-800 leading-relaxed">
                                        Mantenha este registro atualizado para sugerir armações e lentes baseadas no histórico e preferências do paciente, aumentando a taxa de conversão em 30%.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactEditor;
