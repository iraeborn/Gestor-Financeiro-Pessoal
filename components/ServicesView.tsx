
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
    Store, Zap, Info, LayoutGrid, Trello, Pencil, Package, Layers
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
    
    // Estado para transferência multi-produto
    const [transferHeader, setTransferHeader] = useState({
        fromBranchId: '', toBranchId: '', date: new Date().toISOString().split('T')[0], notes: ''
    });
    const [transferItems, setTransferItems] = useState<{serviceItemId: string, quantity: number}[]>([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [selectedQty, setSelectedQty] = useState(1);

    const handleAddItemToTransfer = () => {
        if (!selectedItemId) return;
        const exists = transferItems.find(i => i.serviceItemId === selectedItemId);
        if (exists) {
            setTransferItems(transferItems.map(i => i.serviceItemId === selectedItemId ? { ...i, quantity: i.quantity + selectedQty } : i));
        } else {
            setTransferItems([...transferItems, { serviceItemId: selectedItemId, quantity: selectedQty }]);
        }
        setSelectedItemId('');
        setSelectedQty(1);
    };

    const handleRemoveItemFromTransfer = (id: string) => {
        setTransferItems(transferItems.filter(i => i.serviceItemId !== id));
    };

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
        if (!transferHeader.fromBranchId || !transferHeader.toBranchId || transferItems.length === 0) {
            return showAlert("Configure a origem, destino e ao menos um produto.", "warning");
        }
        if (transferHeader.fromBranchId === transferHeader.toBranchId) {
            return showAlert("Origem e destino devem ser diferentes.", "warning");
        }
        
        try {
            // Processa cada item da transferência sequencialmente
            for (const item of transferItems) {
                await api.transferStock({
                    ...transferHeader,
                    serviceItemId: item.serviceItemId,
                    quantity: item.quantity
                });
            }
            
            showAlert(`${transferItems.length} produto(s) transferidos com sucesso!`, "success");
            setIsTransferModalOpen(false);
            setTransferItems([]);
            setTransferHeader({ fromBranchId: '', toBranchId: '', date: new Date().toISOString().split('T')[0], notes: '' });
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
                            <ArrowLeftRight className="w-4 h-4" /> Transferência em Lote
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

            {/* MODAL DE TRANSFERÊNCIA EM LOTE */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl p-10 animate-scale-up border border-slate-100 relative max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-8 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                                    <ArrowLeftRight className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Transferência de Estoque (Lote)</h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase">Movimentação logística entre unidades</p>
                                </div>
                            </div>
                            <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-6 h-6"/></button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                            {/* Coluna 1: Configuração de Rota */}
                            <div className="space-y-6">
                                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-2"><Store className="w-3 h-3"/> Rota Logística</h3>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Unidade de Origem</label>
                                        <select 
                                            className="w-full bg-white border-none rounded-xl p-3 text-xs font-bold outline-none shadow-sm"
                                            value={transferHeader.fromBranchId}
                                            onChange={e => setTransferHeader({...transferHeader, fromBranchId: e.target.value})}
                                        >
                                            <option value="">Selecionar...</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Unidade de Destino</label>
                                        <select 
                                            className="w-full bg-white border-none rounded-xl p-3 text-xs font-bold outline-none shadow-sm"
                                            value={transferHeader.toBranchId}
                                            onChange={e => setTransferHeader({...transferHeader, toBranchId: e.target.value})}
                                        >
                                            <option value="">Selecionar...</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Data</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-white border-none rounded-xl p-3 text-xs font-bold shadow-sm"
                                            value={transferHeader.date}
                                            onChange={e => setTransferHeader({...transferHeader, date: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                                    <div className="flex items-center gap-2 text-indigo-700 mb-2">
                                        <Info className="w-4 h-4" />
                                        <h4 className="text-[10px] font-black uppercase">Regra Logística</h4>
                                    </div>
                                    <p className="text-[10px] text-indigo-800 leading-relaxed font-medium">
                                        A transferência em lote criará um par de eventos (saída/entrada) para cada produto da lista, garantindo a rastreabilidade fiscal e física.
                                    </p>
                                </div>
                            </div>

                            {/* Coluna 2 e 3: Carrinho de Transferência */}
                            <div className="lg:col-span-2 flex flex-col overflow-hidden">
                                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col flex-1 overflow-hidden">
                                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                                        <div className="flex-1 relative">
                                            <Package className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                            <select 
                                                className="w-full pl-10 pr-4 py-2.5 bg-white border-none rounded-xl text-xs font-bold shadow-sm outline-none appearance-none"
                                                value={selectedItemId}
                                                onChange={e => setSelectedItemId(e.target.value)}
                                            >
                                                <option value="">+ Adicionar produto à lista...</option>
                                                {serviceItems.filter(i => i.type === 'PRODUCT').map(i => <option key={i.id} value={i.id}>{i.name} (Saldo Global: {i.stockQuantity})</option>)}
                                            </select>
                                        </div>
                                        <div className="w-24 relative">
                                            <input 
                                                type="number" 
                                                className="w-full p-2.5 bg-white border-none rounded-xl text-xs font-black shadow-sm text-center" 
                                                value={selectedQty}
                                                onChange={e => setSelectedQty(Number(e.target.value))}
                                                min="1"
                                            />
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleAddItemToTransfer}
                                            className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
                                        {transferItems.length === 0 ? (
                                            <div className="py-20 text-center text-slate-300 italic flex flex-col items-center gap-3">
                                                <Layers className="w-12 h-12 opacity-10" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Nenhum item na lista de envio</span>
                                            </div>
                                        ) : transferItems.map(item => {
                                            const catalogItem = serviceItems.find(i => i.id === item.serviceItemId);
                                            return (
                                                <div key={item.serviceItemId} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:border-indigo-100 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center">
                                                            <Box className="w-5 h-5 text-indigo-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">{catalogItem?.name || 'Item desconhecido'}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase">{catalogItem?.brand || 'Sem Marca'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mover</p>
                                                            <p className="text-sm font-black text-indigo-600">{item.quantity} un</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleRemoveItemFromTransfer(item.serviceItemId)}
                                                            className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="p-6 bg-slate-900 border-t border-slate-800 rounded-b-[2rem]">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="text-white">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Resumo de Carga</p>
                                                <p className="text-lg font-black">{transferItems.length} referências selecionadas</p>
                                            </div>
                                            <div className="text-right text-white">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Volume Total</p>
                                                <p className="text-lg font-black">{transferItems.reduce((acc, i) => acc + i.quantity, 0)} unidades</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleTransferStock}
                                            disabled={transferItems.length === 0}
                                            className="w-full bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-emerald-900/50 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:grayscale"
                                        >
                                            <ArrowLeftRight className="w-5 h-5" /> Processar Transferência em Lote
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesView;
