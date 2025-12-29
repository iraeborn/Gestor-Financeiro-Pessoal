
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ServiceClient, ServiceItem, ServiceAppointment, Contact, ToothState, Anamnesis, Prescription, Transaction, Category, TransactionType, TransactionStatus, Account, TreatmentItem } from '../types';
import { Calendar, User, ClipboardList, Plus, Search, Trash2, Mail, Phone, FileHeart, Stethoscope, AlertCircle, Shield, Paperclip, Eye, History, Heart, AlertTriangle, FileText, Image as ImageIcon, X, Info, Pencil, Activity, FileCheck, Stethoscope as DentalIcon, Pill, Lock, Unlock, DollarSign, CheckCircle2, Clock, MapPin, ChevronDown, ChevronUp, Layers } from 'lucide-react';
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

    // Controle de Seletor de Dentes para Itens de Tratamento
    const [activeToothPickerIdx, setActiveToothPickerIdx] = useState<number | null>(null);

    // Handlers Clínicos
    const handleToothClick = (tooth: number) => setSelectedTooth(tooth);

    const handleUpdateToothCondition = (condition: ToothState['condition']) => {
      if (selectedTooth === null) return;
      const currentStates = [...(clientForm.odontogram || [])];
      const index = currentStates.findIndex(s => s.tooth === selectedTooth);
      
      if (index > -1) {
        currentStates[index] = { ...currentStates[index], condition };
      } else {
        currentStates.push({ tooth: selectedTooth, condition });
      }
      
      setClientForm({ ...clientForm, odontogram: currentStates });
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
        showAlert("Prontuário completo salvo!", "success");
    };

    const handleBillAppointment = async (appt: ServiceAppointment) => {
        if (!onAddTransaction) return;
        
        const totalAmount = (appt.treatmentItems || []).reduce((acc, item) => acc + item.value, 0);

        const confirm = await showConfirm({
            title: "Gerar Cobrança",
            message: `Deseja gerar um lançamento financeiro de ${formatCurrency(totalAmount)} para este atendimento?`,
            confirmText: "Sim, Gerar Lançamento"
        });

        if (confirm) {
            onAddTransaction({
                description: `Atendimento: ${appt.clientName} - ${appt.treatmentItems?.length || 1} procedimento(s)`,
                amount: totalAmount,
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

    // --- Agendamentos / Itens de Tratamento ---

    const handleAddTreatmentItem = () => {
        const newItem: TreatmentItem = {
            id: crypto.randomUUID(),
            serviceId: '',
            teeth: [],
            value: 0
        };
        setApptForm(prev => ({
            ...prev,
            treatmentItems: [...(prev.treatmentItems || []), newItem]
        }));
    };

    const handleUpdateTreatmentItem = (idx: number, field: keyof TreatmentItem, value: any) => {
        const items = [...(apptForm.treatmentItems || [])];
        if (field === 'serviceId') {
            const service = services.find(s => s.id === value);
            items[idx] = { 
                ...items[idx], 
                serviceId: value, 
                serviceName: service?.name, 
                value: service?.defaultPrice || 0 
            };
        } else {
            items[idx] = { ...items[idx], [field]: value };
        }
        setApptForm({ ...apptForm, treatmentItems: items });
    };

    const handleRemoveTreatmentItem = (idx: number) => {
        const items = [...(apptForm.treatmentItems || [])];
        items.splice(idx, 1);
        setApptForm({ ...apptForm, treatmentItems: items });
    };

    const toggleToothInItem = (idx: number, tooth: number) => {
        const items = [...(apptForm.treatmentItems || [])];
        const currentTeeth = [...(items[idx].teeth || [])];
        const toothIdx = currentTeeth.indexOf(tooth);
        if (toothIdx > -1) currentTeeth.splice(toothIdx, 1);
        else currentTeeth.push(tooth);
        items[idx].teeth = currentTeeth;
        setApptForm({ ...apptForm, treatmentItems: items });
    };

    const filteredClients = clients.filter(c => c.contactName?.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredAppointments = appointments.filter(a => a.clientName?.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

    const handleOpenApptModal = (appt?: ServiceAppointment) => {
        if (appt) setApptForm(appt);
        else setApptForm({ date: new Date().toISOString().split('T')[0], status: 'SCHEDULED', treatmentItems: [], moduleTag: 'odonto' });
        setApptModalOpen(true);
    };

    const handleOpenServiceModal = (service?: ServiceItem) => {
        if (service) setServiceForm(service);
        else setServiceForm({ name: '', defaultPrice: 0, type: 'SERVICE', moduleTag: 'odonto' });
        setServiceModalOpen(true);
    };

    const getActionButtonLabel = () => {
        if (activeSection === 'CALENDAR') return `Novo Agendamento`;
        if (activeSection === 'SERVICES') return `Novo ${serviceLabel}`;
        return `Novo ${clientLabel}`;
    };

    const handleMainAction = () => {
        if (activeSection === 'CALENDAR') handleOpenApptModal();
        else if (activeSection === 'SERVICES') handleOpenServiceModal();
        else handleOpenClientModal();
    };

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
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none shadow-sm" 
                        />
                    </div>
                    <button onClick={handleMainAction} className="bg-sky-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-sky-700 shadow-lg transition-all active:scale-95 whitespace-nowrap">
                        <Plus className="w-4 h-4" /> {getActionButtonLabel()}
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
                                <span>Ult. Consulta: {appointments.find(a => a.clientId === c.id)?.date.split('T')[0] || '--/--'}</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 text-sky-600 bg-sky-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredClients.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[2.5rem]"><User className="w-16 h-16 mx-auto mb-4 opacity-10"/><p className="font-bold">Nenhum paciente cadastrado.</p></div>}
                </div>
            )}

            {/* ABA AGENDA (CALENDAR) */}
            {activeSection === 'CALENDAR' && (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">Data/Hora</th>
                                    <th className="px-6 py-4">Paciente</th>
                                    <th className="px-6 py-4">Tratamentos</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredAppointments.map(appt => (
                                    <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-700">
                                            {new Date(appt.date).toLocaleDateString('pt-BR')} <span className="text-gray-300 font-normal ml-2">{new Date(appt.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-sky-600">{appt.clientName}</td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <div className="flex flex-wrap gap-1">
                                                {appt.treatmentItems?.map((item, idx) => (
                                                    <span key={idx} className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold">
                                                        {item.serviceName} {item.teeth?.length ? `(${item.teeth.join(',')})` : ''}
                                                    </span>
                                                )) || <span className="text-gray-300 italic">Nenhum selecionado</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {appt.status === 'COMPLETED' ? 'Concluído' : 'Agendado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleOpenApptModal(appt)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button>
                                                <button onClick={() => onDeleteAppointment(appt.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredAppointments.length === 0 && <div className="py-20 text-center text-slate-300"><Calendar className="w-16 h-16 mx-auto mb-4 opacity-10"/><p className="font-bold">Nenhum agendamento para exibir.</p></div>}
                    </div>
                </div>
            )}

            {/* ABA PROCEDIMENTOS (SERVICES) */}
            {activeSection === 'SERVICES' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredServices.map(service => (
                        <div key={service.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-xl transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl">
                                    <ClipboardList className="w-6 h-6"/>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Base</p>
                                    <p className="text-lg font-black text-gray-900">{formatCurrency(service.defaultPrice)}</p>
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-800 mb-2 line-clamp-2">{service.name}</h3>
                            <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-auto pt-4 border-t border-gray-50">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {service.defaultDuration || 30} min</span>
                                <div className="flex gap-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenServiceModal(service)} className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg"><Pencil className="w-3.5 h-3.5"/></button>
                                    <button onClick={() => onDeleteService(service.id)} className="p-1.5 text-rose-500 bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
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
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                </div>
                            )}

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

                            {clientModalTab === 'HISTORY' && (
                              <div className="space-y-6 animate-fade-in">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Anotações Clínicas Progressivas</h3>
                                    <button onClick={() => handleOpenApptModal()} className="bg-sky-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 shadow-lg shadow-sky-100 transition-all">+ Nova Evolução</button>
                                </div>
                                <div className="space-y-4">
                                  {patientAppointments.map(appt => (
                                    <div key={appt.id} className="bg-slate-50 border border-slate-100 p-8 rounded-[2rem] relative group">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex gap-5">
                                                <div className="w-14 h-14 bg-white rounded-2xl flex flex-col items-center justify-center border border-slate-100 shadow-sm">
                                                    <span className="text-sm font-black text-sky-600 leading-none">{new Date(appt.date).toLocaleDateString('pt-BR', {day:'2-digit'})}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-1">{new Date(appt.date).toLocaleDateString('pt-BR', {month:'short'})}</span>
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {appt.treatmentItems?.map((item, idx) => (
                                                            <div key={idx} className="bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-sm">
                                                                <span className="font-black text-slate-800 uppercase text-[10px] tracking-wider">{item.serviceName}</span>
                                                                {item.teeth?.length ? <span className="ml-2 bg-sky-100 text-sky-700 text-[9px] px-1.5 py-0.5 rounded-full font-black">Dentes: {item.teeth.join(', ')}</span> : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2 mt-2">
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total: {formatCurrency(appt.treatmentItems?.reduce((acc, i) => acc + i.value, 0))}</p>
                                                        {appt.status === 'COMPLETED' && <button onClick={() => handleBillAppointment(appt)} className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 uppercase flex items-center gap-1"><DollarSign className="w-3 h-3"/> Gerar Cobrança</button>}
                                                    </div>
                                                </div>
                                            </div>
                                            {!appt.isLocked && (
                                                <button onClick={() => handleOpenApptModal(appt)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button>
                                            )}
                                        </div>
                                        <div className="bg-white p-6 rounded-2xl border border-slate-100 text-sm text-slate-600 font-medium leading-relaxed italic relative shadow-inner">
                                          {appt.clinicalNotes ? `"${appt.clinicalNotes}"` : <span className="text-slate-300">Sem anotações detalhadas.</span>}
                                        </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>

                        <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={() => setClientModalOpen(false)} className="px-8 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase text-[10px] tracking-widest">Sair sem salvar</button>
                            <button onClick={handleSaveClient} className="px-10 py-4 bg-sky-600 text-white rounded-2xl hover:bg-sky-700 text-sm font-black shadow-xl shadow-sky-100 transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest">
                                <FileCheck className="w-5 h-5" /> Salvar Prontuário Completo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Evolução Clínica (Múltiplos Procedimentos) */}
            {isApptModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl p-8 animate-scale-up border border-slate-100 max-h-[95vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                                {apptForm.isLocked ? <Lock className="w-5 h-5 text-amber-500" /> : <DentalIcon className="w-5 h-5 text-sky-500" />}
                                Registro de Atendimento Clínico
                            </h2>
                            <button onClick={() => setApptModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          onSaveAppointment({
                            ...apptForm,
                            id: apptForm.id || crypto.randomUUID(),
                            status: apptForm.status || 'SCHEDULED',
                            moduleTag: 'odonto'
                          });
                          setApptModalOpen(false);
                          showAlert("Atendimento atualizado com sucesso.", "success");
                        }} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Paciente</label>
                                    <select 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" 
                                        value={apptForm.clientId || ''} 
                                        onChange={e => setApptForm({...apptForm, clientId: e.target.value, clientName: clients.find(c => c.id === e.target.value)?.contactName})} 
                                        required
                                        disabled={apptForm.isLocked}
                                    >
                                        <option value="">Selecione o paciente...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.contactName}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Data e Hora</label>
                                        <input type="datetime-local" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={apptForm.date ? apptForm.date.substring(0, 16) : ''} onChange={e => setApptForm({...apptForm, date: e.target.value})} required disabled={apptForm.isLocked} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Situação</label>
                                        <select className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={apptForm.status || 'SCHEDULED'} onChange={e => setApptForm({...apptForm, status: e.target.value as any})} disabled={apptForm.isLocked}>
                                            <option value="SCHEDULED">Agendado</option>
                                            <option value="COMPLETED">Concluído</option>
                                            <option value="CANCELED">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* LISTA DE PROCEDIMENTOS */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4" /> Procedimentos Realizados</h3>
                                    {!apptForm.isLocked && (
                                        <button type="button" onClick={handleAddTreatmentItem} className="text-[10px] font-black text-sky-600 bg-sky-50 px-4 py-2 rounded-xl border border-sky-100 hover:bg-sky-100 transition-all">+ Adicionar Item</button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {apptForm.treatmentItems?.map((item, idx) => (
                                        <div key={item.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 animate-fade-in relative group">
                                            {!apptForm.isLocked && (
                                                <button type="button" onClick={() => handleRemoveTreatmentItem(idx)} className="absolute -top-2 -right-2 p-2 bg-white text-rose-500 rounded-full shadow-md border border-rose-50 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"><X className="w-4 h-4"/></button>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="md:col-span-1">
                                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-2">Serviço</label>
                                                    <select 
                                                        className="w-full bg-white border-none rounded-xl p-3 text-xs font-bold outline-none shadow-sm"
                                                        value={item.serviceId}
                                                        onChange={e => handleUpdateTreatmentItem(idx, 'serviceId', e.target.value)}
                                                        disabled={apptForm.isLocked}
                                                        required
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-2">Dentes ({item.teeth?.length || 0})</label>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setActiveToothPickerIdx(activeToothPickerIdx === idx ? null : idx)}
                                                        className={`w-full text-left bg-white border-none rounded-xl p-3 text-xs font-bold shadow-sm flex items-center justify-between transition-all ${activeToothPickerIdx === idx ? 'ring-2 ring-sky-500' : ''}`}
                                                        disabled={apptForm.isLocked}
                                                    >
                                                        <span className="truncate">{item.teeth?.length ? item.teeth.join(', ') : 'Selecionar dentes...'}</span>
                                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${activeToothPickerIdx === idx ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-2">Valor (R$)</label>
                                                    <div className="relative">
                                                        <DollarSign className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-3.5" />
                                                        <input type="number" step="0.01" className="w-full pl-9 bg-white border-none rounded-xl p-3 text-xs font-black shadow-sm outline-none" value={item.value} onChange={e => handleUpdateTreatmentItem(idx, 'value', Number(e.target.value))} disabled={apptForm.isLocked} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Seletor de Dentes em Grade (Condicional por Item) */}
                                            {activeToothPickerIdx === idx && (
                                                <div className="mt-6 p-6 bg-white rounded-3xl border border-sky-100 shadow-xl shadow-sky-900/5 animate-scale-up">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Clique nos dentes trabalhados para este procedimento</p>
                                                        <button type="button" onClick={() => setActiveToothPickerIdx(null)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase">Fechar</button>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {/* Superior */}
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map(t => (
                                                                <button key={t} type="button" onClick={() => toggleToothInItem(idx, t)} className={`w-7 h-9 text-[10px] font-black rounded-md border-2 transition-all flex flex-col items-center justify-center ${item.teeth?.includes(t) ? 'bg-sky-600 text-white border-sky-700 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{t}</button>
                                                            ))}
                                                        </div>
                                                        <div className="h-px bg-slate-100 w-full opacity-50"></div>
                                                        {/* Inferior */}
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            {[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(t => (
                                                                <button key={t} type="button" onClick={() => toggleToothInItem(idx, t)} className={`w-7 h-9 text-[10px] font-black rounded-md border-2 transition-all flex flex-col items-center justify-center ${item.teeth?.includes(t) ? 'bg-sky-600 text-white border-sky-700 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{t}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {(!apptForm.treatmentItems || apptForm.treatmentItems.length === 0) && (
                                        <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300">
                                            <p className="font-bold text-sm">Nenhum procedimento adicionado.</p>
                                            <p className="text-[10px] uppercase mt-1">Clique em "+ Adicionar Item" para iniciar.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[10px] font-black uppercase text-sky-600 mb-2 ml-1">Evolução Clínica / Detalhes Gerais</label>
                                <textarea className="w-full bg-slate-50 border-none rounded-[2rem] p-6 text-sm font-bold min-h-[120px] outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-70 shadow-inner" placeholder="Descreva os detalhes gerais do atendimento que não foram especificados nos itens acima..." value={apptForm.clinicalNotes || ''} onChange={e => setApptForm({...apptForm, clinicalNotes: e.target.value})} disabled={apptForm.isLocked} />
                            </div>

                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100 bg-slate-50/50 -mx-8 -mb-8 p-8">
                                <div className="text-center md:text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total da Consulta</p>
                                    <p className="text-3xl font-black text-slate-900">{formatCurrency(apptForm.treatmentItems?.reduce((acc, i) => acc + i.value, 0))}</p>
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setApptModalOpen(false)} className="px-8 py-4 text-slate-400 font-black text-sm uppercase tracking-widest">Cancelar</button>
                                    {!apptForm.isLocked && (
                                        <button type="submit" className="bg-sky-600 text-white px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95">Salvar Atendimento</button>
                                    )}
                                </div>
                            </div>
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

const formatCurrency = (val: number | undefined) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export default ServiceModule;
