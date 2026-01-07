
import React, { useState } from 'react';
import { Salesperson, Branch, Member } from '../types';
import { Users, Plus, Percent, Trash2, Pencil, Search, Store, BadgeDollarSign, UserPlus, Info } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';

interface SalespeopleViewProps {
    salespeople: Salesperson[];
    branches: Branch[];
    members: Member[];
    onSaveSalesperson: (s: Salesperson) => void;
    onDeleteSalesperson: (id: string) => void;
}

const SalespeopleView: React.FC<SalespeopleViewProps> = ({ salespeople, branches, members, onSaveSalesperson, onDeleteSalesperson }) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Salesperson>>({
        commissionRate: 0
    });

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
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-600" />
                        Gestão de Colaboradores
                    </h1>
                    <p className="text-gray-500">Gestão de equipe, comissões de venda e alocação por unidade.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all"
                >
                    <UserPlus className="w-4 h-4" /> Configurar Colaborador
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Filtrar colaboradores..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 text-sm outline-none border-none bg-transparent"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                        Nenhum colaborador configurado para comissões.
                    </div>
                ) : filtered.map(seller => (
                    <div key={seller.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 group hover:shadow-xl transition-all relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-50 group-hover:text-indigo-50 transition-colors">
                            <BadgeDollarSign className="w-full h-full" />
                        </div>
                        
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg">
                                    {seller.name?.charAt(0)}
                                </div>
                                <div className="overflow-hidden">
                                    <h3 className="font-black text-gray-900 truncate">{seller.name}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">{seller.email}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(seller)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"><Pencil className="w-4 h-4"/></button>
                                <button onClick={() => handleDelete(seller.id, seller.name)} className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Store className="w-3 h-3"/> Filial</p>
                                <p className="text-sm font-bold text-gray-700 truncate">{seller.branchName || 'Não alocado'}</p>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Percent className="w-3 h-3"/> Comissão</p>
                                <p className="text-sm font-black text-indigo-700">{seller.commissionRate}%</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100">
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-8">Configurar Colaborador</h2>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Colaborador (Membro da Equipe)</label>
                                <select 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
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
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
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
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={formData.commissionRate} 
                                        onChange={e => setFormData({...formData, commissionRate: Number(e.target.value)})} 
                                        required 
                                    />
                                </div>
                            </div>

                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="text-[10px] font-bold text-amber-800 uppercase leading-relaxed">
                                    Colaboradores configurados aqui podem ser vinculados a vendas e orçamentos para rastreabilidade e bonificação.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg">Confirmar Cadastro</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalespeopleView;
