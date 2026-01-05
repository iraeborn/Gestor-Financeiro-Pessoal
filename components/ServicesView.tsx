
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, 
    TransactionType, TransactionStatus, ServiceItem, OSItem, Category, 
    Account, CompanyProfile, TaxRegime, OSStatus, OSType, OSOrigin, 
    OSPriority, KanbanItem, KanbanColumnConfig, Member, AppSettings, OpticalRx 
} from '../types';
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText, UserCircle, User, Package, Zap, Info, UserCheck, Timer, Layers, ListChecks, RefreshCw, Share2, Send, MessageSquare, FileUp, Download, Monitor, FileSearch, Link2, LayoutGrid, LayoutList, Trello, UserCog, Pencil, Eye, Glasses, Save } from 'lucide-react';
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
        moduleTag: isOpticalContext ? 'optical' : 'general'
    });

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
            if (item) setFormData(item);
            else setFormData({ type: 'PRODUCT', defaultPrice: 0, costPrice: 0, moduleTag: 'general' });
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
            showAlert("Item do catálogo salvo!", "success");
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map(item => (
                    <div key={item.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col h-full">
                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{item.type || 'Ref'} #{item.id.substring(0,4)}</span>
                                    <h3 className="font-bold text-gray-800 leading-tight line-clamp-2">{item.name || item.title || item.description}</h3>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase bg-gray-100 text-gray-600`}>{item.status || (item.type === 'PRODUCT' ? 'Produto' : 'Serviço')}</span>
                            </div>
                            
                            {isCatalog && (
                                <div className="space-y-2 mb-4">
                                    <p className="text-xs text-gray-500 line-clamp-2">{item.description || 'Sem descrição cadastrada.'}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-gray-400 uppercase">Custo: {formatCurrency(item.costPrice)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-50 flex justify-between items-center bg-gray-50/30 mt-auto">
                            <div className="text-lg font-black text-gray-900">{formatCurrency(item.defaultPrice || item.amount || item.totalAmount)}</div>
                            <div className="flex gap-1">
                                <button onClick={() => handleOpenAction(item)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors"><Pencil className="w-4 h-4"/></button>
                                <button onClick={() => handleDeleteRecord(isCatalog ? 'CATALOG' : (isOS ? 'OS' : 'SALE'), item.id, item.name || item.title)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors"><Trash2 className="w-4 h-4"/></button>
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
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl p-10 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3"><Package className="w-6 h-6 text-indigo-600" /> Gerenciar Item de Catálogo</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-6 h-6"/></button>
                        </div>
                        <form onSubmit={handleSaveCatalog} className="space-y-6">
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-indigo-400 mb-2 ml-1">Preço de Venda (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-4 w-4 h-4 text-indigo-400" />
                                        <input type="number" step="0.01" className="w-full pl-11 py-4 bg-white border-none rounded-xl text-lg font-black text-indigo-700 outline-none shadow-sm" value={formData.defaultPrice} onChange={e => setFormData({...formData, defaultPrice: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-rose-400 mb-2 ml-1">Preço de Custo (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-4 w-4 h-4 text-rose-400" />
                                        <input type="number" step="0.01" className="w-full pl-11 py-4 bg-white border-none rounded-xl text-lg font-black text-rose-700 outline-none shadow-sm" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Cancelar</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Salvar no Catálogo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesView;
