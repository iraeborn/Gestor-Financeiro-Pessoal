
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CommercialOrder, OSItem, Contact, ServiceItem, OpticalRx, AppSettings, TransactionStatus, Member, Branch, Salesperson, User as UserType, Account, PaymentMethod } from '../types';
import { 
    ArrowLeft, Save, Package, Trash2, Plus, Info, Tag, User, 
    DollarSign, Calendar, Percent, CheckCircle, ShoppingBag, 
    Eye, Glasses, Receipt, Store, AlertTriangle, Zap, ImageIcon, 
    ShieldCheck, Landmark, Lock, Microscope, Activity, ChevronDown, 
    Search, X, ChevronRight, ChevronLeft, Sparkles, Filter,
    LayoutList, ShoppingCart, CreditCard, FileText, Banknote
} from 'lucide-react';
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

    const [formData, setFormData] = useState<Partial<CommercialOrder>>({
        status: 'DRAFT',
        type: 'SALE',
        date: new Date().toISOString().split('T')[0],
        items: [],
        grossAmount: 0,
        discountAmount: 0,
        taxAmount: 0,
        accountId: '',
        paymentMethod: 'CARD',
        installments: 1
    });

    const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogFilter, setCatalogFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');

    const isLocked = initialData?.status === 'CONFIRMED' || formData.status === 'CONFIRMED';
    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);
    const sliderRef = useRef<HTMLDivElement>(null);

    const isRestrictedUser = useMemo(() => {
        if (isAdmin) return false;
        return salespeople.some(s => s.userId === currentUser.id);
    }, [currentUser, salespeople, isAdmin]);

    const effectiveMaxDiscount = isRestrictedUser ? (settings?.maxDiscountPct || 100) : 100;

    // Efeito para configuração inicial do formulário (Dono de Venda / Vendedor)
    useEffect(() => {
        loadTeam();
        const defaultAccId = initialData?.accountId || settings?.defaultAccountId || (accounts.length > 0 ? accounts[0].id : '');

        if (initialData) {
            setFormData({ ...initialData, accountId: defaultAccId });
            const c = contacts.find(c => c.id === initialData.contactId);
            setContactSearch(c ? c.name : initialData.contactName || '');
        } else {
            // REGRA: Seleção automática do vendedor baseado no usuário logado
            const mySalesRecord = salespeople.find(s => s.userId === currentUser.id);
            
            setFormData(prev => ({ 
                ...prev, 
                accountId: defaultAccId,
                branchId: mySalesRecord?.branchId || (branches.length > 0 ? branches[0].id : ''),
                assigneeId: mySalesRecord?.id || '',
                paymentMethod: 'CARD',
                installments: 1
            }));
        }
        
        const handleClickOutside = (event: MouseEvent) => {
            if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [initialData, accounts, branches, settings, currentUser.id, salespeople]);

    // REGRA: Lógica de sugestão de Título dinâmico (Observador de mudanças no carrinho)
    useEffect(() => {
        if (isLocked) return;
        
        const itemsCount = formData.items?.length || 0;
        if (itemsCount === 0) return;

        // Só sugerir se o campo estiver vazio ou se for uma sugestão padrão do sistema
        const isGenericSuggestion = !formData.description || formData.description.startsWith('Venda p/');
        
        if (isGenericSuggestion) {
            const clientName = contactSearch || 'Cliente';
            const firstItem = formData.items![0].description;
            let suggestion = `Venda p/ ${clientName} - ${firstItem}`;
            if (itemsCount > 1) suggestion += ` + ${itemsCount - 1} item(s)`;
            
            setFormData(prev => ({ ...prev, description: suggestion }));
        }
    }, [formData.items, contactSearch, isLocked]);

    const loadTeam = async () => {
        try {
            const list = await getFamilyMembers();
            setTeamMembers(list || []);
        } catch (e) {}
    };

    const filteredCatalog = useMemo(() => {
        return serviceItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                                 (item.code || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                 (item.brand || '').toLowerCase().includes(catalogSearch.toLowerCase());
            const matchesType = catalogFilter === 'ALL' || item.type === catalogFilter;
            return matchesSearch && matchesType;
        });
    }, [serviceItems, catalogSearch, catalogFilter]);

    const linkedRx = useMemo(() => {
        if (!formData.rxId) return null;
        return opticalRxs.find(r => r.id === formData.rxId);
    }, [formData.rxId, opticalRxs]);

    const pricing = useMemo(() => {
        const items = (formData.items || []) as OSItem[];
        const gross = items.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0);
        const discount = Number(formData.discountAmount) || 0;
        const net = gross - discount;
        const discountPct = gross > 0 ? (discount / gross) * 100 : 0;
        const isOverDiscount = discountPct > effectiveMaxDiscount;
        return { gross, discount, net, discountPct, isOverDiscount };
    }, [formData.items, formData.discountAmount, effectiveMaxDiscount]);

    const handleAddItem = (item: ServiceItem) => {
        if (isLocked) return;
        
        const newItem: OSItem = {
            id: crypto.randomUUID(),
            serviceItemId: item.id,
            code: item.code || '',
            description: item.name,
            quantity: 1,
            unitPrice: item.defaultPrice,
            totalPrice: item.defaultPrice,
            isBillable: true,
            unit: item.unit
        };
        
        setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
        showAlert(`"${item.name}" adicionado ao pedido.`, "success");
    };

    const scrollSlider = (direction: 'left' | 'right') => {
        if (sliderRef.current) {
            const scrollAmount = direction === 'left' ? -400 : 400;
            sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
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
        if (initialData?.status === 'CONFIRMED') return;
        
        if (!formData.description) return showAlert("O título do pedido é obrigatório.", "warning");
        if (!formData.branchId) return showAlert("Selecione a filial.", "warning");
        if (!formData.accountId) return showAlert("Selecione a conta para o faturamento.", "warning");
        if (pricing.isOverDiscount) return showAlert(`Desconto excedido! Limite de ${effectiveMaxDiscount}%.`, "error");

        const assignedSeller = salespeople.find(s => s.id === formData.assigneeId);
        onSave({
            ...formData,
            id: formData.id || crypto.randomUUID(),
            contactName: contactSearch,
            assigneeName: assignedSeller?.name || formData.assigneeName,
            amount: pricing.net,
            grossAmount: pricing.gross,
            moduleTag: formData.rxId ? 'optical' : undefined
        } as CommercialOrder);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className={`max-w-6xl mx-auto animate-fade-in pb-20 ${isLocked ? 'grayscale-[0.3]' : ''}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600 group">
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            {initialData ? 'Ajustar Pedido' : 'Nova Venda / Orçamento'}
                            {isLocked && <Lock className="w-6 h-6 text-amber-500" />}
                        </h1>
                        <p className="text-gray-500 font-medium tracking-tight">#{formData.id?.substring(0,8).toUpperCase() || 'RASCUNHO'}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">
                        {isLocked ? 'Voltar' : 'Descartar'}
                    </button>
                    {!isLocked && (
                        <button onClick={handleSave} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95 flex items-center gap-2">
                            <Save className="w-4 h-4" /> {formData.status === 'CONFIRMED' ? 'Confirmar e Faturar' : 'Salvar Venda'}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    
                    {/* SELETOR VISUAL DE PRODUTOS (Catalog Slider) */}
                    {!isLocked && (
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden p-8 space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100">
                                        <Package className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-gray-900">Escolha de Produtos</h2>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Toque na imagem para adicionar</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-64">
                                        <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar modelo, marca..." 
                                            value={catalogSearch} 
                                            onChange={e => setCatalogSearch(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => setIsCatalogModalOpen(true)}
                                        className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all"
                                        title="Ver catálogo completo"
                                    >
                                        <LayoutList className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative group">
                                <div 
                                    ref={sliderRef}
                                    className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x"
                                >
                                    {filteredCatalog.length === 0 ? (
                                        <div className="w-full py-12 text-center text-gray-300 italic border-2 border-dashed border-gray-50 rounded-[2rem]">
                                            Nenhum produto encontrado.
                                        </div>
                                    ) : filteredCatalog.map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={() => handleAddItem(item)}
                                            className="flex-shrink-0 w-56 bg-slate-50 border border-slate-100 rounded-[2rem] overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-indigo-100 hover:border-indigo-400 hover:-translate-y-1 transition-all snap-start group/card"
                                        >
                                            <div className="aspect-[4/5] relative overflow-hidden bg-white">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-20">
                                                        <ImageIcon className="w-12 h-12" />
                                                        <span className="text-[9px] font-black uppercase">Sem Foto</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex items-end p-4">
                                                    <div className="bg-white/90 backdrop-blur-sm w-full py-2 rounded-xl text-center text-[10px] font-black text-indigo-600 uppercase tracking-widest shadow-xl">
                                                        Adicionar +
                                                    </div>
                                                </div>
                                                <div className="absolute top-3 left-3 bg-indigo-600 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter shadow-lg">
                                                    {item.type === 'PRODUCT' ? 'PRODUTO' : 'SERVIÇO'}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white">
                                                <h4 className="font-bold text-gray-800 text-sm truncate leading-tight">{item.name}</h4>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase truncate mt-0.5">{item.brand || '---'}</p>
                                                <div className="mt-3 flex justify-between items-center">
                                                    <span className="text-sm font-black text-indigo-600">{formatCurrency(item.defaultPrice)}</span>
                                                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center group-hover/card:bg-indigo-600 group-hover/card:text-white transition-colors">
                                                        <Plus className="w-3 h-3" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {filteredCatalog.length > 2 && (
                                    <>
                                        <button 
                                            onClick={() => scrollSlider('left')}
                                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white rounded-full shadow-2xl border border-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all z-10"
                                        >
                                            <ChevronLeft className="w-6 h-6" />
                                        </button>
                                        <button 
                                            onClick={() => scrollSlider('right')}
                                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-white rounded-full shadow-2xl border border-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all z-10"
                                        >
                                            <ChevronRight className="w-6 h-6" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={`bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-12 ${isLocked ? 'bg-gray-50/50' : ''}`}>
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <div className="flex justify-between items-center mb-2 ml-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Título do Pedido</label>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const itemsCount = formData.items?.length || 0;
                                                const firstItem = formData.items?.[0]?.description || 'Venda';
                                                const clientName = contactSearch || 'Cliente';
                                                let suggestion = `Venda p/ ${clientName} - ${firstItem}`;
                                                if (itemsCount > 1) suggestion += ` + ${itemsCount - 1} item(s)`;
                                                setFormData({...formData, description: suggestion});
                                            }}
                                            className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1 hover:underline"
                                        >
                                            <Sparkles className="w-3 h-3" /> Gerar Nova Sugestão
                                        </button>
                                    </div>
                                    <input 
                                        type="text" 
                                        disabled={isLocked}
                                        value={formData.description || ''} 
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner transition-all"
                                        placeholder="Ex: Armação de Grau + Lente Multifocal"
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
                                            className="w-full pl-11 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none"
                                            placeholder="Buscar cliente..."
                                        />
                                    </div>
                                    {showContactDropdown && !isLocked && (
                                        <div className="absolute z-50 w-full bg-white border border-gray-100 rounded-2xl shadow-xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in border-t-4 border-t-indigo-500">
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
                                            className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-indigo-500" /> Itens no Carrinho</h3>

                                <div className="bg-slate-50 rounded-[2rem] border border-gray-100 overflow-hidden shadow-inner overflow-x-auto">
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
                                                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-800 p-0"
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
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-center"
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="number" 
                                                            disabled={isLocked}
                                                            step="0.01"
                                                            value={item.unitPrice} 
                                                            onChange={e => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-center text-indigo-600"
                                                        />
                                                    </td>
                                                    <td className="p-4 text-right font-black text-gray-900 text-sm">
                                                        {formatCurrency(item.totalPrice)}
                                                    </td>
                                                    {!isLocked && (
                                                        <td className="p-4">
                                                            <button onClick={() => setFormData(prev => ({...prev, items: prev.items?.filter(i => i.id !== item.id)}))} className="text-gray-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            )})}
                                            {(formData.items || []).length === 0 && (
                                                <tr><td colSpan={6} className="p-10 text-center text-gray-300 italic text-sm">O carrinho está vazio. Adicione produtos acima.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    {linkedRx && (
                        <div className="bg-indigo-900 rounded-[2.5rem] p-6 text-white shadow-xl animate-fade-in space-y-4">
                            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                                <Glasses className="w-5 h-5 text-indigo-400" />
                                <div className="flex-1">
                                    <h4 className="text-xs font-black uppercase tracking-widest leading-none">RX Vinculada</h4>
                                    <p className="text-[10px] text-indigo-300 font-bold uppercase mt-1">Ref: {linkedRx.rxNumber || 'RX-TECH'}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-[10px]">
                                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                    <p className="font-black text-indigo-400 uppercase mb-1">OD</p>
                                    <p className="font-bold">E: {linkedRx.sphereOdLonge?.toFixed(2)}<br/>C: {linkedRx.cylOdLonge?.toFixed(2)}<br/>A: {linkedRx.axisOdLonge}°</p>
                                </div>
                                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                    <p className="font-black text-sky-400 uppercase mb-1">OE</p>
                                    <p className="font-bold">E: {linkedRx.sphereOeLonge?.toFixed(2)}<br/>C: {linkedRx.cylOeLonge?.toFixed(2)}<br/>A: {linkedRx.axisOeLonge}°</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm space-y-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Vendedor Responsável</label>
                            <div className="relative">
                                <User className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                <select 
                                    disabled={isLocked}
                                    value={formData.assigneeId || ''} 
                                    onChange={e => setFormData({...formData, assigneeId: e.target.value})}
                                    className="w-full pl-11 py-4 bg-gray-50 border-none rounded-xl text-sm font-bold outline-none appearance-none"
                                >
                                    <option value="">Quem é o vendedor?</option>
                                    {salespeople.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.branchName || 'Sede'})</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-4 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Loja / Filial</label>
                            <div className="relative">
                                <Store className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                <select 
                                    disabled={isLocked}
                                    value={formData.branchId || ''} 
                                    onChange={e => setFormData({...formData, branchId: e.target.value})}
                                    className="w-full pl-11 py-4 bg-slate-900 text-white rounded-xl text-sm font-black uppercase tracking-widest outline-none border-none appearance-none disabled:bg-slate-700"
                                    required
                                >
                                    <option value="">Filial de Venda...</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* SEÇÃO: Checkout Financeiro */}
                        <div className="pt-4 border-t border-gray-100 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 ml-1">Forma de Pagamento</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'CARD', label: 'Cartão', icon: CreditCard },
                                        { id: 'BOLETO', label: 'Boleto', icon: FileText },
                                        { id: 'PIX', label: 'Pix', icon: Zap },
                                        { id: 'CASH', label: 'Dinheiro', icon: Banknote }
                                    ].map(method => (
                                        <button 
                                            key={method.id}
                                            type="button"
                                            disabled={isLocked}
                                            onClick={() => setFormData({...formData, paymentMethod: method.id as PaymentMethod})}
                                            className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${formData.paymentMethod === method.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-indigo-200'}`}
                                        >
                                            <method.icon className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase">{method.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {['CARD', 'BOLETO'].includes(formData.paymentMethod || '') && (
                                <div className="animate-fade-in">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Número de Parcelas</label>
                                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max={formData.paymentMethod === 'CARD' ? 12 : 24} 
                                            step="1" 
                                            disabled={isLocked}
                                            className="flex-1 accent-indigo-600 h-1.5"
                                            value={formData.installments || 1} 
                                            onChange={e => setFormData({...formData, installments: parseInt(e.target.value)})} 
                                        />
                                        <div className="w-12 h-10 bg-white rounded-xl flex items-center justify-center font-black text-indigo-600 shadow-sm border border-slate-200">{formData.installments}x</div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Faturar em Conta</label>
                                <div className="relative">
                                    <Landmark className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <select 
                                        disabled={isLocked}
                                        value={formData.accountId || ''} 
                                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} 
                                        className="w-full pl-11 py-4 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold outline-none border border-gray-100 appearance-none disabled:bg-slate-100"
                                        required
                                    >
                                        <option value="">Conta Financeira...</option>
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-4 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 space-y-4">
                            <div className="flex justify-between text-xs font-bold text-gray-400 uppercase">
                                <span>Subtotal Bruto</span>
                                <span>{formatCurrency(pricing.gross)}</span>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Desconto Comercial</label>
                                <div className="relative">
                                    <DollarSign className={`w-4 h-4 absolute left-4 top-4 ${pricing.isOverDiscount ? 'text-rose-500' : 'text-emerald-500'}`} />
                                    <input 
                                        type="number" 
                                        disabled={isLocked}
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
                                {pricing.isOverDiscount && <p className="text-[9px] text-rose-500 font-bold uppercase mt-1 ml-1">* Limite máximo: {effectiveMaxDiscount}%</p>}
                            </div>

                            <div className="pt-4 flex justify-between items-center">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Total Líquido</span>
                                <span className="text-3xl font-black text-gray-900">{formatCurrency(pricing.net)}</span>
                            </div>
                        </div>

                        {!isLocked && (
                            <button 
                                onClick={handleSave} 
                                disabled={pricing.isOverDiscount}
                                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95 disabled:opacity-50"
                            >
                                <CheckCircle className="w-5 h-5" /> Salvar & Finalizar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Catálogo Completo (Lista) */}
            {isCatalogModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border border-slate-100">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                                    <LayoutList className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900">Catálogo do Negócio</h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Busque e adicione produtos ao orçamento</p>
                                </div>
                            </div>
                            <button onClick={() => setIsCatalogModalOpen(false)} className="p-3 hover:bg-white rounded-full text-gray-400 border border-transparent hover:border-gray-200 transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row gap-4 bg-white">
                            <div className="flex-1 relative">
                                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nome, marca ou código..." 
                                    value={catalogSearch} 
                                    onChange={e => setCatalogSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                                />
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-2xl">
                                {['ALL', 'PRODUCT', 'SERVICE'].map(type => (
                                    <button 
                                        key={type}
                                        onClick={() => setCatalogFilter(type as any)}
                                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${catalogFilter === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {type === 'ALL' ? 'Tudo' : type === 'PRODUCT' ? 'Produtos' : 'Serviços'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCatalog.map(item => (
                                    <div 
                                        key={item.id}
                                        onClick={() => handleAddItem(item)}
                                        className="bg-slate-50 border border-slate-200 rounded-3xl p-4 flex gap-4 cursor-pointer hover:bg-white hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-50 transition-all group"
                                    >
                                        <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                            ) : (
                                                <ImageIcon className="w-6 h-6 text-slate-200" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-800 text-sm truncate">{item.name}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase truncate mt-0.5">{item.brand || '---'}</p>
                                            <div className="mt-2 flex justify-between items-center">
                                                <span className="text-sm font-black text-indigo-600">{formatCurrency(item.defaultPrice)}</span>
                                                <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">+ Adicionar</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button 
                                onClick={() => setIsCatalogModalOpen(false)}
                                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95"
                            >
                                Fechar Catálogo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SaleEditor;
