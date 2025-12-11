
import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, DollarSign, Tag, CreditCard, Repeat, AlertCircle, ArrowRightLeft, Percent, User, Plus, Search, FileText } from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus, Account, RecurrenceFrequency, Contact } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>, newContact?: Contact) => void;
  accounts: Account[];
  contacts: Contact[];
  initialData?: Transaction | null;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, accounts, contacts, initialData }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: TransactionType.EXPENSE,
    category: 'Geral',
    date: new Date().toISOString().split('T')[0],
    status: TransactionStatus.PAID,
    accountId: '',
    destinationAccountId: '',
    isRecurring: false,
    recurrenceFrequency: 'MONTHLY' as RecurrenceFrequency,
    recurrenceEndDate: '',
    interestRate: '0',
    contactId: ''
  });

  // Autocomplete State
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasAccounts = accounts && accounts.length > 0;

  useEffect(() => {
    if (initialData) {
      const contact = contacts.find(c => c.id === initialData.contactId);
      setFormData({
        description: initialData.description,
        amount: initialData.amount.toString(),
        type: initialData.type,
        category: initialData.category,
        date: initialData.date,
        status: initialData.status,
        accountId: initialData.accountId,
        destinationAccountId: initialData.destinationAccountId || '',
        isRecurring: initialData.isRecurring,
        recurrenceFrequency: initialData.recurrenceFrequency || 'MONTHLY',
        recurrenceEndDate: initialData.recurrenceEndDate || '',
        interestRate: initialData.interestRate ? initialData.interestRate.toString() : '0',
        contactId: initialData.contactId || ''
      });
      // Pre-fill contact search if exists
      setContactSearch(contact ? contact.name : '');
    } else {
      setFormData({
        description: '',
        amount: '',
        type: TransactionType.EXPENSE,
        category: 'Geral',
        date: new Date().toISOString().split('T')[0],
        status: TransactionStatus.PAID,
        accountId: accounts.length > 0 ? accounts[0].id : '',
        destinationAccountId: accounts.length > 1 ? accounts[1].id : '',
        isRecurring: false,
        recurrenceFrequency: 'MONTHLY',
        recurrenceEndDate: '',
        interestRate: '0',
        contactId: ''
      });
      setContactSearch('');
    }
  }, [initialData, isOpen, accounts, contacts]);

  // Click outside to close dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setShowContactDropdown(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accountId) {
        alert("Atenção: Você precisa selecionar uma conta.");
        return;
    }

    if (formData.type === TransactionType.TRANSFER) {
        if (!formData.destinationAccountId) {
            alert("Selecione a conta de destino para a transferência.");
            return;
        }
        if (formData.accountId === formData.destinationAccountId) {
            alert("A conta de origem e destino não podem ser a mesma.");
            return;
        }
    }

    // Determine final contact
    let finalContactId = formData.contactId;
    let newContactObj: Contact | undefined;

    // Se usuário digitou algo no campo de contato mas não selecionou ID
    // Assumimos que quer criar um novo contato
    if (!finalContactId && contactSearch && formData.type !== TransactionType.TRANSFER) {
         // Verifica se já existe pelo nome exato
         const existing = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
         if (existing) {
             finalContactId = existing.id;
         } else {
             // Create New Contact Logic
             const newId = crypto.randomUUID();
             newContactObj = { id: newId, name: contactSearch };
             finalContactId = newId;
         }
    }

    onSave({
      description: formData.description, 
      amount: parseFloat(formData.amount),
      type: formData.type,
      category: formData.type === TransactionType.TRANSFER ? 'Transferência' : formData.category,
      date: formData.date,
      status: formData.status,
      accountId: formData.accountId,
      destinationAccountId: (formData.type === TransactionType.TRANSFER && formData.destinationAccountId) ? formData.destinationAccountId : undefined,
      isRecurring: formData.isRecurring,
      recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : undefined,
      recurrenceEndDate: (formData.isRecurring && formData.recurrenceEndDate) ? formData.recurrenceEndDate : undefined,
      interestRate: parseFloat(formData.interestRate) || 0,
      // Se finalContactId for string vazia ou undefined, enviamos NULL explicitamente ou undefined.
      // O backend sanitiza, mas enviar undefined pode remover a chave do JSON.
      // Vamos enviar undefined se não houver, para compatibilidade padrão, mas garantindo que string vazia não vá.
      contactId: finalContactId || undefined
    }, newContactObj);
    
    onClose();
  };

  const getDynamicLabels = () => {
    switch (formData.type) {
        case TransactionType.INCOME:
            return {
                accountLabel: 'Receber em (Conta)',
                contactLabel: 'Origem (Quem pagou?)'
            };
        case TransactionType.EXPENSE:
            return {
                accountLabel: 'Pagar com (Conta)',
                contactLabel: 'Destino (Favorecido)'
            };
        default:
            return {
                accountLabel: 'Conta de Saída',
                contactLabel: 'Beneficiário'
            };
    }
  };

  const labels = getDynamicLabels();

  // Filter contacts based on search
  const filteredContacts = contacts.filter(c => 
      c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">
            {initialData ? 'Editar Transação' : 'Nova Transação'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Selection */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                  setFormData({ ...formData, type: TransactionType.EXPENSE, category: 'Geral' });
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.type === TransactionType.EXPENSE
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => {
                  setFormData({ ...formData, type: TransactionType.INCOME, category: 'Salário' });
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.type === TransactionType.INCOME
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => {
                  setFormData({ ...formData, type: TransactionType.TRANSFER, category: 'Transferência' });
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.type === TransactionType.TRANSFER
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Transf.
            </button>
          </div>

          {/* Amount */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 font-bold">R$</span>
            </div>
            <input
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="pl-10 block w-full rounded-xl border-gray-200 border py-3 text-lg font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="0,00"
            />
          </div>

          {/* Contact Autocomplete - SEPARADO */}
          {formData.type !== TransactionType.TRANSFER && (
            <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{labels.contactLabel}</label>
                <div className="relative">
                    <div className="absolute left-3 top-2.5 pointer-events-none">
                        <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={contactSearch}
                        onFocus={() => setShowContactDropdown(true)}
                        onChange={(e) => {
                            setContactSearch(e.target.value);
                            setFormData({...formData, contactId: ''}); // Limpa ID se o usuário digitar
                            setShowContactDropdown(true);
                        }}
                        className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Buscar ou criar novo contato..."
                    />
                </div>
                
                {/* Dropdown Results */}
                {showContactDropdown && contactSearch && (
                    <div className="absolute z-10 w-full bg-white mt-1 border border-gray-100 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredContacts.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    setContactSearch(c.name);
                                    setFormData({...formData, contactId: c.id});
                                    setShowContactDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm text-gray-700 flex items-center justify-between group"
                            >
                                <span>{c.name}</span>
                                <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100">Selecionar</span>
                            </button>
                        ))}
                        {filteredContacts.length === 0 && contactSearch.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowContactDropdown(false)} // Fecha, o submit criará
                                className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-sm text-emerald-700 flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Criar novo: "{contactSearch}"
                            </button>
                        )}
                    </div>
                )}
            </div>
          )}

          {/* Description - SEPARADO */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descrição (O que é?)</label>
            <div className="relative">
                <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={formData.type === TransactionType.TRANSFER ? "Motivo da transferência" : "Ex: Compras do Mês, Jantar..."}
                />
            </div>
          </div>

          {/* Category & Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
              <div className="relative">
                <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  list="categories"
                  disabled={formData.type === TransactionType.TRANSFER}
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="block w-full rounded-lg border-gray-200 border pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                />
                <datalist id="categories">
                  <option value="Alimentação" />
                  <option value="Moradia" />
                  <option value="Transporte" />
                  <option value="Saúde" />
                  <option value="Lazer" />
                  <option value="Salário" />
                  <option value="Investimentos" />
                </datalist>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="block w-full rounded-lg border-gray-200 border pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

           {/* Interest Rate Field */}
           {formData.type !== TransactionType.TRANSFER && (
              <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Taxa de Juros (Mensal %)</label>
                  <div className="relative">
                    <Percent className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.interestRate}
                      onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                      className="block w-full rounded-lg border-gray-200 border pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0"
                    />
                  </div>
              </div>
           )}

          {/* Account Selection Logic */}
          {formData.type === TransactionType.TRANSFER ? (
              <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div className="col-span-2 flex items-center gap-2 text-blue-700 text-xs font-bold mb-1">
                      <ArrowRightLeft className="w-3 h-3" />
                      Contas Envolvidas
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-blue-800 mb-1">Sai de</label>
                    <select
                        value={formData.accountId}
                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                        className="block w-full rounded-lg border border-blue-200 px-2 py-2 text-sm outline-none bg-white"
                    >
                         {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                         ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-blue-800 mb-1">Entra em</label>
                    <select
                        value={formData.destinationAccountId}
                        onChange={(e) => setFormData({ ...formData, destinationAccountId: e.target.value })}
                        className="block w-full rounded-lg border border-blue-200 px-2 py-2 text-sm outline-none bg-white"
                    >
                         <option value="">Selecione...</option>
                         {accounts.filter(a => a.id !== formData.accountId).map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                         ))}
                    </select>
                  </div>
              </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="block text-xs font-bold text-indigo-700 mb-1">{labels.accountLabel}</label>
                <div className="relative">
                    <CreditCard className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className={`block w-full rounded-lg border pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none ${!hasAccounts ? 'border-red-300 text-red-500 bg-red-50' : 'border-gray-200'}`}
                    >
                    {hasAccounts ? (
                        accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))
                    ) : (
                        <option value="">Nenhuma conta</option>
                    )}
                    </select>
                </div>
                </div>
                <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                    className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    <option value={TransactionStatus.PAID}>Pago / Recebido</option>
                    <option value={TransactionStatus.PENDING}>Pendente</option>
                    <option value={TransactionStatus.OVERDUE}>Atrasado</option>
                </select>
                </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recurring"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <label htmlFor="recurring" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5" />
                Recorrente?
              </label>
            </div>
            
            {formData.isRecurring && (
              <div className="mt-3 grid grid-cols-2 gap-4 animate-fade-in p-3 bg-gray-50 rounded-xl">
                 <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Frequência</label>
                    <select
                      value={formData.recurrenceFrequency}
                      onChange={(e) => setFormData({ ...formData, recurrenceFrequency: e.target.value as RecurrenceFrequency })}
                      className="block w-full rounded-lg border-gray-200 border px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="WEEKLY">Semanal</option>
                      <option value="MONTHLY">Mensal</option>
                      <option value="YEARLY">Anual</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Data de Término</label>
                    <input
                      type="date"
                      value={formData.recurrenceEndDate}
                      onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                      className="block w-full rounded-lg border-gray-200 border px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                 </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!hasAccounts}
              className={`w-full text-white py-3 rounded-xl font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  formData.type === TransactionType.TRANSFER 
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {formData.type === TransactionType.TRANSFER ? 'Confirmar Transferência' : 'Salvar Transação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
