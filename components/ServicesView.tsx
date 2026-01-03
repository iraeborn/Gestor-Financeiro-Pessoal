
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, 
    TransactionType, TransactionStatus, ServiceItem, OSItem, Category, 
    Account, CompanyProfile, TaxRegime, OSStatus, OSType, OSOrigin, 
    OSPriority, KanbanItem, KanbanColumnConfig, Member, AppSettings, OpticalRx 
} from '../types';
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText, UserCircle, User, Package, Zap, Info, UserCheck, Timer, Layers, ListChecks, RefreshCw, Share2, Send, MessageSquare, FileUp, Download, Monitor, FileSearch, Link2, LayoutGrid, LayoutList, Trello, UserCog, Pencil, Eye, Glasses } from 'lucide-react';
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
    const isNF = currentView === 'SRV_NF';
    const isOpticalContext = currentView === 'OPTICAL_SALES' || currentView === 'OPTICAL_LAB';

    // Fix: Corrected useAlert/useConfirm usage. Property 'showConfirm' is part of useConfirm hook result.
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [catalogTab, setCatalogTab] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
    const [viewType, setViewType] = useState<'GRID' | 'LIST' | 'KANBAN'>((isOS || isSales) ? 'KANBAN' : 'GRID');
    const [compositionFilter, setCompositionFilter] = useState<'ALL' | 'SIMPLE' | 'COMPOSITE'>('ALL');
    const [formData, setFormData] = useState<any>({}); 
    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [selectedOrderForApproval, setSelectedOrderForApproval] = useState<CommercialOrder | null>(null);

    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const formatCurrency = (val: number | undefined | null) => {
        const amount = typeof val === 'number' ? val : 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    };

    const handleOSStatusUpdate = async (itemId: string, newStatus: string) => {
        const os = serviceOrders.find(o => o.id === itemId);
        if (!os) return;
        onSaveOS({ ...os, status: newStatus as OSStatus });
        showAlert(`OS #${os.id.substring(0,6)} movida para ${newStatus}`, "info");
    };

    const handleSaleStatusUpdate = async (itemId: string, newStatus: string) => {
        const order = commercialOrders.find(o => o.id === itemId);
        if (!order) return;
        onSaveOrder({ ...order, status: newStatus as any });
        showAlert(`Pedido #${order.id.substring(0,6)} movido para ${newStatus}`, "info");
    };

    const getTitle = () => {
        if (isOpticalContext) {
            return currentView === 'OPTICAL_SALES' 
                ? { title: 'Venda de Óculos', icon: Glasses, label: 'Venda' }
                : { title: 'Lab (Montagem)', icon: Monitor, label: 'OS' };
        }
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

    const handleOpenAction = (item?: any) => {
        if (isOS) {
            if (item) onEditOS(item);
            else onAddOS();
        } else if (isSales) {
            if (item) onEditSale(item);
            else onAddSale();
        } else {
            // Outros itens que ainda usam modal (Catálogo, Contratos, NF)
            if (item) {
                if (item.contactId) {
                    const c = contacts.find(c => c.id === item.contactId);
                    setContactSearch(c ? c.name : '');
                } else if (item.contactName) setContactSearch(item.contactName);
                else setContactSearch('');
                setFormData(item);
            } else {
                setContactSearch('');
                setFormData({});
            }
            setIsModalOpen(true);
        }
    };

    const handleDeleteRecord = async (type: string, id: string, title?: string) => {
        const confirm = await showConfirm({
            title: "Excluir Registro",
            message: `Tem certeza que deseja remover "${title || 'este registro'}"? Esta operação não pode ser desfeita.`,
            variant: "danger",
            confirmText: "Sim, Excluir"
        });

        if (confirm) {
            if (type === 'OS') onDeleteOS(id);
            else if (type === 'SALE' || type === 'PURCHASE') onDeleteOrder(id);
            else if (type === 'CONTRACT') onDeleteContract(id);
            else if (type === 'INVOICE') onDeleteInvoice(id);
            else if (type === 'CATALOG' && onDeleteCatalogItem) onDeleteCatalogItem(id);
        }
    };

    // Fix: Implemented handleSave to process submissions for NF, Contracts and Catalog items
    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const id = formData.id || crypto.randomUUID();
        
        if (isCatalog && onSaveCatalogItem) {
            onSaveCatalogItem({ ...formData, id });
        } else if (currentView === 'SRV_CONTRACTS') {
            onSaveContract({ ...formData, id } as Contract);
        } else if (currentView === 'SRV_NF') {
            onSaveInvoice({ ...formData, id } as Invoice);
        }
        
        setIsModalOpen(false);
        setFormData({});
        showAlert("Registro salvo com sucesso!", "success");
    };

    const getOSStatusColor = (status: string) => {
        switch(status) {
            case 'ABERTA': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'APROVADA': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'AGENDADA': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'EM_EXECUCAO': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'PAUSADA': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'FINALIZADA': return 'bg-slate-200 text-slate-700 border-slate-300';
            case 'DRAFT': return 'bg-slate-100 text-slate-600';
            case 'APPROVED': return 'bg-blue-100 text-blue-700';
            case 'CONFIRMED': return 'bg-emerald-100 text-emerald-700';
            case 'REJECTED': return 'bg-rose-100 text-rose-700';
            case 'ON_HOLD': return 'bg-amber-100 text-amber-700';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const renderGridContent = () => {
        let rawItems: any[] = [];
        if (isOS) rawItems = serviceOrders;
        else if (currentView === 'SRV_SALES' || currentView === 'OPTICAL_SALES') rawItems = commercialOrders.filter(o => o.type === 'SALE');
        else if (currentView === 'SRV_PURCHASES') rawItems = commercialOrders.filter(o => o.type === 'PURCHASE');
        else if (currentView === 'SRV_CONTRACTS') rawItems = contracts;
        else if (currentView === 'SRV_NF') rawItems = invoices;
        else if (isCatalog) {
            rawItems = serviceItems.filter(i => {
                const typeMatch = catalogTab === 'ALL' || i.type === catalogTab;
                const compositeMatch = compositionFilter === 'ALL' || (compositionFilter === 'COMPOSITE' ? i.isComposite : !i.isComposite);
                return typeMatch && compositeMatch;
            });
        }

        const filtered = rawItems.filter(i => {
            if (isOpticalContext && i.moduleTag !== 'optical') return false;
            if (!isOpticalContext && i.moduleTag === 'optical' && (currentView === 'SRV_SALES' || currentView === 'SRV_OS')) return false;

            const text = (i.title || i.description || i.name || i.code || i.brand || i.number || '').toLowerCase();
            const contact = (i.contactName || '').toLowerCase();
            const term = searchTerm.toLowerCase();
            return text.includes(term) || contact.includes(term);
        });
        
        if (filtered.length === 0) return <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm mx-auto max-w-4xl"><Box className="w-16 h-16 text-gray-200 mx-auto mb-4" /><h3 className="text-lg font-bold text-gray-800">Nenhum registro encontrado</h3><p className="text-gray-500 max-w-sm mx-auto">Tente ajustar sua busca ou adicione um novo item.</p></div>;
        
        if (isOS && viewType === 'KANBAN') {
            const kanbanItems: KanbanItem[] = filtered.map(os => ({
                id: os.id, title: os.title, subtitle: os.contactName || 'Sem cliente',
                status: os.status, priority: os.priority, amount: os.totalAmount,
                date: os.openedAt, tags: [os.type, os.origin], assigneeName: os.assigneeName, raw: os
            }));
            return <div className="w-full h-full overflow-hidden"><KanbanBoard items={kanbanItems} columns={OS_KANBAN_COLUMNS} onItemClick={handleOpenAction} onStatusChange={handleOSStatusUpdate} /></div>;
        }

        if (isSales && viewType === 'KANBAN') {
            const kanbanItems: KanbanItem[] = filtered.map(o => ({
                id: o.id, title: o.description, subtitle: o.contactName || 'Sem cliente',
                status: o.status, amount: o.amount, date: o.date, tags: [o.type],
                assigneeName: o.assigneeName, raw: o
            }));
            return <div className="w-full h-full overflow-hidden"><KanbanBoard items={kanbanItems} columns={SALE_KANBAN_COLUMNS} onItemClick={handleOpenAction} onStatusChange={handleSaleStatusUpdate} /></div>;
        }

        if ((isOS || isSales) && viewType === 'GRID') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.map(item => {
                        const isOrder = 'amount' in item;
                        const title = isOrder ? item.description : item.title;
                        const number = isOrder ? item.id.substring(0,6) : (item.number || item.id.substring(0,4));
                        const val = isOrder ? item.amount : item.totalAmount;
                        
                        return (
                            <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{isOrder ? 'Venda' : 'OS'} #{number}</span>
                                            <h3 className="font-bold text-gray-800 leading-tight line-clamp-2">{title}</h3>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getOSStatusColor(item.status)}`}>{item.status}</span>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-gray-600"><User className="w-3 h-3 text-gray-400" /><span className="font-medium truncate">{item.contactName || 'Consumidor'}</span></div>
                                        {item.assigneeName && <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-bold bg-emerald-50 w-fit px-2 py-0.5 rounded uppercase tracking-tighter"><UserCog className="w-2.5 h-2.5" />{item.assigneeName}</div>}
                                    </div>
                                </div>
                                <div className="px-5 py-4 border-t border-gray-50 flex justify-between items-center bg-gray-50/30">
                                    <div className="text-sm font-black text-gray-900">{formatCurrency(val)}</div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleOpenAction(item)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><Pencil className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteRecord(isOrder ? (item.type === 'SALE' ? 'SALE' : 'PURCHASE') : 'OS', item.id, title)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(item => {
                    const itemTitle = item.description || item.title || item.name;
                    return (
                        <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group flex flex-col h-full">
                             <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col overflow-hidden">
                                    <div className="flex items-center gap-2"><span className="font-bold text-gray-800 truncate">{itemTitle}</span>{item.isComposite && <span title="Item Composto / Kit"><Layers className="w-3 h-3 text-indigo-500" /></span>}</div>
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {item.contactName || (isCatalog ? 'Item de Catálogo' : 'Venda')}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getOSStatusColor(item.status)}`}>{item.status}</span>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm font-black text-gray-900 mt-auto pt-3 border-t border-gray-50">
                                 <span>{formatCurrency(item.amount || item.value || item.defaultPrice)}</span>
                                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenAction(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600"><Wrench className="w-4 h-4"/></button>
                                    <button onClick={() => handleDeleteRecord(isCatalog ? 'CATALOG' : (isSales ? 'SALE' : 'CONTRACT'), item.id, itemTitle)} className="p-1.5 text-gray-400 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                                 </div>
                            </div>
                        </div>
                    )})}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10 w-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-1 shrink-0">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><header.icon className="w-6 h-6 text-indigo-600" /> {header.title}</h1>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" /></div>
                    <button onClick={() => handleOpenAction()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"><Plus className="w-4 h-4" /> Novo {header.label}</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 px-1 shrink-0">
                <div className="flex gap-3">
                    {isCatalog && <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">{[{id:'ALL',label:'Categorias'},{id:'PRODUCT',label:'Produtos'},{id:'SERVICE',label:'Serviços'}].map(t=>(<button key={t.id} onClick={()=>setCatalogTab(t.id as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab===t.id?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}>{t.label}</button>))}</div>}
                    {(isOS || isSales) && (
                        <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">
                            <button onClick={()=>setViewType('KANBAN')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewType==='KANBAN'?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}><Trello className="w-3.5 h-3.5" /> Kanban</button>
                            <button onClick={()=>setViewType('GRID')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewType==='GRID'?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}><LayoutGrid className="w-3.5 h-3.5" /> Cards</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">{renderGridContent()}</div>
            
            {/* Modal Simples (NF, Contratos, etc) - OS e Vendas agora são páginas */}
            {isModalOpen && !isOS && !isSales && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Gerenciar {header.label}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(e); }} className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Título</label><input type="text" className="w-full border rounded-xl p-3 text-sm font-bold" value={formData.title || formData.description || ''} onChange={e => setFormData({...formData, title: e.target.value, description: e.target.value})} required /></div>
                            <div className="flex gap-4"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold uppercase text-[10px]">Cancelar</button><button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg">Salvar</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesView;
