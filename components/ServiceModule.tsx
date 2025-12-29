

import React, { useState, useRef, useEffect, useMemo } from 'react';
/* Fix: Added missing Account import */
import { ServiceClient, ServiceItem, ServiceAppointment, Contact, ToothState, Anamnesis, Prescription, Transaction, Category, TransactionType, TransactionStatus, Account } from '../types';
import { Calendar, User, ClipboardList, Plus, Search, Trash2, Mail, Phone, FileHeart, Stethoscope, AlertCircle, Shield, Paperclip, Eye, History, Heart, AlertTriangle, FileText, Image as ImageIcon, X, Info, Pencil, Activity, FileCheck, Stethoscope as DentalIcon, Pill, Lock, Unlock, DollarSign, CheckCircle2 } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import AttachmentModal from './AttachmentModal';
import Odontogram from './Odontogram';

export type ServiceModuleSection = 'CALENDAR' | 'CLIENTS' | 'SERVICES';
type PatientTab = 'CONTACT' | 'ANAMNESIS' | 'ODONTOGRAM' | 'HISTORY' | 'PRESCRIPTIONS' | 'FILES';

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
    /* Fix: Account is now correctly imported */
    accounts: Account[];
    onSaveClient: (c: Partial<ServiceClient>) => void;
    onDeleteClient: (id: string) => void;
    onSaveService: (s: Partial<ServiceItem>) => void;
    onDeleteService: (id: string) => void;
    onSaveAppointment: (a: Partial<ServiceAppointment>) => void;
    onDeleteAppointment: (id: string) => void;
    onAddTransaction?: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
}

const ServiceModule: React.FC<ServiceModuleProps> = ({ 
    moduleTitle, clientLabel, serviceLabel, activeSection,
    clients, services, appointments, contacts, accounts,
    onSaveClient, onDeleteClient, onSaveService, onDeleteService,
    onSaveAppointment, onDeleteAppointment, onAddTransaction
}) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [searchTerm, setSearchTerm] = useState('');

    // Modais
    const [isClientModalOpen, setClientModalOpen] = useState(false);
    const [clientForm, setClientForm] = useState<Partial<ServiceClient>>({});
    const [clientModalTab, setClientModalTab] = useState<PatientTab>('CONTACT');
    
    const [isApptModalOpen, setApptModalOpen] = useState(false);
    const [apptForm, setApptForm] = useState<Partial<ServiceAppointment>>({});

    const [isServiceModalOpen, setServiceModalOpen] = useState(false);
    const [serviceForm, setServiceForm] = useState<Partial<ServiceItem>>({});

    const [attachmentTarget, setAttachmentTarget] = useState<{type: 'CLIENT' | 'APPT', id: string} | null>(null);
    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

    // Handlers Clínicos
    const handleToothClick = (tooth: number) => setSelectedTooth(tooth);

    const handleUpdateToothCondition = (condition: ToothState['condition']) => {
      if (selectedTooth === null) return;
      const currentStates = clientForm.odontogram || [];
      const index = currentStates.findIndex(s => s.tooth === selectedTooth);
      let updated;
      if (index > -1) {
        updated = [...currentStates];
        updated[index] = { ...updated[index], condition };
      } else {
        updated = [...currentStates, { tooth: selectedTooth, condition }];
      }
      setClientForm({ ...clientForm, odontogram: updated });
      setSelectedTooth(null);
    };

    const handleSaveAnamnesis = (field: keyof Anamnesis, value: any) => {
      setClientForm({
        ...clientForm,
        anamnesis: {
          ...(clientForm.anamnesis || { heartProblem: false, hypertension: false, diabetes: false, allergy: false, anestheticAllergy: false, bleedingProblem: false, isPregnant: false, bisphosphonates: false, medications: '', notes: '' }),
          [field]: value
        }
      });
    };

    const handleAddPrescription = () => {
      const newP: Prescription = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        content: '',
        type: 'RECEITA'
      };
      setClientForm({
        ...clientForm,
        prescriptions: [newP, ...(clientForm.prescriptions || [])]
      });
    };

    const handleOpenClientModal = (client?: ServiceClient) => {
        if (client) {
            setClientForm({ ...client });
        } else {
            setClientForm({ 
              odontogram: [], 
              prescriptions: [], 
              anamnesis: { heartProblem: false, hypertension: false, diabetes: false, allergy: false, anestheticAllergy: false, bleedingProblem: false, isPregnant: false, bisphosphonates: false, medications: '', notes: '' },
              attachments: [],
              moduleTag: 'odonto'
            });
        }
        setClientModalTab('CONTACT');
        setClientModalOpen(true);
    };

    const handleSaveClient = () => {
        onSaveClient({
            ...clientForm,
            id: clientForm.id || crypto.randomUUID(),
            moduleTag: 'odonto'
        });
        setClientModalOpen(false);
        showAlert("Prontuário atualizado com sucesso!", "success");
    };

    const handleBillAppointment = async (appt: ServiceAppointment) => {
        if (!onAddTransaction) return;
        
        const service = services.find(s => s.id === appt.serviceId);
        const amount = service?.defaultPrice || 0;

        const confirm = await showConfirm({
            title: "Gerar Cobrança",
            message: `Deseja gerar um lançamento financeiro de ${amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} para este atendimento?`,
            confirmText: "Sim, Gerar Lançamento"
        });

        if (confirm) {
            onAddTransaction({
                description: `Atendimento: ${appt.clientName} - ${appt.serviceName || 'Odontologia'}`,
                amount: amount,
                type: TransactionType.INCOME,
                category: 'Serviços Odontológicos',
                date: new Date().toISOString().split('T')[0],
                status: TransactionStatus.PENDING,
                accountId: accounts[0]?.id || '',
                contactId: clients.find(c => c.id === appt.clientId)?.contactId
            });
            showAlert("Lançamento financeiro gerado!", "success");
        }
    };

    const filteredClients = clients.filter(c => c.contactName?.toLowerCase().includes(searchTerm.toLowerCase()));
    const patientAppointments = useMemo(() => {
        if (!clientForm.id) return [];
        return appointments
            .filter(a => a.clientId === clientForm.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [appointments, clientForm.id]);

    const clinicalAlerts = useMemo(() => {
      if (!clientForm.anamnesis) return [];
      const alerts = [];
      const ana = clientForm.anamnesis;
      if (ana.heartProblem) alerts.push("Cardiopata");
      if (ana.hypertension) alerts.push("Hipertenso");
      if (ana.diabetes) alerts.push("Diabético");
      if (ana.allergy) alerts.push("Alergias");
      if (ana.anestheticAllergy) alerts.push("ALERGIA ANESTÉSICO");
      if (ana.bleedingProblem) alerts.push("Risco Hemorrágico");
      if (ana.bisphosphonates) alerts.push("Uso de Bifosfonatos");
      return alerts;
    }, [clientForm.anamnesis]);

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-sky-600 rounded-xl text-white shadow-lg"><DentalIcon className="w-6 h-6"/></div>
                        {moduleTitle}
                        <span className="text-gray-400 font-light text-xl">| 
                            {activeSection === 'CALENDAR' ? ' Agenda' : activeSection === 'CLIENTS' ? ` ${clientLabel}s` : ` ${serviceLabel}s`}
                        </span>
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleOpenClientModal()} className="bg-sky-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-sky-700 shadow-lg transition-all active:scale-95">
                        <Plus className="w-4 h-4" /> Novo {clientLabel}
                    </button>
                </div>
            </div>

            {/* Grid de Pacientes */}
            {activeSection === 'CLIENTS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map(c => (
                        <div key={c.id} onClick={() => handleOpenClientModal(c)} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
                            {c.odontogram && c.odontogram.length > 0 && <div className="absolute -right-4 -top-4 w-16 h-16 bg-sky-50 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 font-black text-xl">
                                    {c.contactName?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 group-hover:text-sky-600 transition-colors">{c.contactName}</h3>
                                    <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3"/> {c.contactPhone || 'Sem telefone'}</p>
                                </div>
                            </div>
                            <div className="space-y-2 mb-4 h-8 overflow-hidden">
                                {c.anamnesis?.anestheticAllergy && <span className="inline-block px-2 py-0.5 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse mr-2">Cuidado Anestésico</span>}
                                {c.insurance && <span className="inline-block px-2 py-0.5 bg-sky-50 text-sky-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-sky-100">{c.insurance}</span>}
                            </div>
                            <div className="pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                <span>Última Visita: 12/05</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 text-sky-600 bg-sky-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal do Prontuário Digital */}
            {isClientModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up border border-slate-100">
                        {/* Header do Prontuário */}
                        <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 bg-sky-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-xl">
                                    {clientForm.contactName?.charAt(0) || <User className="w-10 h-10"/>}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-gray-900">{clientForm.contactName || 'Novo Paciente'}</h2>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {clinicalAlerts.map(a => (
                                          <span key={a} className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 animate-pulse"><AlertTriangle className="w-3 h-3"/> {a}</span>
                                        ))}
                                        {clinicalAlerts.length === 0 && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><Shield className="w-3 h-3"/> Sem riscos críticos</span>}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setClientModalOpen(false)} className="p-3 hover:bg-white rounded-full text-gray-400 shadow-sm border border-transparent hover:border-gray-200"><X className="w-6 h-6" /></button>
                        </div>

                        {/* Navegação Interna */}
                        <div className="px-10 bg-white border-b border-gray-100 flex gap-2 overflow-x-auto py-2">
                            {[
                              { id: 'CONTACT', label: 'Cadastro', icon: User },
                              { id: 'ANAMNESIS', label: 'Anamnese', icon: FileHeart },
                              { id: 'ODONTOGRAM', label: 'Odontograma', icon: DentalIcon },
                              { id: 'HISTORY', label: 'Evolução', icon: History },
                              { id: 'PRESCRIPTIONS', label: 'Prescrições', icon: Pill },
                              { id: 'FILES', label: 'RX/Exames', icon: ImageIcon }
                            ].map(tab => (
                              <button
                                key={tab.id}
                                onClick={() => setClientModalTab(tab.id as PatientTab)}
                                className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 transition-all whitespace-nowrap ${clientModalTab === tab.id ? 'bg-sky-600 text-white shadow-lg shadow-sky-100' : 'text-slate-400 hover:bg-slate-50'}`}
                              >
                                <tab.icon className="w-4 h-4" /> {tab.label}
                              </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-10">
                            {/* ABA CADASTRO */}
                            {clientModalTab === 'CONTACT' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fade-in">
                                    <div className="space-y-6">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User className="w-4 h-4"/> Dados Identificação</h3>
                                        <div className="space-y-4">
                                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Nome Completo</label><input type="text" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold" value={clientForm.contactName || ''} onChange={e => setClientForm({...clientForm, contactName: e.target.value})} /></div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Nascimento</label><input type="date" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold" value={clientForm.birthDate || ''} onChange={e => setClientForm({...clientForm, birthDate: e.target.value})} /></div>
                                            <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">WhatsApp</label><input type="text" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold" value={clientForm.contactPhone || ''} onChange={e => setClientForm({...clientForm, contactPhone: e.target.value})} /></div>
                                          </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-4 h-4"/> Convênio & Responsável</h3>
                                        <div className="space-y-4">
                                          <div><input type="text" placeholder="Nome do Convênio" className="w-full bg-white border-none rounded-2xl p-4 text-sm font-bold" value={clientForm.insurance || ''} onChange={e => setClientForm({...clientForm, insurance: e.target.value})} /></div>
                                          <div><input type="text" placeholder="Carteirinha" className="w-full bg-white border-none rounded-2xl p-4 text-sm font-bold" value={clientForm.insuranceNumber || ''} onChange={e => setClientForm({...clientForm, insuranceNumber: e.target.value})} /></div>
                                          <div className="h-px bg-slate-200 my-4"></div>
                                          <div><input type="text" placeholder="Nome Responsável (se menor)" className="w-full bg-white border-none rounded-2xl p-4 text-sm font-bold" value={clientForm.legalGuardianName || ''} onChange={e => setClientForm({...clientForm, legalGuardianName: e.target.value})} /></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ABA ANAMNESE */}
                            {clientModalTab === 'ANAMNESIS' && (
                                <div className="space-y-10 animate-fade-in">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[
                                      { id: 'heartProblem', label: 'Problemas Cardíacos' },
                                      { id: 'hypertension', label: 'Hipertensão Arterial' },
                                      { id: 'diabetes', label: 'Diabetes' },
                                      { id: 'allergy', label: 'Alergias Alimentares/Med' },
                                      { id: 'anestheticAllergy', label: 'Alergia a Anestésicos' },
                                      { id: 'bleedingProblem', label: 'Problemas de Hemorragia' },
                                      { id: 'isPregnant', label: 'Está Grávida?' },
                                      { id: 'bisphosphonates', label: 'Uso de Bifosfonatos' }
                                    ].map(q => (
                                      <div key={q.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <span className="text-sm font-bold text-slate-700">{q.label}</span>
                                        <button 
                                          type="button"
                                          onClick={() => handleSaveAnamnesis(q.id as any, !(clientForm.anamnesis as any)?.[q.id])}
                                          className={`w-14 h-8 rounded-full transition-all relative ${(clientForm.anamnesis as any)?.[q.id] ? 'bg-rose-500' : 'bg-slate-300'}`}
                                        >
                                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${(clientForm.anamnesis as any)?.[q.id] ? 'right-1' : 'left-1'}`}></div>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Medicamentos em Uso e Observações</label>
                                    <textarea className="w-full bg-slate-50 border-none rounded-3xl p-6 text-sm font-bold min-h-[120px]" placeholder="Liste aqui remédios que o paciente toma regularmente..." value={clientForm.anamnesis?.medications || ''} onChange={e => handleSaveAnamnesis('medications', e.target.value)} />
                                  </div>
                                </div>
                            )}

                            {/* ABA ODONTOGRAMA */}
                            {clientModalTab === 'ODONTOGRAM' && (
                                <div className="space-y-8 animate-fade-in">
                                  <Odontogram states={clientForm.odontogram || []} onToothClick={handleToothClick} />
                                  
                                  {selectedTooth && (
                                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/20">
                                      <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-sm border border-slate-100 animate-scale-up">
                                        <h4 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">Dente {selectedTooth}</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                          {[
                                            { id: 'HEALTHY', label: 'Hígido', color: 'bg-emerald-50 text-emerald-700' },
                                            { id: 'CAVITY', label: 'Cárie', color: 'bg-rose-50 text-rose-700' },
                                            { id: 'FILLING', label: 'Restauração', color: 'bg-blue-50 text-blue-700' },
                                            { id: 'MISSING', label: 'Ausente', color: 'bg-slate-50 text-slate-700' },
                                            { id: 'CROWN', label: 'Coroa/Prótese', color: 'bg-amber-50 text-amber-700' },
                                            { id: 'ENDO', label: 'Canal', color: 'bg-purple-50 text-purple-700' },
                                            { id: 'IMPLANT', label: 'Implante', color: 'bg-indigo-50 text-indigo-700' }
                                          ].map(opt => (
                                            <button 
                                              key={opt.id}
                                              onClick={() => handleUpdateToothCondition(opt.id as any)}
                                              className={`p-3 rounded-xl text-[10px] font-black uppercase transition-all hover:scale-105 ${opt.color}`}
                                            >
                                              {opt.label}
                                            </button>
                                          ))}
                                        </div>
                                        <button onClick={() => setSelectedTooth(null)} className="w-full mt-6 py-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cancelar</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                            )}

                            {/* ABA HISTÓRICO / EVOLUÇÃO CLÍNICA */}
                            {clientModalTab === 'HISTORY' && (
                              <div className="space-y-6 animate-fade-in">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Anotações Clínicas Progressivas</h3>
                                    <button onClick={() => { setApptForm({ clientId: clientForm.id, clientName: clientForm.contactName, date: new Date().toISOString() }); setApptModalOpen(true); }} className="bg-sky-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 shadow-lg shadow-sky-100 transition-all">+ Nova Evolução</button>
                                </div>
                                <div className="space-y-4">
                                  {patientAppointments.length === 0 ? (
                                    <div className="py-20 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                                        <History className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                        <p className="font-bold">Nenhum registro clínico ainda.</p>
                                    </div>
                                  ) : patientAppointments.map(appt => (
                                    <div key={appt.id} className="bg-slate-50 border border-slate-100 p-8 rounded-[2rem] relative group">
                                        {appt.isLocked && <div className="absolute top-4 right-4 text-slate-300" title="Registro Bloqueado (Imutável)"><Lock className="w-4 h-4"/></div>}
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex gap-5">
                                                <div className="w-14 h-14 bg-white rounded-2xl flex flex-col items-center justify-center border border-slate-100 shadow-sm">
                                                    <span className="text-sm font-black text-sky-600 leading-none">{new Date(appt.date).toLocaleDateString('pt-BR', {day:'2-digit'})}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-1">{new Date(appt.date).toLocaleDateString('pt-BR', {month:'short'})}</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider">{appt.serviceName || 'Consulta Geral'}</h4>
                                                    <div className="flex gap-2 mt-1">
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Status: {appt.status}</p>
                                                        {appt.status === 'COMPLETED' && <button onClick={() => handleBillAppointment(appt)} className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 uppercase flex items-center gap-1"><DollarSign className="w-3 h-3"/> Gerar Cobrança</button>}
                                                    </div>
                                                </div>
                                            </div>
                                            {!appt.isLocked && (
                                                <button onClick={() => { setApptForm(appt); setApptModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button>
                                            )}
                                        </div>
                                        <div className="bg-white p-6 rounded-2xl border border-slate-100 text-sm text-slate-600 font-medium leading-relaxed italic relative">
                                          {appt.clinicalNotes ? `"${appt.clinicalNotes}"` : <span className="text-slate-300">Sem anotações detalhadas.</span>}
                                        </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ABA PRESCRIÇÕES */}
                            {clientModalTab === 'PRESCRIPTIONS' && (
                                <div className="space-y-8 animate-fade-in">
                                  <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Receituários e Atestados</h3>
                                    <button onClick={handleAddPrescription} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">+ Nova Prescrição</button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {clientForm.prescriptions?.map((p, idx) => (
                                      <div key={p.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{new Date(p.date).toLocaleDateString('pt-BR')}</span>
                                          <select 
                                            value={p.type} 
                                            onChange={e => {
                                              const updated = [...(clientForm.prescriptions || [])];
                                              updated[idx].type = e.target.value as any;
                                              setClientForm({...clientForm, prescriptions: updated});
                                            }}
                                            className="bg-white border-none rounded-lg text-[9px] font-black uppercase px-2 py-1 outline-none"
                                          >
                                            <option value="RECEITA">Receituário</option>
                                            <option value="ORIENTACAO">Orientações</option>
                                            <option value="ATESTADO">Atestado</option>
                                          </select>
                                        </div>
                                        <textarea 
                                          className="w-full bg-white border-none rounded-2xl p-4 text-xs font-bold min-h-[150px] shadow-inner"
                                          value={p.content}
                                          onChange={e => {
                                            const updated = [...(clientForm.prescriptions || [])];
                                            updated[idx].content = e.target.value;
                                            setClientForm({...clientForm, prescriptions: updated});
                                          }}
                                          placeholder="Descreva aqui o medicamento, dose e via de administração..."
                                        />
                                        <div className="flex justify-end gap-2">
                                          <button className="p-2 text-indigo-600 bg-white rounded-lg shadow-sm border border-slate-100 hover:bg-indigo-50"><FileText className="w-4 h-4"/></button>
                                          <button 
                                            onClick={() => {
                                              const updated = (clientForm.prescriptions || []).filter((_, i) => i !== idx);
                                              setClientForm({...clientForm, prescriptions: updated});
                                            }}
                                            className="p-2 text-rose-500 bg-white rounded-lg shadow-sm border border-slate-100 hover:bg-rose-50"
                                          >
                                            <Trash2 className="w-4 h-4"/>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                            )}

                            {/* ABA ARQUIVOS */}
                            {clientModalTab === 'FILES' && (
                                <div className="space-y-6 animate-fade-in">
                                  <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Exames Radiográficos e Fotos</h3>
                                    <button onClick={() => setAttachmentTarget({type: 'CLIENT', id: clientForm.id!})} className="bg-sky-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 shadow-lg shadow-sky-100 transition-all"><Paperclip className="w-4 h-4"/> Anexar Documento</button>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {clientForm.attachments?.map((url, idx) => (
                                      <div key={idx} className="group relative bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden aspect-square hover:shadow-xl transition-all">
                                        <img src={url} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-sky-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                          <a href={url} target="_blank" className="p-2 bg-white text-sky-600 rounded-xl"><Eye className="w-5 h-5"/></a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Ações Prontuário */}
                        <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={() => setClientModalOpen(false)} className="px-8 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase text-[10px] tracking-widest">Sair sem salvar</button>
                            <button onClick={handleSaveClient} className="px-10 py-4 bg-sky-600 text-white rounded-2xl hover:bg-sky-700 text-sm font-black shadow-xl shadow-sky-100 transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest">
                                <FileCheck className="w-5 h-5" /> Salvar Prontuário Completo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Evolução Clínica (Atendimento) */}
            {isApptModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-8 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                                {apptForm.isLocked ? <Lock className="w-5 h-5 text-amber-500" /> : <DentalIcon className="w-5 h-5 text-sky-500" />}
                                Atendimento Clínico
                            </h2>
                            <button onClick={() => setApptModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          onSaveAppointment({
                            ...apptForm,
                            id: apptForm.id || crypto.randomUUID(),
                            status: apptForm.status || 'COMPLETED',
                            isLocked: true, // Trava legal ao salvar evolução
                            moduleTag: 'odonto'
                          });
                          setApptModalOpen(false);
                          showAlert("Evolução registrada e bloqueada legalmente.", "success");
                        }} className="space-y-6">
                            <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Procedimento Realizado</label>
                              <select className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold outline-none disabled:opacity-50" value={apptForm.serviceId || ''} onChange={e => setApptForm({...apptForm, serviceId: e.target.value, serviceName: services.find(s=>s.id===e.target.value)?.name})} required disabled={apptForm.isLocked}>
                                <option value="">Selecione...</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase text-sky-600 mb-2 ml-1">Anotações da Evolução (Imutável após salvar)</label>
                              <textarea className="w-full bg-slate-50 border-none rounded-2xl p-6 text-sm font-bold min-h-[200px] outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-70" placeholder="Descreva os procedimentos realizados, intercorrências e orientações dadas ao paciente..." value={apptForm.clinicalNotes || ''} onChange={e => setApptForm({...apptForm, clinicalNotes: e.target.value})} required disabled={apptForm.isLocked} />
                            </div>
                            {!apptForm.isLocked ? (
                                <button type="submit" className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all flex items-center justify-center gap-2">
                                    <FileCheck className="w-5 h-5" /> Finalizar & Bloquear Evolução
                                </button>
                            ) : (
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-[10px] font-black uppercase text-center flex items-center justify-center gap-2">
                                    <Lock className="w-3 h-3" /> Este registro não pode ser alterado por conformidade legal.
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            <AttachmentModal 
                isOpen={!!attachmentTarget}
                onClose={() => setAttachmentTarget(null)}
                urls={clientForm.attachments || []}
                onAdd={async (files) => {
                  showAlert("Upload simulado concluído.", "info");
                }}
                onRemove={(idx) => {
                  const updated = (clientForm.attachments || []).filter((_, i) => i !== idx);
                  setClientForm({...clientForm, attachments: updated});
                }}
            />
        </div>
    );
};

export default ServiceModule;
