
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    ArrowLeft, Save, Tag, User, CreditCard, Landmark, 
    Calendar, Banknote, TrendingUp, ArrowRightLeft, 
    Plus, QrCode, Loader2, Check, Clock, AlertCircle, 
    Repeat, CalendarDays, Briefcase, Calculator, 
    Layers, ReceiptText, ShieldCheck, DollarSign
} from 'lucide-react';
import { 
    Transaction, TransactionType, TransactionStatus, 
    Account, RecurrenceFrequency, Contact, Category, 
    EntityType, TransactionClassification, Branch, 
    CostCenter, Department, Project 
} from '../types';
import { useAlert } from './AlertSystem';

interface TransactionEditorProps {
    initialData?: Transaction | null;
    accounts: Account[];
    contacts: Contact[];
    categories: Category[];
    branches: Branch[];
    costCenters: CostCenter[];
    departments: Department[];
    projects: Project[];
    userEntity: EntityType;
    onSave: (transaction: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => Promise<void>;
    onCancel: () => void;
    settings?: any;
}

const TransactionEditor: React.FC<TransactionEditorProps> = ({ 
    initialData, accounts, contacts, categories, branches, 
    costCenters, departments, projects, userEntity, 
    onSave, onCancel, settings 
}) => {
    const { showAlert } = useAlert();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estado principal do formulário
    const [formData, setFormData] = useState<Partial<Transaction>>({
        type: TransactionType.EXPENSE,
        status: TransactionStatus.PAID,
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        classification: TransactionClassification.STANDARD,
        isRecurring: false,
        recurrenceFrequency: RecurrenceFrequency.MONTHLY,
        receiptUrls: []
    });

    // Estados de busca/seleção
    const [categorySearch, setCategorySearch] = useState('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);

    // Estados de Parcelamento
    const [isParcelado, setIsParcelado] = useState(false);
    const [numInstallments, setNumInstallments] = useState(1);
    const [downPayment, setDownPayment] = useState(0);
    const [installmentMethod, setInstallmentMethod] = useState<'CREDIT_CARD' | 'BOLETO'>('CREDIT_CARD');

    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const contactDropdownRef = useRef<HTMLDivElement>(null);

    // Efeito para carregar dados iniciais
    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
            setCategorySearch(initialData.category || '');
            const c = contacts.find(co => co.id === initialData.contactId);
            setContactSearch(c ? c.name : '');
        } else {
            const defaultAccId = accounts.length > 0 ? accounts[0].id : '';
            setFormData(prev => ({ 
                ...prev, 
                accountId: defaultAccId,
                destinationAccountId: accounts.length > 1 ? accounts[1].id : defaultAccId
            }));
        }
    }, [initialData, accounts, contacts]);

    // Lógica de Descrição Automática
    useEffect(() => {
        if (initialData) return; // Não sugerir se estiver editando

        const typeLabel = formData.type === TransactionType.INCOME ? 'Recebimento' : 'Pagamento';
        const catLabel = categorySearch || '[Categoria]';
        const contactLabel = contactSearch || '';
        
        let suggestion = `${typeLabel} de ${catLabel}`;
        if (contactLabel) suggestion += ` - ${contactLabel}`;

        setFormData(prev => ({ ...prev, description: suggestion }));
    }, [formData.type, categorySearch, contactSearch, initialData]);

    // Cálculos de Parcelamento
    const installmentPreview = useMemo(() => {
        if (!isParcelado || (formData.amount || 0) <= 0) return [];
        
        const remainder = (formData.amount || 0) - downPayment;
        if (remainder <= 0) return [];

        const rules = settings?.installmentRules || { creditCard: { interestRate: 0 }, boleto: { maxInstallments: 12 } };
        const rate = installmentMethod === 'CREDIT_CARD' ? (rules.creditCard.interestRate / 100) : 0;

        // Cálculo Simples: Valor * (1 + Taxa) / Parcelas
        const installmentValue = (remainder * (1 + rate)) / numInstallments;
        
        const items = [];
        const baseDate = new Date(formData.date!);

        for (let i = 1; i <= numInstallments; i++) {
            const date = new Date(baseDate);
            date.setMonth(baseDate.getMonth() + i);
            items.push({
                idx: i,
                date: date.toISOString().split('T')[0],
                value: installmentValue
            });
        }
        return items;
    }, [isParcelado, formData.amount, downPayment, numInstallments, installmentMethod, formData.date, settings]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!formData.description?.trim()) return showAlert("A descrição é obrigatória.", "warning");
        if (!formData.amount || formData.amount <= 0) return showAlert("Insira um valor maior que zero.", "warning");
        if (!categorySearch.trim()) return showAlert("Selecione uma categoria.", "warning");

        setIsSubmitting(true);

        // Processamento de Contato/Categoria
        let newContactObj: Contact | undefined;
        let finalContactId = formData.contactId;
        if (contactSearch.trim() && !contacts.some(c => c.id === formData.contactId)) {
            newContactObj = { id: crypto.randomUUID(), name: contactSearch.trim(), type: 'PF' };
            finalContactId = newContactObj.id;
        }

        let newCategoryObj: Category | undefined;
        let finalCategory = categorySearch.trim();
        if (!categories.some(c => c.name.toLowerCase() === finalCategory.toLowerCase() && c.type === formData.type)) {
            newCategoryObj = { id: crypto.randomUUID(), name: finalCategory, type: formData.type as TransactionType };
        }

        try {
            if (isParcelado && formData.type === TransactionType.INCOME) {
                // Lógica de Venda Parcelada: Salva a Entrada + Parcelas
                if (downPayment > 0) {
                    await onSave({
                        ...formData,
                        amount: downPayment,
                        category: finalCategory,
                        contactId: finalContactId,
                        description: `${formData.description} (Entrada)`,
                        status: TransactionStatus.PAID
                    } as Transaction, newContactObj, newCategoryObj);
                }

                for (const inst of installmentPreview) {
                    await onSave({
                        ...formData,
                        amount: inst.value,
                        category: finalCategory,
                        contactId: finalContactId,
                        description: `${formData.description} (${inst.idx}/${numInstallments})`,
                        date: inst.date,
                        status: TransactionStatus.PENDING
                    } as Transaction, undefined, undefined);
                }
            } else {
                // Lançamento Comum
                await onSave({
                    ...formData,
                    category: finalCategory,
                    contactId: finalContactId
                } as Transaction, newContactObj, newCategoryObj);
            }
            onCancel();
        } catch (err) {
            showAlert("Erro ao processar lançamento.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const typeColors = {
        [TransactionType.EXPENSE]: 'text-rose-600',
        [TransactionType.INCOME]: 'text-emerald-600',
        [TransactionType.TRANSFER]: 'text-blue-600'
    };

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-24">
            {/* Header Estratégico */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4 border-b border-slate-100 pb-8">
                <div className="flex items-center gap-5">
                    <button onClick={onCancel} className="p-3 hover:bg-white rounded-2xl border border-slate-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600 group">
                        <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                            {initialData ? 'Ajuste de Registro' : 'Novo Lançamento Financeiro'}
                        </h1>
                        <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest mt-1">
                            Ambiente de Classificação e Fluxo de Caixa
                        </p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-slate-200 hover:bg-black transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Confirmar Lançamento
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Bloco 1: Valor e Tipo */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Volume Financeiro</label>
                            <div className="relative group">
                                <div className={`absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-black ${typeColors[formData.type as TransactionType]} transition-colors`}>R$</div>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    autoFocus
                                    value={formData.amount === 0 ? '' : formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                    className="block w-full pl-16 pr-4 py-4 bg-transparent border-b-4 border-slate-50 focus:border-indigo-500 rounded-none text-6xl font-black text-slate-900 outline-none transition-all placeholder-slate-100"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        <div className="flex bg-slate-100/50 p-1.5 rounded-[2rem] border border-slate-100 shadow-inner">
                            {[
                                { id: TransactionType.EXPENSE, label: 'Despesa', icon: Banknote },
                                { id: TransactionType.INCOME, label: 'Receita', icon: TrendingUp },
                                { id: TransactionType.TRANSFER, label: 'Transferência', icon: ArrowRightLeft }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: item.id })}
                                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                                        formData.type === item.id 
                                        ? 'bg-white shadow-xl text-indigo-600 border border-slate-50' 
                                        : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <item.icon className="w-5 h-5" /> {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bloco 2: Classificação (Prioridade) */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-10">
                        <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                            <Layers className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Classificação Estratégica</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                            {/* CATEGORIA - PRIORIDADE #1 */}
                            <div className="space-y-3 relative" ref={categoryDropdownRef}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoria do Fluxo <span className="text-rose-500">*</span></label>
                                <div className="relative">
                                    <Tag className="w-5 h-5 text-slate-300 absolute left-4 top-4" />
                                    <input 
                                        type="text" 
                                        value={categorySearch} 
                                        onFocus={() => setShowCategoryDropdown(true)} 
                                        onChange={(e) => {setCategorySearch(e.target.value); setShowCategoryDropdown(true);}} 
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                                        placeholder="Buscar ou criar..." 
                                    />
                                </div>
                                {showCategoryDropdown && (
                                    <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl mt-2 max-h-64 overflow-y-auto p-2 animate-fade-in border-t-4 border-t-indigo-500">
                                        {categories.filter(c => c.type === formData.type && c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                            <button key={c.id} type="button" onClick={() => {setCategorySearch(c.name); setShowCategoryDropdown(false);}} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 rounded-xl text-xs font-black text-slate-600 transition-colors">
                                                {c.name}
                                            </button>
                                        ))}
                                        {categorySearch && !categories.some(c => c.name.toLowerCase() === categorySearch.toLowerCase() && c.type === formData.type) && (
                                            <button type="button" onClick={() => setShowCategoryDropdown(false)} className="w-full text-left px-5 py-4 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 mt-2">
                                                <Plus className="w-4 h-4" /> Criar nova: "{categorySearch}"
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* CLIENTE/CONTATO - PRIORIDADE #2 */}
                            <div className="space-y-3 relative" ref={contactDropdownRef}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Favorecido / Pagador</label>
                                <div className="relative">
                                    <User className="w-5 h-5 text-slate-300 absolute left-4 top-4" />
                                    <input 
                                        type="text" 
                                        value={contactSearch}
                                        onFocus={() => setShowContactDropdown(true)}
                                        onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        placeholder="Nome da pessoa ou empresa..."
                                    />
                                </div>
                                {showContactDropdown && (
                                    <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl mt-2 max-h-64 overflow-y-auto p-2 animate-fade-in border-t-4 border-t-indigo-500">
                                        {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                                            <button key={c.id} type="button" onClick={() => {setContactSearch(c.name); setFormData(prev => ({ ...prev, contactId: c.id })); setShowContactDropdown(false);}} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 rounded-xl text-xs font-black text-slate-600 transition-colors flex items-center justify-between">
                                                {c.name}
                                                {formData.contactId === c.id && <Check className="w-4 h-4 text-indigo-600" />}
                                            </button>
                                        ))}
                                        {contactSearch && !contacts.some(c => c.name.toLowerCase() === contactSearch.toLowerCase()) && (
                                            <button type="button" onClick={() => setShowContactDropdown(false)} className="w-full text-left px-5 py-4 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 mt-2">
                                                <Plus className="w-4 h-4" /> Novo Contato: "{contactSearch}"
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="md:col-span-2 space-y-3">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição do Lançamento</label>
                                    <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">Sugestão de IA ativa</span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                    placeholder="Ex: Compra de Material de Escritório"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Bloco 3: Parcelamento (Exclusivo Receita) */}
                    {formData.type === TransactionType.INCOME && !initialData && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8 animate-slide-in-bottom">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Calculator className="w-5 h-5"/></div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Fluxo de Parcelamento</h3>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={isParcelado} onChange={e => setIsParcelado(e.target.checked)} />
                                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                                    <span className="ml-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Venda Parcelada</span>
                                </label>
                            </div>

                            {isParcelado && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Valor da Entrada (R$)</label>
                                            <input type="number" step="0.01" className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500" value={downPayment} onChange={e => setDownPayment(parseFloat(e.target.value) || 0)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Método das Parcelas</label>
                                            <select className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-bold outline-none cursor-pointer" value={installmentMethod} onChange={e => setInstallmentMethod(e.target.value as any)}>
                                                <option value="CREDIT_CARD">💳 Cartão de Crédito</option>
                                                <option value="BOLETO">📄 Boleto Bancário</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Quantidade de Parcelas</label>
                                            <input type="number" min="1" max="60" className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500" value={numInstallments} onChange={e => setNumInstallments(parseInt(e.target.value) || 1)} />
                                        </div>
                                    </div>

                                    {/* Preview das Parcelas */}
                                    <div className="bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden shadow-inner">
                                        <table className="w-full text-left">
                                            <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <tr>
                                                    <th className="p-4">Parcela</th>
                                                    <th className="p-4">Data Prevista</th>
                                                    <th className="p-4 text-right">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {downPayment > 0 && (
                                                    <tr className="bg-emerald-50/50">
                                                        <td className="p-4 text-[10px] font-black text-emerald-600 uppercase">Entrada / À Vista</td>
                                                        <td className="p-4 text-xs font-bold text-slate-700">{new Date(formData.date!).toLocaleDateString()}</td>
                                                        <td className="p-4 text-right text-sm font-black text-emerald-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(downPayment)}</td>
                                                    </tr>
                                                )}
                                                {installmentPreview.map(inst => (
                                                    <tr key={inst.idx}>
                                                        <td className="p-4 text-xs font-bold text-slate-500">{inst.idx}ª Parcela</td>
                                                        <td className="p-4 text-xs font-bold text-slate-700">{new Date(inst.date).toLocaleDateString()}</td>
                                                        <td className="p-4 text-right text-sm font-black text-slate-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.value)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Coluna Lateral: Dados Bancários e PJ */}
                <div className="lg:col-span-1 space-y-8">
                    
                    {/* Conta e Datas */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-slate-200 space-y-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest ml-1">Data do Lançamento</label>
                            <div className="relative">
                                <Calendar className="w-5 h-5 text-indigo-400 absolute left-4 top-4" />
                                <input 
                                    type="date" 
                                    required 
                                    value={formData.date} 
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
                                    className="w-full pl-12 pr-4 py-4 bg-white/10 border-none rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer" 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest ml-1">Origem / Destino</label>
                            <div className="relative">
                                <Landmark className="w-5 h-5 text-indigo-400 absolute left-4 top-4" />
                                <select 
                                    value={formData.accountId} 
                                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} 
                                    className="w-full pl-12 pr-8 py-4 bg-white/10 border-none rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                    required
                                >
                                    {accounts.map(acc => <option key={acc.id} value={acc.id} className="text-slate-900">{acc.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {formData.type === TransactionType.TRANSFER && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest ml-1">Conta de Destino</label>
                                <div className="relative">
                                    <ArrowRightLeft className="w-5 h-5 text-blue-400 absolute left-4 top-4" />
                                    <select 
                                        value={formData.destinationAccountId} 
                                        onChange={(e) => setFormData({ ...formData, destinationAccountId: e.target.value })} 
                                        className="w-full pl-12 pr-8 py-4 bg-white/10 border-none rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                                        required
                                    >
                                        {accounts.map(acc => <option key={acc.id} value={acc.id} className="text-slate-900">{acc.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="pt-6 border-t border-white/10">
                            <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest ml-1 block mb-4">Situação Financeira</label>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { id: TransactionStatus.PAID, label: 'Pago / Liquidado', icon: Check, color: 'bg-emerald-500' },
                                    { id: TransactionStatus.PENDING, label: 'Aguardando / Agendado', icon: Clock, color: 'bg-amber-500' },
                                    { id: TransactionStatus.OVERDUE, label: 'Em Atraso', icon: AlertCircle, color: 'bg-rose-500' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setFormData({...formData, status: opt.id as TransactionStatus})}
                                        className={`flex items-center gap-4 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                                            formData.status === opt.id 
                                            ? `border-white bg-white text-slate-900` 
                                            : 'border-white/10 text-white/40 hover:border-white/30'
                                        }`}
                                    >
                                        <div className={`w-2.5 h-2.5 rounded-full ${opt.color}`}></div>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Informações PJ (Opcional por tipo de conta) */}
                    {userEntity === EntityType.BUSINESS && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                                <Briefcase className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Atributos PJ</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 ml-1">Filial de Origem</label>
                                    <select value={formData.branchId || ''} onChange={e => setFormData({...formData, branchId: e.target.value})} className="w-full p-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none">
                                        <option value="">Selecione...</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 ml-1">Centro de Custo</label>
                                    <select value={formData.costCenterId || ''} onChange={e => setFormData({...formData, costCenterId: e.target.value})} className="w-full p-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none">
                                        <option value="">Selecione...</option>
                                        {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default TransactionEditor;
