import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, DollarSign, Tag, CreditCard, Repeat, ArrowRightLeft, Percent, User, Plus, FileText, Briefcase, MapPin, Calculator, FolderKanban, Users, Banknote, History, QrCode, Loader2 } from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus, Account, RecurrenceFrequency, Contact, Category, EntityType, Branch, CostCenter, Department, Project, TransactionClassification, AccountType } from '../types';
import { useAlert } from './AlertSystem';
import QRCodeScanner from './QRCodeScanner';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  accounts: Account[];
  contacts: Contact[];
  categories?: Category[];
  initialData?: Partial<Transaction> | null;
  // User context
  userEntity?: EntityType;
  // PJ Data
  branches?: Branch[];
  costCenters?: CostCenter[];
  departments?: Department[];
  projects?: Project[];
}

const TransactionModal: React.FC<TransactionModalProps> = ({ 
    isOpen, onClose, onSave, accounts, contacts, categories = [], initialData, 
    userEntity = EntityType.PERSONAL, branches = [], costCenters = [], departments = [], projects = []
}) => {
  const { showAlert } = useAlert();
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: TransactionType.EXPENSE,
    category: '', 
    date: new Date().toISOString().split('T')[0],
    status: TransactionStatus.PAID,
    accountId: '',
    destinationAccountId: '',
    isRecurring: false,
    recurrenceFrequency: 'MONTHLY' as RecurrenceFrequency,
    recurrenceEndDate: '',
    interestRate: '0',
    contactId: '',
    // PJ Fields
    branchId: '',
    destinationBranchId: '',
    costCenterId: '',
    departmentId: '',
    projectId: '',
    classification: TransactionClassification.STANDARD
  });

  // Autocomplete Contact State
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  // Autocomplete Category State
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // QR Code State
  const [showScanner, setShowScanner] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);

  const hasAccounts = accounts && accounts.length > 0;
  const isPJ = userEntity === EntityType.BUSINESS;

  useEffect(() => {
    if (initialData) {
      const contact = contacts.find(c => c.id === initialData.contactId);
      setFormData({
        description: initialData.description || '',
        amount: initialData.amount !== undefined ? initialData.amount.toString() : '',
        type: initialData.type || TransactionType.EXPENSE,
        category: initialData.category || '',
        date: initialData.date || new Date().toISOString().split('T')[0],
        status: initialData.status || TransactionStatus.PAID,
        accountId: initialData.accountId || '',
        destinationAccountId: initialData.destinationAccountId || '',
        isRecurring: !!initialData.isRecurring,
        recurrenceFrequency: initialData.recurrenceFrequency || 'MONTHLY',
        recurrenceEndDate: initialData.recurrenceEndDate || '',
        interestRate: initialData.interestRate !== undefined ? initialData.interestRate.toString() : '0',
        contactId: initialData.contactId || '',
        branchId: initialData.branchId || '',
        destinationBranchId: initialData.destinationBranchId || '',
        costCenterId: initialData.costCenterId || '',
        departmentId: initialData.departmentId || '',
        projectId: initialData.projectId || '',
        classification: initialData.classification || TransactionClassification.STANDARD
      });
      setContactSearch(contact ? contact.name : '');
      setCategorySearch(initialData.category || '');
    } else {
      setFormData({
        description: '',
        amount: '',
        type: TransactionType.EXPENSE,
        category: '',
        date: new Date().toISOString().split('T')[0],
        status: TransactionStatus.PAID,
        accountId: accounts.length > 0 ? accounts[0].id : '',
        destinationAccountId: accounts.length > 1 ? accounts[1].id : '',
        isRecurring: false,
        recurrenceFrequency: 'MONTHLY',
        recurrenceEndDate: '',
        interestRate: '0',
        contactId: '',
        branchId: branches[0]?.id || '',
        destinationBranchId: '',
        costCenterId: '',
        departmentId: '',
        projectId: '',
        classification: TransactionClassification.STANDARD
      });
      setContactSearch('');
      setCategorySearch('');
    }
  }, [initialData, isOpen, accounts, contacts, branches]);

  // Click outside listener
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
              setShowContactDropdown(false);
          }
          if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
              setShowCategoryDropdown(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update logic when classification changes
  useEffect(() => {
      if (formData.classification === TransactionClassification.CASH_REPLENISHMENT) {
          setFormData(prev => ({ ...prev, type: TransactionType.TRANSFER }));
          // Suggest description
          if (!formData.description) setFormData(prev => ({...prev, description: 'Suprimento de Caixa'}));
      } else if (formData.classification === TransactionClassification.INTER_BRANCH) {
          setFormData(prev => ({ ...prev, type: TransactionType.TRANSFER }));
          if (!formData.description) setFormData(prev => ({...prev, description: 'Transf. entre Filiais'}));
      } else if (formData.classification === TransactionClassification.ADVANCE) {
          setFormData(prev => ({ ...prev, type: TransactionType.EXPENSE })); // Typically expense first
      }
  }, [formData.classification]);

  const handleQRSuccess = async (decodedText: string) => {
      setShowScanner(false);
      setLoadingQR(true);
      
      try {
          const token = localStorage.getItem('token');
          const res = await fetch('/api/scrape-nfce', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': token ? `Bearer ${token}` : ''
              },
              body: JSON.stringify({ url: decodedText })
          });

          const data = await res.json();

          if (res.ok) {
              // Smart Account Selection based on payment type
              let suggestedAccountId = formData.accountId;
              if (data.paymentType) {
                  if (data.paymentType === 'CREDIT') {
                      const card = accounts.find(a => a.type === AccountType.CARD);
                      if (card) suggestedAccountId = card.id;
                  } else if (data.paymentType === 'CASH') {
                      const wallet = accounts.find(a => a.type === AccountType.WALLET);
                      if (wallet) suggestedAccountId = wallet.id;
                  } else if (data.paymentType === 'PIX' || data.paymentType === 'DEBIT') {
                      const bank = accounts.find(a => a.type === AccountType.BANK);
                      if (bank) suggestedAccountId = bank.id;
                  }
              }

              setFormData(prev => ({
                  ...prev,
                  description: data.merchant || 'Compra NFC-e',
                  type: TransactionType.EXPENSE,
                  amount: data.amount ? data.amount.toString() : prev.amount,
                  date: data.date || prev.date,
                  accountId: suggestedAccountId
              }));
              showAlert(`Nota lida com sucesso! Valor: R$ ${data.amount}`, "success");
          } else {
              showAlert(data.error || "Erro ao ler nota fiscal.", "error");
          }
      } catch (e) {
          console.error("Erro parse QR", e);
          showAlert("Erro ao conectar com o serviço de leitura.", "error");
      } finally {
          setLoadingQR(false);
      }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accountId) {
        showAlert("Atenção: Você precisa selecionar uma conta.", "warning");
        return;
    }

    if (formData.type === TransactionType.TRANSFER) {
        if (!formData.destinationAccountId) {
            showAlert("Selecione a conta de destino para a transferência.", "warning");
            return;
        }
        if (formData.accountId === formData.destinationAccountId) {
            showAlert("A conta de origem e destino não podem ser a mesma.", "warning");
            return;
        }
        
        if (formData.classification === TransactionClassification.INTER_BRANCH) {
            if (!formData.branchId || !formData.destinationBranchId) {
                showAlert("Para transferências entre filiais, selecione a filial de origem e a de destino.", "warning");
                return;
            }
            if (formData.branchId === formData.destinationBranchId) {
                showAlert("A filial de origem e destino devem ser diferentes.", "warning");
                return;
            }
        }
    }

    // --- Contact Logic ---
    let finalContactId = formData.contactId;
    let newContactObj: Contact | undefined;

    if (!finalContactId && contactSearch && formData.type !== TransactionType.TRANSFER) {
         const existing = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
         if (existing) {
             finalContactId = existing.id;
         } else {
             const newId = crypto.randomUUID();
             newContactObj = { 
                 id: newId, 
                 name: contactSearch,
                 type: 'PF' // Default to PF for quick creation
             };
             finalContactId = newId;
         }
    }

    // --- Category Logic ---
    let finalCategory = categorySearch;
    let newCategoryObj: Category | undefined;
    
    // Se digitou algo na busca que não bate com nada existente, cria nova categoria
    if (categorySearch && formData.type !== TransactionType.TRANSFER) {
        const existingCat = categories.find(c => c.name.toLowerCase() === categorySearch.toLowerCase() && c.type === formData.type);
        if (!existingCat) {
             // Create New Category
             newCategoryObj = { 
                 id: crypto.randomUUID(), 
                 name: categorySearch,
                 type: formData.type
             };
        }
    }

    onSave({
      description: formData.description, 
      amount: parseFloat(formData.amount),
      type: formData.type,
      category: formData.type === TransactionType.TRANSFER ? 'Transferência' : finalCategory,
      date: formData.date,
      status: formData.status,
      accountId: formData.accountId,
      destinationAccountId: (formData.type === TransactionType.TRANSFER && formData.destinationAccountId) ? formData.destinationAccountId : undefined,
      isRecurring: formData.isRecurring,
      recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : undefined,
      recurrenceEndDate: (formData.isRecurring && formData.recurrenceEndDate) ? formData.recurrenceEndDate : undefined,
      interestRate: parseFloat(formData.interestRate) || 0,
      contactId: finalContactId || undefined,
      // PJ
      branchId: isPJ ? formData.branchId : undefined,
      destinationBranchId: isPJ && formData.classification === TransactionClassification.INTER_BRANCH ? formData.destinationBranchId : undefined,
      costCenterId: isPJ ? formData.costCenterId : undefined,
      departmentId: isPJ ? formData.departmentId : undefined,
      projectId: isPJ ? formData.projectId : undefined,
      classification: isPJ ? formData.classification : undefined
    }, newContactObj, newCategoryObj);
    
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

  // Filter contacts
  const filteredContacts = contacts.filter(c => 
      c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  // Filter categories by Type and Search
  const filteredCategories = categories.filter(c => 
      c.type === formData.type && c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Filter destination accounts for Cash Replenishment (Only Wallets)
  const availableDestAccounts = formData.classification === TransactionClassification.CASH_REPLENISHMENT 
      ? accounts.filter(a => a.id !== formData.accountId && a.type === AccountType.WALLET)
      : accounts.filter(a => a.id !== formData.accountId);

  return (
    <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto animate-scale-up">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">
            {initialData && initialData.id ? 'Editar Transação' : 'Nova Transação'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loadingQR ? (
            <div className="p-8 text-center flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-gray-500 text-sm">Consultando dados da nota fiscal...</p>
            </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* QR CODE BUTTON - Only for PF and New Transaction */}
          {!initialData && !isPJ && (
              <div className="mb-2">
                  <button 
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl font-semibold shadow-md hover:bg-black transition-all"
                  >
                      <QrCode className="w-5 h-5" /> Ler QR Code da Nota (NFC-e)
                  </button>
                  <p className="text-[10px] text-center text-gray-400 mt-1">Preenchimento automático via SEFAZ</p>
              </div>
          )}

          {/* PJ Classification Selector */}
          {isPJ && (
              <div className="mb-2">
                  <label className="block text-xs font-bold text-indigo-700 mb-1">Tipo de Operação (PJ)</label>
                  <select
                      value={formData.classification}
                      onChange={(e) => setFormData({ ...formData, classification: e.target.value as TransactionClassification })}
                      className="block w-full rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900 font-medium"
                  >
                      <option value={TransactionClassification.STANDARD}>Padrão (Receita/Despesa)</option>
                      <option value={TransactionClassification.ADVANCE}>Adiantamento</option>
                      <option value={TransactionClassification.CASH_REPLENISHMENT}>Suprimento de Caixa</option>
                      <option value={TransactionClassification.INTER_BRANCH}>Transf. Entre Filiais</option>
                  </select>
              </div>
          )}

          {/* Type Selection (Disabled for specialized PJ operations) */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              disabled={formData.classification !== TransactionClassification.STANDARD}
              onClick={() => setFormData({ ...formData, type: TransactionType.EXPENSE })}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === TransactionType.EXPENSE ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Despesa
            </button>
            <button
              type="button"
              disabled={formData.classification !== TransactionClassification.STANDARD}
              onClick={() => setFormData({ ...formData, type: TransactionType.INCOME })}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Receita
            </button>
            <button
              type="button"
              disabled={formData.classification !== TransactionClassification.STANDARD}
              onClick={() => setFormData({ ...formData, type: TransactionType.TRANSFER })}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === TransactionType.TRANSFER ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Transf.
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Ex: Almoço, Salário, Conta de Luz"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor (R$)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0.00"
                />
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
                  className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{labels.accountLabel}</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {!hasAccounts && <option value="">Sem contas cadastradas</option>}
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.type === TransactionType.TRANSFER && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Para (Destino)</label>
                    <div className="relative">
                      <ArrowRightLeft className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <select
                        value={formData.destinationAccountId}
                        onChange={(e) => setFormData({ ...formData, destinationAccountId: e.target.value })}
                        className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        {availableDestAccounts.length === 0 && <option value="">Nenhuma conta disponível</option>}
                        {availableDestAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
              )}
          </div>

          {/* Contact & Category Autocomplete */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative" ref={contactDropdownRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{labels.contactLabel}</label>
                  <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                          type="text"
                          value={contactSearch}
                          onChange={(e) => {
                              setContactSearch(e.target.value);
                              setFormData(prev => ({ ...prev, contactId: '' })); // Reset ID on type
                              setShowContactDropdown(true);
                          }}
                          onFocus={() => setShowContactDropdown(true)}
                          className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Buscar ou criar..."
                      />
                  </div>
                  {showContactDropdown && (contactSearch || filteredContacts.length > 0) && (
                      <div className="absolute z-10 w-full bg-white border border-gray-100 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {filteredContacts.map(c => (
                              <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                      setContactSearch(c.name);
                                      setFormData(prev => ({ ...prev, contactId: c.id }));
                                      setShowContactDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                              >
                                  {c.name}
                              </button>
                          ))}
                          {contactSearch && !filteredContacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase()) && (
                              <div className="px-4 py-2 text-xs text-gray-500 italic border-t border-gray-50">
                                  Será criado como novo: "{contactSearch}"
                              </div>
                          )}
                      </div>
                  )}
              </div>

              <div className="relative" ref={categoryDropdownRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
                  <div className="relative">
                      <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                          type="text"
                          value={categorySearch}
                          onChange={(e) => {
                              setCategorySearch(e.target.value);
                              setShowCategoryDropdown(true);
                          }}
                          onFocus={() => setShowCategoryDropdown(true)}
                          className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Buscar ou criar..."
                      />
                  </div>
                  {showCategoryDropdown && (categorySearch || filteredCategories.length > 0) && (
                      <div className="absolute z-10 w-full bg-white border border-gray-100 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {filteredCategories.map(c => (
                              <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                      setCategorySearch(c.name);
                                      setFormData(prev => ({ ...prev, category: c.name }));
                                      setShowCategoryDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                              >
                                  {c.name}
                              </button>
                          ))}
                          {categorySearch && !filteredCategories.find(c => c.name.toLowerCase() === categorySearch.toLowerCase()) && (
                              <div className="px-4 py-2 text-xs text-gray-500 italic border-t border-gray-50">
                                  Nova Categoria: "{categorySearch}"
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>

          {/* Recurrence Options */}
          <div className="pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                      type="checkbox"
                      checked={formData.isRecurring}
                      onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Repeat className="w-4 h-4 text-gray-400" /> Repetir lançamento
                  </span>
              </label>

              {formData.isRecurring && (
                  <div className="grid grid-cols-2 gap-4 pl-6 animate-fade-in">
                      <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Frequência</label>
                          <select
                              value={formData.recurrenceFrequency}
                              onChange={(e) => setFormData({ ...formData, recurrenceFrequency: e.target.value as RecurrenceFrequency })}
                              className="block w-full rounded-lg border-gray-200 border px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                              <option value="WEEKLY">Semanal</option>
                              <option value="MONTHLY">Mensal</option>
                              <option value="YEARLY">Anual</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Até quando? (Opcional)</label>
                          <input
                              type="date"
                              value={formData.recurrenceEndDate}
                              onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                              className="block w-full rounded-lg border-gray-200 border px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                      </div>
                  </div>
              )}
          </div>

          {/* PJ Specific Fields */}
          {isPJ && (
              <div className="pt-2 border-t border-gray-100 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Detalhes Corporativos
                  </p>
                  
                  {/* Branch Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                              Filial {formData.type === TransactionType.TRANSFER && formData.classification === TransactionClassification.INTER_BRANCH ? '(Origem)' : ''}
                          </label>
                          <div className="relative">
                              <MapPin className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                              <select
                                  value={formData.branchId}
                                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                                  className="block w-full pl-8 rounded-lg border-gray-200 border px-3 py-1.5 text-sm outline-none"
                              >
                                  <option value="">Selecione...</option>
                                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                          </div>
                      </div>
                      
                      {formData.type === TransactionType.TRANSFER && formData.classification === TransactionClassification.INTER_BRANCH && (
                          <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Filial (Destino)</label>
                              <div className="relative">
                                  <MapPin className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                                  <select
                                      value={formData.destinationBranchId}
                                      onChange={(e) => setFormData({ ...formData, destinationBranchId: e.target.value })}
                                      className="block w-full pl-8 rounded-lg border-gray-200 border px-3 py-1.5 text-sm outline-none"
                                  >
                                      <option value="">Selecione...</option>
                                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                  </select>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Centro de Custo</label>
                          <div className="relative">
                              <Calculator className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                              <select
                                  value={formData.costCenterId}
                                  onChange={(e) => setFormData({ ...formData, costCenterId: e.target.value })}
                                  className="block w-full pl-8 rounded-lg border-gray-200 border px-3 py-1.5 text-sm outline-none"
                              >
                                  <option value="">Selecione...</option>
                                  {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Departamento</label>
                          <div className="relative">
                              <Users className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                              <select
                                  value={formData.departmentId}
                                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                  className="block w-full pl-8 rounded-lg border-gray-200 border px-3 py-1.5 text-sm outline-none"
                              >
                                  <option value="">Selecione...</option>
                                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Projeto</label>
                          <div className="relative">
                              <FolderKanban className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                              <select
                                  value={formData.projectId}
                                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                                  className="block w-full pl-8 rounded-lg border-gray-200 border px-3 py-1.5 text-sm outline-none"
                              >
                                  <option value="">Selecione...</option>
                                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* Status & Submit */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                  <input
                      type="checkbox"
                      checked={formData.status === TransactionStatus.PAID}
                      onChange={(e) => setFormData({ ...formData, status: e.target.checked ? TransactionStatus.PAID : TransactionStatus.PENDING })}
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className={`text-sm font-bold ${formData.status === TransactionStatus.PAID ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {formData.status === TransactionStatus.PAID ? 'Pago / Recebido' : 'Pendente / Agendado'}
                  </span>
              </label>

              <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                  Salvar
              </button>
          </div>

        </form>
        )}
      </div>
      
      {showScanner && (
          <QRCodeScanner 
              onScanSuccess={handleQRSuccess} 
              onClose={() => setShowScanner(false)} 
          />
      )}
    </div>
    </>
  );
};

export default TransactionModal;