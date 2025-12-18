
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, TransactionType, TransactionStatus, ServiceItem, OrderItem, Category } from '../types';
/* Added missing 'Package' to lucide-react imports */
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText, UserCircle, User, Package } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';

interface ServicesViewProps {
    currentView: ViewMode;
    serviceOrders: ServiceOrder[];
    commercialOrders: CommercialOrder[];
    contracts: Contract[];
    invoices: Invoice[];
    contacts: Contact[];
    serviceItems?: ServiceItem[];
    
    onSaveOS: (os: ServiceOrder, newContact?: Contact) => void;
    onDeleteOS: (id: string) => void;
    onSaveOrder: (o: CommercialOrder, newContact?: Contact) => void;
    onDeleteOrder: (id: string) => void;
    onSaveContract: (c: Contract, newContact?: Contact) => void;
    onDeleteContract: (id: string) => void;
    onSaveInvoice: (i: Invoice, newContact?: Contact) => void;
    onDeleteInvoice: (id: string) => void;
    onSaveCatalogItem?: (i: ServiceItem) => void;
    onDeleteCatalogItem?: (id: string) => void;
    onAddTransaction: (t: any) => void;
}

const ServicesView: React.FC<ServicesViewProps> = ({ 
    currentView, serviceOrders, commercialOrders, contracts, invoices, contacts, serviceItems = [],
    onSaveOS, onDeleteOS, onSaveOrder, onDeleteOrder, onSaveContract, onDeleteContract, onSaveInvoice, onDeleteInvoice, onAddTransaction, onSaveCatalogItem, onDeleteCatalogItem
}) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [catalogTab, setCatalogTab] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
    const [formData, setFormData] = useState<any>({}); 
    const [taxPercent, setTaxPercent] = useState<number>(0);

    // Contact Search States
    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);

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
        if (currentView !== 'SRV_SALES' && currentView !== 'SRV_PURCHASES') return null;
        const items = (formData.items || []) as OrderItem[];
        const gross = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
        const disc = Number(formData.discountAmount) || 0;
        const taxes = (gross - disc) * (taxPercent / 100);
        const net = gross - disc - (currentView === 'SRV_SALES' ? taxes : 0);
        const totalCost = items.reduce((sum, item) => sum + ((Number(item.costPrice) || 0) * (item.quantity || 1)), 0);
        const profit = net - totalCost;
        const margin = totalCost > 0 ? (profit / totalCost) * 100 : 100;
        return { gross, disc, taxes, net, totalCost, profit, margin };
    }, [formData.items, formData.discountAmount, taxPercent, currentView]);

    useEffect(() => {
        if (pricing && (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES')) {
            setFormData((prev: any) => ({ ...prev, amount: pricing.net }));
        }
    }, [pricing?.net, currentView]);

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

    const handleOpenModal = (item?: any) => {
        setTaxPercent(0);
        if (item && item.contactId) {
            const c = contacts.find(c => c.id === item.contactId);
            setContactSearch(c ? c.name : '');
        } else {
            setContactSearch('');
        }

        if (currentView === 'SRV_CATALOG') {
            if (item) setFormData({ ...item });
            else setFormData({ type: catalogTab === 'PRODUCT' ? 'PRODUCT' : 'SERVICE', defaultPrice: '', costPrice: '', brand: '' });
        } else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            if (item) {
                setFormData({ ...item, grossAmount: item.grossAmount || item.amount, discountAmount: item.discountAmount || 0, taxAmount: item.taxAmount || 0, items: item.items || [] });
                const base = (item.grossAmount || item.amount) - (item.discountAmount || 0);
                if (base > 0) setTaxPercent(Math.round(((item.taxAmount || 0) / base) * 100));
            } else {
                setFormData({ status: 'DRAFT', date: new Date().toISOString().split('T')[0], grossAmount: 0, discountAmount: 0, taxAmount: 0, items: [] });
            }
        } else {
            setFormData(item || {});
        }
        setIsModalOpen(true);
    };

    const handleAddItem = (catalogItemId?: string) => {
        const catalogItem = serviceItems.find(i => i.id === catalogItemId);
        const newItem: OrderItem = {
            id: crypto.randomUUID(),
            serviceItemId: catalogItem?.id,
            description: catalogItem?.name || '',
            quantity: 1,
            unitPrice: catalogItem?.defaultPrice || 0,
            totalPrice: catalogItem?.defaultPrice || 0,
            costPrice: catalogItem?.costPrice
        };
        setFormData((prev: any) => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const handleUpdateItem = (itemId: string, field: keyof OrderItem, value: any) => {
        const updatedItems = (formData.items || []).map((item: OrderItem) => {
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
        setFormData((prev: any) => ({ ...prev, items: (prev.items || []).filter((i: OrderItem) => i.id !== itemId) }));
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
        const common = { id, contactId: finalContactId };

        if (currentView === 'SRV_OS') {
            onSaveOS({ ...formData, ...common, totalAmount: Number(formData.totalAmount) || 0, status: formData.status || 'OPEN' }, newContactObj);
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
            onSaveInvoice({ ...formData, ...common, amount: Number(formData.amount) || 0, issueDate: formData.issueDate || new Date().toISOString().split('T')[0], status: formData.status || 'ISSUED', type: formData.type || 'ISS' }, newContactObj);
        } else if (currentView === 'SRV_CATALOG' && onSaveCatalogItem) {
            onSaveCatalogItem({ ...formData, id, defaultPrice: Number(formData.defaultPrice) || 0, costPrice: Number(formData.costPrice) || 0, type: formData.type || 'SERVICE' });
        }
        setIsModalOpen(false);
        setFormData({});
    };

    const handleDelete = async (id: string) => {
        if (await showConfirm({ title: 'Excluir Item', message: 'Tem certeza que deseja excluir este registro?', variant: 'danger' })) {
            if (currentView === 'SRV_OS') onDeleteOS(id);
            else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') onDeleteOrder(id);
            else if (currentView === 'SRV_CONTRACTS') onDeleteContract(id);
            else if (currentView === 'SRV_NF') onDeleteInvoice(id);
            else if (currentView === 'SRV_CATALOG' && onDeleteCatalogItem) onDeleteCatalogItem(id);
        }
    };

    const handleGenerateTransaction = async (item: any) => {
        if (await showConfirm({ title: 'Gerar Financeiro', message: 'Deseja criar um lançamento financeiro para este item?', confirmText: 'Sim, Gerar' })) {
            let trans: any = {
                description: item.description || item.title || 'Venda/Compra',
                amount: item.amount,
                date: new Date().toISOString().split('T')[0],
                status: TransactionStatus.PENDING,
                type: item.type === 'PURCHASE' ? TransactionType.EXPENSE : TransactionType.INCOME,
                category: item.type === 'PURCHASE' ? 'Fornecedores' : 'Vendas/Serviços',
                contactId: item.contactId,
                isRecurring: false,
                accountId: '' 
            };
            onAddTransaction(trans);
            if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') onSaveOrder({ ...item, status: 'CONFIRMED' });
            else if (currentView === 'SRV_OS') onSaveOS({ ...item, status: 'DONE' });
            showAlert("Lançamento financeiro gerado com sucesso!", "success");
        }
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'DRAFT': return 'bg-amber-100 text-amber-700';
            case 'APPROVED': return 'bg-blue-100 text-blue-700';
            case 'CONFIRMED': return 'bg-emerald-100 text-emerald-700';
            case 'DONE': return 'bg-emerald-100 text-emerald-700';
            case 'CANCELED': return 'bg-rose-100 text-rose-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusLabel = (status: string) => {
        const map: any = { 'DRAFT': 'Orçamento', 'APPROVED': 'Aprovado', 'CONFIRMED': 'Vendido', 'DONE': 'Concluído', 'CANCELED': 'Cancelado', 'OPEN': 'Aberto' };
        return map[status] || status;
    };

    const filteredItemsBySearch = (items: any[]) => items.filter(i => 
        (i.title || i.description || i.name || i.code || i.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.contactName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderGridContent = () => {
        let rawItems: any[] = [];
        if (currentView === 'SRV_OS') rawItems = serviceOrders;
        else if (currentView === 'SRV_SALES') rawItems = commercialOrders.filter(o => o.type === 'SALE');
        else if (currentView === 'SRV_PURCHASES') rawItems = commercialOrders.filter(o => o.type === 'PURCHASE');
        else if (currentView === 'SRV_CONTRACTS') rawItems = contracts;
        else if (currentView === 'SRV_NF') rawItems = invoices;
        else if (currentView === 'SRV_CATALOG') rawItems = serviceItems.filter(i => catalogTab === 'ALL' || i.type === catalogTab);

        const filtered = filteredItemsBySearch(rawItems);

        if (filtered.length === 0) return (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                <Box className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-800">Nenhum registro encontrado</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Tente ajustar sua busca ou adicione um novo item para começar.</p>
            </div>
        );

        if (currentView === 'SRV_CATALOG') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group overflow-hidden">
                            <div className={`h-1.5 w-full ${item.type === 'PRODUCT' ? 'bg-amber-400' : 'bg-indigo-500'}`}></div>
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`p-2 rounded-xl shrink-0 ${item.type === 'PRODUCT' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {item.type === 'PRODUCT' ? <Box className="w-5 h-5"/> : <Wrench className="w-5 h-5"/>}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(item)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Wrench className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1 line-clamp-1">{item.name}</h3>
                                <p className="text-xs text-gray-500 mb-4 line-clamp-2 min-h-[2.5em]">{item.description || 'Sem descrição'}</p>
                                <div className="mt-auto pt-4 border-t border-dashed border-gray-100">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Preço Venda</p>
                                    <p className="text-xl font-extrabold text-gray-900">{formatCurrency(item.defaultPrice)}</p>
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
                    <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-gray-800 truncate">{item.description || item.title || `Item #${item.id.substring(0,4)}`}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {item.contactName || 'Sem contato'}</span>
                                    {item.createdByName && (
                                        <span className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full flex items-center gap-1" title={`Criado por ${item.createdByName}`}>
                                            <UserCircle className="w-2.5 h-2.5" /> {item.createdByName.split(' ')[0]}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(item.status)}`}>
                                {getStatusLabel(item.status)}
                            </span>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Valor Bruto</span>
                                <span className="text-gray-700">{formatCurrency(item.grossAmount || item.amount)}</span>
                            </div>
                            {(item.discountAmount > 0) && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-rose-500">Desconto (-)</span>
                                    <span className="text-rose-600">-{formatCurrency(item.discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1">
                                <span className="text-gray-800">Líquido</span>
                                <span className={currentView === 'SRV_PURCHASES' ? 'text-rose-600' : 'text-emerald-600'}>{formatCurrency(item.amount)}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-400">
                             <span>{formatDate(item.date || item.startDate || item.issueDate)}</span>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600 transition-colors"><Wrench className="w-4 h-4"/></button>
                                {(item.status === 'DRAFT' || item.status === 'APPROVED' || item.status === 'OPEN') && (
                                    <button onClick={() => handleGenerateTransaction(item)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Gerar Lançamento Financeiro">
                                        <DollarSign className="w-4 h-4"/>
                                    </button>
                                )}
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
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl p-8 max-h-[95vh] overflow-y-auto animate-scale-up">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2"><Calculator className="w-6 h-6 text-indigo-600"/> {formData.id ? 'Editar ' : 'Novo '} {header.label}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    {(currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') ? (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <h3 className="font-bold text-gray-700 flex items-center gap-2 uppercase tracking-wider text-xs">
                                                    <Box className="w-4 h-4 text-indigo-500"/> Itens do Orçamento
                                                </h3>
                                                <div className="flex gap-2">
                                                    <select className="border border-gray-200 rounded-lg p-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => { if(e.target.value) handleAddItem(e.target.value); e.target.value = ''; }}>
                                                        <option value="">+ Catálogo</option>
                                                        {serviceItems.map(i => <option key={i.id} value={i.id}>{i.name} ({formatCurrency(i.defaultPrice)})</option>)}
                                                    </select>
                                                    <button type="button" onClick={() => handleAddItem()} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">+ Item Avulso</button>
                                                </div>
                                            </div>
                                            <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-inner">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-gray-100/80 text-[10px] uppercase font-bold text-gray-500 border-b border-gray-200">
                                                        <tr>
                                                            <th className="px-4 py-3">Descrição do Produto/Serviço</th>
                                                            <th className="px-4 py-3 w-20">Qtd</th>
                                                            <th className="px-4 py-3 w-32">Preço Un.</th>
                                                            <th className="px-4 py-3 w-32">Total</th>
                                                            <th className="px-4 py-3 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {(formData.items || []).map((item: OrderItem) => (
                                                            <tr key={item.id} className="bg-white hover:bg-indigo-50/20 transition-colors">
                                                                <td className="px-4 py-2"><input type="text" value={item.description} onChange={e => handleUpdateItem(item.id, 'description', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-800" placeholder="Nome do item..."/></td>
                                                                <td className="px-4 py-2"><input type="number" value={item.quantity} onChange={e => handleUpdateItem(item.id, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-sm" min="1"/></td>
                                                                <td className="px-4 py-2"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold"/></td>
                                                                <td className="px-4 py-2 text-sm font-bold text-gray-900">{formatCurrency(item.totalPrice)}</td>
                                                                <td className="px-4 py-2 text-right"><button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button></td>
                                                            </tr>
                                                        ))}
                                                        {(formData.items || []).length === 0 && (<tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-xs italic">Clique em "Adicionar Item" para compor seu orçamento.</td></tr>)}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    ) : currentView === 'SRV_CATALOG' ? (
                                        <div className="space-y-4 max-w-2xl mx-auto">
                                            <div className="flex bg-gray-100 p-1 rounded-xl mb-4 border border-gray-200">
                                                <button type="button" onClick={() => setFormData((prev: any) => ({...prev, type: 'SERVICE'}))} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${formData.type !== 'PRODUCT' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500'}`}>Serviço</button>
                                                <button type="button" onClick={() => setFormData((prev: any) => ({...prev, type: 'PRODUCT'}))} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${formData.type === 'PRODUCT' ? 'bg-white shadow-md text-amber-600' : 'text-gray-500'}`}>Produto</button>
                                            </div>
                                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Nome do Item</label><input type="text" placeholder="Ex: Mouse Sem Fio..." className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Preço de Venda</label><input type="number" step="0.01" placeholder="0,00" className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.defaultPrice || ''} onChange={e => setFormData({...formData, defaultPrice: e.target.value})} required /></div>
                                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Custo Unitário</label><input type="number" step="0.01" placeholder="0,00" className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.costPrice || ''} onChange={e => setFormData({...formData, costPrice: e.target.value})} /></div>
                                            </div>
                                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Descrição</label><textarea placeholder="Detalhes..." className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 max-w-2xl mx-auto">
                                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Título</label><input type="text" placeholder="Ex: Manutenção..." className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.title || formData.description || ''} onChange={e => setFormData({...formData, title: e.target.value, description: e.target.value})} required /></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Valor</label><input type="number" step="0.01" placeholder="0,00" className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.totalAmount || formData.amount || formData.value || ''} onChange={e => setFormData({...formData, totalAmount: e.target.value, amount: e.target.value, value: e.target.value})} /></div>
                                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                                                    <select className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white" value={formData.status || 'OPEN'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                        <option value="OPEN">Aberto / Orçamento</option>
                                                        <option value="IN_PROGRESS">Em Andamento</option>
                                                        <option value="DONE">Concluído</option>
                                                        <option value="CANCELED">Cancelado</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentView !== 'SRV_CATALOG' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {(currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') ? null : (
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título do Pedido</label>
                                                    <input type="text" placeholder="Ex: Projeto Reforma..." className="w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} required />
                                                </div>
                                            )}
                                            
                                            {/* Busca de Contato Inteligente */}
                                            <div className="relative" ref={contactDropdownRef}>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pessoa / Empresa</label>
                                                <div className="relative">
                                                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                                    <input 
                                                        type="text" 
                                                        value={contactSearch} 
                                                        onFocus={() => setShowContactDropdown(true)} 
                                                        onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}} 
                                                        className="w-full pl-9 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-700 bg-white" 
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
                                    )}
                                </div>

                                {/* LADO DIREITO: Resumo Financeiro */}
                                {currentView !== 'SRV_CATALOG' && (
                                    <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex flex-col shadow-inner h-fit">
                                        <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b border-gray-200 pb-2 mb-4"><ReceiptText className="w-4 h-4 text-indigo-500"/> Resumo</h3>
                                        <div className="space-y-4">
                                            {(pricing) ? (
                                                <>
                                                    <div className="space-y-4">
                                                        <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Soma Bruta</label><p className="text-xl font-bold text-gray-800">{formatCurrency(pricing.gross)}</p></div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Desconto (R$)</label><input type="number" step="0.01" className="w-full border border-gray-200 rounded-xl p-2 text-sm text-rose-600 font-bold" value={formData.discountAmount || ''} onChange={e => setFormData({...formData, discountAmount: e.target.value})} /></div>
                                                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Impostos (%)</label><input type="number" className="w-full border border-gray-200 rounded-xl p-2 text-sm text-gray-600" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))} /></div>
                                                        </div>
                                                        <div className="pt-4 border-t border-gray-200 space-y-2">
                                                            <div className="flex justify-between text-2xl font-extrabold text-indigo-700"><span>Líquido</span><span>{formatCurrency(pricing.net)}</span></div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Valor do Registro</label><p className="text-2xl font-extrabold text-indigo-700">{formatCurrency(Number(formData.totalAmount || formData.amount || formData.value || 0))}</p></div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                                                <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Data</label><input type="date" className="w-full border border-gray-200 rounded-xl p-2 text-xs" value={formData.date || formData.startDate || formData.issueDate || ''} onChange={e => setFormData({...formData, date: e.target.value, startDate: e.target.value, issueDate: e.target.value})} required /></div>
                                                <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Status</label>
                                                    <select className="w-full border border-gray-200 rounded-xl p-2 text-xs bg-white" value={formData.status || 'DRAFT'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                        {currentView === 'SRV_OS' ? (
                                                            <><option value="OPEN">Aberto</option><option value="IN_PROGRESS">Em Curso</option><option value="DONE">Concluído</option><option value="CANCELED">Cancelado</option></>
                                                        ) : (
                                                            <><option value="DRAFT">Orçamento</option><option value="APPROVED">Aprovado</option><option value="CONFIRMED">Confirmado</option><option value="CANCELED">Cancelado</option></>
                                                        )}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-bold transition-all">Cancelar</button>
                                <button type="submit" className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all">Salvar {header.label}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesView;
