
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ServiceClient, ServiceItem, ServiceAppointment, Contact, TransactionType, TransactionStatus, Transaction } from '../types';
// Fix: Added missing X and Info icon imports from lucide-react
import { Calendar, User, ClipboardList, Plus, Search, Trash2, Clock, DollarSign, CheckCircle, Mail, Phone, FileHeart, Stethoscope, AlertCircle, Shield, Paperclip, Eye, History, UserCheck, Heart, AlertTriangle, FileText, Image as ImageIcon, Loader2, X, Info } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import AttachmentModal from './AttachmentModal';

export type ServiceModuleSection = 'CALENDAR' | 'CLIENTS' | 'SERVICES';

interface ServiceModuleProps {
    moduleTitle: string;
    clientLabel: string;
    serviceLabel: string;
    transactionCategory: string;
    activeSection: ServiceModuleSection;
    clients: ServiceClient[];
    services: ServiceItem[];
    appointments: ServiceAppointment[];
    contacts: Contact[];
    onSaveClient: (c: Partial<ServiceClient>) => void;
    onDeleteClient: (id: string) => void;
    onSaveService: (s: Partial<ServiceItem>) => void;
    onDeleteService: (id: string) => void;
    onSaveAppointment: (a: Partial<ServiceAppointment>) => void;
    onDeleteAppointment: (id: string) => void;
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
}

const ServiceModule: React.FC<ServiceModuleProps> = ({ 
    moduleTitle, clientLabel, serviceLabel, transactionCategory, activeSection,
    clients, services, appointments, contacts,
    onSaveClient, onDeleteClient, onSaveService, onDeleteService,
    onSaveAppointment, onDeleteAppointment, onAddTransaction
}) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [searchTerm, setSearchTerm] = useState('');

    // --- MODALS STATES ---
    const [isClientModalOpen, setClientModalOpen] = useState(false);
    const [clientForm, setClientForm] = useState<Partial<ServiceClient>>({});
    const [clientModalTab, setClientModalTab] = useState<'CONTACT' | 'CLINICAL' | 'HISTORY' | 'FILES'>('CONTACT');
    
    const [isApptModalOpen, setApptModalOpen] = useState(false);
    const [apptForm, setApptForm] = useState<Partial<ServiceAppointment>>({});

    const [isServiceModalOpen, setServiceModalOpen] = useState(false);
    const [serviceForm, setServiceForm] = useState<Partial<ServiceItem>>({});

    const [attachmentTarget, setAttachmentTarget] = useState<{type: 'CLIENT' | 'APPT', id: string} | null>(null);

    // Autocomplete State
    const [clientSearchName, setClientSearchName] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- HANDLERS ---

    const handleOpenClientModal = (client?: ServiceClient) => {
        if (client) {
            setClientForm({ ...client });
            setClientSearchName(client.contactName || '');
        } else {
            setClientForm({ attachments: [] });
            setClientSearchName('');
        }
        setClientModalTab('CONTACT');
        setClientModalOpen(true);
    };

    const handleSaveClient = (e: React.FormEvent) => {
        e.preventDefault();
        let resolvedContactId = clientForm.contactId;
        const exactMatch = contacts.find(c => c.name.toLowerCase() === clientSearchName.trim().toLowerCase());
        if (exactMatch) resolvedContactId = exactMatch.id;

        onSaveClient({
            ...clientForm,
            id: clientForm.id || crypto.randomUUID(),
            contactId: resolvedContactId,
            contactName: exactMatch ? exactMatch.name : clientSearchName.trim(),
            moduleTag: 'odonto'
        });
        setClientModalOpen(false);
    };

    const handleSaveAppointment = (e: React.FormEvent) => {
        e.preventDefault();
        onSaveAppointment({
            ...apptForm,
            id: apptForm.id || crypto.randomUUID(),
            status: apptForm.status || 'SCHEDULED',
            moduleTag: 'odonto'
        });
        setApptModalOpen(false);
    };

    const handleUpdateAttachments = async (files: FileList) => {
        if (!attachmentTarget) return;
        
        try {
            const token = localStorage.getItem('token');
            const uploadData = new FormData();
            Array.from(files).forEach(f => uploadData.append('files', f));

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: uploadData
            });

            if (!res.ok) throw new Error("Upload Error");
            const { urls } = await res.json();
            
            if (attachmentTarget.type === 'CLIENT') {
                const current = clientForm.attachments || [];
                const updated = [...current, ...urls];
                setClientForm({ ...clientForm, attachments: updated });
                onSaveClient({ ...clientForm, attachments: updated, moduleTag: 'odonto' });
            } else {
                const current = apptForm.attachments || [];
                const updated = [...current, ...urls];
                setApptForm({ ...apptForm, attachments: updated });
                onSaveAppointment({ ...apptForm, attachments: updated, moduleTag: 'odonto' });
            }
            showAlert("Arquivos salvos com sucesso.", "success");
        } catch (e) {
            showAlert("Erro ao subir arquivos.", "error");
        }
    };

    const handleRemoveAttachment = (index: number) => {
        if (!attachmentTarget) return;
        if (attachmentTarget.type === 'CLIENT') {
            const updated = (clientForm.attachments || []).filter((_, i) => i !== index);
            setClientForm({ ...clientForm, attachments: updated });
            onSaveClient({ ...clientForm, attachments: updated, moduleTag: 'odonto' });
        } else {
            const updated = (apptForm.attachments || []).filter((_, i) => i !== index);
            setApptForm({ ...apptForm, attachments: updated });
            onSaveAppointment({ ...apptForm, attachments: updated, moduleTag: 'odonto' });
        }
    };

    const patientAppointments = useMemo(() => {
        if (!clientForm.id) return [];
        return appointments
            .filter(a => a.clientId === clientForm.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [appointments, clientForm.id]);

    const filteredClients = clients.filter(c => c.contactName?.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(clientSearchName.toLowerCase()));

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-sky-600 rounded-xl text-white shadow-lg shadow-sky-100"><ClipboardList className="w-6 h-6"/></div>
                        {moduleTitle}
                        <span className="text-gray-400 font-light text-xl">| 
                            {activeSection === 'CALENDAR' ? ' Agenda' : 
                             activeSection === 'CLIENTS' ? ` ${clientLabel}s` : 
                             ` ${serviceLabel}s`}
                        </span>
                    </h1>
                </div>
                <div className="flex gap-2">
                    {activeSection === 'CLIENTS' && (
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            <input 
                                type="text" 
                                placeholder={`Buscar ${clientLabel.toLowerCase()}...`}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm w-64 transition-all"
                            />
                        </div>
                    )}
                    <button 
                        onClick={() => {
                            if (activeSection === 'CALENDAR') { setApptForm({ attachments: [] }); setApptModalOpen(true); }
                            else if (activeSection === 'CLIENTS') handleOpenClientModal();
                            else { setServiceForm({}); setServiceModalOpen(true); }
                        }}
                        className="bg-sky-600 text-white px-5 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-sky-700 shadow-lg shadow-sky-100 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Novo {activeSection === 'CALENDAR' ? 'Agendamento' : activeSection === 'CLIENTS' ? clientLabel : serviceLabel}
                    </button>
                </div>
            </div>

            {/* --- LISTA DE PACIENTES --- */}
            {activeSection === 'CLIENTS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map(c => (
                        <div key={c.id} onClick={() => handleOpenClientModal(c)} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
                            {(c.allergies || c.medicalConditions) && (
                                <div className="absolute top-0 right-0 p-3">
                                    <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                                </div>
                            )}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 font-black text-xl">
                                    {c.contactName?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 group-hover:text-sky-600 transition-colors">{c.contactName}</h3>
                                    <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3"/> {c.contactPhone || 'Sem telefone'}</p>
                                </div>
                            </div>
                            <div className="space-y-2 mb-4">
                                {c.insurance && <span className="inline-block px-2 py-1 bg-sky-50 text-sky-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-sky-100">{c.insurance}</span>}
                                {c.medicalConditions && <p className="text-[10px] text-rose-600 font-bold uppercase truncate"><Heart className="w-3 h-3 inline mr-1"/> {c.medicalConditions}</p>}
                            </div>
                            <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Prontuário Digital</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenClientModal(c); }} className="p-2 text-sky-600 bg-sky-50 rounded-lg hover:bg-sky-100"><Eye className="w-4 h-4"/></button>
                                    <button onClick={(e) => { e.stopPropagation(); onDeleteClient(c.id); }} className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- AGENDA --- */}
            {activeSection === 'CALENDAR' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {appointments.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(appt => (
                        <div key={appt.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:border-sky-300 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-sky-50 p-3 rounded-2xl text-sky-600">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-gray-900">{new Date(appt.date).toLocaleDateString('pt-BR')}</p>
                                    <p className="text-xs text-gray-400 font-bold uppercase">{new Date(appt.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg mb-1">{appt.clientName}</h3>
                            <p className="text-sky-600 text-sm font-bold uppercase tracking-widest mb-4">{appt.serviceName || 'Consulta'}</p>
                            
                            <div className="flex gap-2 mb-6">
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : appt.status === 'CANCELED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {appt.status}
                                </span>
                                {(appt.attachments?.length || 0) > 0 && (
                                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1">
                                        <Paperclip className="w-3 h-3" /> {appt.attachments?.length}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-gray-50">
                                <button 
                                    onClick={() => { setApptForm(appt); setApptModalOpen(true); }}
                                    className="flex-1 bg-gray-50 text-gray-600 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-sky-50 hover:text-sky-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Stethoscope className="w-4 h-4" /> Evolução
                                </button>
                                <button 
                                    onClick={() => onDeleteAppointment(appt.id)}
                                    className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- MODAL DO PACIENTE (PRONTUÁRIO) --- */}
            {isClientModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border border-slate-100">
                        <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-sky-100">
                                    {clientForm.contactName?.charAt(0) || <User className="w-8 h-8"/>}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900">{clientForm.id ? clientForm.contactName : `Novo ${clientLabel}`}</h2>
                                    <div className="flex gap-3 mt-1">
                                        <div className="flex bg-slate-200/50 p-1 rounded-xl">
                                            {[{id:'CONTACT', label:'Dados', icon:User}, {id:'CLINICAL', label:'Saúde', icon:FileHeart}, {id:'HISTORY', label:'Prontuário', icon:History}, {id:'FILES', label:'Exames/Anexos', icon:ImageIcon}].map(t => (
                                                <button key={t.id} onClick={() => setClientModalTab(t.id as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${clientModalTab === t.id ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setClientModalOpen(false)} className="p-3 hover:bg-white rounded-full transition-all text-gray-400 shadow-sm border border-transparent hover:border-gray-200"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10">
                            {(clientForm.allergies || clientForm.medicalConditions) && (
                                <div className="mb-8 p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-start gap-4 animate-pulse">
                                    <AlertCircle className="w-6 h-6 text-rose-600 mt-1 shrink-0" />
                                    <div>
                                        <h4 className="text-rose-800 font-black uppercase text-xs tracking-widest">Alerta Clínico Crítico</h4>
                                        <p className="text-rose-700 text-sm font-bold">{[clientForm.allergies, clientForm.medicalConditions].filter(Boolean).join(' | ')}</p>
                                    </div>
                                </div>
                            )}

                            {/* ABA CADASTRO */}
                            {clientModalTab === 'CONTACT' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                                    <div className="space-y-6">
                                        <div className="relative" ref={contactDropdownRef}>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome Completo</label>
                                            <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-sky-500" value={clientSearchName} onFocus={() => setShowContactDropdown(true)} onChange={(e) => {setClientSearchName(e.target.value); if(!clientForm.id) setClientForm({...clientForm, contactId: undefined}); setShowContactDropdown(true);}} required />
                                            {showContactDropdown && clientSearchName && filteredContacts.length > 0 && (
                                                <div className="absolute z-20 w-full bg-white mt-1 border border-gray-100 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-2">
                                                    {filteredContacts.map(c => <button key={c.id} type="button" onClick={() => {setClientSearchName(c.name); setClientForm({...clientForm, contactId: c.id, contactPhone: c.phone, contactEmail: c.email}); setShowContactDropdown(false);}} className="w-full text-left px-4 py-3 hover:bg-sky-50 rounded-xl text-sm font-bold flex justify-between">{c.name} <UserCheck className="w-4 h-4 text-sky-500"/></button>)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Telefone</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold" value={clientForm.contactPhone || ''} onChange={e => setClientForm({...clientForm, contactPhone: e.target.value})} /></div>
                                            <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Data Nasc.</label><input type="date" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold" value={clientForm.birthDate || ''} onChange={e => setClientForm({...clientForm, birthDate: e.target.value})} /></div>
                                        </div>
                                        <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2">E-mail</label><input type="email" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold" value={clientForm.contactEmail || ''} onChange={e => setClientForm({...clientForm, contactEmail: e.target.value})} /></div>
                                    </div>
                                    <div className="space-y-6 bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
                                        <h3 className="font-black text-gray-700 uppercase tracking-widest text-xs mb-4">Responsável Legal (Menores)</h3>
                                        <div className="space-y-4">
                                            <div><input type="text" placeholder="Nome do Responsável" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={clientForm.legalGuardianName || ''} onChange={e => setClientForm({...clientForm, legalGuardianName: e.target.value})} /></div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="text" placeholder="CPF" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={clientForm.legalGuardianDocument || ''} onChange={e => setClientForm({...clientForm, legalGuardianDocument: e.target.value})} />
                                                <input type="text" placeholder="Celular" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={clientForm.legalGuardianPhone || ''} onChange={e => setClientForm({...clientForm, legalGuardianPhone: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ABA SAÚDE */}
                            {clientModalTab === 'CLINICAL' && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="p-6 bg-rose-50/30 border border-rose-100 rounded-3xl">
                                                <h3 className="font-black text-rose-600 uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Alergias Importantes</h3>
                                                <textarea className="w-full bg-white border border-rose-100 rounded-2xl p-4 text-sm font-bold text-rose-900 focus:ring-2 focus:ring-rose-500 outline-none" rows={3} value={clientForm.allergies || ''} onChange={e => setClientForm({...clientForm, allergies: e.target.value})} placeholder="Ex: Penicilina, Látex, Anestésicos..." />
                                            </div>
                                            <div className="p-6 bg-amber-50/30 border border-amber-100 rounded-3xl">
                                                <h3 className="font-black text-amber-600 uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><Heart className="w-4 h-4"/> Condições Médicas</h3>
                                                <textarea className="w-full bg-white border border-amber-100 rounded-2xl p-4 text-sm font-bold text-amber-900 focus:ring-2 focus:ring-amber-500 outline-none" rows={3} value={clientForm.medicalConditions || ''} onChange={e => setClientForm({...clientForm, medicalConditions: e.target.value})} placeholder="Ex: Hipertensão, Diabetes, Problemas cardíacos..." />
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="p-6 bg-sky-50/30 border border-sky-100 rounded-3xl">
                                                <h3 className="font-black text-sky-600 uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><Shield className="w-4 h-4"/> Convênio Médico / Dental</h3>
                                                <div className="space-y-3">
                                                    <input type="text" placeholder="Nome do Convênio" className="w-full bg-white border border-sky-100 rounded-xl px-4 py-3 text-sm font-bold" value={clientForm.insurance || ''} onChange={e => setClientForm({...clientForm, insurance: e.target.value})} />
                                                    <input type="text" placeholder="Número da Carteirinha" className="w-full bg-white border border-sky-100 rounded-xl px-4 py-3 text-sm font-bold" value={clientForm.insuranceNumber || ''} onChange={e => setClientForm({...clientForm, insuranceNumber: e.target.value})} />
                                                    <input type="text" placeholder="Plano / Categoria" className="w-full bg-white border border-sky-100 rounded-xl px-4 py-3 text-sm font-bold" value={clientForm.insurancePlan || ''} onChange={e => setClientForm({...clientForm, insurancePlan: e.target.value})} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Medicamentos em Uso Permanente</label>
                                                <textarea className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold" rows={3} value={clientForm.medications || ''} onChange={e => setClientForm({...clientForm, medications: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ABA PRONTUÁRIO (HISTÓRICO) */}
                            {clientModalTab === 'HISTORY' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-black text-gray-700 uppercase tracking-widest text-xs">Cronologia de Atendimentos</h3>
                                        <button onClick={() => { setApptForm({ clientId: clientForm.id, clientName: clientForm.contactName, attachments: [] }); setApptModalOpen(true); }} className="text-[10px] font-black uppercase bg-sky-600 text-white px-4 py-2 rounded-xl hover:bg-sky-700 shadow-lg shadow-sky-100 transition-all">+ Novo Atendimento</button>
                                    </div>
                                    <div className="space-y-4">
                                        {patientAppointments.length === 0 ? (
                                            <div className="py-20 text-center text-gray-300 border-2 border-dashed border-gray-100 rounded-[2rem]">
                                                <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p className="font-bold">Nenhum atendimento registrado ainda.</p>
                                            </div>
                                        ) : (
                                            patientAppointments.map(appt => (
                                                <div key={appt.id} className="bg-slate-50 border border-slate-100 p-6 rounded-3xl relative hover:border-sky-200 transition-all group">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex gap-4">
                                                            <div className="w-12 h-12 bg-white rounded-2xl flex flex-col items-center justify-center border border-slate-100">
                                                                <span className="text-[10px] font-black text-sky-600 leading-none">{new Date(appt.date).toLocaleDateString('pt-BR', {day:'2-digit'})}</span>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase leading-none mt-0.5">{new Date(appt.date).toLocaleDateString('pt-BR', {month:'short'})}</span>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-gray-800 uppercase text-xs tracking-wider">{appt.serviceName || 'Consulta Geral'}</h4>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{new Date(appt.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} • Dr(a). Profissional</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {(appt.attachments?.length || 0) > 0 && <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1"><Paperclip className="w-3 h-3"/> {appt.attachments?.length}</span>}
                                                            <button onClick={() => { setApptForm(appt); setApptModalOpen(true); }} className="p-2 text-sky-600 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-sky-50"><FileText className="w-4 h-4"/></button>
                                                        </div>
                                                    </div>
                                                    {appt.clinicalNotes && (
                                                        <div className="bg-white p-4 rounded-2xl border border-slate-100 text-sm text-gray-600 italic leading-relaxed">
                                                            "{appt.clinicalNotes}"
                                                        </div>
                                                    )}
                                                    {appt.notes && <p className="text-[10px] text-gray-400 mt-3 font-bold uppercase"><Info className="w-3 h-3 inline mr-1"/> Obs Adm: {appt.notes}</p>}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ABA ANEXOS GERAIS */}
                            {clientModalTab === 'FILES' && (
                                <div className="animate-fade-in">
                                    <div className="flex justify-between items-center mb-8">
                                        <div>
                                            <h3 className="font-black text-gray-700 uppercase tracking-widest text-xs">Central de Imagens e Documentos</h3>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">RX, Fotos Intraorais, Exames de Sangue e Laudos</p>
                                        </div>
                                        <button onClick={() => setAttachmentTarget({type: 'CLIENT', id: clientForm.id!})} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95"><Paperclip className="w-4 h-4"/> Anexar Arquivo</button>
                                    </div>

                                    {(clientForm.attachments?.length || 0) === 0 ? (
                                        <div className="py-20 text-center text-gray-300 border-2 border-dashed border-gray-100 rounded-[3rem]">
                                            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                            <p className="font-bold">Nenhuma imagem ou documento armazenado.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {clientForm.attachments?.map((url, idx) => {
                                                const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('image');
                                                return (
                                                    <div key={idx} className="group relative bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden aspect-square hover:border-indigo-400 transition-all shadow-sm">
                                                        {isImage ? (
                                                            <img src={url} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                                                                <FileText className="w-10 h-10 text-indigo-400 mb-2" />
                                                                <span className="text-[8px] font-black text-gray-400 uppercase break-all">DOCUMENTO</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                                            <a href={url} target="_blank" className="p-2 bg-white text-indigo-600 rounded-xl hover:scale-110 transition-transform"><Eye className="w-5 h-5"/></a>
                                                            <button onClick={() => handleRemoveAttachment(idx)} className="p-2 bg-white text-rose-500 rounded-xl hover:scale-110 transition-transform"><Trash2 className="w-5 h-5"/></button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                            <button type="button" onClick={() => setClientModalOpen(false)} className="px-8 py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors uppercase text-xs tracking-widest">Fechar Prontuário</button>
                            <button onClick={handleSaveClient} className="px-10 py-4 bg-sky-600 text-white rounded-2xl hover:bg-sky-700 text-sm font-black shadow-xl shadow-sky-100 transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest">Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DE ATENDIMENTO (EVOLUÇÃO) --- */}
            {isApptModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-8 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Atendimento Clínico</h2>
                                <p className="text-[10px] text-sky-600 font-black uppercase tracking-widest mt-1">{apptForm.clientName || 'Paciente'}</p>
                            </div>
                            <button onClick={() => setApptModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <form onSubmit={handleSaveAppointment} className="space-y-6">
                            {!apptForm.clientId && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Selecionar Paciente</label>
                                    <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-sky-500" value={apptForm.clientId || ''} onChange={e => setApptForm({...apptForm, clientId: e.target.value, clientName: clients.find(c=>c.id===e.target.value)?.contactName})} required>
                                        <option value="">Selecione...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.contactName}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Procedimento</label>
                                    <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-sky-500" value={apptForm.serviceId || ''} onChange={e => setApptForm({...apptForm, serviceId: e.target.value, serviceName: services.find(s=>s.id===e.target.value)?.name})}>
                                        <option value="">Consulta Geral</option>
                                        {services.map(s => <option key={s.id} value={s.id}>{s.name} - {s.defaultPrice}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Data & Hora</label>
                                    <input type="datetime-local" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold" value={apptForm.date || ''} onChange={e => setApptForm({...apptForm, date: e.target.value})} required />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-sky-600 mb-2 ml-1">Evolução Clínica (Anotações do Dentista)</label>
                                <textarea className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-sky-500" rows={5} value={apptForm.clinicalNotes || ''} onChange={e => setApptForm({...apptForm, clinicalNotes: e.target.value})} placeholder="Descreva os procedimentos realizados, anestesia, intercorrências e orientações pós-operatórias..." />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Situação</label>
                                    <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-2 text-xs font-bold" value={apptForm.status || 'SCHEDULED'} onChange={e => setApptForm({...apptForm, status: e.target.value as any})}>
                                        <option value="SCHEDULED">Agendado</option>
                                        <option value="COMPLETED">Concluído</option>
                                        <option value="CANCELED">Cancelado</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Arquivos da Sessão</label>
                                    <button type="button" onClick={() => setAttachmentTarget({type: 'APPT', id: apptForm.id!})} className="w-full bg-indigo-50 text-indigo-700 py-2 rounded-2xl text-[10px] font-black uppercase border border-indigo-100 flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors">
                                        <Paperclip className="w-3 h-3" /> {(apptForm.attachments?.length || 0) > 0 ? `${apptForm.attachments?.length} Anexos` : 'Anexar RX/Foto'}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-gray-50 flex gap-3">
                                <button type="button" onClick={() => setApptModalOpen(false)} className="flex-1 py-4 text-gray-400 font-bold uppercase text-xs tracking-widest">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-sky-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95">Salvar Evolução</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE SERVIÇO (PROCEDIMENTO) */}
            {isServiceModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Novo Procedimento</h2>
                            <button onClick={() => setServiceModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); onSaveService({ ...serviceForm, id: serviceForm.id || crypto.randomUUID(), type: 'SERVICE', moduleTag: 'odonto' }); setServiceModalOpen(false); }} className="space-y-4">
                            <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome do Procedimento</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold" value={serviceForm.name || ''} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} required placeholder="Ex: Canal, Profilaxia, Restauração" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Código TUSS</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold" value={serviceForm.code || ''} onChange={e => setServiceForm({...serviceForm, code: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Preço (R$)</label><input type="number" step="0.01" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold" value={serviceForm.defaultPrice || ''} onChange={e => setServiceForm({...serviceForm, defaultPrice: Number(e.target.value)})} required /></div>
                            </div>
                            <button type="submit" className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all mt-4">Salvar Procedimento</button>
                        </form>
                    </div>
                </div>
            )}

            <AttachmentModal 
                isOpen={!!attachmentTarget}
                onClose={() => setAttachmentTarget(null)}
                urls={attachmentTarget?.type === 'CLIENT' ? (clientForm.attachments || []) : (apptForm.attachments || [])}
                onAdd={handleUpdateAttachments}
                onRemove={handleRemoveAttachment}
                title={attachmentTarget?.type === 'CLIENT' ? `Documentos: ${clientForm.contactName}` : `Anexos do Atendimento`}
            />
        </div>
    );
};

export default ServiceModule;
