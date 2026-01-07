
import React, { useState, useEffect } from 'react';
import { OpticalRx, Contact, Laboratory, Branch } from '../types';
import { X, User, Eye, Stethoscope, Save, Calendar, Info, FileText, Microscope, Store, UserPlus, Phone, Mail, RefreshCw } from 'lucide-react';
import { useAlert } from './AlertSystem';
import { api } from '../services/storageService';

interface OpticalRxModalProps {
    isOpen: boolean;
    onClose: () => void;
    contacts: Contact[];
    branches: Branch[];
    laboratories?: Laboratory[];
    initialData?: OpticalRx | null;
    onSave: (rx: OpticalRx) => void;
}

const OpticalRxModal: React.FC<OpticalRxModalProps> = ({ isOpen, onClose, contacts, branches, laboratories = [], initialData, onSave }) => {
    const { showAlert } = useAlert();
    const [formData, setFormData] = useState<Partial<OpticalRx>>({
        rxDate: new Date().toISOString().split('T')[0],
        expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
    });

    // Estados para Cadastro Rápido de Contato
    const [showQuickContact, setShowQuickContact] = useState(false);
    const [quickContact, setQuickContact] = useState({ name: '', phone: '', email: '' });
    const [isSavingContact, setIsSavingContact] = useState(false);

    useEffect(() => {
        if (initialData) setFormData(initialData);
        else setFormData({ rxDate: new Date().toISOString().split('T')[0] });
    }, [initialData, isOpen]);

    const handleQuickSaveContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickContact.name) return showAlert("O nome é obrigatório.", "warning");
        
        setIsSavingContact(true);
        try {
            const newId = crypto.randomUUID();
            const contact: Contact = {
                id: newId,
                name: quickContact.name,
                phone: quickContact.phone,
                email: quickContact.email,
                type: 'PF'
            };
            await api.saveContact(contact);
            
            // Seleciona automaticamente o novo contato no formulário
            setFormData(prev => ({ ...prev, contactId: newId }));
            setShowQuickContact(false);
            setQuickContact({ name: '', phone: '', email: '' });
            showAlert("Novo cliente cadastrado!", "success");
        } catch (err) {
            showAlert("Erro ao cadastrar cliente.", "error");
        } finally {
            setIsSavingContact(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.contactId) { showAlert("Selecione um cliente.", "warning"); return; }
        if (!formData.branchId) { showAlert("Selecione a unidade de atendimento.", "warning"); return; }
        
        const contact = contacts.find(c => c.id === formData.contactId);
        onSave({
            ...formData,
            id: formData.id || crypto.randomUUID(),
            contactName: contact?.name,
            rxDate: formData.rxDate || new Date().toISOString().split('T')[0]
        } as OpticalRx);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl p-10 animate-scale-up border border-slate-100 my-10">
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <Eye className="w-8 h-8 text-indigo-600" />
                            {formData.id ? 'Editar Receita Ótica' : 'Nova Receita Ótica'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400"><X className="w-6 h-6"/></button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-10">
                        {/* Header: Cliente e Datas */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="md:col-span-2">
                                <div className="flex justify-between items-center mb-2 ml-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400">Cliente / Paciente</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowQuickContact(true)}
                                        className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1 hover:underline"
                                    >
                                        <UserPlus className="w-3 h-3" /> Novo Cadastro
                                    </button>
                                </div>
                                <select 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={formData.contactId || ''}
                                    onChange={e => setFormData({...formData, contactId: e.target.value})}
                                    required
                                >
                                    <option value="">Selecione o cliente...</option>
                                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Unidade de Atendimento</label>
                                <div className="relative">
                                    <Store className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <select 
                                        className="w-full pl-10 bg-gray-50 border-none rounded-2xl p-3 text-sm font-bold outline-none"
                                        value={formData.branchId || ''}
                                        onChange={e => setFormData({...formData, branchId: e.target.value})}
                                        required
                                    >
                                        <option value="">Selecione a filial...</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Data da Receita</label>
                                <input type="date" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.rxDate} onChange={e => setFormData({...formData, rxDate: e.target.value})} required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Validade</label>
                                <input type="date" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} />
                            </div>
                        </div>

                        {/* Bloco Clinico: Visão de Longe */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <Stethoscope className="w-4 h-4"/> Exame: Visão de Longe
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-indigo-50/30 p-8 rounded-[2rem] border border-indigo-100/50">
                                <div className="md:col-span-3 grid grid-cols-4 gap-4 mb-2 opacity-50 text-[9px] font-black uppercase text-center">
                                    <div>OLHO</div><div>ESFÉRICO</div><div>CILÍNDRICO</div><div>EIXO</div>
                                </div>
                                {/* OD */}
                                <div className="text-center font-black text-indigo-700 text-sm flex items-center justify-center">O.D.</div>
                                <input type="number" step="0.25" placeholder="Esférico" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.sphereOdLonge} onChange={e => setFormData({...formData, sphereOdLonge: Number(e.target.value)})} />
                                <input type="number" step="0.25" placeholder="Cilíndrico" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.cylOdLonge} onChange={e => setFormData({...formData, cylOdLonge: Number(e.target.value)})} />
                                <input type="number" placeholder="Eixo" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.axisOdLonge} onChange={e => setFormData({...formData, axisOdLonge: Number(e.target.value)})} />
                                
                                {/* OE */}
                                <div className="text-center font-black text-indigo-700 text-sm flex items-center justify-center">O.E.</div>
                                <input type="number" step="0.25" placeholder="Esférico" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.sphereOeLonge} onChange={e => setFormData({...formData, sphereOeLonge: Number(e.target.value)})} />
                                <input type="number" step="0.25" placeholder="Cilíndrico" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.cylOeLonge} onChange={e => setFormData({...formData, cylOeLonge: Number(e.target.value)})} />
                                <input type="number" placeholder="Eixo" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.axisOeLonge} onChange={e => setFormData({...formData, axisOeLonge: Number(e.target.value)})} />
                            </div>
                        </div>

                        {/* Bloco Tecnico: Medidas de Montagem */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Save className="w-4 h-4"/> Medidas de Montagem & Adição
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Adição (ADD)</label><input type="number" step="0.25" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.addition} onChange={e => setFormData({...formData, addition: Number(e.target.value)})} /></div>
                                <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">DNP O.D.</label><input type="number" step="0.5" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.dnpOd} onChange={e => setFormData({...formData, dnpOd: Number(e.target.value)})} /></div>
                                <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">DNP O.E.</label><input type="number" step="0.5" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.dnpOe} onChange={e => setFormData({...formData, dnpOe: Number(e.target.value)})} /></div>
                                <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Altura O.D.</label><input type="number" step="0.5" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.heightOd} onChange={e => setFormData({...formData, heightOd: Number(e.target.value)})} /></div>
                                <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Altura O.E.</label><input type="number" step="0.5" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.heightOe} onChange={e => setFormData({...formData, heightOe: Number(e.target.value)})} /></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Laboratório Preferencial</label>
                                <div className="relative">
                                    <Microscope className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <select 
                                        className="w-full pl-10 bg-gray-50 border-none rounded-2xl p-3 text-sm font-bold outline-none"
                                        value={formData.laboratoryId || ''}
                                        onChange={e => setFormData({...formData, laboratoryId: e.target.value})}
                                    >
                                        <option value="">Selecione...</option>
                                        {laboratories.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Observações / Médico</label>
                                <textarea className="w-full bg-gray-50 border-none rounded-2xl p-3 text-sm font-bold min-h-[60px] outline-none focus:ring-2 focus:ring-indigo-500" value={formData.observations || ''} onChange={e => setFormData({...formData, observations: e.target.value})} placeholder="Instruções especiais..."></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                            <button type="button" onClick={onClose} className="px-8 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">Cancelar</button>
                            <button type="submit" className="bg-indigo-600 text-white px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                                <Save className="w-5 h-5" /> Salvar Receita
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Modal Interno de Cadastro Rápido */}
            {showQuickContact && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                                <UserPlus className="w-6 h-6 text-indigo-600" />
                                Cadastro Rápido
                            </h2>
                            <button onClick={() => setShowQuickContact(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handleQuickSaveContact} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome Completo</label>
                                <input 
                                    type="text" 
                                    autoFocus
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={quickContact.name}
                                    onChange={e => setQuickContact({...quickContact, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">WhatsApp</label>
                                <div className="relative">
                                    <Phone className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        value={quickContact.phone}
                                        onChange={e => setQuickContact({...quickContact, phone: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setShowQuickContact(false)} className="flex-1 py-3 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
                                <button 
                                    type="submit" 
                                    disabled={isSavingContact}
                                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2"
                                >
                                    {isSavingContact ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default OpticalRxModal;
