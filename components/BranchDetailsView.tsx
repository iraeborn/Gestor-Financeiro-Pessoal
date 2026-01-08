
import React, { useMemo } from 'react';
import { Branch, AppState, TransactionType, TransactionStatus, StockTransfer } from '../types';
import { 
    ArrowLeft, Store, MapPin, Phone, TrendingUp, Eye, Package, 
    Calendar, Wrench, ShoppingBag, Clock, ArrowRight, AlertTriangle,
    CheckCircle2, Box, Landmark, Glasses, ArrowLeftRight, Download
} from 'lucide-react';

interface BranchDetailsViewProps {
    branch: Branch;
    state: AppState;
    onBack: () => void;
}

const BranchDetailsView: React.FC<BranchDetailsViewProps> = ({ branch, state, onBack }) => {
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const metrics = useMemo(() => {
        const branchId = branch.id;
        
        const sales = (state.commercialOrders || []).filter(o => o.branchId === branchId);
        const totalSales = sales.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);

        const prescriptions = (state.opticalRxs || []).filter(rx => rx.branchId === branchId);
        
        const today = new Date().toISOString().split('T')[0];
        const appointments = (state.serviceAppointments || []).filter(a => a.branchId === branchId && a.date?.startsWith(today));

        const inventory = (state.serviceItems || []).filter(i => i.branchId === branchId && i.type === 'PRODUCT');
        const lowStockItems = inventory.filter(i => (i.stockQuantity || 0) <= 5);

        const serviceOrders = (state.serviceOrders || []).filter(o => o.branchId === branchId && ['ABERTA', 'EM_EXECUCAO'].includes(o.status));

        const transactions = (state.transactions || []).filter(t => t.branchId === branchId && t.status === TransactionStatus.PAID);
        const revenue = transactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);

        // Histórico de Transferências (Regra Centralizada)
        const transfersIn = (state.stockTransfers || []).filter(t => t.toBranchId === branchId);
        const transfersOut = (state.stockTransfers || []).filter(t => t.fromBranchId === branchId);

        return {
            totalSales,
            prescriptionsCount: prescriptions.length,
            todaysAppts: appointments,
            lowStockItems,
            serviceOrders,
            revenue,
            totalInventoryItems: inventory.length,
            transfersIn,
            transfersOut
        };
    }, [branch.id, state]);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-100 pb-8">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="p-3 hover:bg-white rounded-2xl border border-gray-200 text-gray-400 hover:text-indigo-600 transition-all shadow-sm group">
                        <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl" style={{ backgroundColor: branch.color || '#4f46e5' }}>
                            <Store className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{branch.name}</h1>
                            <div className="flex items-center gap-4 text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">
                                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-500" /> {branch.city || 'Unidade Geral'}</span>
                                {branch.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-indigo-500" /> {branch.phone}</span>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-[0.2em] border-2 ${branch.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {branch.isActive ? 'Unidade Operacional' : 'Unidade Inativa'}
                </div>
            </div>

            {/* Grid KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Faturamento Captado</p>
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{formatCurrency(metrics.totalSales)}</h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-2">Vendas locais nesta unidade</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estoque Local</p>
                        <Package className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{metrics.totalInventoryItems}</h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-2">Itens em prateleira</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ordens em Aberto</p>
                        <Wrench className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{metrics.serviceOrders.length}</h3>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-2">Serviços técnicos em curso</p>
                </div>
                <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Caixa Confirmado</p>
                        <Landmark className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-black">{formatCurrency(metrics.revenue)}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">Pagamentos liquidados</p>
                </div>
            </div>

            {/* Distribuição e Logística */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Logística de Distribuição */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3">
                                <ArrowLeftRight className="w-5 h-5 text-indigo-600" /> Histórico de Distribuição
                            </h2>
                        </div>
                        <div className="p-0">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                    <tr>
                                        <th className="px-8 py-4">Data</th>
                                        <th className="px-8 py-4">Tipo</th>
                                        <th className="px-8 py-4">Item</th>
                                        <th className="px-8 py-4 text-center">Qtd</th>
                                        <th className="px-8 py-4 text-right">Origem/Destino</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {[...metrics.transfersIn, ...metrics.transfersOut].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 15).map(transfer => {
                                        const isIn = transfer.toBranchId === branch.id;
                                        return (
                                            <tr key={transfer.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-5 text-gray-400 font-medium">{new Date(transfer.date).toLocaleDateString()}</td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-2 py-0.5 rounded-[0.5rem] text-[9px] font-black uppercase ${isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {isIn ? 'Entrada (Hub)' : 'Saída (Dist)'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 font-bold text-gray-700">{state.serviceItems.find(i => i.id === transfer.serviceItemId)?.name || 'Item'}</td>
                                                <td className="px-8 py-5 text-center font-black">{transfer.quantity}</td>
                                                <td className="px-8 py-5 text-right text-gray-400 font-bold">
                                                    {isIn ? transfer.fromBranchName : transfer.toBranchName}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {metrics.transfersIn.length === 0 && metrics.transfersOut.length === 0 && (
                                        <tr><td colSpan={5} className="py-12 text-center text-gray-300 italic">Nenhuma transferência logística registrada.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-gray-50 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3">
                                <ShoppingBag className="w-5 h-5 text-indigo-600" /> Fluxo de Vendas Recentes
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                    <tr>
                                        <th className="px-8 py-4">Data</th>
                                        <th className="px-8 py-4">Cliente</th>
                                        <th className="px-8 py-4 text-right">Valor</th>
                                        <th className="px-8 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(state.commercialOrders || []).filter(o => o.branchId === branch.id).slice(0, 10).map(order => (
                                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-5 text-gray-500 font-medium">{new Date(order.date).toLocaleDateString()}</td>
                                            <td className="px-8 py-5 font-bold text-gray-800">{order.contactName || 'Consumidor'}</td>
                                            <td className="px-8 py-5 text-right font-black text-indigo-600">{formatCurrency(order.amount)}</td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${order.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Monitor de Ruptura de Estoque */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Package className="w-5 h-5 text-indigo-600" /> Ruptura / Reposição
                            </h3>
                        </div>

                        {metrics.lowStockItems.length > 0 ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 items-start">
                                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black text-rose-700 uppercase leading-none">Pedir ao HUB</p>
                                        <p className="text-[10px] text-rose-600 mt-1">{metrics.lowStockItems.length} itens abaixo da margem de segurança.</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {metrics.lowStockItems.map(item => (
                                        <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-xs font-bold text-gray-700 truncate max-w-[150px]">{item.name}</span>
                                            <span className="px-2 py-0.5 bg-white text-rose-600 font-black text-[10px] rounded-lg shadow-sm border border-rose-100">{item.stockQuantity} un</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center bg-emerald-50/50 rounded-2xl border border-emerald-100 border-dashed">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                <p className="text-xs font-bold text-emerald-700 uppercase">Estoque em Conformidade</p>
                            </div>
                        )}
                    </div>

                    {/* Guia de Transferência Fiscal */}
                    <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Glasses className="w-24 h-24" /></div>
                        <h3 className="text-lg font-black mb-2">NF-e Transferência</h3>
                        <p className="text-indigo-200 text-xs mb-6">Emita documentos fiscais para movimentação entre filiais sem gerar cobrança financeira.</p>
                        
                        <button className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                            <Download className="w-4 h-4" /> Gerar Guia de Remessa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BranchDetailsView;
