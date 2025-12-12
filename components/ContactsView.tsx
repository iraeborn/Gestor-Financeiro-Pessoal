
import React, { useState } from 'react';
import { Contact } from '../types';
import { User, Plus, Search, Pencil, Trash2, X, Mail, Phone, FileText, QrCode } from 'lucide-react';

interface ContactsViewProps {
  contacts: Contact[];
  onAddContact: (c: Contact) => void;
  onEditContact: (c: Contact) => void;
  onDeleteContact: (id: string) => void;
}

const ContactsView: React.FC<ContactsViewProps> = ({ contacts, onAddContact, onEditContact, onDeleteContact }) => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Contatos</h1>
          <p className="text-gray-500">Cadastro centralizado de favorecidos, clientes e pagadores.</p>
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
            placeholder="Buscar por nome ou email..."
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
                {filteredContacts.map(contact => (
                    <div key={contact.id} className="flex flex-col justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors group">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                    {contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="overflow-hidden">
                                    <span className="font-semibold text-gray-800 block truncate" title={contact.name}>{contact.name}</span>
                                    {contact.document && <span className="text-xs text-gray-500 block">Doc: {contact.document}</span>}
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
                ))}
            </div>
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800">
                        {editingContact ? 'Editar Contato' : 'Novo Contato'}
                    </h2>
                    <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                                placeholder="Ex: Supermercado X, João Silva..."
                                autoFocus
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
                                    placeholder="000.000.000-00"
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

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg mt-2"
                    >
                        Salvar Contato
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ContactsView;
