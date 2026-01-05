
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CommercialOrder, OSItem, Contact, ServiceItem, OpticalRx, AppSettings, TransactionStatus, Member, Branch } from '../types';
import { ArrowLeft, Save, Package, Trash2, Plus, Info, Tag, User, DollarSign, Calendar, Percent, CheckCircle, ShoppingBag, Eye, Glasses, Receipt, Store, AlertTriangle, Zap, ImageIcon } from 'lucide-react';
import { useAlert } from './AlertSystem';
import { getFamilyMembers } from '../services/storageService';

interface SaleEditorProps {
    initialData?: CommercialOrder | null;
    contacts: Contact[];
    serviceItems: ServiceItem[];
    opticalRxs: OpticalRx[];
    branches: Branch[];
    settings?: AppSettings;
    onSave: (o: CommercialOrder) => void;
    onCancel: () => void;
}

const SaleEditor: React.FC<SaleEditorProps> = ({ initialData, contacts, serviceItems, opticalRxs, branches, settings, onSave, onCancel }) => {
    const { showAlert } = useAlert();
    const [teamMembers, setTeamMembers] = useState<Member[]>([]);
    const [formData, setFormData] = useState<Partial<CommercialOrder>>({
        status: 'DRAFT',
        type: 'SALE',
        date: new Date().toISOString().split('T')[0],
        items: [],
        grossAmount: 0,
        discountAmount: 0,
        taxAmount: 0
    });

    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);

    const maxDiscountPct = settings?.maxDiscountPct || 100;

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
        const isOverDiscount = discountPct > maxDiscountPct;
        return { gross, discount, net, discountPct, isOverDiscount };
    }, [formData.items, formData.discountAmount, maxDiscountPct]);

    const handleAddItem = (catalogItemId?: string) => {
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
        if (!formData.description) return showAlert("A descrição é obrigatória", "warning");
        if (!formData.branchId) return showAlert("Selecione a filial.", "warning");
        if (pricing.isOverDiscount) return showAlert(`Desconto excedido! Limite máximo: ${maxDiscountPct}%.`, "error");

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

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                            {initialData ? 'Editar Venda' : 'Nova Venda de Óculos'}
                        </h1>
                        <p className="text-gray-500 font-medium">Configure itens, armação e valide o poder de negociação.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">Descartar</button>
                    <button onClick={handleSave} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Salvar Venda
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-12">
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Descrição do Pedido</label>
                                    <input 
                                        type="text" 
                                        value={formData.description || ''} 
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
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
                                            value={contactSearch}
                                            onFocus={() => setShowContactDropdown(true)}
                                            onChange={e => { setContactSearch(e.target.value); setShowContactDropdown(true); }}
                                            className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none"
                                            placeholder="Buscar cliente..."
                                        />
                                    </div>
                                    {showContactDropdown && (
                                        <div className="absolute z-50 w-full bg-white border border-gray-100 rounded-2xl shadow-xl mt-1 max-h-48 overflow-y-auto p-1.5">
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
                                            value={formData.date} 
                                            onChange={e => setFormData({...formData, date: e.target.value})}
                                            className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-indigo-500" /> Itens no Carrinho</h3>
                                    <div className="flex gap-2">
                                        <select 
                                            className="bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-indigo-100 outline-none"
                                            onChange={e => { if(e.target.value) handleAddItem(e.target.value); e.target.value = ''; }}
                                        >
                                            <option value="">+ Selecionar Armação/Lente</option>
                                            {serviceItems.map(i => <option key={i.id} value={i.id}>[{i.type === 'PRODUCT' ? 'P' : 'S'}] {i.name}</option>)}
                                        </select>
                                    </div>
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
                                                <th className="p-5 w-10"></th>
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
                                                                value={item.description} 
                                                                onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                                                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-800 p-0"
                                                            />
                                                            {item.code && <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mt-1">Ref: {item.code}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="number" 
                                                            value={item.quantity} 
                                                            onChange={e => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-center"
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            value={item.unitPrice} 
                                                            onChange={e => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-center text-indigo-600"
                                                        />
                                                    </td>
                                                    <td className="p-4 text-right font-black text-gray-900 text-sm">
                                                        {formatCurrency(item.totalPrice)}
                                                    </td>
                                                    <td className="p-4">
                                                        <button onClick={() => setFormData(prev => ({...prev, items: prev.items?.filter(i => i.id !== item.id)}))} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                                                    </td>
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
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Unidade de Venda</label>
                            <div className="relative">
                                <Store className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                <select 
                                    value={formData.branchId || ''} 
                                    onChange={e => setFormData({...formData, branchId: e.target.value})}
                                    className="w-full pl-11 py-4 bg-slate-900 text-white rounded-xl text-sm font-black uppercase tracking-widest outline-none border-none cursor-pointer appearance-none shadow-lg shadow-slate-200"
                                    required
                                >
                                    <option value="">Selecionar Filial...</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Vendedor</label>
                            <select 
                                value={formData.assigneeId || ''} 
                                onChange={e => setFormData({...formData, assigneeId: e.target.value})}
                                className="w-full bg-gray-50 border-none rounded-xl p-4 text-sm font-bold outline-none"
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
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Desconto Negociado</label>
                                <div className="relative">
                                    <DollarSign className={`w-4 h-4 absolute left-4 top-4 ${pricing.isOverDiscount ? 'text-rose-500' : 'text-emerald-500'}`} />
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={formData.discountAmount || ''} 
                                        onChange={e => setFormData({...formData, discountAmount: Number(e.target.value)})}
                                        className={`w-full pl-11 py-4 rounded-xl text-sm font-black outline-none border-2 transition-all ${pricing.isOverDiscount ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-gray-50 border-transparent focus:bg-white'}`}
                                        placeholder="0,00"
                                    />
                                    <span className={`absolute right-4 top-4 text-[10px] font-black uppercase ${pricing.isOverDiscount ? 'text-rose-600' : 'text-gray-400'}`}>
                                        {Math.round(pricing.discountPct)}% OFF
                                    </span>
                                </div>
                                {pricing.isOverDiscount && (
                                    <p className="text-[9px] font-black text-rose-500 uppercase mt-2 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Limite de {maxDiscountPct}% excedido
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

                        <button 
                            onClick={handleSave} 
                            disabled={pricing.isOverDiscount}
                            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95 disabled:opacity-50 disabled:grayscale"
                        >
                            <CheckCircle className="w-5 h-5" /> Confirmar Venda
                        </button>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-3xl text-white">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
                            <Info className="w-4 h-4" /> Alerta de Alçada
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            O desconto máximo permitido para este negócio é de <strong>{maxDiscountPct}%</strong>. Vendas fora dessa regra serão bloqueadas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaleEditor;
