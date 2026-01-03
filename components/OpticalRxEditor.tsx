
import React, { useState, useEffect } from 'react';
import { OpticalRx, Contact, Branch } from '../types';
import { ArrowLeft, Save, Eye, Stethoscope, Info, Store } from 'lucide-react';
import { useAlert } from './AlertSystem';

interface OpticalRxEditorProps {
    contacts: Contact[];
    branches: Branch[];
    initialData?: OpticalRx | null;
    onSave: (rx: OpticalRx) => void;
    onCancel: () => void;
}

const OpticalRxEditor: React.FC<OpticalRxEditorProps> = ({ contacts, branches, initialData, onSave, onCancel }) => {
    const { showAlert } = useAlert();
    const [formData, setFormData] = useState<Partial<OpticalRx>>({
        rxDate: new Date().toISOString().split('T')[0],
        expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
    });

    useEffect(() => {
        if (initialData) setFormData(initialData);
        else setFormData({ rxDate: new Date().toISOString().split('T')[0], expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] });
    }, [initialData]);

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

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2 hover:bg-white rounded-full border border-gray-200 shadow-sm transition-all text-gray-400">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                            <Eye className="w-8 h-8 text-indigo-600" />
                            {formData.id ? 'Editar Receita' : 'Nova Receita Ótica'}
                        </h1>
                        <p className="text-gray-500 font-medium">Dados técnicos da prescrição oftalmológica do paciente.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button type="button" onClick={onCancel} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">Descartar</button>
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Salvar Receita
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Cliente / Paciente</label>
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
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Unidade de Exame</label>
                            <div className="relative">
                                <Store className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                <select 
                                    className="w-full pl-11 py-4 bg-indigo-50 text-indigo-700 border-none rounded-2xl text-sm font-bold outline-none appearance-none"
                                    value={formData.branchId || ''}
                                    onChange={e => setFormData({...formData, branchId: e.target.value})}
                                    required
                                >
                                    <option value="">Onde foi feito?</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 lg:col-span-1">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Data</label>
                                <input type="date" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.rxDate} onChange={e => setFormData({...formData, rxDate: e.target.value})} required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Validade</label>
                                <input type="date" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                            <Stethoscope className="w-4 h-4"/> Exame: Visão de Longe
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-indigo-50/30 p-8 rounded-[2rem] border border-indigo-100/50">
                            <div className="md:col-span-3 grid grid-cols-4 gap-4 mb-2 opacity-50 text-[9px] font-black uppercase text-center">
                                <div>OLHO</div><div>ESFÉRICO</div><div>CILÍNDRICO</div><div>EIXO</div>
                            </div>
                            <div className="text-center font-black text-indigo-700 text-sm flex items-center justify-center">O.D.</div>
                            <input type="number" step="0.25" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.sphereOdLonge} onChange={e => setFormData({...formData, sphereOdLonge: Number(e.target.value)})} placeholder="0.00" />
                            <input type="number" step="0.25" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.cylOdLonge} onChange={e => setFormData({...formData, cylOdLonge: Number(e.target.value)})} placeholder="0.00" />
                            <input type="number" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.axisOdLonge} onChange={e => setFormData({...formData, axisOdLonge: Number(e.target.value)})} placeholder="0" />
                            
                            <div className="text-center font-black text-indigo-700 text-sm flex items-center justify-center">O.E.</div>
                            <input type="number" step="0.25" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.sphereOeLonge} onChange={e => setFormData({...formData, sphereOeLonge: Number(e.target.value)})} placeholder="0.00" />
                            <input type="number" step="0.25" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.cylOeLonge} onChange={e => setFormData({...formData, cylOeLonge: Number(e.target.value)})} placeholder="0.00" />
                            <input type="number" className="bg-white border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.axisOeLonge} onChange={e => setFormData({...formData, axisOeLonge: Number(e.target.value)})} placeholder="0" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Info className="w-4 h-4"/> Adição & Medidas Técnicas
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Adição (ADD)</label><input type="number" step="0.25" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.addition} onChange={e => setFormData({...formData, addition: Number(e.target.value)})} /></div>
                            <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">DNP O.D.</label><input type="number" step="0.5" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.dnpOd} onChange={e => setFormData({...formData, dnpOd: Number(e.target.value)})} /></div>
                            <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">DNP O.E.</label><input type="number" step="0.5" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.dnpOe} onChange={e => setFormData({...formData, dnpOe: Number(e.target.value)})} /></div>
                            <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Altura O.D.</label><input type="number" step="0.5" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.heightOd} onChange={e => setFormData({...formData, heightOd: Number(e.target.value)})} /></div>
                            <div><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Altura O.E.</label><input type="number" step="0.5" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold text-center" value={formData.heightOe} onChange={e => setFormData({...formData, heightOe: Number(e.target.value)})} /></div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Observações Clínicas / Laboratório</label>
                        <textarea className="w-full bg-gray-50 border-none rounded-[2rem] p-6 text-sm font-bold min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" value={formData.observations || ''} onChange={e => setFormData({...formData, observations: e.target.value})} placeholder="Instruções de montagem, prisma ou notas médicas..."></textarea>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default OpticalRxEditor;
