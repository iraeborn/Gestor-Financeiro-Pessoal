
import React, { useState, useRef, useEffect } from 'react';
import { ServiceClient, ServiceItem, ServiceAppointment, Contact, TransactionType, TransactionStatus, Transaction } from '../types';
import { Calendar, User, ClipboardList, Plus, Search, Trash2, Clock, DollarSign, CheckCircle, Mail, Phone, FileHeart, Stethoscope, AlertCircle, Shield } from 'lucide-react';
import { useConfirm } from './AlertSystem';

// Sections map to the sub-items in sidebar
export type ServiceModuleSection = 'CALENDAR' | 'CLIENTS' | 'SERVICES';

interface ServiceModuleProps {
    moduleTitle: string;
    clientLabel: string; // "Paciente", "Cliente", "Aluno"
    serviceLabel: string; // "Procedimento", "Serviço", "Aula"
    transactionCategory: string; // Default category for generated transactions
    
    // Controls which section is visible based on sidebar selection
    activeSection: ServiceModuleSection;

    clients: ServiceClient[];
    services: ServiceItem[];
    appointments: ServiceAppointment[];
    contacts: Contact[];
    
    onSaveClient: (c: Partial<ServiceClient>) => void;
    onDeleteClient: (id: string) => void;
    onSaveService: (s: Omit<ServiceItem, 'moduleTag'>) => void;
    onDeleteService: (id: string) => void;
    onSaveAppointment: (a: Omit<ServiceAppointment, 'moduleTag'>) => void;
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
    const [searchTerm, setSearchTerm] = useState('');

    // --- FORMS STATES ---
    const [isClientModalOpen, setClientModalOpen] = useState(false);
    const [clientForm, setClientForm] = useState<Partial<ServiceClient>>({});
    const [clientModalTab, setClientModalTab] = useState<'CONTACT' | 'CLINICAL'>('CONTACT');
    
    // Autocomplete State for Client Modal
    const [clientSearchName, setClientSearchName] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);
    
    const [isServiceModalOpen, setServiceModalOpen] = useState(false);
    const [serviceForm, setServiceForm] = useState<Partial<ServiceItem>>({});

    const [isApptModalOpen, setApptModalOpen] = useState(false);
    const [apptForm, setApptForm] = useState<Partial<ServiceAppointment>>({});

    // Close dropdown on click outside
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
            setClientForm({});
            setClientSearchName('');
        }
        setClientModalTab('CONTACT');
        setClientModalOpen(true);
    };

    const handleSaveClient = (e: React.FormEvent) => {
        e.preventDefault();
        
        let resolvedContactId = clientForm.contactId;
        const exactMatch = contacts.find(c => c.name.toLowerCase() === clientSearchName.trim().toLowerCase());
        if (exactMatch) {
            resolvedContactId = exactMatch.id;
        }

        onSaveClient({
            id: clientForm.id || crypto.randomUUID(),
            contactId: resolvedContactId,
            contactName: exactMatch ? exactMatch.name : clientSearchName.trim(),
            contactEmail: clientForm.contactEmail,
            contactPhone: clientForm.contactPhone, 
            notes: clientForm.notes,
            birthDate: clientForm.birthDate,
            insurance: clientForm.insurance,
            allergies: clientForm.allergies,
            medications: clientForm.medications
        });
        setClientModalOpen(false);
    };

    const handleSaveService = (e: React.FormEvent) => {
        e.preventDefault();
        onSaveService({
            id: serviceForm.id || crypto.randomUUID(),
            name: serviceForm.name!,
            code: serviceForm.code,
            defaultPrice: Number(serviceForm.defaultPrice) || 0
        });
        setServiceModalOpen(false);
    };

    const handleSaveAppointment = (e: React.FormEvent) => {
        e.preventDefault();
        onSaveAppointment({
            id: apptForm.id || crypto.randomUUID(),
            clientId: apptForm.clientId!,
            serviceId: apptForm.serviceId,
            date: apptForm.date!,
            status: apptForm.status || 'SCHEDULED',
            notes: apptForm.notes
        });
        setApptModalOpen(false);
    };

    const handleGenerateTransaction = async (appt: ServiceAppointment) => {
        const srv = services.find(s => s.id === appt.serviceId);
        const amount = srv ? srv.defaultPrice : 0;
        const client = clients.find(c => c.id === appt.clientId);
        
        const confirm = await showConfirm({
            title: "Gerar Cobrança",
            message: `Gerar cobrança de R$ ${amount.toFixed(2)} para ${appt.clientName}?`,
            confirmText: "Sim, Gerar"
        });

        if (confirm) {
            const transId = crypto.randomUUID();
            onAddTransaction({
                description: `${moduleTitle}: ${appt.serviceName}`,
                amount: amount,
                type: TransactionType.INCOME,
                category: transactionCategory,
                date: appt.date.split('T')[0],
                status: TransactionStatus.PENDING,
                contactId: client?.contactId,
                accountId: '', 
                isRecurring: false
            });
            // Link transaction to appointment
            onSaveAppointment({ ...appt, transactionId: transId, status: 'COMPLETED' });
        }
    };

    const filteredClients = clients.filter(c => c.contactName?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filter contacts for dropdown in modal
    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(clientSearchName.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-sky-100 rounded-lg text-sky-600"><ClipboardList className="w-6 h-6"/></div>
                        {moduleTitle}
                        <span className="text-gray-400 font-light text-xl">| 
                            {activeSection === 'CALENDAR' ? ' Agenda' : 
                             activeSection === 'CLIENTS' ? ` ${clientLabel}s` : 
                             ` ${serviceLabel}s`}
                        </span>
                    </h1>
                </div>
            </div>

            {/* --- CALENDAR TAB --- */}
            {activeSection === 'CALENDAR' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => { setApptForm({}); setApptModalOpen(true); }} className="bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-sky-700">
                            <Plus className="w-4 h-4" /> Novo Agendamento
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {appointments.length === 0 && <p className="text-gray-400 col-span-3 text-center py-8">Nenhum agendamento encontrado.</p>}
                        
                        {appointments.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(appt => (
                            <div key={appt.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-sky-300 transition-colors relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Clock className="w-4 h-4" />
                                        {new Date(appt.date).toLocaleDateString('pt-BR')} às {new Date(appt.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : appt.status === 'CANCELED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {appt.status === 'SCHEDULED' ? 'Agendado' : appt.status === 'COMPLETED' ? 'Concluído' : 'Cancelado'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-800">{appt.clientName}</h3>
                                <p className="text-sm text-sky-600 font-medium">{appt.serviceName || 'Consulta Geral'}</p>
                                {appt.notes && <p className="text-xs text-gray-400 mt-2 italic">"{appt.notes}"</p>}

                                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2">
                                    <button onClick={() => onDeleteAppointment(appt.id)} className="p-1.5 text-gray-400 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                                    
                                    {appt.status === 'SCHEDULED' && (
                                        <button 
                                            onClick={() => handleGenerateTransaction(appt)}
                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded hover:bg-emerald-100 flex items-center gap-1"
                                            title="Concluir e Cobrar"
                                        >
                                            <DollarSign className="w-3 h-3" /> Cobrar
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- CLIENTS TAB --- */}
            {activeSection === 'CLIENTS' && (
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                            <input 
                                type="text" 
                                placeholder={`Buscar ${clientLabel.toLowerCase()}...`}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                            />
                        </div>
                        <button onClick={() => handleOpenClientModal()} className="bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-sky-700">
                            <Plus className="w-4 h-4" /> Novo {clientLabel}
                        </button>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Nome</th>
                                    <th className="px-6 py-3">Convênio</th>
                                    <th className="px-6 py-3">Observações Clínicas</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredClients.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenClientModal(c)}>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {c.contactName}
                                            <div className="text-xs text-gray-400 font-normal">{c.contactPhone || 'Sem telefone'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {c.insurance ? (
                                                <span className="bg-sky-50 text-sky-700 px-2 py-1 rounded text-xs font-bold">{c.insurance}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 truncate max-w-xs">
                                            {c.allergies && <span className="text-rose-500 text-xs font-bold mr-2">! Alérgico</span>}
                                            {c.notes || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => onDeleteClient(c.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- SERVICES TAB --- */}
            {activeSection === 'SERVICES' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => { setServiceForm({}); setServiceModalOpen(true); }} className="bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-sky-700">
                            <Plus className="w-4 h-4" /> Novo {serviceLabel}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {services.map(srv => (
                            <div key={srv.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-gray-800">{srv.name}</h3>
                                    <p className="text-xs text-gray-400">{srv.code}</p>
                                    <p className="text-sky-600 font-bold mt-1">R$ {srv.defaultPrice.toFixed(2)}</p>
                                </div>
                                <button onClick={() => onDeleteService(srv.id)} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODALS */}
            
            {/* Client Modal (Unified Contact/Client Creation) */}
            {isClientModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                {clientForm.id ? `Editar ${clientLabel}` : `Novo ${clientLabel}`}
                            </h2>
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setClientModalTab('CONTACT')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${clientModalTab === 'CONTACT' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500'}`}
                                >
                                    Contato
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setClientModalTab('CLINICAL')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${clientModalTab === 'CLINICAL' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500'}`}
                                >
                                    Ficha Clínica
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSaveClient} className="flex-1 overflow-y-auto p-6">
                            
                            {/* TAB: CONTACT INFO (Centralized) */}
                            {clientModalTab === 'CONTACT' && (
                                <div className="space-y-4 animate-fade-in">
                                    <p className="text-xs text-gray-400 uppercase font-bold bg-gray-50 p-2 rounded border border-gray-100">
                                        Dados Centralizados (Financeiro & Sistema)
                                    </p>
                                    
                                    <div className="relative" ref={contactDropdownRef}>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Nome Completo</label>
                                        <div className="relative">
                                            <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                            <input 
                                                type="text"
                                                placeholder={`Nome do ${clientLabel.toLowerCase()}...`}
                                                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                                                value={clientSearchName}
                                                onFocus={() => setShowContactDropdown(true)}
                                                onChange={(e) => {
                                                    setClientSearchName(e.target.value);
                                                    if (!clientForm.id) setClientForm(prev => ({ ...prev, contactId: undefined })); 
                                                    setShowContactDropdown(true);
                                                }}
                                                required
                                            />
                                        </div>
                                        
                                        {showContactDropdown && clientSearchName && filteredContacts.length > 0 && (
                                            <div className="absolute z-10 w-full bg-white mt-1 border border-gray-100 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase bg-gray-50 sticky top-0">Contatos Existentes</p>
                                                {filteredContacts.map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setClientSearchName(c.name);
                                                            setClientForm(prev => ({ 
                                                                ...prev, 
                                                                contactId: c.id,
                                                                contactPhone: c.phone,
                                                                contactEmail: c.email
                                                            }));
                                                            setShowContactDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-sky-50 text-sm text-gray-700 flex items-center justify-between"
                                                    >
                                                        {c.name}
                                                        {clientForm.contactId === c.id && <CheckCircle className="w-3 h-3 text-sky-600"/>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {!clientForm.contactId && clientSearchName.length > 2 && !filteredContacts.find(c => c.name.toLowerCase() === clientSearchName.toLowerCase()) && (
                                            <p className="text-xs text-sky-600 mt-1 flex items-center gap-1">
                                                <Plus className="w-3 h-3" /> Um novo contato será criado automaticamente.
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Telefone</label>
                                            <div className="relative">
                                                <Phone className="w-3 h-3 text-gray-400 absolute left-2.5 top-3" />
                                                <input 
                                                    type="text" 
                                                    className="w-full pl-8 border rounded-lg p-2 text-sm" 
                                                    value={clientForm.contactPhone || ''} 
                                                    onChange={e => setClientForm({...clientForm, contactPhone: e.target.value})}
                                                    placeholder="(00) 00000-0000"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                                            <div className="relative">
                                                <Mail className="w-3 h-3 text-gray-400 absolute left-2.5 top-3" />
                                                <input 
                                                    type="email" 
                                                    className="w-full pl-8 border rounded-lg p-2 text-sm" 
                                                    value={clientForm.contactEmail || ''} 
                                                    onChange={e => setClientForm({...clientForm, contactEmail: e.target.value})}
                                                    placeholder="email@exemplo.com"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Data Nascimento</label>
                                        <input type="date" className="w-full border rounded-lg p-2" value={clientForm.birthDate || ''} onChange={e => setClientForm({...clientForm, birthDate: e.target.value})} />
                                    </div>
                                </div>
                            )}

                            {/* TAB: CLINICAL INFO (Module Specific) */}
                            {clientModalTab === 'CLINICAL' && (
                                <div className="space-y-4 animate-fade-in">
                                    <p className="text-xs text-sky-600 font-bold uppercase bg-sky-50 p-2 rounded border border-sky-100 flex items-center gap-2">
                                        <FileHeart className="w-4 h-4" /> Dados do Módulo Odonto
                                    </p>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Convênio / Plano de Saúde</label>
                                        <div className="relative">
                                            <Shield className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                            <input 
                                                type="text" 
                                                className="w-full pl-9 border rounded-lg p-2 text-sm" 
                                                value={clientForm.insurance || ''} 
                                                onChange={e => setClientForm({...clientForm, insurance: e.target.value})}
                                                placeholder="Particular, Unimed, Amil..."
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-rose-600 mb-1 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Alergias
                                            </label>
                                            <textarea 
                                                className="w-full border border-rose-100 bg-rose-50/30 rounded-lg p-2 text-sm focus:ring-rose-200 focus:border-rose-300" 
                                                rows={3} 
                                                value={clientForm.allergies || ''} 
                                                onChange={e => setClientForm({...clientForm, allergies: e.target.value})} 
                                                placeholder="Listar alergias..." 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                                                <Stethoscope className="w-3 h-3" /> Medicamentos em uso
                                            </label>
                                            <textarea 
                                                className="w-full border rounded-lg p-2 text-sm" 
                                                rows={3} 
                                                value={clientForm.medications || ''} 
                                                onChange={e => setClientForm({...clientForm, medications: e.target.value})} 
                                                placeholder="Listar medicamentos..." 
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Anamnese / Histórico Geral</label>
                                        <textarea 
                                            className="w-full border rounded-lg p-2 text-sm" 
                                            rows={4} 
                                            value={clientForm.notes || ''} 
                                            onChange={e => setClientForm({...clientForm, notes: e.target.value})} 
                                            placeholder="Detalhes clínicos, cirurgias prévias, queixas principais..." 
                                        />
                                    </div>
                                </div>
                            )}

                        </form>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 flex-shrink-0">
                            <button type="button" onClick={() => setClientModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancelar</button>
                            <button onClick={handleSaveClient} type="submit" className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-bold shadow-lg shadow-sky-200">Salvar Paciente</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Service Modal */}
            {isServiceModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                        <h2 className="text-lg font-bold mb-4">Novo {serviceLabel}</h2>
                        <form onSubmit={handleSaveService} className="space-y-4">
                            <input type="text" placeholder="Nome (Ex: Limpeza, Consulta)" className="w-full border rounded-lg p-2" value={serviceForm.name || ''} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} required />
                            <input type="text" placeholder="Código (Opcional)" className="w-full border rounded-lg p-2" value={serviceForm.code || ''} onChange={e => setServiceForm({...serviceForm, code: e.target.value})} />
                            <input type="number" placeholder="Preço Padrão (R$)" className="w-full border rounded-lg p-2" value={serviceForm.defaultPrice || ''} onChange={e => setServiceForm({...serviceForm, defaultPrice: Number(e.target.value)})} required />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setServiceModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Appointment Modal */}
            {isApptModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                        <h2 className="text-lg font-bold mb-4">Agendar</h2>
                        <form onSubmit={handleSaveAppointment} className="space-y-4">
                            <select className="w-full border rounded-lg p-2" value={apptForm.clientId || ''} onChange={e => setApptForm({...apptForm, clientId: e.target.value})} required>
                                <option value="">Selecione {clientLabel}...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.contactName}</option>)}
                            </select>
                            <select className="w-full border rounded-lg p-2" value={apptForm.serviceId || ''} onChange={e => setApptForm({...apptForm, serviceId: e.target.value})}>
                                <option value="">Selecione {serviceLabel}...</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name} - R$ {s.defaultPrice}</option>)}
                            </select>
                            <input type="datetime-local" className="w-full border rounded-lg p-2" value={apptForm.date || ''} onChange={e => setApptForm({...apptForm, date: e.target.value})} required />
                            <textarea className="w-full border rounded-lg p-2" rows={2} placeholder="Observações" value={apptForm.notes || ''} onChange={e => setApptForm({...apptForm, notes: e.target.value})} />
                            
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setApptModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">Agendar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceModule;
