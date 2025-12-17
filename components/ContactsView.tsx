
import React, { useState } from 'react';
import { Contact, ServiceClient } from '../types';
import { User, Plus, Search, Pencil, Trash2, X, Mail, Phone, FileText, QrCode, Stethoscope, Shield, AlertCircle, FileHeart, Building, MapPin, DollarSign, CreditCard, Calendar, CheckCircle, AlertTriangle, Briefcase, RefreshCw } from 'lucide-react';
import { consultCnpj } from '../services/storageService';
import { useAlert } from './AlertSystem';

interface ContactsViewProps {
  contacts: Contact[];
  serviceClients?: ServiceClient[]; // Dados vindos de módulos (Odonto, Fisio, etc)
  onAddContact: (c: Contact) => void;
  onEditContact: (c: Contact) => void;
  onDeleteContact: (id: string) => void;
  title?: string;
  subtitle?: string;
}

const ContactsView: React.FC<ContactsViewProps> = ({ contacts, serviceClients = [], onAddContact, onEditContact, onDeleteContact, title, subtitle }) => {
  const { showAlert } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'BASIC' | 'ADDRESS' | 'FINANCIAL'>('BASIC');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  // Loading state for CNPJ search
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  // Extended Form State
  const [formData, setFormData] = useState<Partial<Contact>>({ 
      name: '',
      type: 'PF',
      email: '',
      phone: '',
      document: '',
      pixKey: '',
      // Addr
      zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '',
      // Fin
      creditLimit: 0, isDefaulter: false, isBlocked: false, defaultPaymentTerm: 0
  });

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.document && c.document.includes(searchTerm))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate
    if (!formData.name) {
        showAlert("Nome obrigatório.", "warning");
        return;
    }

    const contact: Contact = {
        id: editingContact ? editingContact.id : crypto.randomUUID(),
        name: formData.name,
        fantasyName: formData.fantasyName,
        type: formData.type as 'PF' | 'PJ',
        email: formData.email,
        phone: formData.phone,
        document: formData.document,
        ie: formData.ie,
        im: formData.im,
        pixKey: formData.pixKey,
        // Addr
        zipCode: formData.zipCode,
        street: formData.street,
        number: formData.number,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        // Fin
        isDefaulter: formData.isDefaulter,
        isBlocked: formData.isBlocked,
        creditLimit: Number(formData.creditLimit),
        defaultPaymentMethod: formData.defaultPaymentMethod,
        defaultPaymentTerm: Number(formData.defaultPaymentTerm)
    };
    
    if (editingContact) {
        onEditContact(contact);
    } else {
        onAddContact(contact);
    }
    handleCloseModal();
  };

  const handleConsultCnpj = async () => {
      if (!formData.document || formData.document.length < 14) {
          showAlert("CNPJ inválido para consulta.", "warning");
          return;
      }
      setLoadingCnpj(true);
      try {
          const data = await consultCnpj(formData.document);
          if (data) {
              setFormData(prev => ({
                  ...prev,
                  name: data.razao_social,
                  fantasyName: data.nome_fantasia,
                  type: 'PJ',
                  zipCode: data.cep,
                  street: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro}`.trim(),
                  number: data.numero,
                  neighborhood: data.bairro,
                  city: data.municipio,
                  state: data.uf,
                  phone: data.ddd_telefone_1,
                  email: data.email ? data.email.toLowerCase() : prev.email
              }));
              showAlert("Dados carregados da Receita!", "success");
          }
      } catch (e) {
          showAlert("Erro ao consultar CNPJ.", "error");
      } finally {
          setLoadingCnpj(false);
      }
  };

  const handleOpenModal = (contact?: Contact) => {
    if (contact) {
        setEditingContact(contact);
        setFormData({ ...contact });
    } else {
        setEditingContact(null);
        setFormData({ 
            name: '', type: 'PF', email: '', phone: '', document: '', pixKey: '',
            isDefaulter: false, isBlocked: false
        });
    }
    setActiveTab('BASIC');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
    setFormData({});
  };

  // Helper para encontrar dados de módulo associados
  const getModuleData = (contactId: string) => {
      return serviceClients.find(sc => sc.contactId === contactId);
  };

  const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ 0,00';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title || "Pessoas & Empresas"}</h1>
          <p className="text-gray-500">{subtitle || "Gestão unificada de clientes, fornecedores e contatos diversos."}</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Novo Cadastro
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="relative mb-6">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF/CNPJ ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
                <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Nenhum contato encontrado.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredContacts.map(contact => {
                    const moduleInfo = getModuleData(contact.id);
                    return (
                        <div key={contact.id} className={`flex flex-col justify-between p-4 bg-white rounded-xl border transition-all group hover:shadow-md ${contact.isBlocked ? 'border-rose-200 bg-rose-50/30' : 'border-gray-200 hover:border-indigo-200'}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${contact.type === 'PJ' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {contact.type === 'PJ' ? <Building className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                    </div>
                                    <div className="overflow-hidden min-w-0">
                                        <span className="font-bold text-gray-800 block truncate" title={contact.name}>{contact.name}</span>
                                        <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                                            {contact.fantasyName && <span className="text-[10px] text-gray-500 truncate block max-w-[150px]">{contact.fantasyName}</span>}
                                            {moduleInfo && (
                                                <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 flex items-center gap-1">
                                                    {moduleInfo.moduleTag}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleOpenModal(contact)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"
                                        title="Editar"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => onDeleteContact(contact.id)}
                                        className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                                {(contact.email || contact.phone) && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {contact.phone && (
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                <span className="truncate">{contact.phone}</span>
                                            </div>
                                        )}
                                        {contact.email && (
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                <span className="truncate">{contact.email}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {contact.document && (
                                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                                        <span>{contact.document}</span>
                                    </div>
                                )}

                                {/* Status Flags */}
                                {(contact.isDefaulter || contact.isBlocked || (contact.creditLimit && contact.creditLimit > 0)) && (
                                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-50">
                                        {contact.isBlocked && (
                                            <span className="flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                                <Shield className="w-3 h-3" /> Bloqueado
                                            </span>
                                        )}
                                        {contact.isDefaulter && (
                                            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                                <AlertTriangle className="w-3 h-3" /> Inadimplente
                                            </span>
                                        )}
                                        {contact.creditLimit && contact.creditLimit > 0 && (
                                            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100">
                                                <DollarSign className="w-3 h-3" /> Limite: {formatCurrency(contact.creditLimit)}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {editingContact ? 'Editar Cadastro' : 'Novo Cadastro'}
                    </h2>
                    <div className="flex bg-gray-200 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('BASIC')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'BASIC' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            Dados Básicos
                        </button>
                        <button
                            onClick={() => setActiveTab('ADDRESS')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'ADDRESS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            Endereço
                        </button>
                        <button
                            onClick={() => setActiveTab('FINANCIAL')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'FINANCIAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            Financeiro
                        </button>
                    </div>
                    <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors ml-4">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form id="contactForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {activeTab === 'BASIC' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex justify-center mb-2">
                                <div className="flex bg-indigo-50 p-1 rounded-lg border border-indigo-100">
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData({...formData, type: 'PF'})}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${formData.type === 'PF' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-indigo-100'}`}
                                    >
                                        <User className="w-4 h-4" /> Pessoa Física
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData({...formData, type: 'PJ'})}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${formData.type === 'PJ' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-purple-100'}`}
                                    >
                                        <Briefcase className="w-4 h-4" /> Pessoa Jurídica
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">{formData.type === 'PJ' ? 'CNPJ' : 'CPF'}</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                            <input
                                                type="text"
                                                value={formData.document}
                                                onChange={(e) => setFormData({ ...formData, document: e.target.value.replace(/\D/g, '') })}
                                                className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Apenas números"
                                                maxLength={14}
                                            />
                                        </div>
                                        {formData.type === 'PJ' && (
                                            <button 
                                                type="button" 
                                                onClick={handleConsultCnpj} 
                                                disabled={loadingCnpj}
                                                className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-purple-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                                                title="Buscar na Receita"
                                            >
                                                {loadingCnpj ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">{formData.type === 'PJ' ? 'Razão Social' : 'Nome Completo'}</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {formData.type === 'PJ' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Nome Fantasia</label>
                                        <input
                                            type="text"
                                            value={formData.fantasyName}
                                            onChange={(e) => setFormData({ ...formData, fantasyName: e.target.value })}
                                            className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Inscrição Estadual (IE)</label>
                                        <input
                                            type="text"
                                            value={formData.ie}
                                            onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                                            className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Inscrição Municipal (IM)</label>
                                        <input
                                            type="text"
                                            value={formData.im}
                                            onChange={(e) => setFormData({ ...formData, im: e.target.value })}
                                            className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Telefone / WhatsApp</label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="(00) 00000-0000"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ADDRESS' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex gap-4">
                                <div className="w-1/3">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">CEP</label>
                                    <input
                                        type="text"
                                        value={formData.zipCode}
                                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                        className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Endereço (Rua/Av)</label>
                                    <div className="relative">
                                        <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                        <input
                                            type="text"
                                            value={formData.street}
                                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                            className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Número</label>
                                    <input
                                        type="text"
                                        value={formData.number}
                                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                        className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Bairro</label>
                                    <input
                                        type="text"
                                        value={formData.neighborhood}
                                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                                        className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Cidade</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Estado (UF)</label>
                                    <input
                                        type="text"
                                        maxLength={2}
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                                        className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'FINANCIAL' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.isBlocked} 
                                            onChange={e => setFormData({...formData, isBlocked: e.target.checked})}
                                            className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500" 
                                        />
                                        <span className={`text-sm font-bold ${formData.isBlocked ? 'text-rose-600' : 'text-gray-600'}`}>
                                            <Shield className="w-4 h-4 inline mr-1" /> Bloquear Cadastro
                                        </span>
                                    </label>
                                    
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.isDefaulter} 
                                            onChange={e => setFormData({...formData, isDefaulter: e.target.checked})}
                                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500" 
                                        />
                                        <span className={`text-sm font-bold ${formData.isDefaulter ? 'text-amber-600' : 'text-gray-600'}`}>
                                            <AlertTriangle className="w-4 h-4 inline mr-1" /> Marcar Inadimplente
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Limite de Crédito (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
                                        <input
                                            type="number"
                                            value={formData.creditLimit}
                                            onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                                            className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Chave Pix Padrão</label>
                                    <div className="relative">
                                        <QrCode className="w-4 h-4 text-indigo-400 absolute left-3 top-2.5" />
                                        <input
                                            type="text"
                                            value={formData.pixKey}
                                            onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                                            className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Forma de Pagamento Padrão</label>
                                    <div className="relative">
                                        <CreditCard className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                        <select 
                                            className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                            value={formData.defaultPaymentMethod}
                                            onChange={(e) => setFormData({ ...formData, defaultPaymentMethod: e.target.value })}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="BOLETO">Boleto Bancário</option>
                                            <option value="PIX">Pix</option>
                                            <option value="CARD">Cartão de Crédito</option>
                                            <option value="CASH">Dinheiro</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Prazo Padrão (Dias)</label>
                                    <div className="relative">
                                        <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                        <input
                                            type="number"
                                            value={formData.defaultPaymentTerm}
                                            onChange={(e) => setFormData({ ...formData, defaultPaymentTerm: Number(e.target.value) })}
                                            className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ex: 30"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </form>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex gap-3 justify-end">
                    <button type="button" onClick={handleCloseModal} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="contactForm"
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        Salvar Cadastro
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ContactsView;
