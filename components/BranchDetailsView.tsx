
import React, { useMemo, useState } from 'react';
import { Branch, AppState, TransactionType, TransactionStatus, StockTransfer, CommercialOrder, OpticalRx, ServiceItem, InventoryEvent } from '../types';
import { 
    ArrowLeft, Store, MapPin, Phone, TrendingUp, Eye, Package, 
    ShoppingBag, Clock, ArrowRight, AlertTriangle,
    CheckCircle2, Landmark, Glasses, ArrowLeftRight, 
    DollarSign, Search, History, LayoutDashboard, Box, 
    Layers, Filter, ArrowUpRight, ArrowDownRight, User as UserIcon, RefreshCw, Archive
} from 'lucide-react';

interface BranchDetailsViewProps {
    branch: Branch;
    state: AppState;
    onBack: () => void;
}

type TimelineFilter = 'ALL' | 'SALES' | 'TRANSFERS' | 'RX' | 'FINANCE' | 'STOCK';

const BranchDetailsView: React.FC<BranchDetailsViewProps> = ({ branch, state, onBack }) => {
    const [activeTab, setActiveTab] = useState<TimelineFilter>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const metrics = useMemo(() => {
        const branchId = branch.id;
        
        const branchSales = (state.commercialOrders || []).filter(o => o.branchId === branchId);
        const branchRxs = (state.opticalRxs || []).filter(rx => rx.branchId === branchId);
        const branchTransfers = (state.stockTransfers || []).filter(t => t.fromBranchId === branchId || t.toBranchId === branchId);
        const branchTransactions = (state.transactions || []).filter(t => t.branchId === branchId);
        const branchInventory = (state.serviceItems || []).filter(i => i.branchId === branchId && i.type === 'PRODUCT');
        const branchEvents = (state.inventoryEvents || []).filter(e => e.branchId === branchId);

        // Timeline Unificada - Correção do Filtro "Tudo"
        const timeline = [
            // Vendas e Compras
            ...branchSales.map(o => ({ 
                id: o.id, date: o.date, type: 'SALE' as const, 
                title: o.type === 'PURCHASE' ? `Compra: ${o.description}` : `Venda: ${o.description}`, 
                value: o.amount, 
                status: o.status, contact: o.contactName, icon: o.type === 'PURCHASE' ? Archive : ShoppingBag, 
                color: o.type === 'PURCHASE' ? 'text-amber-600' : 'text-emerald-600'
            })),
            // Receitas Óticas
            ...branchRxs.map(rx => ({
                id: rx.id, date: rx.rxDate, type: 'RX' as const,
                title: `Receita RX: ${rx.rxNumber}`, value: 0,
                status: rx.status, contact: rx.contactName, icon: Eye, color: 'text-indigo-600'
            })),
            // Transferências Logísticas
            ...branchTransfers.map(t => {
                const isOut = t.fromBranchId === branchId;
                return {
                    id: t.id, date: t.date, type: 'TRANSFER' as const,
                    title: isOut ? `Envio para ${t.toBranchName || 'Outra Loja'}` : `Recebimento de ${t.fromBranchName || 'HUB'}`,
                    value: t.quantity, status: 'CONCLUÍDO',
                    contact: state.serviceItems.find(i => i.id === t.serviceItemId)?.name,
                    icon: ArrowLeftRight, color: isOut ? 'text-rose-600' : 'text-blue-600'
                };
            }),
            // Movimentações de Ajuste Manual de Estoque (Novidade na Timeline)
            ...branchEvents.filter(e => ['ADJUSTMENT_ADD', 'ADJUSTMENT_REMOVE', 'RETURN'].includes(e.type)).map(e => ({
                id: e.id, date: e.date, type: 'STOCK' as const,
                title: e.type === 'ADJUSTMENT_ADD' ? `Entrada Manual: ${e.notes || 'Ajuste'}` : `Saída Manual: ${e.notes || 'Ajuste'}`,
                value: e.quantity, status: 'AJUSTADO',
                contact: state.serviceItems.find(i => i.id === e.serviceItemId)?.name,
                icon: RefreshCw, color: e.type === 'ADJUSTMENT_ADD' ? 'text-emerald-500' : 'text-rose-500'
            })),
            // Transações Financeiras (Filtrando as que já são ordens de venda/compra)
            ...branchTransactions.filter(t => !branchSales.some(s => s.transactionId === t.id)).map(t => ({
                id: t.id, date: t.date, type: 'FINANCE' as const,
                title: `Fluxo: ${t.description}`, value: t.amount,
                status: t.status, contact: t.category, icon: DollarSign, color: t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const filteredTimeline = timeline.filter(item => {
            const matchesSearch = (item.title + (item.contact || '')).toLowerCase().includes(searchTerm.toLowerCase());
            if (activeTab === 'ALL') return matchesSearch;
            if (activeTab === 'SALES') return item.type === 'SALE' && matchesSearch;
            if (activeTab === 'TRANSFERS') return item.type === 'TRANSFER' && matchesSearch;
            if (activeTab === 'RX') return item.type === 'RX' && matchesSearch;
            if (activeTab === 'FINANCE') return item.type === 'FINANCE' && matchesSearch;
            if (activeTab === 'STOCK') return item.type === 'STOCK' && matchesSearch;
            return matchesSearch;
        });

        const filteredInventory = branchInventory.filter(i => 
            i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (i.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        const inventoryValue = branchInventory.reduce((acc, i) => acc + ((Number(i.stockQuantity) || 0) * (Number(i.costPrice) || 0)), 0);

        return {
            totalSales: branchSales.filter(o => o.type === 'SALE').reduce((acc, o) => acc + (Number(o.amount) || 0), 0),
            rxCount: branchRxs.length,
            inventoryValue,
            timeline: filteredTimeline,
            inventory: filteredInventory,
            revenue: branchTransactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID).reduce((acc, t) => acc + t.amount, 0)
        };
    }, [branch.id, state, activeTab, searchTerm]);

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* Header com Branding da Unidade */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-100 pb-10">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="p-4 hover:bg-white rounded-2xl border border-gray-200 text-gray-400 hover:text-indigo-600 transition-all shadow-sm group">
                        <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center text-white shadow-2xl relative overflow-hidden" style={{ backgroundColor: branch.color || '#4f46e5' }}>
                            <Store className="w-10 h-10 relative z-10" />
                            <div className="absolute inset-0 bg-black/10"></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-4xl font-black text-gray-900 tracking-tight">{branch.name}</h1>
                                <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{branch.code}</span>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-gray-400 font-bold uppercase tracking-widest mt-2">
                                <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-500" /> {branch.city}</span>
                                {branch.phone && <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-500" /> {branch.phone}</span>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border-2 ${branch.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        {branch.isActive ? 'Unidade Operacional' : 'Unidade Inativa'}
                    </div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Sincronizado em tempo real</p>
                </div>
            </div>

            {/* Grid Principal de KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Vendas Brutas</p>
                        <TrendingUp className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">{formatCurrency(metrics.totalSales)}</h3>
                    <p className="text-[9px] text-indigo-600 font-bold uppercase mt-4 flex items-center gap-1"><History className="w-3 h-3"/> Somente saídas de PDV</p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Fluxo de Receitas</p>
                        <Eye className="w-6 h-6 text-indigo-500" />
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">{metrics.rxCount} <span className="text-sm text-slate-400 font-bold uppercase">Pacientes</span></h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-4 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Conversão RX/Venda ativa</p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Estoque Local</p>
                        <Package className="w-6 h-6 text-indigo-500" />
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">{formatCurrency(metrics.inventoryValue)}</h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-4 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500"/> Posição de custo na unidade</p>
                </div>

                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform duration-500"><Landmark className="w-24 h-24" /></div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Liquidez Disponível</p>
                    <h3 className="text-3xl font-black">{formatCurrency(metrics.revenue)}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-4">Saldo conciliado em caixa</p>
                </div>
            </div>

            {/* Abas de Gerenciamento do Cockpit */}
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row justify-between items-center gap-6 bg-slate-50/30">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                            {activeTab === 'STOCK' ? <Layers className="w-6 h-6" /> : <History className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                {activeTab === 'STOCK' ? 'Grade de Inventário' : 'Timeline de Rastreabilidade'}
                            </h2>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                {activeTab === 'STOCK' ? 'Saldo atualizado de produtos nesta filial' : 'Fluxo integrado de eventos operacionais'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'ALL', label: 'Tudo', icon: LayoutDashboard },
                            { id: 'SALES', label: 'Vendas/PDV', icon: ShoppingBag },
                            { id: 'STOCK', label: 'Ajustes Estoque', icon: Box },
                            { id: 'TRANSFERS', label: 'Transferências', icon: ArrowLeftRight },
                            { id: 'RX', label: 'Receitas', icon: Glasses },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setActiveTab(f.id as any)}
                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border ${activeTab === f.id ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                            >
                                <f.icon className="w-3.5 h-3.5" /> {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full lg:w-64">
                        <Search className="w-4 h-4 text-gray-300 absolute left-4 top-3.5" />
                        <input 
                            type="text" 
                            placeholder="Buscar no cockpit..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {activeTab === 'STOCK' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                             {/* Mostra apenas a grade de estoque na aba específica ou integra na timeline */}
                             {metrics.inventory.map(item => (
                                    <div key={item.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 hover:shadow-lg transition-all group">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-slate-100">
                                                {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" alt="" /> : <Box className="w-6 h-6 text-slate-300" />}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-gray-800 text-sm truncate uppercase tracking-tight">{item.name}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.brand || 'Marca Geral'} • {item.code || 'S/ SKU'}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-4 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Saldo Atual</p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xl font-black ${Number(item.stockQuantity) <= 2 ? 'text-rose-500' : 'text-indigo-600'}`}>{item.stockQuantity}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit}</span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-center">
                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Preço Venda</p>
                                                <p className="text-sm font-black text-gray-700">{formatCurrency(item.defaultPrice)}</p>
                                            </div>
                                        </div>
                                    </div>
                             ))}
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        {metrics.timeline.length === 0 ? (
                            <div className="py-24 text-center">
                                <Clock className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhum evento registrado com estes filtros.</p>
                            </div>
                        ) : (
                            metrics.timeline.map((event, idx) => (
                                <div key={idx} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[1.8rem] hover:shadow-xl hover:border-indigo-100 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col items-center min-w-[50px]">
                                            <span className="text-[10px] font-black text-slate-400 uppercase leading-none">{new Date(event.date).toLocaleDateString('pt-BR', { day: '2-digit' })}</span>
                                            <span className="text-[14px] font-black text-indigo-600 uppercase leading-none mt-1">{new Date(event.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                                        </div>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-slate-50 ${event.color} transition-colors group-hover:bg-white group-hover:shadow-md`}>
                                            <event.icon className="w-6 h-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-gray-800 text-sm truncate uppercase tracking-tight">{event.title}</h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <UserIcon className="w-3 h-3"/> {event.contact || 'Geral'}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border border-slate-100 bg-slate-50 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors`}>
                                                    {event.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-black ${['TRANSFER', 'STOCK'].includes(event.type) ? 'text-indigo-600' : event.color}`}>
                                            {['TRANSFER', 'STOCK'].includes(event.type) ? `${event.value} un` : formatCurrency(event.value)}
                                        </p>
                                        <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mt-1 flex items-center gap-1 ml-auto">
                                            Detalhes <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BranchDetailsView;
