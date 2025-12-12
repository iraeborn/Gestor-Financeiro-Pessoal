
import React, { useState } from 'react';
import { Contact, ServiceClient } from '../types';
import { User, Plus, Search, Pencil, Trash2, X, Mail, Phone, FileText, QrCode, Stethoscope, Shield, AlertCircle, FileHeart } from 'lucide-react';

interface ContactsViewProps {
  contacts: Contact[];
  serviceClients?: ServiceClient[]; // Dados vindos de módulos (Odonto, Fisio, etc)
  onAddContact: (c: Contact) => void;
  onEditContact: (c: Contact) => void;
  onDeleteContact: (id: string) => void;
}

const ContactsView: React.FC<ContactsViewProps> = ({ contacts, serviceClients = [], onAddContact, onEditContact, onDeleteContact }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  // Extended Form State
  const [formData, setFormData] = useState({ 
      name: '',
      email: '',
      phone: '',
      document: '',
      pixKey: ''
  });

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contact: Contact = {
        id: editingContact ? editingContact.id : crypto.randomUUID(),
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        document: formData.document,
        pixKey: formData.pixKey
    };
    
    if (editingContact) {
        onEditContact(contact);
    } else {
        onAddContact(contact);
    }
    handleCloseModal();
  };

  const handleOpenModal = (contact?: Contact) => {
    if (contact) {
        setEditingContact(contact);
        setFormData({ 
            name: contact.name,
            email: contact.email || '',
            phone: contact.phone || '',
            document: contact.document || '',
            pixKey: contact.pixKey || ''
        });
    } else {
        setEditingContact(null);
        setFormData({ name: '', email: '', phone: '', document: '', pixKey: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
    setFormData({ name: '', email: '', phone: '', document: '', pixKey: '' });
  };

  // Helper para encontrar dados de módulo associados
  const getModuleData = (contactId: string) => {
      return serviceClients.find(sc => sc.contactId === contactId);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Contatos</h1>
          <p className="text-gray-500">Visão unificada de clientes, pacientes, fornecedores e favorecidos.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Novo Contato
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="relative mb-6">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou módulo..."
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
                        <div key={contact.id} className="flex flex-col justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors group">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${moduleInfo ? 'bg-sky-100 text-sky-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="overflow-hidden">
                                        <span className="font-semibold text-gray-800 block truncate" title={contact.name}>{contact.name}</span>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            {contact.document && <span className="text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">Doc: {contact.document}</span>}
                                            {moduleInfo && (
                                                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 flex items-center gap-1">
                                                    {moduleInfo.moduleTag === 'ODONTO' ? <Stethoscope className="w-3 h-3"/> : <User className="w-3 h-3"/>}
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
                                        title="Editar / Ver Detalhes"
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
                            
                            <div className="space-y-1.5 text-sm text-gray-600 border-t border-gray-200 pt-3">
                                {contact.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="truncate">{contact.email}</span>
                                    </div>
                                )}
                                {contact.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                                        <span>{contact.phone}</span>
                                    </div>
                                )}
                                {contact.pixKey && (
                                    <div className="flex items-center gap-2 text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md w-fit mt-1">
                                        <QrCode className="w-3.5 h-3.5" />
                                        <span className="text-xs">Pix: {contact.pixKey}</span>
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-800">
                        {editingContact ? 'Detalhes do Contato' : 'Novo Contato'}
                    </h2>
                    <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="overflow-y-auto p-6 space-y-6">
                    <form id="contactForm" onSubmit={handleSubmit} className="space-y-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dados Cadastrais</p>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nome Completo / Razão Social</label>
                            <div className="relative">
                                <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Nome..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">CPF / CNPJ</label>
                                <div className="relative">
                                    <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        value={formData.document}
                                        onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                                        className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Documento"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
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
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="exemplo@email.com"
                                />
                            </div>
                        </div>

                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                            <label className="block text-xs font-bold text-indigo-700 mb-1">Chave Pix (Padrão)</label>
                            <div className="relative">
                                <QrCode className="w-4 h-4 text-indigo-400 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    value={formData.pixKey}
                                    onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                                    className="block w-full pl-9 rounded-lg border-indigo-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="CPF, Email, Telefone ou Aleatória"
                                />
                            </div>
                        </div>
                    </form>

                    {/* DADOS DO MÓDULO (SE EXISTIR) - READ ONLY NESTA VIEW */}
                    {editingContact && getModuleData(editingContact.id) && (
                        <div className="space-y-3 pt-4 border-t border-gray-100 animate-fade-in">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1">
                                    <FileHeart className="w-4 h-4" /> Informações Integradas ({getModuleData(editingContact.id)?.moduleTag})
                                </p>
                                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded">Módulo Ativo</span>
                            </div>
                            
                            <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 space-y-3 text-sm">
                                {(() => {
                                    const mod = getModuleData(editingContact.id)!;
                                    return (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-xs text-sky-700 font-bold mb-0.5">Convênio</span>
                                                    <div className="flex items-center gap-1 text-gray-700">
                                                        <Shield className="w-3 h-3 text-sky-400" />
                                                        {mod.insurance || 'Particular / Não informado'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-sky-700 font-bold mb-0.5">Nascimento</span>
                                                    <div className="text-gray-700">
                                                        {mod.birthDate ? new Date(mod.birthDate).toLocaleDateString('pt-BR') : '-'}
                                                    </div>
                                                </div>
                                            </div>

                                            {(mod.allergies || mod.medications) && (
                                                <div className="bg-white/60 rounded-lg p-2 border border-sky-100/50 space-y-2">
                                                    {mod.allergies && (
                                                        <div className="flex items-start gap-2">
                                                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5" />
                                                            <div>
                                                                <span className="text-xs font-bold text-rose-600 block">Alergias:</span>
                                                                <span className="text-gray-600">{mod.allergies}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {mod.medications && (
                                                        <div className="flex items-start gap-2">
                                                            <Stethoscope className="w-3.5 h-3.5 text-indigo-500 mt-0.5" />
                                                            <div>
                                                                <span className="text-xs font-bold text-indigo-600 block">Medicamentos:</span>
                                                                <span className="text-gray-600">{mod.medications}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div>
                                                <span className="block text-xs text-sky-700 font-bold mb-1">Histórico / Notas Clínicas</span>
                                                <p className="text-gray-600 italic bg-white p-2 rounded border border-sky-100 text-xs">
                                                    {mod.notes || 'Sem observações registradas.'}
                                                </p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                    <button
                        type="submit"
                        form="contactForm"
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ContactsView;
