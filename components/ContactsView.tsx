
import React, { useState } from 'react';
import { Contact } from '../types';
import { User, Plus, Search, Pencil, Trash2, X } from 'lucide-react';

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
  const [formData, setFormData] = useState({ name: '' });

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contact: Contact = {
        id: editingContact ? editingContact.id : crypto.randomUUID(),
        name: formData.name
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
        setFormData({ name: contact.name });
    } else {
        setEditingContact(null);
        setFormData({ name: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
    setFormData({ name: '' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus Contatos</h1>
          <p className="text-gray-500">Gerencie seus favorecidos e pagadores frequentes.</p>
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
            placeholder="Buscar contato..."
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.map(contact => (
                    <div key={contact.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                {contact.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-800">{contact.name}</span>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => handleOpenModal(contact)}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"
                                title="Editar"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => {
                                    if(confirm('Excluir contato? O histórico de transações não será perdido, mas o nome do contato será desvinculado.')) {
                                        onDeleteContact(contact.id);
                                    }
                                }}
                                className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg"
                                title="Excluir"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800">
                        {editingContact ? 'Editar Contato' : 'Novo Contato'}
                    </h2>
                    <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Contato</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ name: e.target.value })}
                            className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Ex: Supermercado X, João Silva..."
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        Salvar
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ContactsView;
