
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CommercialOrder, OSItem, Contact, ServiceItem, OpticalRx, AppSettings, TransactionStatus, Member, Branch, Salesperson, User as UserType, Account } from '../types';
import { ArrowLeft, Save, Package, Trash2, Plus, Info, Tag, User, DollarSign, Calendar, Percent, CheckCircle, ShoppingBag, Eye, Glasses, Receipt, Store, AlertTriangle, Zap, ImageIcon, ShieldCheck, Landmark, Lock } from 'lucide-react';
import { useAlert } from './AlertSystem';
import { getFamilyMembers } from '../services/storageService';

interface SaleEditorProps {
    initialData?: CommercialOrder | null;
    contacts: Contact[];
    serviceItems: ServiceItem[];
    opticalRxs: OpticalRx[];
    branches: Branch[];
    salespeople: Salesperson[];
    accounts: Account[];
    currentUser: UserType;
    settings?: AppSettings;
    onSave: (o: CommercialOrder) => void;
    onCancel: () => void;
}

const SaleEditor: React.FC<SaleEditorProps> = ({ initialData, contacts, serviceItems, opticalRxs, branches, salespeople, accounts, currentUser, settings, onSave, onCancel }) => {
    const { showAlert } = useAlert();
    const [teamMembers, setTeamMembers] = useState<Member[]>([]);
    
    const familyId = currentUser.familyId || (currentUser as any).family_id;
    const workspace = currentUser.workspaces?.find(w => w.id === familyId);
    const isAdmin = currentUser.id === familyId || workspace?.role === 'ADMIN' || currentUser.role === 'ADMIN';

    // Trava de Segurança: Vendas Confirmadas são apenas leitura
    const isLocked = initialData?.status === 'CONFIRMED';

    const [formData, setFormData] = useState<Partial<CommercialOrder>>({
        status: 'DRAFT',
        type: 'SALE',
        date: new Date().toISOString().split('T')[0],
        items: [],
        grossAmount: 0,
        discountAmount: 0,
        taxAmount: 0,
        accountId: initialData?.accountId || settings?.defaultAccountId || accounts[0]?.id || ''
    });

    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);

    const isRestrictedUser = useMemo(() => {
        if (isAdmin) return false;
        const isRegisteredSalesperson = salespeople.some(s => s.userId === currentUser.id);
        if (!isRegisteredSalesperson) return false;
        return true;
    }, [currentUser, salespeople, isAdmin]);

    const effectiveMaxDiscount = isRestrictedUser ? (settings?.maxDiscountPct || 100) : 100;

    useEffect(() => {
        loadTeam();
        if (initialData) {
            setFormData({ ...initialData });
            const c = contacts.find(c => c.id === initialData.contactId);
            setContactSearch(c ? c.name : initialData.contactName || '');
        }
        
        const handleClickOutside = (event: MouseEvent) => {
            if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [initialData]);

    const loadTeam = async () => {
        try {
            const list = await getFamilyMembers();
            setTeamMembers(list || []);
        } catch (e) {}
    };

    const pricing = useMemo(() => {
        const items = (formData.items || []) as OSItem[];
        const gross = items.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0);
        const discount = Number(formData.discountAmount) || 0;
        const net = gross - discount;
        const discountPct = gross > 0 ? (discount / gross) * 100 : 0;
        const isOverDiscount = discountPct > effectiveMaxDiscount;
        return { gross, discount, net, discountPct, isOverDiscount };
    }, [formData.items, formData.discountAmount, effectiveMaxDiscount]);

    const handleAddItem = (catalogItemId?: string) => {
        if (isLocked) return;
        const catalogItem = serviceItems.find(i => i.id === catalogItemId);
        const price = catalogItem ? catalogItem.defaultPrice : 0;
        const newItem: OSItem = {
            id: crypto.randomUUID(),
            serviceItemId: catalogItem?.id,
            code: catalogItem?.code || '',
            description: catalogItem?.name || '',
            quantity: 1,
            unitPrice: price,
            totalPrice: price,
            isBillable: true
        };
        setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const handleUpdateItem = (itemId: string, field: keyof OSItem, value: any) => {
        if (isLocked) return;
        const updated = (formData.items || []).map(item => {
            if (item.id === itemId) {
                const up = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unitPrice') up.totalPrice = Number(up.quantity) * Number(up.unitPrice);
                return up;
            }
            return item;
        });
        setFormData(prev => ({ ...prev, items: updated }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLocked) return;
        if (!formData.description) return showAlert("A descrição é obrigatória", "warning");
        if (!formData.branchId) return showAlert("Selecione a filial.", "warning");
        if (!formData.accountId) return showAlert("Selecione a conta de destino para o faturamento.", "warning");
        if (pricing.isOverDiscount) return showAlert(`Desconto excedido! Sua alçada permite no máximo ${effectiveMaxDiscount}%.`, "error");

        const assignedMember = teamMembers.find(m => m.id === formData.assigneeId);
        onSave({
            ...formData,
            id: formData.id || crypto.randomUUID(),
            contactName: contactSearch,
            assigneeName: assignedMember?.name || formData.assigneeName,
            amount: pricing.net,
            grossAmount: pricing.gross,
            moduleTag: formData.rxId ? 'optical' : undefined
        } as CommercialOrder);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const selectedAccount = accounts.find(a => a.id === formData.accountId);

    return (
        <div className={`max-w-6xl mx-auto animate-fade-in pb-20 ${isLocked ? 'grayscale-[0.5] opacity-90' : ''}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            {initialData ? 'Detalhes da Venda' : 'Nova Venda de Óculos'}
                            {isLocked && <Lock className="w-6 h-6 text-amber-500" />}
                        </h1>
                        <p className="text-gray-500 font-medium">
                            {isLocked ? 'Esta venda já foi paga e não permite mais alterações.' : 'Configure itens, armação e valide o faturamento.'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">
                        {isLocked ? 'Voltar' : 'Descartar'}
                    </button>
                    {!isLocked && (
                        <button onClick={handleSave} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                            <Save className="w-4 h-4" /> Salvar Venda
                        </button>
                    )}
                    {isLocked && (
                        <div className="bg-emerald-50 text-emerald-700 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 border border-emerald-200">
                            <CheckCircle className="w-4 h-4" /> Venda Consolidada
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    <div className={`bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-12 ${isLocked ? 'bg-gray-50/50' : ''}`}>
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Descrição do Pedido</label>
                                    <input 
                                        type="text" 
                                        disabled={isLocked}
                                        value={formData.description || ''} 
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none disabled:text-gray-500"
                                        placeholder="Ex: Venda de Armação e Lentes..."
                                        required
                                    />
                                </div>
                                <div className="relative" ref={contactDropdownRef}>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Cliente</label>
                                    <div className="relative">
                                        <User className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                        <input 
                                            type="text" 
                                            disabled={isLocked}
                                            value={contactSearch}
                                            onFocus={() => !isLocked && setShowContactDropdown(true)}
                                            onChange={e => { setContactSearch(e.target.value); setShowContactDropdown(true); }}
                                            className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none disabled:text-gray-500"
                                            placeholder="Buscar cliente..."
                                        />
                                    </div>
                                    {showContactDropdown && !isLocked && (
                                        <div className="absolute z-50 w-full bg-white border border-gray-100 rounded-2xl shadow-xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in">
                                            {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                                                <button key={c.id} type="button" onClick={() => { setContactSearch(c.name); setFormData({...formData, contactId: c.id}); setShowContactDropdown(false); }} className="w-full text-left px-4 py-2 hover:bg-indigo-50 rounded-lg text-sm font-bold text-gray-600 transition-colors">
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Data da Venda</label>
                                    <div className="relative">
                                        <Calendar className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                        <input 
                                            type="date" 
                                            disabled={isLocked}
                                            value={formData.date} 
                                            onChange={e => setFormData({...formData, date: e.target.value})}
                                            className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none disabled:text-gray-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-indigo-500" /> Itens no Carrinho</h3>
                                    {!isLocked && (
                                        <div className="flex gap-2">
                                            <select 
                                                className="bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-indigo-100 outline-none"
                                                onChange={e => { if(e.target.value) handleAddItem(e.target.value); e.target.value = ''; }}
                                            >
                                                <option value="">+ Selecionar Armação/Lente</option>
                                                {serviceItems.map(i => <option key={i.id} value={i.id}>[{i.type === 'PRODUCT' ? 'P' : 'S'}] {i.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-50 rounded-[2rem] border border-gray-100 shadow-inner overflow-x-auto">
                                    <table className="w-full text-left min-w-[700px]">
                                        <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">
                                            <tr>
                                                <th className="p-5">Visual</th>
                                                <th className="p-5">Produto / Serviço</th>
                                                <th className="p-5 w-20 text-center">Qtd</th>
                                                <th className="p-5 w-32 text-center">Unitário</th>
                                                <th className="p-5 w-32 text-right">Subtotal</th>
                                                {!isLocked && <th className="p-5 w-10"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(formData.items || []).map(item => {
                                                const catalogItem = serviceItems.find(si => si.id === item.serviceItemId);
                                                return (
                                                <tr key={item.id} className="bg-white/50 hover:bg-white transition-colors">
                                                    <td className="p-4 w-20">
                                                        <div className="w-14 h-14 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                                                            {catalogItem?.imageUrl ? (
                                                                <img src={catalogItem.imageUrl} alt="Foto" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ImageIcon className="w-5 h-5 text-gray-300" />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <input 
                                                                type="text" 
                                                                disabled={isLocked}
                                                                value={item.description} 
                                                                onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                                                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-800 p-0 disabled:text-gray-500"
                                                            />
                                                            {item.code && <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mt-1">Ref: {item.code}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="number" 
                                                            disabled={isLocked}
                                                            value={item.quantity} 
                                                            onChange={e => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-center disabled:text-gray-500"
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="number" 
                                                            disabled={isLocked}
                                                            step="0.01"
                                                            value={item.unitPrice} 
                                                            onChange={e => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-center text-indigo-600 disabled:text-indigo-400"
                                                        />
                                                    </td>
                                                    <td className="p-4 text-right font-black text-gray-900 text-sm">
                                                        {formatCurrency(item.totalPrice)}
                                                    </td>
                                                    {!isLocked && (
                                                        <td className="p-4">
                                                            <button onClick={() => setFormData(prev => ({...prev, items: prev.items?.filter(i => i.id !== item.id)}))} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            )})}
                                            {(formData.items || []).length === 0 && (
                                                <tr><td colSpan={6} className="p-10 text-center text-gray-300 italic text-sm">O carrinho está vazio. Adicione armação e lentes.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm space-y-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Status da Venda</label>
                            <select 
                                disabled={isLocked}
                                value={formData.status || 'DRAFT'} 
                                onChange={e => setFormData({...formData, status: e.target.value as any})}
                                className="w-full bg-gray-50 text-gray-700 rounded-xl p-4 text-sm font-black uppercase tracking-widest outline-none border border-gray-100 cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-70"
                            >
                                <option value="DRAFT">📝 Rascunho</option>
                                <option value="APPROVED">✅ Aprovado</option>
                                <option value="ON_HOLD">⏳ Em Espera</option>
                                <option value="CONFIRMED">💰 Confirmado / Pago</option>
                                <option value="REJECTED">❌ Recusado</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Unidade de Venda</label>
                            <div className="relative">
                                <Store className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                <select 
                                    disabled={isLocked}
                                    value={formData.branchId || ''} 
                                    onChange={e => setFormData({...formData, branchId: e.target.value})}
                                    className="w-full pl-11 py-4 bg-slate-900 text-white rounded-xl text-sm font-black uppercase tracking-widest outline-none border-none cursor-pointer appearance-none shadow-lg shadow-slate-200 disabled:bg-slate-700"
                                    required
                                >
                                    <option value="">Selecionar Filial...</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Faturar para Conta</label>
                            {isAdmin && !isLocked ? (
                                <div className="relative">
                                    <Landmark className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <select 
                                        value={formData.accountId || ''} 
                                        onChange={e => setFormData({...formData, accountId: e.target.value})}
                                        className="w-full pl-11 py-4 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold outline-none border border-gray-100 cursor-pointer appearance-none"
                                        required
                                    >
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(2)})</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-xl border border-gray-100 flex items-center gap-3">
                                    <Landmark className="w-4 h-4 text-slate-400" />
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-bold text-slate-700 truncate">{selectedAccount?.name || 'Conta Padrão'}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Fixado pelo Gestor</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Vendedor</label>
                            <select 
                                disabled={isLocked}
                                value={formData.assigneeId || ''} 
                                onChange={e => setFormData({...formData, assigneeId: e.target.value})}
                                className="w-full bg-gray-50 border-none rounded-xl p-4 text-sm font-bold outline-none disabled:text-gray-500"
                            >
                                <option value="">Quem está atendendo?</option>
                                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>

                        <div className="pt-6 border-t border-gray-100 space-y-4">
                            <div className="flex justify-between text-xs font-bold text-gray-400 uppercase">
                                <span>Subtotal Bruto</span>
                                <span>{formatCurrency(pricing.gross)}</span>
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-center mb-2 ml-1">
                                    <label className="block text-[10px] font-black uppercase text-gray-400">Desconto Negociado</label>
                                    {!isRestrictedUser && !isLocked && (
                                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> Alçada Liberada
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <DollarSign className={`w-4 h-4 absolute left-4 top-4 ${pricing.isOverDiscount ? 'text-rose-500' : 'text-emerald-500'}`} />
                                    <input 
                                        type="number" 
                                        disabled={isLocked}
                                        step="0.01"
                                        value={formData.discountAmount || ''} 
                                        onChange={e => setFormData({...formData, discountAmount: Number(e.target.value)})}
                                        className={`w-full pl-11 py-4 rounded-xl text-sm font-black outline-none border-2 transition-all ${pricing.isOverDiscount ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-gray-50 border-transparent focus:bg-white disabled:text-gray-500'}`}
                                        placeholder="0,00"
                                    />
                                    <span className={`absolute right-4 top-4 text-[10px] font-black uppercase ${pricing.isOverDiscount ? 'text-rose-600' : 'text-gray-400'}`}>
                                        {Math.round(pricing.discountPct)}% OFF
                                    </span>
                                </div>
                                {pricing.isOverDiscount && !isLocked && (
                                    <p className="text-[9px] font-black text-rose-500 uppercase mt-2 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Limite de {effectiveMaxDiscount}% excedido
                                    </p>
                                )}
                            </div>

                            <div className="pt-4 flex justify-between items-center">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Total Líquido</span>
                                <span className="text-3xl font-black text-gray-900">{formatCurrency(pricing.net)}</span>
                            </div>
                        </div>

                        {formData.rxId && (
                            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-2">
                                <div className="flex items-center gap-2 text-emerald-700 font-black text-[10px] uppercase tracking-widest">
                                    <Glasses className="w-4 h-4" /> Origem: Receita RX
                                </div>
                                <p className="text-xs text-emerald-600 font-medium leading-relaxed">Uma Ordem de Serviço de montagem será gerada automaticamente após salvar.</p>
                            </div>
                        )}

                        {!isLocked && (
                            <button 
                                onClick={handleSave} 
                                disabled={pricing.isOverDiscount}
                                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95 disabled:opacity-50 disabled:grayscale"
                            >
                                <CheckCircle className="w-5 h-5" /> Confirmar Venda
                            </button>
                        )}
                    </div>

                    <div className="bg-slate-900 p-6 rounded-3xl text-white">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
                            <Info className="w-4 h-4" /> Informações do Pedido
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            {isLocked ? (
                                <>Este pedido foi bloqueado pelo sistema após a confirmação do pagamento. Para realizar ajustes, realize um <strong>estorno no financeiro</strong> primeiro.</>
                            ) : isRestrictedUser ? (
                                <>O desconto máximo permitido para sua função é de <strong>{effectiveMaxDiscount}%</strong>. Vendas fora dessa regra serão bloqueadas.</>
                            ) : (
                                <>Você possui <strong>Alçada Administrativa</strong>. Descontos de até 100% são permitidos para este perfil.</>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaleEditor;
