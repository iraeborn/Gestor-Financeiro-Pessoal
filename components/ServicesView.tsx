
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, 
    TransactionType, TransactionStatus, ServiceItem, OSItem, Category, 
    Account, CompanyProfile, TaxRegime, OSStatus, OSType, OSOrigin, 
    OSPriority, KanbanItem, KanbanColumnConfig, Member, AppSettings, OpticalRx 
} from '../types';
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText, UserCircle, User, Package, Zap, Info, UserCheck, Timer, Layers, ListChecks, RefreshCw, Share2, Send, MessageSquare, FileUp, Download, Monitor, FileSearch, Link2, LayoutGrid, LayoutList, Trello, UserCog, Pencil, Eye, Glasses, Save, ChevronDown, ChevronUp, UploadCloud } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import ApprovalModal from './ApprovalModal';
import { api, getFamilyMembers } from '../services/storageService';
import KanbanBoard from './KanbanBoard';
import { useHelp } from './GuidedHelp';

const OS_KANBAN_COLUMNS: KanbanColumnConfig[] = [
    { id: 'ABERTA', label: 'Backlog', color: 'bg-amber-400', borderColor: 'border-amber-200' },
    { id: 'APROVADA', label: 'Aprovado', color: 'bg-blue-400', borderColor: 'border-blue-200' },
    { id: 'AGENDADA', label: 'Agendado', color: 'bg-indigo-400', borderColor: 'border-indigo-200' },
    { id: 'EM_EXECUCAO', label: 'Em Execução', color: 'bg-emerald-500', borderColor: 'border-emerald-200' },
    { id: 'PAUSADA', label: 'Pausado', color: 'bg-rose-400', borderColor: 'border-rose-200' },
    { id: 'FINALIZADA', label: 'Finalizado', color: 'bg-slate-400', borderColor: 'border-slate-200' }
];

const SALE_KANBAN_COLUMNS: KanbanColumnConfig[] = [
    { id: 'DRAFT', label: 'Rascunho', color: 'bg-slate-400', borderColor: 'border-slate-200' },
    { id: 'APPROVED', label: 'Aprovado', color: 'bg-blue-400', borderColor: 'border-blue-200' },
    { id: 'ON_HOLD', label: 'Em Espera', color: 'bg-amber-400', borderColor: 'border-amber-200' },
    { id: 'CONFIRMED', label: 'Confirmado / Pago', color: 'bg-emerald-500', borderColor: 'border-emerald-200' },
    { id: 'REJECTED', label: 'Recusado', color: 'bg-rose-400', borderColor: 'border-rose-200' }
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
    opticalRxs?: OpticalRx[];
    settings?: AppSettings;
    
    onAddOS: () => void;
    onEditOS: (os: ServiceOrder) => void;
    onAddSale: () => void;
    onEditSale: (sale: CommercialOrder) => void;

    onSaveOS: (os: ServiceOrder, newContact?: Contact) => void;
    onDeleteOS: (id: string) => void;
    onSaveOrder: (o: CommercialOrder, newContact?: Contact) => void;
    onDeleteOrder: (id: string) => void;
    onApproveOrder?: (order: CommercialOrder, approvalData: any) => void;
    onSaveContract: (c: Contract, newContact?: Contact) => void;
    onDeleteContract: (id: string) => void;
    onSaveInvoice: (i: Invoice, newContact?: Contact) => void;
    onDeleteInvoice: (id: string) => void;
    onAddTransaction: (t: any) => void;
    onSaveCatalogItem?: (i: ServiceItem) => void;
    onDeleteCatalogItem?: (id: string) => void;
}

const ServicesView: React.FC<ServicesViewProps> = ({ 
    currentView, serviceOrders, commercialOrders, contracts, invoices, contacts, accounts, companyProfile, serviceItems = [], opticalRxs = [], settings,
    onAddOS, onEditOS, onAddSale, onEditSale,
    onSaveOS, onDeleteOS, onSaveOrder, onDeleteOrder, onSaveContract, onDeleteContract, onSaveInvoice, onDeleteInvoice, onAddTransaction, onSaveCatalogItem, onDeleteCatalogItem, onApproveOrder
}) => {
    const isCatalog = currentView === 'SRV_CATALOG';
    const isOS = currentView === 'SRV_OS' || currentView === 'OPTICAL_LAB';
    const isSales = currentView === 'SRV_SALES' || currentView === 'OPTICAL_SALES';
    const isOpticalContext = currentView === 'OPTICAL_SALES' || currentView === 'OPTICAL_LAB';

    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [catalogTab, setCatalogTab] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
    const [viewType, setViewType] = useState<'GRID' | 'LIST' | 'KANBAN'>((isOS || isSales) ? 'KANBAN' : 'GRID');
    
    const [formData, setFormData] = useState<Partial<ServiceItem>>({
        type: 'PRODUCT',
        defaultPrice: 0,
        costPrice: 0,
        isComposite: false,
        items: [],
        moduleTag: isOpticalContext ? 'optical' : 'general',
        imageUrl: ''
    });

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const formatCurrency = (val: number | undefined | null) => {
        const amount = typeof val === 'number' ? val : 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setIsUploading(true);
        try {
            const token = localStorage.getItem('token');
            const uploadData = new FormData();
            uploadData.append('files', e.target.files[0]);

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: uploadData
            });

            if (!res.ok) throw new Error("Falha no upload");
            const { urls } = await res.json();
            setFormData(prev => ({ ...prev, imageUrl: urls[0] }));
            showAlert("Imagem enviada!", "success");
        } catch (err) {
            showAlert("Erro ao subir imagem.", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddComponent = (itemId: string) => {
        const itemToAdd = serviceItems.find(i => i.id === itemId);
        if (!itemToAdd) return;

        const newComponent: OSItem = {
            id: crypto.randomUUID(),
            serviceItemId: itemToAdd.id,
            description: itemToAdd.name,
            quantity: 1,
            unitPrice: itemToAdd.defaultPrice,
            totalPrice: itemToAdd.defaultPrice,
            costPrice: itemToAdd.costPrice || 0
        };

        const updatedItems = [...(formData.items || []), newComponent];
        const newCost = updatedItems.reduce((acc, i) => acc + ((i.costPrice || 0) * i.quantity), 0);
        setFormData({ ...formData, items: updatedItems, costPrice: newCost });
    };

    const handleRemoveComponent = (compId: string) => {
        const updatedItems = (formData.items || []).filter(i => i.id !== compId);
        const newCost = updatedItems.reduce((acc, i) => acc + ((i.costPrice || 0) * i.quantity), 0);
        setFormData({ ...formData, items: updatedItems, costPrice: newCost });
    };

    const handleUpdateComponentQty = (compId: string, qty: number) => {
        const updatedItems = (formData.items || []).map(i => {
            if (i.id === compId) {
                return { ...i, quantity: qty, totalPrice: qty * i.unitPrice };
            }
            return i;
        });
        const newCost = updatedItems.reduce((acc, i) => acc + ((i.costPrice || 0) * i.quantity), 0);
        setFormData({ ...formData, items: updatedItems, costPrice: newCost });
    };

    const handleOSStatusUpdate = async (itemId: string, newStatus: string) => {
        const os = serviceOrders.find(o => o.id === itemId);
        if (!os) return;
        onSaveOS({ ...os, status: newStatus as OSStatus });
    };

    const handleSaleStatusUpdate = async (itemId: string, newStatus: string) => {
        const order = commercialOrders.find(o => o.id === itemId);
        if (!order) return;
        onSaveOrder({ ...order, status: newStatus as any });
    };

    const header = useMemo(() => {
        if (isOpticalContext) {
            return currentView === 'OPTICAL_SALES' 
                ? { title: 'Venda de Óculos', icon: Glasses, label: 'Venda' }
                : { title: 'Laboratório (OS)', icon: Monitor, label: 'OS' };
        }
        switch(currentView) {
            case 'SRV_OS': return { title: 'Ordens de Serviço', icon: Wrench, label: 'OS' };
            case 'SRV_SALES': return { title: 'Vendas e Orçamentos', icon: ShoppingBag, label: 'Venda' };
            case 'SRV_CATALOG': return { title: 'Produtos e Serviços', icon: Package, label: 'Item' };
            case 'SRV_CONTRACTS': return { title: 'Contratos', icon: FileSignature, label: 'Contrato' };
            case 'SRV_NF': return { title: 'Notas Fiscais', icon: FileText, label: 'Nota' };
            default: return { title: 'Serviços', icon: Wrench, label: 'Item' };
        }
    }, [currentView, isOpticalContext]);

    const handleOpenAction = (item?: any) => {
        if (isCatalog) {
            if (item) setFormData({ ...item, items: item.items || [], isComposite: item.isComposite || false });
            else setFormData({ type: 'PRODUCT', defaultPrice: 0, costPrice: 0, isComposite: false, items: [], moduleTag: 'general', imageUrl: '' });
            setIsModalOpen(true);
        } else if (isOS) {
            if (item) onEditOS(item);
            else onAddOS();
        } else if (isSales) {
            if (item) onEditSale(item);
            else onAddSale();
        }
    };

    const handleDeleteRecord = async (type: string, id: string, title?: string) => {
        const confirm = await showConfirm({
            title: "Excluir Registro",
            message: `Tem certeza que deseja remover "${title || 'este registro'}"?`,
            variant: "danger"
        });

        if (confirm) {
            if (type === 'CATALOG' && onDeleteCatalogItem) onDeleteCatalogItem(id);
            else if (type === 'OS') onDeleteOS(id);
            else if (type === 'SALE') onDeleteOrder(id);
        }
    };

    const handleSaveCatalog = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return showAlert("O nome é obrigatório", "warning");
        if (onSaveCatalogItem) {
            onSaveCatalogItem({ ...formData, id: formData.id || crypto.randomUUID() } as ServiceItem);
            setIsModalOpen(false);
        }
    };

    const renderGridContent = () => {
        let rawItems: any[] = [];
        if (isOS) rawItems = serviceOrders;
        else if (isSales) rawItems = commercialOrders.filter(o => o.type === 'SALE');
        else if (isCatalog) {
            rawItems = serviceItems.filter(i => catalogTab === 'ALL' || i.type === catalogTab);
        }

        const filtered = rawItems.filter(i => {
            const text = (i.title || i.description || i.name || i.code || i.brand || '').toLowerCase();
            const contact = (i.contactName || '').toLowerCase();
            const term = searchTerm.toLowerCase();
            return text.includes(term) || contact.includes(term);
        });
        
        if (filtered.length === 0) return (
            <div className="bg-white rounded-[2.5rem] p-20 text-center border border-gray-100 shadow-sm mx-auto max-w-4xl animate-fade-in">
                <Box className="w-20 h-20 text-gray-100 mx-auto mb-6" />
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Vazio por aqui</h3>
                <p className="text-gray-400 font-medium max-w-xs mx-auto mt-2">Nenhum registro encontrado. Comece clicando no botão "Novo".</p>
            </div>
        );

        if (isOS && viewType === 'KANBAN') {
            const kanbanItems: KanbanItem[] = filtered.map(os => ({
                id: os.id, title: os.title, subtitle: os.contactName || 'Sem cliente',
                status: os.status, priority: os.priority, amount: os.totalAmount,
                date: os.openedAt, tags: [os.type], assigneeName: os.assigneeName, raw: os
            }));
            return <KanbanBoard items={kanbanItems} columns={OS_KANBAN_COLUMNS} onItemClick={handleOpenAction} onStatusChange={handleOSStatusUpdate} />;
        }

        if (isSales && viewType === 'KANBAN') {
            const kanbanItems: KanbanItem[] = filtered.map(o => ({
                id: o.id, title: o.description, subtitle: o.contactName || 'Sem cliente',
                status: o.status, amount: o.amount, date: o.date, tags: [o.type],
                assigneeName: o.assigneeName, raw: o
            }));
            return <KanbanBoard items={kanbanItems} columns={SALE_KANBAN_COLUMNS} onItemClick={handleOpenAction} onStatusChange={handleSaleStatusUpdate} />;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1">
                {filtered.map(item => (
                    <div key={item.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col h-full">
                        {isCatalog && (
                            <div className="aspect-square relative bg-slate-50 overflow-hidden border-b border-gray-50 flex items-center justify-center">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 opacity-20">
                                        {item.type === 'PRODUCT' ? <Package className="w-12 h-12" /> : <Zap className="w-12 h-12" />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">Sem Imagem</span>
                                    </div>
                                )}
                                <div className="absolute top-4 left-4">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm border ${item.isComposite ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-100'}`}>
                                        {item.isComposite ? 'Kit / Combo' : (item.type === 'PRODUCT' ? 'Produto' : 'Serviço')}
                                    </span>
                                </div>
                            </div>
                        )}
                        
                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">#{item.id.substring(0,4)}</span>
                                {isCatalog && item.code && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Ref: {item.code}</span>}
                            </div>
                            <h3 className="font-bold text-gray-800 leading-tight line-clamp-2 text-lg mb-2">{item.name || item.title || item.description}</h3>
                            {isCatalog && item.description && <p className="text-xs text-gray-400 line-clamp-2 font-medium">{item.description}</p>}
                        </div>
                        
                        <div className="px-6 py-5 border-t border-gray-50 flex justify-between items-center bg-gray-50/20 mt-auto">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Preço Sugerido</span>
                                <div className="text-xl font-black text-gray-900">{formatCurrency(item.defaultPrice || item.amount || item.totalAmount)}</div>
                            </div>
                            <div className="flex gap-1.5">
                                <button onClick={() => handleOpenAction(item)} className="p-2.5 text-indigo-600 bg-white border border-gray-100 shadow-sm hover:bg-indigo-50 rounded-xl transition-all"><Pencil className="w-4 h-4"/></button>
                                <button onClick={() => handleDeleteRecord(isCatalog ? 'CATALOG' : (isOS ? 'OS' : 'SALE'), item.id, item.name || item.title)} className="p-2.5 text-rose-500 bg-white border border-gray-100 shadow-sm hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10 flex flex-col h-full">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 px-1">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <header.icon className="w-6 h-6 text-indigo-600" />
                        {header.title}
                    </h1>
                    <p className="text-gray-500 font-medium">Gestão operacional de itens e fluxos.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm" />
                    </div>
                    <button onClick={() => handleOpenAction()} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">
                        <Plus className="w-4 h-4" /> Novo {header.label}
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center px-1 shrink-0">
                <div className="flex bg-gray-200/50 p-1.5 rounded-[1.5rem] w-fit border border-gray-100 shadow-sm">
                    {isCatalog ? (
                        <>
                            {[{id:'ALL',label:'Categorias'},{id:'PRODUCT',label:'Produtos'},{id:'SERVICE',label:'Serviços'}].map(t=>(
                                <button key={t.id} onClick={()=>setCatalogTab(t.id as any)} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${catalogTab===t.id?'bg-white text-indigo-600 shadow-md':'text-gray-500'}`}>{t.label}</button>
                            ))}
                        </>
                    ) : (
                        <>
                            <button onClick={()=>setViewType('KANBAN')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewType==='KANBAN'?'bg-white text-indigo-600 shadow-md':'text-gray-500'}`}><Trello className="w-4 h-4" /> Kanban</button>
                            <button onClick={()=>setViewType('GRID')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewType==='GRID'?'bg-white text-indigo-600 shadow-md':'text-gray-500'}`}><LayoutGrid className="w-4 h-4" /> Lista</button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">{renderGridContent()}</div>
            
            {/* Modal de Catálogo (Produtos e Serviços) */}
            {isModalOpen && isCatalog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl p-10 animate-scale-up border border-slate-100 overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3"><Package className="w-6 h-6 text-indigo-600" /> Gerenciar Item de Catálogo</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-6 h-6"/></button>
                        </div>
                        <form onSubmit={handleSaveCatalog} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Upload de Foto */}
                                <div className="md:col-span-1">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 ml-1 tracking-widest">Foto do Produto</label>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`aspect-square rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group ${formData.imageUrl ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-400 bg-gray-50'}`}
                                    >
                                        {formData.imageUrl ? (
                                            <>
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-indigo-600/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <UploadCloud className="w-8 h-8 text-white" />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {isUploading ? <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /> : <ImageIcon className="w-8 h-8 text-gray-300" />}
                                                <span className="text-[10px] font-black uppercase text-gray-400 mt-2">{isUploading ? 'Enviando...' : 'Clique para subir'}</span>
                                            </>
                                        )}
                                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                                    </div>
                                    <p className="text-[9px] text-gray-400 text-center mt-3 font-medium uppercase italic">Dica: Fotos reais aumentam a confiança do cliente na hora da escolha.</p>
                                </div>

                                <div className="md:col-span-2 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome do Produto ou Serviço</label>
                                            <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ex: Armação Ray-Ban Aviador" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Tipo de Item</label>
                                            <select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                                                <option value="PRODUCT">📦 Produto / Mercadoria</option>
                                                <option value="SERVICE">🛠️ Serviço / Mão de Obra</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Código / Ref Interna</label>
                                            <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="SKU-001" />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-4 h-4 text-amber-500" />
                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Estrutura de Composição</span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={formData.isComposite} onChange={e => setFormData({...formData, isComposite: e.target.checked, items: e.target.checked ? formData.items : []})} />
                                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                                <span className="ml-3 text-xs font-bold text-slate-600">Item Composto (Kit/Combo)</span>
                                            </label>
                                        </div>

                                        {formData.isComposite && (
                                            <div className="space-y-4 animate-fade-in">
                                                <div className="flex gap-2">
                                                    <select 
                                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                                        onChange={(e) => { if(e.target.value) handleAddComponent(e.target.value); e.target.value = ''; }}
                                                    >
                                                        <option value="">Selecionar componente p/ kit...</option>
                                                        {serviceItems.filter(i => i.id !== formData.id && !i.isComposite).map(i => (
                                                            <option key={i.id} value={i.id}>{i.name} (Custo: {formatCurrency(i.costPrice)})</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-slate-100 text-slate-500 font-black uppercase text-[9px] border-b border-slate-200">
                                                            <tr>
                                                                <th className="p-3">Componente</th>
                                                                <th className="p-3 text-center">Qtd</th>
                                                                <th className="p-3 text-right">Custo Unit</th>
                                                                <th className="p-3 text-right">Ações</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {(formData.items || []).map(comp => (
                                                                <tr key={comp.id}>
                                                                    <td className="p-3 font-bold text-slate-700">{comp.description}</td>
                                                                    <td className="p-3 text-center">
                                                                        <input 
                                                                            type="number" 
                                                                            className="w-12 text-center border-none bg-slate-50 rounded p-1 font-black" 
                                                                            value={comp.quantity} 
                                                                            onChange={e => handleUpdateComponentQty(comp.id, Number(e.target.value))}
                                                                        />
                                                                    </td>
                                                                    <td className="p-3 text-right font-medium text-slate-400">{formatCurrency(comp.costPrice)}</td>
                                                                    <td className="p-3 text-right">
                                                                        <button type="button" onClick={() => handleRemoveComponent(comp.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {(!formData.items || formData.items.length === 0) && (
                                                                <tr><td colSpan={4} className="p-6 text-center text-slate-300 italic">Adicione produtos para formar este kit.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-indigo-400 mb-2 ml-1">Preço Sugerido de Venda (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-4 w-4 h-4 text-indigo-400" />
                                        <input type="number" step="0.01" className="w-full pl-11 py-4 bg-white border-none rounded-2xl text-xl font-black text-indigo-700 outline-none shadow-sm focus:ring-2 focus:ring-indigo-500" value={formData.defaultPrice} onChange={e => setFormData({...formData, defaultPrice: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-rose-400 mb-2 ml-1">Custo Médio {formData.isComposite ? '(Automático)' : ''} (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-4 w-4 h-4 text-rose-400" />
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            readOnly={formData.isComposite}
                                            className={`w-full pl-11 py-4 rounded-2xl text-xl font-black text-rose-700 outline-none shadow-sm ${formData.isComposite ? 'bg-slate-100 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-rose-500'}`} 
                                            value={formData.costPrice} 
                                            onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-gray-600 transition-colors">Descartar</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-indigo-700"><Save className="w-4 h-4" /> Salvar Item no Catálogo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesView;
