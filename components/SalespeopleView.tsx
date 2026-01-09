
import React, { useState, useMemo } from 'react';
import { Salesperson, Branch, Member, CommercialOrder } from '../types';
import { 
    Users, Plus, Percent, Trash2, Pencil, Search, Store, 
    BadgeDollarSign, UserPlus, Info, TrendingUp, ShoppingBag, 
    PiggyBank, Target, X
} from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import StatCard from './StatCard';

interface SalespeopleViewProps {
    salespeople: Salesperson[];
    branches: Branch[];
    members: Member[];
    commercialOrders: CommercialOrder[]; // Nova prop para cálculos
    onSaveSalesperson: (s: Salesperson) => void;
    onDeleteSalesperson: (id: string) => void;
}

const SalespeopleView: React.FC<SalespeopleViewProps> = ({ 
    salespeople, branches, members, commercialOrders = [], 
    onSaveSalesperson, onDeleteSalesperson 
}) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Salesperson>>({
        commissionRate: 0
    });

    // Cálculo de Indicadores da Equipe
    const stats = useMemo(() => {
        const confirmedSales = commercialOrders.filter(o => o.type === 'SALE' && o.status === 'CONFIRMED');
        const totalSalesValue = confirmedSales.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
        
        let totalCommissions = 0;
        confirmedSales.forEach(sale => {
            if (sale.assigneeId) {
                const sp = salespeople.find(s => s.id === sale.assigneeId);
                if (sp && sp.commissionRate) {
                    totalCommissions += (sale.amount * sp.commissionRate) / 100;
                }
            }
        });

        const avgTicket = confirmedSales.length > 0 ? totalSalesValue / confirmedSales.length : 0;

        return {
            totalSalesValue,
            totalCommissions,
            avgTicket,
            activeCount: salespeople.length,
            salesCount: confirmedSales.length
        };
    }, [commercialOrders, salespeople]);

    const filtered = salespeople.filter(s => 
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.branchName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (s?: Salesperson) => {
        if (s) setFormData(s);
        else setFormData({ commissionRate: 0 });
        setIsModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.userId) return showAlert("Selecione um colaborador.", "warning");
        if (!formData.branchId) return showAlert("Selecione uma filial.", "warning");

        const selectedMember = members.find(m => m.id === formData.userId);
        const selectedBranch = branches.find(b => b.id === formData.branchId);

        onSaveSalesperson({
            ...formData,
            id: formData.id || crypto.randomUUID(),
            name: selectedMember?.name || formData.name,
            email: selectedMember?.email || formData.email,
            branchName: selectedBranch?.name || formData.branchName
        } as Salesperson);
        
        setIsModalOpen(false);
        showAlert("Colaborador atualizado!", "success");
    };

    const handleDelete = async (id: string, name?: string) => {
        const confirm = await showConfirm({
            title: "Remover Colaborador",
            message: `Deseja remover as configurações de comissão e escala de ${name || 'este colaborador'}?`,
            variant: "danger"
        });
        if (confirm) onDeleteSalesperson(id);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-600" />
                        Gestão de Colaboradores
                    </h1>
                    <p className="text-gray-500 font-medium">Gestão de equipe, comissões de venda e performance.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                >
                    <UserPlus className="w-4 h-4" /> Configurar Colaborador
                </button>
            </div>

            {/* Painel de Indicadores da Equipe */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Volume em Vendas" 
                    amount={stats.totalSalesValue} 
                    type="positive" 
                    subtitle={`${stats.salesCount} pedidos faturados`}
                    icon={<ShoppingBag className="w-5 h-5" />}
                />
                <StatCard 
                    title="Comissões à Pagar" 
                    amount={stats.totalCommissions} 
                    type="negative" 
                    subtitle="Baseado no % de cada vendedor"
                    icon={<BadgeDollarSign className="w-5 h-5" />}
                />
                <StatCard 
                    title="Ticket Médio" 
                    amount={stats.avgTicket} 
                    type="info" 
                    subtitle="Eficiência de conversão"
                    icon={<TrendingUp className="w-5 h-5" />}
                />
                <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between h-full transition-transform hover:scale-[1.02] duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-400 mb-1">Equipe Ativa</p>
                            <h3 className="text-3xl font-black text-white">
                                {stats.activeCount}
                            </h3>
                        </div>
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-auto pt-2 border-t border-slate-800">
                        Pessoas configuradas
                    </p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Filtrar por nome ou filial..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 text-sm outline-none border-none bg-transparent font-medium"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="font-bold">Nenhum colaborador encontrado.</p>
                    </div>
                ) : filtered.map(seller => {
                    const sellerSales = commercialOrders.filter(o => o.assigneeId === seller.id && o.status === 'CONFIRMED');
                    const sellerTotalValue = sellerSales.reduce((acc, o) => acc + o.amount, 0);
                    const sellerComm = (sellerTotalValue * seller.commissionRate) / 100;

                    return (
                    <div key={seller.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 group hover:shadow-xl transition-all relative overflow-hidden flex flex-col">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-50 group-hover:text-indigo-50 transition-colors">
                            <BadgeDollarSign className="w-full h-full" />
                        </div>
                        
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xl shadow-inner">
                                    {seller.name?.charAt(0)}
                                </div>
                                <div className="overflow-hidden">
                                    <h3 className="font-black text-gray-900 truncate text-lg leading-tight">{seller.name}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">{seller.email}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(seller)} className="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all"><Pencil className="w-4 h-4"/></button>
                                <button onClick={() => handleDelete(seller.id, seller.name)} className="p-2 text-rose-500 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6 flex-1">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Store className="w-3.5 h-3.5"/> Filial</span>
                                <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{seller.branchName || 'Não alocado'}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                <span className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-1.5"><Percent className="w-3.5 h-3.5"/> Comissão</span>
                                <span className="text-xs font-black text-indigo-700">{seller.commissionRate}%</span>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-50 mt-auto">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Vendas Mês</p>
                                    <p className="text-sm font-black text-slate-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sellerTotalValue)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">A Receber</p>
                                    <p className="text-lg font-black text-emerald-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sellerComm)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )})}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                                <BadgeDollarSign className="w-6 h-6 text-indigo-600" />
                                Configurar Colaborador
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Colaborador (Membro da Equipe)</label>
                                <select 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                                    value={formData.userId || ''}
                                    onChange={e => setFormData({...formData, userId: e.target.value})}
                                    disabled={!!formData.id}
                                    required
                                >
                                    <option value="">Selecionar membro...</option>
                                    {members.sort((a,b) => a.name.localeCompare(b.name)).map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Filial de Atuação</label>
                                    <select 
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                                        value={formData.branchId || ''}
                                        onChange={e => setFormData({...formData, branchId: e.target.value})}
                                        required
                                    >
                                        <option value="">Selecionar Filial...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Percentual de Comissão (%)</label>
                                    <div className="relative">
                                        <Percent className="absolute left-4 top-4 w-4 h-4 text-slate-300" />
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500" 
                                            value={formData.commissionRate} 
                                            onChange={e => setFormData({...formData, commissionRate: Number(e.target.value)})} 
                                            required 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4">
                                <Info className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Nota Importante</h4>
                                    <p className="text-xs text-amber-800/80 leading-relaxed font-medium">
                                        Ao vincular um colaborador a uma filial, ele passará a ser sugerido como vendedor padrão em vendas realizadas naquela unidade.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Cancelar</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Salvar Configurações</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalespeopleView;
