
import React, { useState } from 'react';
import { Branch } from '../types';
import { Store, Plus, MapPin, Phone, Search, Pencil, Trash2, Calendar, ChevronRight, CheckCircle2, XCircle, Globe } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';

interface BranchesViewProps {
    branches: Branch[];
    onSaveBranch: (b: Branch) => void;
    onDeleteBranch: (id: string) => void;
    onManageSchedule: (b: Branch) => void;
}

const BranchesView: React.FC<BranchesViewProps> = ({ branches = [], onSaveBranch, onDeleteBranch, onManageSchedule }) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<Partial<Branch>>({
        isActive: true,
        color: '#4f46e5'
    });

    const filtered = (branches || []).filter(b => {
        const name = b.name || '';
        const city = b.city || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               city.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleOpenModal = (branch?: Branch) => {
        if (branch) setFormData(branch);
        else setFormData({ isActive: true, color: '#4f46e5' });
        setIsModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSaveBranch({
            ...formData,
            id: formData.id || crypto.randomUUID(),
            name: formData.name || 'Nova Unidade',
            isActive: formData.isActive ?? true
        } as Branch);
        setIsModalOpen(false);
        showAlert("Unidade salva com sucesso!", "success");
    };

    const handleDelete = async (id: string, name: string) => {
        const confirm = await showConfirm({
            title: "Excluir Unidade",
            message: `Tem certeza que deseja remover a filial "${name}"?`,
            variant: "danger"
        });
        if (confirm) onDeleteBranch(id);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Store className="w-6 h-6 text-indigo-600" />
                        Unidades & Filiais
                    </h1>
                    <p className="text-gray-500">Gerencie seus pontos de atendimento físicos e remotos.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                >
                    <Plus className="w-4 h-4" /> Nova Unidade
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Filtrar por nome ou cidade..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 text-sm outline-none border-none bg-transparent"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(branch => (
                    <div key={branch.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all">
                        <div className="h-2" style={{ backgroundColor: branch.color || '#4f46e5' }}></div>
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">{branch.name}</h3>
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{branch.code || 'UN-01'}</span>
                                </div>
                                {branch.isActive ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-rose-500" />
                                )}
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <MapPin className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{branch.city || 'Cidade não informada'}</span>
                                </div>
                                {branch.phone && (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Phone className="w-4 h-4 shrink-0" />
                                        <span>{branch.phone}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-50">
                                <button 
                                    onClick={() => onManageSchedule(branch)}
                                    className="flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                                >
                                    <Calendar className="w-4 h-4" /> Agenda
                                </button>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleOpenModal(branch)}
                                        className="flex-1 flex justify-center py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(branch.id, branch.name)}
                                        className="flex-1 flex justify-center py-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100">
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-8">Configurar Unidade</h2>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome da Filial</label><input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Código/Identificador</label><input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="Ex: SEDE, FILIAL-02" /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Cidade Principal</label><input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Telefone da Unidade</label><input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Cor Identificadora (Agenda)</label>
                                <div className="flex gap-4 items-center">
                                    <input type="color" className="w-12 h-12 rounded-xl border-none p-1 bg-gray-50" value={formData.color || '#4f46e5'} onChange={e => setFormData({...formData, color: e.target.value})} />
                                    <span className="text-sm font-bold text-gray-600 uppercase font-mono">{formData.color}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded-lg text-indigo-600" />
                                <span className="text-sm font-bold text-gray-700">Unidade em Atividade</span>
                            </div>
                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg">Salvar Unidade</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchesView;
