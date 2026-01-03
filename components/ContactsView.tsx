
import React, { useState } from 'react';
import { Contact, ServiceClient } from '../types';
import { User, Plus, Search, Pencil, Trash2, Mail, Phone, FileText, Building, DollarSign, Shield, AlertTriangle, Briefcase } from 'lucide-react';

interface ContactsViewProps {
  contacts: Contact[];
  onAddContact: () => void;
  onEditContact: (c: Contact) => void;
  onDeleteContact: (id: string) => void;
  title?: string;
  subtitle?: string;
}

const ContactsView: React.FC<ContactsViewProps> = ({ contacts, onAddContact, onEditContact, onDeleteContact, title, subtitle }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.document && c.document.includes(searchTerm))
  );

  const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ 0,00';

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title || "Contatos & Clientes"}</h1>
          <p className="text-gray-500">{subtitle || "Gestão centralizada de pessoas físicas e jurídicas."}</p>
        </div>
        <button 
          onClick={onAddContact}
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
            placeholder="Buscar por nome, documento ou email..."
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
                    <div key={contact.id} className={`flex flex-col justify-between p-4 bg-white rounded-xl border transition-all group hover:shadow-md ${contact.isBlocked ? 'border-rose-200 bg-rose-50/30' : 'border-gray-200 hover:border-indigo-200'}`}>
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${contact.type === 'PJ' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {contact.type === 'PJ' ? <Building className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                </div>
                                <div className="overflow-hidden min-w-0">
                                    <span className="font-bold text-gray-800 block truncate">{contact.name}</span>
                                    <div className="flex gap-1 mt-0.5 items-center">
                                        <span className="text-[10px] text-gray-500 uppercase font-black">{contact.type}</span>
                                        {contact.fantasyName && <span className="text-[10px] text-gray-400 truncate">• {contact.fantasyName}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => onEditContact(contact)}
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
                            
                            {contact.document && (
                                <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{contact.document}</span>
                                </div>
                            )}

                            {(contact.isDefaulter || contact.isBlocked || (contact.creditLimit && contact.creditLimit > 0)) && (
                                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-50">
                                    {contact.isBlocked && <span className="flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><Shield className="w-3 h-3" /> Bloqueado</span>}
                                    {contact.isDefaulter && <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><AlertTriangle className="w-3 h-3" /> Inadimplente</span>}
                                    {contact.creditLimit && contact.creditLimit > 0 && <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100"><DollarSign className="w-3 h-3" /> Limite: {formatCurrency(contact.creditLimit)}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default ContactsView;
