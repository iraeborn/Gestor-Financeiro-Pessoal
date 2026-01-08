
import React, { useState, useMemo, useRef } from 'react';
import { 
    ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, 
    ServiceItem, OSItem, Category, Account, OSStatus, KanbanItem, KanbanColumnConfig, 
    Branch, StockTransfer
} from '../types';
import { 
    Wrench, ShoppingBag, Plus, Search, Trash2, Box, Tag, 
    ArrowRight, ImageIcon, Save, X, DollarSign, Calendar, 
    ShieldCheck, ArrowLeftRight, Settings, Loader2, UploadCloud, 
    Store, Zap, Info, LayoutGrid, Trello, Pencil
} from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import { api } from '../services/storageService';
import KanbanBoard from './KanbanBoard';

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
    contacts: Contact[];
    accounts: Account[];
    branches: Branch[];
    serviceItems?: ServiceItem[];
    onAddOS: () => void;
    onEditOS: (os: ServiceOrder) => void;
    onAddSale: () => void;
    onEditSale: (sale: CommercialOrder) => void;
    onSaveOS: (os: ServiceOrder) => void;
    onDeleteOS: (id: string) => void;
    onSaveOrder: (o: CommercialOrder) => void;
    onDeleteOrder: (id: string) => void;
    onAddCatalogItem?: () => void;
    onEditCatalogItem?: (i: ServiceItem) => void;
    onDeleteCatalogItem?: (id: string) => void;
}

const ServicesView: React.FC<ServicesViewProps> = ({ 
    currentView, serviceOrders, commercialOrders, contacts, accounts, branches, serviceItems = [], 
    onAddOS, onEditOS, onAddSale, onEditSale, onSaveOS, onDeleteOS, onSaveOrder, onDeleteOrder, 
    onAddCatalogItem, onEditCatalogItem, onDeleteCatalogItem
}) => {
    const isCatalog = currentView === 'SRV_CATALOG';
    const isOS = currentView === 'SRV_OS' || currentView === 'OPTICAL_LAB';
    const isSales = currentView === 'SRV_SALES' || currentView === 'OPTICAL_SALES';

    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [catalogTab, setCatalogTab] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
    const [viewType, setViewType] = useState<'GRID' | 'KANBAN'>((isOS || isSales) ? 'KANBAN' : 'GRID');
    
    const [transferData, setTransferData] = useState<Partial<StockTransfer>>({
        date: new Date().toISOString().split('T')[0], quantity: 0
    });

    const handleOpenAction = (item?: any) => {
        if (isCatalog) {
            if (item && onEditCatalogItem) onEditCatalogItem(item);
            else if (onAddCatalogItem) onAddCatalogItem();
        } else if (isOS) {
            item ? onEditOS(item) : onAddOS();
        } else if (isSales) {
            item ? onEditSale(item) : onAddSale();
        }
    };

    const handleTransferStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferData.serviceItemId || !transferData.fromBranchId || !transferData.toBranchId || !transferData.quantity) {
            return showAlert("Preencha todos os campos da transferência.", "warning");
        }
        if (transferData.fromBranchId === transferData.toBranchId) {
            return showAlert("Origem e destino devem ser diferentes.", "warning");
        }
        
        try {
            await api.transferStock(transferData);
            showAlert("Transferência registrada e agendada para sincronização!", "success");
            setIsTransferModalOpen(false);
            setTimeout(() => window.location.reload(), 800);
        } catch (e) { showAlert("Erro ao registrar transferência.", "error"); }
    };

    const formatCurrency = (val: number | undefined | null) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const renderGridContent = () => {
        let rawItems: any[] = [];
        if (isOS) rawItems = serviceOrders;
        else if (isSales) rawItems = commercialOrders.filter(o => o.type === 'SALE');
        else if (isCatalog) rawItems = serviceItems.filter(i => catalogTab === 'ALL' || i.type === catalogTab);

        const filtered = rawItems.filter(i => {
            const text = (i.title || i.description || i.name || i.code || i.brand || i.category || '').toLowerCase();
            return text.includes(searchTerm.toLowerCase());
        });

        if (filtered.length === 0) return (
            <div className="bg-white rounded-[2.5rem] p-20 text-center border border-gray-100 shadow-sm mx-auto max-w-4xl">
                <Box className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Nenhum registro</h3>
                <p className="text-gray-400 font-medium">Use os botões acima para cadastrar novos itens.</p>
            </div>
        );

        if ((isOS || isSales) && viewType === 'KANBAN') {
            const columns = isOS ? OS_KANBAN_COLUMNS : SALE_KANBAN_COLUMNS;
            const kanbanItems: KanbanItem[] = filtered.map(item => ({
                id: item.id, title: item.title || item.description, subtitle: item.contactName || 'Sem cliente',
                status: item.status, amount: item.totalAmount || item.amount, date: item.openedAt || item.date,
                raw: item
            }));
            return <KanbanBoard items={kanbanItems} columns={columns} onItemClick={handleOpenAction} onStatusChange={(id, status) => isOS ? onSaveOS({ ...serviceOrders.find(o => o.id === id)!, status: status as any }) : onSaveOrder({ ...commercialOrders.find(o => o.id === id)!, status })} />;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1">
                {filtered.map(item => (
                    <div key={item.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col h-full">
                        {isCatalog && (
                            <div className="aspect-square relative bg-slate-50 overflow-hidden border-b border-gray-50 flex items-center justify-center">
                                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="flex flex-col items-center gap-2 opacity-20">{item.type === 'PRODUCT' ? <Box className="w-12 h-12" /> : <Zap className="w-12 h-12" />}<span className="text-[10px] font-black uppercase tracking-widest">Sem Imagem</span></div>}
                                <div className="absolute top-4 left-4 flex gap-1">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm border ${item.type === 'PRODUCT' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-amber-50 text-white border-amber-600'}`}>{item.type === 'PRODUCT' ? 'Produto' : 'Serviço'}</span>
                                    {item.category && <span className="bg-white/90 backdrop-blur-sm text-gray-500 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-gray-100 shadow-sm">{item.category}</span>}
                                </div>
                                {item.type === 'PRODUCT' && (
                                    <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-lg text-[10px] font-black shadow-lg ${item.stockQuantity <= 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>
                                        {item.stockQuantity} un em estoque
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="p-6 flex-1">
                            <h3 className="font-bold text-gray-800 leading-tight line-clamp-2 text-lg mb-2">{item.name || item.title || item.description}</h3>
                            {isCatalog && item.stockQuantity > 0 && <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Store className="w-3 h-3"/> Local: {branches.find(b => b.id === item.branchId)?.name || 'Sede'}</p>}
                            {item.warrantyEnabled && <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Garantia: {item.warrantyDays} dias</p>}
                        </div>
                        <div className="px-6 py-5 border-t border-gray-50 flex justify-between items-center bg-gray-50/20 mt-auto">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Preço Base</span>
                                <div className="text-xl font-black text-gray-900">{formatCurrency(item.defaultPrice || item.amount || item.totalAmount)}</div>
                            </div>
                            <div className="flex gap-1.5">
                                <button onClick={() => handleOpenAction(item)} className="p-2.5 text-indigo-600 bg-white border border-gray-100 shadow-sm hover:bg-indigo-50 rounded-xl transition-all"><Pencil className="w-4 h-4"/></button>
                                <button onClick={() => { if(showConfirm) showConfirm({title:"Excluir", message:`Remover ${item.name || item.title}?`, variant:"danger"}).then(c => c && (isCatalog ? onDeleteCatalogItem!(item.id) : isOS ? onDeleteOS(item.id) : onDeleteOrder(item.id)))}} className="p-2.5 text-rose-500 bg-white border border-gray-100 shadow-sm hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4"/></button>
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
                        {isCatalog ? <Box className="w-6 h-6 text-indigo-600" /> : isOS ? <Wrench className="w-6 h-6 text-indigo-600" /> : <ShoppingBag className="w-6 h-6 text-indigo-600" />}
                        {isCatalog ? 'Catálogo & Estoque' : isOS ? 'Ordens de Serviço' : 'Vendas e Orçamentos'}
                    </h1>
                    <p className="text-gray-500 font-medium italic">Gestão operacional de itens e fluxos corporativos.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {isCatalog && (
                        <button onClick={() => setIsTransferModalOpen(true)} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-black uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95">
                            <ArrowLeftRight className="w-4 h-4" /> Transferir Estoque
                        </button>
                    )}
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm" />
                    </div>
                    <button onClick={() => handleOpenAction()} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">
                        <Plus className="w-4 h-4" /> Novo {isCatalog ? 'Item' : isOS ? 'O.S.' : 'Pedido'}
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center px-1 shrink-0">
                <div className="flex bg-gray-200/50 p-1.5 rounded-[1.5rem] w-fit border border-gray-100 shadow-sm">
                    {isCatalog ? (
                        ['ALL', 'PRODUCT', 'SERVICE'].map(t => (
                            <button key={t} onClick={() => setCatalogTab(t as any)} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${catalogTab === t ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500'}`}>
                                {t === 'ALL' ? 'Tudo' : t === 'PRODUCT' ? 'Produtos' : 'Serviços'}
                            </button>
                        ))
                    ) : (
                        <>
                            <button onClick={() => setViewType('KANBAN')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewType === 'KANBAN' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500'}`}><Trello className="w-4 h-4" /> Kanban</button>
                            <button onClick={() => setViewType('GRID')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewType === 'GRID' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500'}`}><LayoutGrid className="w-4 h-4" /> Lista</button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">{renderGridContent()}</div>

            {/* Modal de Transferência de Estoque Multi-Filial (Mantido como modal pois é uma ação rápida de ajuste) */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100 relative">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3"><ArrowLeftRight className="w-6 h-6 text-emerald-600" /> Transferir Estoque</h2>
                            <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handleTransferStock} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Produto para Movimentação</label>
                                <select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={transferData.serviceItemId || ''} onChange={e => setTransferData({...transferData, serviceItemId: e.target.value})} required>
                                    <option value="">Qual item deseja transferir?</option>
                                    {serviceItems.filter(i => i.type === 'PRODUCT').map(i => <option key={i.id} value={i.id}>{i.name} (Saldo Atual: {i.stockQuantity})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Sair de (Origem)</label><select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={transferData.fromBranchId || ''} onChange={e => setTransferData({...transferData, fromBranchId: e.target.value})} required><option value="">Selecionar...</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Entrar em (Destino)</label><select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={transferData.toBranchId || ''} onChange={e => setTransferData({...transferData, toBranchId: e.target.value})} required><option value="">Selecionar...</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Quantidade</label><input type="number" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black" value={transferData.quantity} onChange={e => setTransferData({...transferData, quantity: Number(e.target.value)})} required min="1" /></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Data</label><input type="date" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={transferData.date} onChange={e => setTransferData({...transferData, date: e.target.value})} /></div>
                            </div>
                            <button type="submit" className="w-full bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">Confirmar Movimentação</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesView;
