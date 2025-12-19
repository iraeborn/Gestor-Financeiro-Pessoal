
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, TransactionType, TransactionStatus, ServiceItem, OSItem, Category, Account, CompanyProfile, TaxRegime, OSStatus, OSType, OSOrigin, OSPriority } from '../types';
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText, UserCircle, User, Package, Zap, Info, UserCheck, Timer } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import ApprovalModal from './ApprovalModal';

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
    const [formData, setFormData] = useState<any>({}); 
    const [taxPercent, setTaxPercent] = useState<number>(0);

    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [selectedOrderForApproval, setSelectedOrderForApproval] = useState<CommercialOrder | null>(null);

    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);

    const getTaxSuggestion = (regime?: TaxRegime) => {
        if (!regime) return 0;
        switch (regime) {
            case TaxRegime.MEI: return 0;
            case TaxRegime.SIMPLES: return 6;
            case TaxRegime.PRESUMIDO: return 15;
            case TaxRegime.REAL: return 18;
            default: return 0;
        }
    };

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
        if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            const items = (formData.items || []) as any[];
            const gross = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
            const disc = Number(formData.discountAmount) || 0;
            const taxes = (gross - disc) * (taxPercent / 100);
            const net = gross - disc - (currentView === 'SRV_SALES' ? taxes : 0);
            return { gross, disc, taxes, net };
        }
        if (currentView === 'SRV_OS') {
            const items = (formData.items || []) as OSItem[];
            const net = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
            return { net };
        }
        return null;
    }, [formData.items, formData.discountAmount, taxPercent, currentView]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

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

    // Fix: Added missing handleDelete function to handle generic deletion based on current view.
    const handleDelete = async (id: string) => {
        const confirm = await showConfirm({
            title: "Excluir Registro",
            message: "Tem certeza que deseja excluir este registro?",
            variant: "danger"
        });
        if (!confirm) return;

        if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') onDeleteOrder(id);
        else if (currentView === 'SRV_CONTRACTS') onDeleteContract(id);
        else if (currentView === 'SRV_NF') onDeleteInvoice(id);
        else if (currentView === 'SRV_CATALOG' && onDeleteCatalogItem) onDeleteCatalogItem(id);
    };

    // Fix: Added missing handleRemoveItem function to remove an item from the current order/OS.
    const handleRemoveItem = (itemId: string) => {
        setFormData((prev: any) => ({
            ...prev,
            items: (prev.items || []).filter((i: any) => i.id !== itemId)
        }));
    };

    // Fix: Added missing handleConfirmApproval function to process the order approval.
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

        if (currentView === 'SRV_OS') {
            if (item) {
                setFormData({ ...item });
            } else {
                setFormData({ 
                    status: 'OPEN', 
                    type: 'MAINTENANCE', 
                    origin: 'MANUAL', 
                    priority: 'MEDIUM', 
                    openedAt: new Date().toISOString(),
                    items: [] 
                });
            }
        } else if (currentView === 'SRV_CATALOG') {
            if (item) setFormData({ ...item });
            else setFormData({ type: catalogTab === 'PRODUCT' ? 'PRODUCT' : 'SERVICE', defaultPrice: '', costPrice: '', brand: '' });
        } else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            if (item) {
                setFormData({ ...item, grossAmount: item.grossAmount || item.amount, discountAmount: item.discountAmount || 0, taxAmount: item.taxAmount || 0, items: item.items || [] });
                const base = (item.grossAmount || item.amount) - (item.discountAmount || 0);
                if (base > 0) setTaxPercent(Math.round(((item.taxAmount || 0) / base) * 100));
            } else {
                setFormData({ status: 'DRAFT', date: new Date().toISOString().split('T')[0], grossAmount: 0, discountAmount: 0, taxAmount: 0, items: [] });
                setTaxPercent(getTaxSuggestion(companyProfile?.taxRegime));
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
            isBillable: true
        };
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let finalContactId = formData.contactId;
        let newContactObj: Contact | undefined;

        if (contactSearch) {
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

        if (currentView === 'SRV_OS') {
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
        } else if (currentView === 'SRV_CATALOG' && onSaveCatalogItem) {
            onSaveCatalogItem({ ...formData, id, defaultPrice: Number(formData.defaultPrice) || 0, costPrice: Number(formData.costPrice) || 0, type: formData.type || 'SERVICE' });
        }
        setIsModalOpen(false);
        setFormData({});
    };

    const getOSStatusColor = (status: string) => {
        switch(status) {
            case 'OPEN': return 'bg-amber-100 text-amber-700';
            case 'APPROVED': return 'bg-blue-100 text-blue-700';
            case 'SCHEDULED': return 'bg-purple-100 text-purple-700';
            case 'IN_PROGRESS': return 'bg-indigo-100 text-indigo-700';
            case 'PAUSED': return 'bg-orange-100 text-orange-700';
            case 'WAITING_CLIENT': return 'bg-rose-100 text-rose-700';
            case 'WAITING_MATERIAL': return 'bg-slate-200 text-slate-700';
            case 'DONE': return 'bg-emerald-100 text-emerald-700';
            case 'CANCELED': return 'bg-gray-100 text-gray-500';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getOSPriorityColor = (p: string) => {
        switch(p) {
            case 'LOW': return 'text-emerald-500';
            case 'MEDIUM': return 'text-blue-500';
            case 'HIGH': return 'text-orange-500';
            case 'URGENT': return 'text-rose-600 font-black';
            default: return 'text-gray-400';
        }
    };

    const renderGridContent = () => {
        let rawItems: any[] = [];
        if (currentView === 'SRV_OS') rawItems = serviceOrders;
        else if (currentView === 'SRV_SALES') rawItems = commercialOrders.filter(o => o.type === 'SALE');
        else if (currentView === 'SRV_PURCHASES') rawItems = commercialOrders.filter(o => o.type === 'PURCHASE');
        else if (currentView === 'SRV_CONTRACTS') rawItems = contracts;
        else if (currentView === 'SRV_NF') rawItems = invoices;
        else if (currentView === 'SRV_CATALOG') rawItems = serviceItems.filter(i => catalogTab === 'ALL' || i.type === catalogTab);

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

        if (currentView === 'SRV_OS') {
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
                                        <button onClick={() => handleOpenModal(os)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg"><Wrench className="w-4 h-4"/></button>
                                        <button onClick={() => onDeleteOS(os.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // Outras visualizações (Vendas, Catálogo...)
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => (
                    <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                         <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-gray-800 truncate">{item.description || item.title || item.name}</span>
                                <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {item.contactName || 'Sem contato'}</span>
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${osStatusColor(item.status)}`}>{item.status}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-black text-gray-900 mt-2">
                             <span>{formatCurrency(item.amount || item.defaultPrice || item.value || 0)}</span>
                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600"><Wrench className="w-4 h-4"/></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const osStatusColor = (s: string) => {
        if (s === 'DRAFT' || s === 'OPEN') return 'bg-amber-100 text-amber-700';
        if (s === 'CONFIRMED' || s === 'DONE') return 'bg-emerald-100 text-emerald-700';
        return 'bg-gray-100 text-gray-500';
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

            {currentView === 'SRV_CATALOG' && (
                <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">
                    {['ALL', 'PRODUCT', 'SERVICE'].map(t => (
                        <button key={t} onClick={() => setCatalogTab(t as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>{t === 'ALL' ? 'Todos' : t === 'PRODUCT' ? 'Produtos' : 'Serviços'}</button>
                    ))}
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
                                
                                {/* Coluna 1: Informações Gerais */}
                                <div className="lg:col-span-3 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Título do Registro</label>
                                            <input type="text" placeholder="Ex: Reforma Cozinha..." className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.title || formData.description || formData.name || ''} onChange={e => setFormData({...formData, title: e.target.value, description: e.target.value, name: e.target.value})} required />
                                        </div>
                                        <div className="relative" ref={contactDropdownRef}>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Pessoa / Empresa</label>
                                            <div className="relative">
                                                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                                                <input 
                                                    type="text" 
                                                    value={contactSearch} 
                                                    onFocus={() => setShowContactDropdown(true)} 
                                                    onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}} 
                                                    className="w-full pl-9 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold bg-white" 
                                                    placeholder="Buscar ou criar..." 
                                                />
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
                                    </div>

                                    {currentView === 'SRV_OS' && (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Tipo de OS</label>
                                                <select className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white font-bold" value={formData.type || 'MAINTENANCE'} onChange={e => setFormData({...formData, type: e.target.value})}>
                                                    <option value="PREVENTATIVE">Preventiva</option>
                                                    <option value="CORRECTIVE">Corretiva</option>
                                                    <option value="INSTALLATION">Instalação</option>
                                                    <option value="MAINTENANCE">Manutenção</option>
                                                    <option value="CONSULTANCY">Consultoria</option>
                                                    <option value="EMERGENCY">Emergencial</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Origem</label>
                                                <select className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white font-bold" value={formData.origin || 'MANUAL'} onChange={e => setFormData({...formData, origin: e.target.value})}>
                                                    <option value="MANUAL">Manual</option>
                                                    <option value="QUOTE">Orçamento</option>
                                                    <option value="SALE">Venda</option>
                                                    <option value="CONTRACT">Contrato</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Prioridade</label>
                                                <select className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white font-bold" value={formData.priority || 'MEDIUM'} onChange={e => setFormData({...formData, priority: e.target.value})}>
                                                    <option value="LOW">Baixa</option>
                                                    <option value="MEDIUM">Média</option>
                                                    <option value="HIGH">Alta</option>
                                                    <option value="URGENT">Urgente</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Data/Hora Abertura</label>
                                                <input type="datetime-local" className="w-full border border-gray-200 rounded-xl p-2 text-[10px] font-bold" value={formData.openedAt?.substring(0,16) || ''} onChange={e => setFormData({...formData, openedAt: e.target.value})} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Lista de Itens (Expansível e Detalhada para OS) */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-black text-gray-700 flex items-center gap-2 uppercase tracking-widest text-xs">
                                                <Package className="w-4 h-4 text-indigo-500"/> Detalhamento de Serviços/Produtos
                                            </h3>
                                            <div className="flex gap-2">
                                                <select className="border border-gray-200 rounded-lg p-1.5 text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => { if(e.target.value) handleAddOSItem(e.target.value); e.target.value = ''; }}>
                                                    <option value="">+ Catálogo</option>
                                                    {serviceItems.map(i => <option key={i.id} value={i.id}>{i.name} ({formatCurrency(i.defaultPrice)})</option>)}
                                                </select>
                                                <button type="button" onClick={() => handleAddOSItem()} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-black transition-colors">+ Adicionar Manual</button>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-2xl border border-gray-200 overflow-hidden shadow-inner">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-100 text-[9px] uppercase font-black text-slate-500 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3">Cód/Descrição</th>
                                                        <th className="px-4 py-3 w-16 text-center">Qtd</th>
                                                        <th className="px-4 py-3 w-28 text-center">Vlr Unit</th>
                                                        <th className="px-4 py-3 w-28 text-center">Vlr Total</th>
                                                        {currentView === 'SRV_OS' && (
                                                            <>
                                                                <th className="px-4 py-3 w-28 text-center">Técnico</th>
                                                                <th className="px-4 py-3 w-24 text-center">Tempo Est/Real</th>
                                                                <th className="px-4 py-3 w-12 text-center">Fat?</th>
                                                            </>
                                                        )}
                                                        <th className="px-4 py-3 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {(formData.items || []).map((item: any) => (
                                                        <tr key={item.id} className="bg-white hover:bg-indigo-50/10 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-1">
                                                                    <input type="text" value={item.code} onChange={e => handleUpdateOSItem(item.id, 'code', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-black text-indigo-400 placeholder-indigo-200" placeholder="Código"/>
                                                                    <input type="text" value={item.description} onChange={e => handleUpdateOSItem(item.id, 'description', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-800" placeholder="Serviço/Peça..."/>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-3"><input type="number" value={item.quantity} onChange={e => handleUpdateOSItem(item.id, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-center" min="1"/></td>
                                                            <td className="px-2 py-3"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleUpdateOSItem(item.id, 'unitPrice', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-xs font-black text-center"/></td>
                                                            <td className="px-2 py-3 text-xs font-black text-gray-900 text-center">{formatCurrency(item.totalPrice)}</td>
                                                            {currentView === 'SRV_OS' && (
                                                                <>
                                                                    <td className="px-2 py-3 text-center"><input type="text" value={item.technician} onChange={e => handleUpdateOSItem(item.id, 'technician', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center" placeholder="Nome..."/></td>
                                                                    <td className="px-2 py-3">
                                                                        <div className="flex flex-col gap-1">
                                                                            <input type="text" value={item.estimatedTime} onChange={e => handleUpdateOSItem(item.id, 'estimatedTime', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center" placeholder="Est (ex: 2h)"/>
                                                                            <input type="text" value={item.realTime} onChange={e => handleUpdateOSItem(item.id, 'realTime', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-black text-indigo-600 text-center border-t border-gray-100" placeholder="Real"/>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-2 py-3 text-center">
                                                                        <input type="checkbox" checked={item.isBillable} onChange={e => handleUpdateOSItem(item.id, 'isBillable', e.target.checked)} className="w-4 h-4 rounded text-indigo-600"/>
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="px-4 py-3 text-right"><button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button></td>
                                                        </tr>
                                                    ))}
                                                    {(formData.items || []).length === 0 && (<tr><td colSpan={currentView === 'SRV_OS' ? 8 : 5} className="px-4 py-12 text-center text-gray-400 text-xs italic">Nenhum item adicionado.</td></tr>)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Coluna 2: Status & Totais */}
                                <div className="bg-slate-50 p-6 rounded-3xl border border-gray-200 space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Situação Atual</label>
                                        <select className={`w-full rounded-xl p-3 text-sm font-black border-2 transition-all ${getOSStatusColor(formData.status || 'OPEN')}`} value={formData.status || 'OPEN'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                            <option value="OPEN">Aberta</option>
                                            <option value="APPROVED">Aprovada</option>
                                            <option value="SCHEDULED">Agendada</option>
                                            <option value="IN_PROGRESS">Em Execução</option>
                                            <option value="PAUSED">Pausada</option>
                                            <option value="WAITING_CLIENT">Aguardando Cliente</option>
                                            <option value="WAITING_MATERIAL">Aguardando Material</option>
                                            <option value="DONE">Finalizada</option>
                                            <option value="CANCELED">Cancelada</option>
                                        </select>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-black text-gray-400 uppercase">Total Geral</span>
                                            {/* Fix: Wrapped Lucide Info icon in a span to apply 'title' tooltip, as the icon itself does not support it. */}
                                            {currentView === 'SRV_OS' && <span title="Soma de todos os itens marcados como faturáveis."><Info className="w-3 h-3 text-gray-300" /></span>}
                                        </div>
                                        <p className="text-3xl font-black text-gray-900">{formatCurrency(pricing?.net || 0)}</p>
                                    </div>

                                    <div className="space-y-3">
                                        <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2">
                                            <CheckCircle className="w-5 h-5" /> Salvar Registro
                                        </button>
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-700">Descartar</button>
                                    </div>

                                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-700 uppercase mb-2">
                                            <Timer className="w-3 h-3" /> Cronograma
                                        </div>
                                        <div className="space-y-3">
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
