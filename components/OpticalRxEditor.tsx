
import React, { useState, useEffect, useMemo } from 'react';
import { OpticalRx, Contact, Branch, Laboratory, LensType } from '../types';
import { ArrowLeft, Save, Eye, Stethoscope, Info, Store, Microscope, Glasses, User, Calendar, Award, Package, HeartPulse, Activity, UserPlus, X, Phone, Mail, RefreshCw } from 'lucide-react';
import { useAlert } from './AlertSystem';
import { api } from '../services/storageService';

interface OpticalRxEditorProps {
    contacts: Contact[];
    branches: Branch[];
    laboratories?: Laboratory[];
    initialData?: OpticalRx | null;
    onSave: (rx: OpticalRx) => void;
    onCancel: () => void;
}

const LENS_TYPES: {id: LensType, label: string}[] = [
    { id: 'MONOFOCAL', label: 'Monofocal' },
    { id: 'BIFOCAL', label: 'Bifocal' },
    { id: 'MULTIFOCAL', label: 'Multifocal / Progressiva' },
    { id: 'OCUPACIONAL', label: 'Ocupacional / Regressiva' }
];

const OpticalRxEditor: React.FC<OpticalRxEditorProps> = ({ contacts, branches, laboratories = [], initialData, onSave, onCancel }) => {
    const { showAlert } = useAlert();
    const [formData, setFormData] = useState<Partial<OpticalRx>>({
        rxDate: new Date().toISOString().split('T')[0],
        expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        lensType: 'MONOFOCAL',
        status: 'PENDING'
    });

    // Ordenação alfabética dos contatos para o select
    const sortedContacts = useMemo(() => {
        return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
    }, [contacts]);

    // Estados para Cadastro Rápido de Contato
    const [showQuickContact, setShowQuickContact] = useState(false);
    const [quickContact, setQuickContact] = useState({ name: '', phone: '', email: '' });
    const [isSavingContact, setIsSavingContact] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            const num = `RX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            setFormData(prev => ({ ...prev, rxNumber: num }));
        }
    }, [initialData]);

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
            
            // Força a seleção do novo contato imediatamente no formulário
            setFormData(prev => ({ 
                ...prev, 
                contactId: newId,
                contactName: contact.name // Preenche o nome virtualmente para exibição imediata
            }));
            
            setShowQuickContact(false);
            setQuickContact({ name: '', phone: '', email: '' });
            showAlert("Novo cliente cadastrado e selecionado!", "success");
        } catch (err) {
            showAlert("Erro ao cadastrar cliente.", "error");
        } finally {
            setIsSavingContact(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.contactId) return showAlert("Selecione um cliente.", "warning");
        if (!formData.branchId) return showAlert("Selecione a unidade de atendimento.", "warning");
        
        const contact = contacts.find(c => c.id === formData.contactId);
        onSave({
            ...formData,
            id: formData.id || crypto.randomUUID(),
            contactName: contact?.name || formData.contactName,
            rxDate: formData.rxDate || new Date().toISOString().split('T')[0]
        } as OpticalRx);
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Receita Oftalmológica</h1>
                            <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">{formData.rxNumber}</span>
                        </div>
                        <p className="text-gray-500 font-medium">Controle técnico e medidas de alta precisão.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">Descartar</button>
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Finalizar RX
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Seção 1: Paciente */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><User className="w-5 h-5"/></div>
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">1. Dados do Paciente</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <div className="flex justify-between items-center mb-2 ml-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400">Paciente / Cliente</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowQuickContact(true)}
                                        className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1 hover:underline"
                                    >
                                        <UserPlus className="w-3 h-3" /> Novo Cliente
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        className="flex-1 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={formData.contactId || ''}
                                        onChange={e => setFormData({...formData, contactId: e.target.value})}
                                        required
                                    >
                                        <option value="">Selecione o paciente...</option>
                                        {/* Lista ordenada alfabeticamente */}
                                        {sortedContacts.map(c => <option key={c.id} value={c.id}>{c.name} (ID: {c.id.substring(0,4)})</option>)}
                                    </select>
                                    <div className="bg-slate-100 p-4 rounded-2xl flex items-center justify-center">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CID: {formData.contactId?.substring(0,4) || '----'}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Unidade de Atendimento</label>
                                <div className="relative">
                                    <Store className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <select 
                                        className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                        value={formData.branchId || ''}
                                        onChange={e => setFormData({...formData, branchId: e.target.value})}
                                        required
                                    >
                                        <option value="">Selecione a filial...</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Data da Receita</label>
                                    <input type="date" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.rxDate} onChange={e => setFormData({...formData, rxDate: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Validade Sugerida</label>
                                    <input type="date" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seção 2: Prescrição Técnica (OD/OE) */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><Activity className="w-5 h-5"/></div>
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">2. Prescrição Técnica (Longe)</h3>
                        </div>
                        
                        <div className="space-y-8">
                            {/* Olho Direito */}
                            <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="bg-indigo-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black">O.D.</span>
                                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">Olho Direito</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-indigo-400 mb-1">ESFÉRICO</label><input type="number" step="0.25" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.sphereOdLonge || ''} onChange={e => setFormData({...formData, sphereOdLonge: Number(e.target.value)})} placeholder="0.00" /></div>
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-indigo-400 mb-1">CILÍNDRICO</label><input type="number" step="0.25" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.cylOdLonge || ''} onChange={e => setFormData({...formData, cylOdLonge: Number(e.target.value)})} placeholder="0.00" /></div>
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-indigo-400 mb-1">EIXO</label><input type="number" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.axisOdLonge || ''} onChange={e => setFormData({...formData, axisOdLonge: Number(e.target.value)})} placeholder="0°" /></div>
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-indigo-400 mb-1">PRISMA</label><input type="number" step="0.5" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.prismaOdLonge || ''} onChange={e => setFormData({...formData, prismaOdLonge: Number(e.target.value)})} placeholder="Δ" /></div>
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-indigo-400 mb-1">BASE</label><input type="text" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.baseOdLonge || ''} onChange={e => setFormData({...formData, baseOdLonge: e.target.value.toUpperCase()})} placeholder="BASE" /></div>
                                </div>
                            </div>

                            {/* Olho Esquerdo */}
                            <div className="bg-sky-50/30 p-6 rounded-3xl border border-sky-100/50">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="bg-sky-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black">O.E.</span>
                                    <span className="text-xs font-bold text-sky-700 uppercase tracking-widest">Olho Esquerdo</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-sky-400 mb-1">ESFÉRICO</label><input type="number" step="0.25" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.sphereOeLonge || ''} onChange={e => setFormData({...formData, sphereOeLonge: Number(e.target.value)})} placeholder="0.00" /></div>
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-sky-400 mb-1">CILÍNDRICO</label><input type="number" step="0.25" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.cylOeLonge || ''} onChange={e => setFormData({...formData, cylOeLonge: Number(e.target.value)})} placeholder="0.00" /></div>
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-sky-400 mb-1">EIXO</label><input type="number" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.axisOeLonge || ''} onChange={e => setFormData({...formData, axisOeLonge: Number(e.target.value)})} placeholder="0°" /></div>
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-sky-400 mb-1">PRISMA</label><input type="number" step="0.5" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.prismaOeLonge || ''} onChange={e => setFormData({...formData, prismaOeLonge: Number(e.target.value)})} placeholder="Δ" /></div>
                                    <div className="md:col-span-1"><label className="block text-[9px] font-black text-sky-400 mb-1">BASE</label><input type="text" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center" value={formData.baseOeLonge || ''} onChange={e => setFormData({...formData, baseOeLonge: e.target.value.toUpperCase()})} placeholder="BASE" /></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seção 3: Medidas Ópticas */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Eye className="w-5 h-5"/></div>
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">3. Medidas de Montagem</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                            <div className="md:col-span-1 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                <label className="block text-[9px] font-black text-amber-600 mb-1 uppercase tracking-tighter">Adição (ADD)</label>
                                <input type="number" step="0.25" className="w-full bg-white rounded-xl p-3 text-sm font-black text-center border-none" value={formData.addition || ''} onChange={e => setFormData({...formData, addition: Number(e.target.value)})} placeholder="0.00" />
                            </div>
                            <div><label className="block text-[9px] font-black text-gray-400 mb-1 uppercase">DNP O.D.</label><input type="number" step="0.5" className="w-full bg-gray-50 rounded-xl p-3 text-sm font-black text-center" value={formData.dnpOd || ''} onChange={e => setFormData({...formData, dnpOd: Number(e.target.value)})} /></div>
                            <div><label className="block text-[9px] font-black text-gray-400 mb-1 uppercase">DNP O.E.</label><input type="number" step="0.5" className="w-full bg-gray-50 rounded-xl p-3 text-sm font-black text-center" value={formData.dnpOe || ''} onChange={e => setFormData({...formData, dnpOe: Number(e.target.value)})} /></div>
                            <div><label className="block text-[9px] font-black text-gray-400 mb-1 uppercase">Altura O.D.</label><input type="number" step="0.5" className="w-full bg-gray-50 rounded-xl p-3 text-sm font-black text-center" value={formData.heightOd || ''} onChange={e => setFormData({...formData, heightOd: Number(e.target.value)})} /></div>
                            <div><label className="block text-[9px] font-black text-gray-400 mb-1 uppercase">Altura O.E.</label><input type="number" step="0.5" className="w-full bg-gray-50 rounded-xl p-3 text-sm font-black text-center" value={formData.heightOe || ''} onChange={e => setFormData({...formData, heightOe: Number(e.target.value)})} /></div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Seção 4: Tipo de Lente & Recomendações */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Package className="w-5 h-5"/></div>
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">4. Especificação de Lentes</h3>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Tipo de Desenho</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {LENS_TYPES.map(type => (
                                        <button 
                                            key={type.id}
                                            type="button"
                                            onClick={() => setFormData({...formData, lensType: type.id})}
                                            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all border ${formData.lensType === type.id ? 'bg-purple-600 text-white border-purple-700 shadow-md' : 'bg-slate-50 text-slate-600 border-transparent hover:border-purple-200'}`}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Material Sugerido</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.lensMaterial || ''} onChange={e => setFormData({...formData, lensMaterial: e.target.value})} placeholder="Resina 1.67, Policarbonato..." />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Tratamentos (Antirreflexo, BlueControl...)</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.lensTreatments || ''} onChange={e => setFormData({...formData, lensTreatments: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Uso Indicado</label>
                                <select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={formData.usageInstructions || ''} onChange={e => setFormData({...formData, usageInstructions: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    <option value="PERMANENTE">Uso Permanente</option>
                                    <option value="LEITURA">Apenas Leitura / Perto</option>
                                    <option value="DISTANCIA">Apenas Distância / Longe</option>
                                    <option value="FOTOSSENSIVEL">Uso com Proteção Solar</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Seção 6: Profissional */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Award className="w-5 h-5"/></div>
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">5. Dados do Profissional</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Médico Oftalmologista / Optometrista</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.professionalName || ''} onChange={e => setFormData({...formData, professionalName: e.target.value})} placeholder="Nome completo" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Registro (CRM / CBO)</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.professionalReg || ''} onChange={e => setFormData({...formData, professionalReg: e.target.value})} placeholder="Ex: CRM-SP 123456" />
                            </div>
                        </div>
                    </div>

                    {/* Laboratório & Observações */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-indigo-400 mb-3 ml-1 tracking-widest">Laboratório de Montagem</label>
                            <div className="relative">
                                <Microscope className="w-5 h-5 text-indigo-400 absolute left-4 top-4" />
                                <select 
                                    className="w-full pl-12 py-4 bg-white/10 border-none rounded-2xl text-sm font-bold outline-none appearance-none cursor-pointer"
                                    value={formData.laboratoryId || ''}
                                    onChange={e => setFormData({...formData, laboratoryId: e.target.value})}
                                >
                                    <option value="" className="text-gray-900">Vincular laboratório...</option>
                                    {laboratories.map(lab => <option key={lab.id} value={lab.id} className="text-gray-900">{lab.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-indigo-400 mb-2 ml-1">Observações Internas</label>
                            <textarea 
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium min-h-[100px] outline-none focus:bg-white/10" 
                                value={formData.observations || ''} 
                                onChange={e => setFormData({...formData, observations: e.target.value})} 
                                placeholder="Anotações para o laboratório ou técnico de montagem..."
                            />
                        </div>
                    </div>
                </div>
            </form>

            {/* Modal de Cadastro Rápido de Contato */}
            {showQuickContact && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                                <UserPlus className="w-6 h-6 text-indigo-600" />
                                Cadastro Expresso
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
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">WhatsApp / Celular</label>
                                <div className="relative">
                                    <Phone className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        value={quickContact.phone}
                                        onChange={e => setQuickContact({...quickContact, phone: e.target.value})}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">E-mail</label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <input 
                                        type="email" 
                                        className="w-full pl-11 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        value={quickContact.email}
                                        onChange={e => setQuickContact({...quickContact, email: e.target.value})}
                                        placeholder="exemplo@email.com"
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
                                    Cadastrar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OpticalRxEditor;
