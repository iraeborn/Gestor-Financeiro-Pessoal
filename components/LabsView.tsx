
import React, { useState } from 'react';
import { Laboratory } from '../types';
import { Plus, Search, Pencil, Trash2, Phone, Mail, MapPin, FlaskConical, TestTube2, Microscope } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';

interface LabsViewProps {
    laboratories: Laboratory[];
    onSaveLaboratory: (l: Laboratory) => void;
    onDeleteLaboratory: (id: string) => void;
}

const LabsView: React.FC<LabsViewProps> = ({ laboratories, onSaveLaboratory, onDeleteLaboratory }) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Laboratory>>({});

    const filtered = laboratories.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (lab?: Laboratory) => {
        if (lab) setFormData(lab);
        else setFormData({});
        setIsModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return showAlert("Nome do laboratório é obrigatório.", "warning");

        onSaveLaboratory({
            ...formData,
            id: formData.id || crypto.randomUUID()
        } as Laboratory);
        setIsModalOpen(false);
        showAlert("Laboratório salvo!", "success");
    };

    const handleDelete = async (id: string, name: string) => {
        const confirm = await showConfirm({
            title: "Remover Laboratório",
            message: `Deseja remover o laboratório "${name}"?`,
            variant: "danger"
        });
        if (confirm) onDeleteLaboratory(id);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Microscope className="w-6 h-6 text-indigo-600" />
                        Laboratórios Óticos
                    </h1>
                    <p className="text-gray-500">Parceiros de montagem e surfaçagem de lentes.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all"
                >
                    <Plus className="w-4 h-4" /> Novo Laboratório
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Filtrar por nome ou contato..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 text-sm outline-none border-none bg-transparent"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                        <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="font-bold">Nenhum laboratório cadastrado.</p>
                    </div>
                ) : filtered.map(lab => (
                    <div key={lab.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-xl transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TestTube2 className="w-20 h-20 text-indigo-600" />
                        </div>
                        
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg shadow-sm">
                                    {lab.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 line-clamp-1">{lab.name}</h3>
                                    {lab.contactPerson && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Contato: {lab.contactPerson}</p>}
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(lab)} className="p-2 text-indigo-600 bg-white hover:bg-indigo-50 rounded-lg shadow-sm border border-gray-100"><Pencil className="w-4 h-4"/></button>
                                <button onClick={() => handleDelete(lab.id, lab.name)} className="p-2 text-rose-500 bg-white hover:bg-rose-50 rounded-lg shadow-sm border border-gray-100"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>

                        <div className="space-y-3 relative z-10">
                            {lab.phone && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <Phone className="w-4 h-4 text-emerald-500" />
                                    <span className="text-sm font-medium text-gray-700">{lab.phone}</span>
                                </div>
                            )}
                            {lab.email && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <Mail className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-medium text-gray-700 truncate">{lab.email}</span>
                                </div>
                            )}
                            {lab.address && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <MapPin className="w-4 h-4 text-amber-500" />
                                    <span className="text-sm font-medium text-gray-700 truncate">{lab.address}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100">
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-8">Cadastro de Laboratório</h2>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome do Laboratório</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ex: Lab Vision" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Responsável</label><input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={formData.contactPerson || ''} onChange={e => setFormData({...formData, contactPerson: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Telefone / WhatsApp</label><input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(99) 99999-9999" /></div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">E-mail para Pedidos</label>
                                <input type="email" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Endereço Completo</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Observações Internas</label>
                                <textarea className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none h-24" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Prazos, tabelas de preço, etc." />
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-indigo-700 transition-all">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LabsView;
