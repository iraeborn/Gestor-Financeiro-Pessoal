
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, TransactionType, TransactionStatus, ServiceItem, OSItem, Category, Account, CompanyProfile, TaxRegime, OSStatus, OSType, OSOrigin, OSPriority } from '../types';
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText, UserCircle, User, Package, Zap, Info, UserCheck, Timer, Layers, ListChecks } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import ApprovalModal from './ApprovalModal';

const SERVICE_UNITS = [
    { id: 'UN', label: 'Unidade (UN)' },
    { id: 'HR', label: 'Hora (HR)' },
    { id: 'MIN', label: 'Minuto (MIN)' },
    { id: 'DIA', label: 'Dia (DIA)' },
    { id: 'MT', label: 'Metro (MT)' },
    { id: 'KG', label: 'Quilo (KG)' },
    { id: 'SERV', label: 'Serviço (SERV)' },
];

interface ServicesViewProps {
    currentView: ViewMode;
    serviceOrders: ServiceOrder[];
    commercialOrders: CommercialOrder[];
    contracts: Contract[];
    invoices: Invoice[];
    contacts: Contact[];
    accounts: Account[];
    companyProfile?: CompanyProfile | null;
    serviceItems?: ServiceItem[];
    
    onSaveOS: (os: ServiceOrder, newContact?: Contact) => void;
    onDeleteOS: (id: string) => void;
    onSaveOrder: (o: CommercialOrder, newContact?: Contact) => void;
    onDeleteOrder: (id: string) => void;
    onApproveOrder?: (order: CommercialOrder, approvalData: any) => void;
    onSaveContract: (c: Contract, newContact?: Contact) => void;
    onDeleteContract: (id: string) => void;
    onSaveInvoice: (i: Invoice, newContact?: Contact) => void;
    onDeleteInvoice: (id: string) => void;
    onSaveCatalogItem?: (i: ServiceItem) => void;
    onDeleteCatalogItem?: (id: string) => void;
    onAddTransaction: (t: any) => void;
}

const ServicesView: React.FC<ServicesViewProps> = ({ 
    currentView, serviceOrders, commercialOrders, contracts, invoices, contacts, accounts, companyProfile, serviceItems = [],
    onSaveOS, onDeleteOS, onSaveOrder, onDeleteOrder, onSaveContract, onDeleteContract, onSaveInvoice, onDeleteInvoice, onAddTransaction, onSaveCatalogItem, onDeleteCatalogItem, onApproveOrder
}) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [catalogTab, setCatalogTab] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
    const [compositionFilter, setCompositionFilter] = useState<'ALL' | 'SIMPLE' | 'COMPOSITE'>('ALL');
    const [formData, setFormData] = useState<any>({}); 
    const [taxPercent, setTaxPercent] = useState<number>(0);

    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [selectedOrderForApproval, setSelectedOrderForApproval] = useState<CommercialOrder | null>(null);

    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);

    const isCatalog = currentView === 'SRV_CATALOG';
    const isOS = currentView === 'SRV_OS';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const pricing = useMemo(() => {
        const items = (formData.items || []) as any[];
        const itemsSum = items.reduce((sum, item) => sum + (item.isBillable !== false ? (Number(item.totalPrice) || 0) : 0), 0);
        const costSum = items.reduce((sum, item) => sum + (Number(item.costPrice || 0) * Number(item.quantity || 1)), 0);
        const durationSum = items.reduce((sum, item) => sum + (Number(item.estimatedDuration || 0)), 0);

        if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            const disc = Number(formData.discountAmount) || 0;
            const taxes = (itemsSum - disc) * (taxPercent / 100);
            const net = itemsSum - disc - (currentView === 'SRV_SALES' ? taxes : 0);
            return { gross: itemsSum, disc, taxes, net };
        }
        
        const useAutomatic = isCatalog ? formData.isComposite : items.length > 0;
        
        return { 
            net: useAutomatic ? itemsSum : (Number(formData.defaultPrice) || 0),
            cost: useAutomatic ? costSum : (Number(formData.costPrice) || 0),
            duration: useAutomatic ? durationSum : (Number(formData.defaultDuration) || 0)
        };
    }, [formData.items, formData.discountAmount, formData.defaultPrice, formData.costPrice, formData.defaultDuration, formData.isComposite, taxPercent, currentView, isCatalog]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const getTitle = () => {
        switch(currentView) {
            case 'SRV_OS': return { title: 'Ordens de Serviço', icon: Wrench, label: 'OS' };
            case 'SRV_SALES': return { title: 'Vendas e Orçamentos', icon: ShoppingBag, label: 'Venda' };
            case 'SRV_PURCHASES': return { title: 'Compras', icon: ShoppingBag, label: 'Compra' };
            case 'SRV_CONTRACTS': return { title: 'Contratos', icon: FileSignature, label: 'Contrato' };
            case 'SRV_NF': return { title: 'Notas Fiscais', icon: FileText, label: 'Nota' };
            case 'SRV_CATALOG': return { title: 'Catálogo de Itens', icon: Package, label: 'Item' };
            default: return { title: 'Serviços', icon: Wrench, label: 'Item' };
        }
    };

    const header = getTitle();

    const handleDelete = async (id: string) => {
        const confirm = await showConfirm({
            title: "Excluir Registro",
            message: "Tem certeza que deseja excluir este registro?",
            variant: "danger"
        });
        if (!confirm) return;

        if (currentView === 'SRV_OS') onDeleteOS(id);
        else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') onDeleteOrder(id);
        else if (currentView === 'SRV_CONTRACTS') onDeleteContract(id);
        else if (currentView === 'SRV_NF') onDeleteInvoice(id);
        else if (isCatalog && onDeleteCatalogItem) onDeleteCatalogItem(id);
    };

    const handleConfirmApproval = (data: any) => {
        if (selectedOrderForApproval && onApproveOrder) {
            onApproveOrder(selectedOrderForApproval, data);
            setIsApprovalOpen(false);
            setSelectedOrderForApproval(null);
        }
    };

    const handleOpenModal = (item?: any) => {
        if (item && item.contactId) {
            const c = contacts.find(c => c.id === item.contactId);
            setContactSearch(c ? c.name : '');
        } else {
            setContactSearch('');
        }

        if (isOS) {
            if (item) {
                setFormData({ ...item });
            } else {
                setFormData({ 
                    status: 'ABERTA', 
                    type: 'MANUTENCAO', 
                    origin: 'MANUAL', 
                    priority: 'MEDIA', 
                    openedAt: new Date().toISOString(),
                    items: [] 
                });
            }
        } else if (isCatalog) {
            if (item) {
                setFormData({ 
                    ...item, 
                    items: Array.isArray(item.items) ? item.items : [],
                    defaultDuration: item.defaultDuration || 0,
                    isComposite: item.isComposite || false
                });
            } else {
                setFormData({ 
                    type: catalogTab === 'PRODUCT' ? 'PRODUCT' : 'SERVICE', 
                    isComposite: false,
                    defaultPrice: 0, 
                    costPrice: 0, 
                    brand: '', 
                    defaultDuration: 0, 
                    unit: 'UN', 
                    items: [] 
                });
            }
        } else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            if (item) {
                setFormData({ ...item, grossAmount: item.grossAmount || item.amount, discountAmount: item.discountAmount || 0, taxAmount: item.taxAmount || 0, items: item.items || [] });
            } else {
                setFormData({ status: 'DRAFT', date: new Date().toISOString().split('T')[0], grossAmount: 0, discountAmount: 0, taxAmount: 0, items: [] });
            }
        } else {
            setFormData(item || {});
        }
        setIsModalOpen(true);
    };

    const handleAddOSItem = (catalogItemId?: string) => {
        const catalogItem = serviceItems.find(i => i.id === catalogItemId);
        const newItem: OSItem = {
            id: crypto.randomUUID(),
            serviceItemId: catalogItem?.id,
            code: catalogItem?.code || '',
            description: catalogItem?.name || '',
            quantity: 1,
            unitPrice: catalogItem?.defaultPrice || 0,
            totalPrice: catalogItem?.defaultPrice || 0,
            estimatedDuration: catalogItem?.defaultDuration || 0,
            isBillable: true
        };
        (newItem as any).costPrice = catalogItem?.costPrice || 0;
        setFormData((prev: any) => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const handleUpdateOSItem = (itemId: string, field: keyof OSItem, value: any) => {
        const updatedItems = (formData.items || []).map((item: OSItem) => {
            if (item.id === itemId) {
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unitPrice') {
                    updated.totalPrice = Number(updated.quantity) * Number(updated.unitPrice);
                }
                return updated;
            }
            return item;
        });
        setFormData((prev: any) => ({ ...prev, items: updatedItems }));
    };

    const handleRemoveItem = (itemId: string) => {
        setFormData((prev: any) => ({
            ...prev,
            items: (prev.items || []).filter((i: any) => i.id !== itemId)
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let finalContactId = formData.contactId;
        let newContactObj: Contact | undefined;

        if (contactSearch && !isOS && !isCatalog) {
            const existing = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
            if (existing) {
                finalContactId = existing.id;
            } else {
                const newId = crypto.randomUUID();
                newContactObj = { id: newId, name: contactSearch, type: 'PF' };
                finalContactId = newId;
            }
        }

        const id = formData.id || crypto.randomUUID();
        const common = { id, contactId: finalContactId, contactName: contactSearch };

        if (isOS) {
            onSaveOS({ ...formData, ...common, totalAmount: pricing?.net || 0 }, newContactObj);
        } else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            const type = currentView === 'SRV_SALES' ? 'SALE' : 'PURCHASE';
            onSaveOrder({ 
                ...formData, ...common, type, 
                amount: pricing?.net || 0, 
                grossAmount: pricing?.gross || 0,
                discountAmount: pricing?.disc || 0,
                taxAmount: pricing?.taxes || 0,
                items: formData.items || [],
                date: formData.date || new Date().toISOString().split('T')[0], 
                status: formData.status || 'DRAFT' 
            }, newContactObj);
        } else if (currentView === 'SRV_CONTRACTS') {
            onSaveContract({ ...formData, ...common, value: Number(formData.value) || 0, startDate: formData.startDate || new Date().toISOString().split('T')[0], status: formData.status || 'ACTIVE' }, newContactObj);
        } else if (currentView === 'SRV_NF') {
            onSaveInvoice({ ...formData, ...common, amount: Number(formData.amount) || 0, issue_date: formData.issue_date || new Date().toISOString().split('T')[0], status: formData.status || 'ISSUED', type: formData.type || 'ISS' }, newContactObj);
        } else if (isCatalog && onSaveCatalogItem) {
            onSaveCatalogItem({ 
                ...formData, 
                id, 
                defaultPrice: pricing.net, 
                costPrice: pricing.cost, 
                type: formData.type || 'SERVICE', 
                defaultDuration: pricing.duration,
                isComposite: formData.isComposite || false,
                items: formData.items || [] 
            });
        }
        setIsModalOpen(false);
        setFormData({});
    };

    const getOSStatusColor = (status: OSStatus) => {
        switch(status) {
            case 'ABERTA': return 'bg-amber-100 text-amber-700';
            case 'APROVADA': return 'bg-blue-100 text-blue-700';
            case 'AGENDADA': return 'bg-purple-100 text-purple-700';
            case 'EM_EXECUCAO': return 'bg-indigo-100 text-indigo-700';
            case 'PAUSADA': return 'bg-orange-100 text-orange-700';
            case 'AGUARDANDO_CLIENTE': return 'bg-rose-100 text-rose-700';
            case 'AGUARDANDO_MATERIAL': return 'bg-slate-200 text-slate-700';
            case 'FINALIZADA': return 'bg-emerald-100 text-emerald-700';
            case 'CANCELADA': return 'bg-gray-100 text-gray-500';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getOSPriorityColor = (p: OSPriority) => {
        switch(p) {
            case 'BAIXA': return 'text-emerald-500';
            case 'MEDIA': return 'text-blue-500';
            case 'ALTA': return 'text-orange-500';
            case 'URGENTE': return 'text-rose-600 font-black';
            default: return 'text-gray-400';
        }
    };

    const renderGridContent = () => {
        let rawItems: any[] = [];
        if (isOS) rawItems = serviceOrders;
        else if (currentView === 'SRV_SALES') rawItems = commercialOrders.filter(o => o.type === 'SALE');
        else if (currentView === 'SRV_PURCHASES') rawItems = commercialOrders.filter(o => o.type === 'PURCHASE');
        else if (currentView === 'SRV_CONTRACTS') rawItems = contracts;
        else if (currentView === 'SRV_NF') rawItems = invoices;
        else if (isCatalog) {
            rawItems = serviceItems.filter(i => {
                const typeMatch = catalogTab === 'ALL' || i.type === catalogTab;
                const compositeMatch = compositionFilter === 'ALL' || 
                    (compositionFilter === 'COMPOSITE' ? i.isComposite : !i.isComposite);
                return typeMatch && compositeMatch;
            });
        }

        const filtered = rawItems.filter(i => 
            (i.title || i.description || i.name || i.code || i.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (i.contactName || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filtered.length === 0) return (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                <Box className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-800">Nenhum registro encontrado</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Tente ajustar sua busca ou adicione um novo item.</p>
            </div>
        );

        if (isOS) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(os => (
                        <div key={os.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">OS #{os.number || os.id.substring(0,4)}</span>
                                        <h3 className="font-bold text-gray-800 leading-tight">{os.title}</h3>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getOSStatusColor(os.status)}`}>{os.status}</span>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <User className="w-3 h-3 text-gray-400" />
                                        <span className="font-medium truncate">{os.contactName || 'Consumidor'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] uppercase font-bold">
                                        <div className="flex items-center gap-1 text-gray-400">
                                            <Zap className={`w-3 h-3 ${getOSPriorityColor(os.priority)}`} /> Prioridade: <span className={getOSPriorityColor(os.priority)}>{os.priority}</span>
                                        </div>
                                        <div className="text-gray-400">Origem: {os.origin}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                    <div className="text-sm font-black text-gray-900">{formatCurrency(os.totalAmount)}</div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(os)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg" title="Editar OS"><Wrench className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete(os.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => (
                    <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                         <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col overflow-hidden">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800 truncate">{item.description || item.title || item.name}</span>
                                    {item.isComposite && <span title="Item Composto / Kit"><Layers className="w-3 h-3 text-indigo-500" /></span>}
                                </div>
                                <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {item.contactName || 'Item de Catálogo'}</span>
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${item.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.status || 'CATALOG'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-black text-gray-900 mt-2">
                             <span>{formatCurrency(item.amount || item.defaultPrice || item.value || 0)}</span>
                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {currentView === 'SRV_SALES' && item.status === 'DRAFT' && (
                                    <button onClick={() => { setSelectedOrderForApproval(item); setIsApprovalOpen(true); }} className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg" title="Aprovar Orçamento"><CheckCircle className="w-4 h-4"/></button>
                                )}
                                <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600" title="Editar"><Wrench className="w-4 h-4"/></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-rose-500" title="Excluir"><Trash2 className="w-4 h-4"/></button>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <header.icon className="w-6 h-6 text-indigo-600" /> {header.title}
                </h1>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                    </div>
                    <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                        <Plus className="w-4 h-4" /> Novo {header.label}
                    </button>
                </div>
            </div>

            {isCatalog && (
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">
                        {[
                            { id: 'ALL', label: 'Categorias' },
                            { id: 'PRODUCT', label: 'Produtos' },
                            { id: 'SERVICE', label: 'Serviços' }
                        ].map(t => (
                            <button key={t.id} onClick={() => setCatalogTab(t.id as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex bg-indigo-50/50 p-1 rounded-xl w-fit border border-indigo-100 shadow-sm">
                        {[
                            { id: 'ALL', label: 'Todos', icon: ListChecks },
                            { id: 'SIMPLE', label: 'Simples', icon: Box },
                            { id: 'COMPOSITE', label: 'Compostos', icon: Layers }
                        ].map(t => (
                            <button key={t.id} onClick={() => setCompositionFilter(t.id as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${compositionFilter === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-400'}`}>
                                <t.icon className="w-3.5 h-3.5" /> {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {renderGridContent()}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl p-8 max-h-[95vh] overflow-y-auto animate-scale-up">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2"><Calculator className="w-6 h-6 text-indigo-600"/> {formData.id ? 'Editar ' : 'Novo '} {header.label}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                <div className="lg:col-span-3 space-y-6">
                                    {isCatalog && (
                                        <div className="flex bg-indigo-50 p-1.5 rounded-2xl border border-indigo-100/50 w-fit">
                                            <button type="button" onClick={() => setFormData({...formData, isComposite: false, items: []})} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${!formData.isComposite ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-indigo-400'}`}>
                                                <Box className="w-4 h-4" /> Item Simples
                                            </button>
                                            <button type="button" onClick={() => setFormData({...formData, isComposite: true})} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${formData.isComposite ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-indigo-400'}`}>
                                                <Layers className="w-4 h-4" /> Item Composto / Kit
                                            </button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className={isCatalog ? "md:col-span-2" : "md:col-span-1"}>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Título do Registro</label>
                                            <input type="text" placeholder={isCatalog ? "Ex: Motor Trifásico 5HP..." : "Ex: Manutenção Elétrica Prédio..."} className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.title || formData.description || formData.name || ''} onChange={e => setFormData({...formData, title: e.target.value, description: e.target.value, name: e.target.value})} required />
                                        </div>
                                        {!isOS && !isCatalog && (
                                            <div className="relative" ref={contactDropdownRef}>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Pessoa / Empresa</label>
                                                <div className="relative">
                                                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                                                    <input type="text" value={contactSearch} onFocus={() => setShowContactDropdown(true)} onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}} className="w-full pl-9 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold bg-white" placeholder="Buscar ou criar..." />
                                                </div>
                                                {showContactDropdown && (
                                                    <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in border-t-4 border-t-indigo-500">
                                                        {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                                                            <button key={c.id} type="button" onClick={() => {setContactSearch(c.name); setFormData({...formData, contactId: c.id}); setShowContactDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-colors flex items-center justify-between">
                                                                {c.name}
                                                            </button>
                                                        ))}
                                                        {contactSearch && !contacts.some(c => c.name.toLowerCase() === contactSearch.toLowerCase()) && (
                                                            <button type="button" onClick={() => setShowContactDropdown(false)} className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-2 mt-1">
                                                                <Plus className="w-3 h-3" /> Criar novo: "{contactSearch}"
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {isOS && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Tipo de OS</label>
                                                <select className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white font-bold" value={formData.type || 'MANUTENCAO'} onChange={e => setFormData({...formData, type: e.target.value})}>
                                                    <option value="PREVENTIVA">Preventiva</option>
                                                    <option value="CORRETIVA">Corretiva</option>
                                                    <option value="INSTALACAO">Instalação</option>
                                                    <option value="MANUTENCAO">Manutenção</option>
                                                    <option value="CONSULTORIA">Consultoria</option>
                                                    <option value="EMERGENCIAL">Emergencial</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Origem</label>
                                                <select className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white font-bold" value={formData.origin || 'MANUAL'} onChange={e => setFormData({...formData, origin: e.target.value})}>
                                                    <option value="MANUAL">Manual</option>
                                                    <option value="ORCAMENTO">Orçamento</option>
                                                    <option value="VENDA">Venda</option>
                                                    <option value="CONTRATO">Contrato</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Prioridade</label>
                                                <select className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white font-bold" value={formData.priority || 'MEDIA'} onChange={e => setFormData({...formData, priority: e.target.value})}>
                                                    <option value="BAIXA">Baixa</option>
                                                    <option value="MEDIA">Média</option>
                                                    <option value="ALTA">Alta</option>
                                                    <option value="URGENTE">Urgente</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                    {isCatalog && (
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Duração Padrão</label>
                                                <input type="number" placeholder="Ex: 60" className={`w-full border border-gray-200 rounded-xl p-3 text-sm font-bold ${formData.isComposite ? 'bg-gray-50' : 'bg-white'}`} value={pricing.duration || ''} readOnly={formData.isComposite} onChange={e => setFormData({...formData, defaultDuration: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Unidade Padrão</label>
                                                <select className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold bg-white" value={formData.unit || 'UN'} onChange={e => setFormData({...formData, unit: e.target.value})}>
                                                    {SERVICE_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Preço Sugerido (R$)</label>
                                                <input type="number" step="0.01" className={`w-full border border-gray-200 rounded-xl p-3 text-sm font-bold ${formData.isComposite ? 'bg-gray-50 text-indigo-600' : 'bg-white'}`} value={pricing.net || ''} onChange={e => setFormData({...formData, defaultPrice: e.target.value})} readOnly={formData.isComposite} />
                                                {formData.isComposite && <p className="text-[9px] text-indigo-500 font-bold mt-1 uppercase">* Somatório dos itens da grade</p>}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Custo Sugerido (R$)</label>
                                                <input type="number" step="0.01" className={`w-full border border-gray-200 rounded-xl p-3 text-sm font-bold ${formData.isComposite ? 'bg-gray-50' : 'bg-white'}`} value={pricing.cost || ''} onChange={e => setFormData({...formData, costPrice: e.target.value})} readOnly={formData.isComposite}/>
                                            </div>
                                         </div>
                                    )}
                                    <div className={`space-y-4 transition-opacity ${isCatalog && !formData.isComposite ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-black text-gray-700 flex items-center gap-2 uppercase tracking-widest text-xs">
                                                <Package className="w-4 h-4 text-indigo-500"/> Detalhamento Técnico / Composição
                                            </h3>
                                            <div className="flex gap-2">
                                                <select className="border border-gray-200 rounded-lg p-1.5 text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => { if(e.target.value) handleAddOSItem(e.target.value); e.target.value = ''; }}>
                                                    <option value="">+ Catálogo</option>
                                                    {serviceItems.filter(i => i.id !== formData.id).map(i => <option key={i.id} value={i.id}>{i.name} ({formatCurrency(i.defaultPrice)})</option>)}
                                                </select>
                                                <button type="button" onClick={() => handleAddOSItem()} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-black transition-colors">+ Manual</button>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl border border-gray-200 overflow-hidden shadow-inner overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-[800px]">
                                                <thead className="bg-slate-100 text-[9px] uppercase font-black text-slate-500 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3">Serviço/Peça</th>
                                                        <th className="px-4 py-3 w-16 text-center">Qtd</th>
                                                        <th className="px-4 py-3 w-28 text-center">Vlr Unit</th>
                                                        {isOS && (
                                                            <>
                                                                <th className="px-4 py-3 w-32 text-center">Técnico</th>
                                                                <th className="px-4 py-3 w-20 text-center">Estimado (min)</th>
                                                                <th className="px-4 py-3 w-20 text-center">Real (min)</th>
                                                                <th className="px-4 py-3 w-12 text-center">Fat?</th>
                                                            </>
                                                        )}
                                                        <th className="px-4 py-3 w-28 text-right">Subtotal</th>
                                                        <th className="px-4 py-3 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {(formData.items || []).map((item: any) => (
                                                        <tr key={item.id} className="bg-white hover:bg-indigo-50/10 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-1">
                                                                    <input type="text" value={item.code} onChange={e => handleUpdateOSItem(item.id, 'code', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-black text-indigo-400 placeholder-indigo-200" placeholder="Código"/>
                                                                    <input type="text" value={item.description} onChange={e => handleUpdateOSItem(item.id, 'description', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-800" placeholder="Descrição do item..."/>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-3"><input type="number" value={item.quantity} onChange={e => handleUpdateOSItem(item.id, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-center" min="1"/></td>
                                                            <td className="px-2 py-3"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleUpdateOSItem(item.id, 'unitPrice', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-xs font-black text-center"/></td>
                                                            {isOS && (
                                                                <>
                                                                    <td className="px-2 py-3 text-center"><input type="text" value={item.technician} onChange={e => handleUpdateOSItem(item.id, 'technician', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center" placeholder="Responsável..."/></td>
                                                                    <td className="px-2 py-3 text-center"><input type="number" value={item.estimatedDuration} onChange={e => handleUpdateOSItem(item.id, 'estimatedDuration', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center" /></td>
                                                                    <td className="px-2 py-3 text-center"><input type="number" value={item.realDuration} onChange={e => handleUpdateOSItem(item.id, 'realDuration', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-black text-indigo-600 text-center" /></td>
                                                                    <td className="px-2 py-3 text-center"><input type="checkbox" checked={item.isBillable} onChange={e => handleUpdateOSItem(item.id, 'isBillable', e.target.checked)} className="w-4 h-4 rounded text-indigo-600"/></td>
                                                                </>
                                                            )}
                                                            <td className="px-2 py-3 text-xs font-black text-gray-900 text-right">{formatCurrency(item.totalPrice)}</td>
                                                            <td className="px-4 py-3 text-right"><button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button></td>
                                                        </tr>
                                                    ))}
                                                    {(formData.items || []).length === 0 && (<tr><td colSpan={isOS ? 10 : 5} className="px-4 py-12 text-center text-gray-400 text-xs italic">Clique em catálogo ou manual para adicionar itens.</td></tr>)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-gray-200 space-y-6">
                                    {!isOS && !isCatalog && (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Situação Atual</label>
                                            <select className={`w-full rounded-xl p-3 text-sm font-black border-2 transition-all ${getOSStatusColor(formData.status || 'ABERTA')}`} value={formData.status || 'ABERTA'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                <option value="ABERTA">Aberta</option>
                                                <option value="APROVADA">Aprovada</option>
                                                <option value="AGENDADA">Agendada</option>
                                                <option value="EM_EXECUCAO">Em Execução</option>
                                                <option value="PAUSADA">Pausada</option>
                                                <option value="AGUARDANDO_CLIENTE">Aguardando Cliente</option>
                                                <option value="AGUARDANDO_MATERIAL">Aguardando Material</option>
                                                <option value="FINALIZADA">Finalizada</option>
                                                <option value="CANCELADA">Cancelada</option>
                                            </select>
                                        </div>
                                    )}
                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-black text-gray-400 uppercase">{isCatalog ? 'Valor Final' : 'Valor Faturável'}</span>
                                            {(isOS || isCatalog) && <span title="Somatório automático de todos os itens técnicos."><Info className="w-3 h-3 text-gray-300" /></span>}
                                        </div>
                                        <p className="text-3xl font-black text-gray-900">{formatCurrency(pricing?.net || 0)}</p>
                                    </div>
                                    <div className="space-y-3">
                                        <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2">
                                            <CheckCircle className="w-5 h-5" /> Salvar Alterações
                                        </button>
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-700">Descartar</button>
                                    </div>
                                    {!isCatalog && (
                                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-700 uppercase mb-2">
                                                <Timer className="w-3 h-3" /> Cronograma (Auto)
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-indigo-400 uppercase">Abertura</label>
                                                    <input type="datetime-local" className="w-full bg-transparent text-[11px] font-bold text-indigo-900 outline-none" value={formData.openedAt?.substring(0,16) || ''} onChange={e => setFormData({...formData, openedAt: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-indigo-400 uppercase">Previsão Início</label>
                                                    <input type="date" className="w-full bg-transparent text-xs font-bold text-indigo-900 outline-none" value={formData.startDate || ''} onChange={e => setFormData({...formData, startDate: e.target.value})}/>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-indigo-400 uppercase">Previsão Conclusão</label>
                                                    <input type="date" className="w-full bg-transparent text-xs font-bold text-indigo-900 outline-none" value={formData.endDate || ''} onChange={e => setFormData({...formData, endDate: e.target.value})}/>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ApprovalModal 
                isOpen={isApprovalOpen}
                onClose={() => setIsApprovalOpen(false)}
                order={selectedOrderForApproval}
                accounts={accounts}
                onConfirm={handleConfirmApproval}
            />
        </div>
    );
};

export default ServicesView;