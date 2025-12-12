
import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, DollarSign, Tag, CreditCard, Repeat, ArrowRightLeft, Percent, User, Plus, FileText, Briefcase, MapPin, Calculator, FolderKanban, Users, Banknote, History, QrCode } from 'lucide-react';
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

  const handleQRSuccess = (decodedText: string) => {
      setShowScanner(false);
      
      // Lógica de Parsing da URL/String do QR Code da NFC-e
      // Padrão 1: URL com parametros v (versão 2.0+ frequentemente tem o valor no parametro 'v' ou 'vNF')
      // Padrão 2: String separada por pipe '|' (Modelo antigo/contingência) -> ...|VALOR|...
      
      let amountFound = '';
      let dateFound = '';

      // Tentar extrair valor via URL Params (comum em muitos estados)
      try {
          // Se for URL completa
          if (decodedText.startsWith('http')) {
              const url = new URL(decodedText);
              // Tenta parâmetros comuns de valor
              const vNF = url.searchParams.get('vNF') || url.searchParams.get('v') || url.searchParams.get('valor');
              if (vNF) amountFound = vNF;
          }
          
          // Fallback: Tentar extrair de string pipe-separated (ex: chNFe|...|vNF|...)
          // O QR code da NFC-e versão 2.0 geralmente é:
          // URL?p=CHAVE|2|1|1|VALOR|DIGEST|...
          if (!amountFound && decodedText.includes('|')) {
              const parts = decodedText.split('|');
              // Heurística: Procurar um valor numérico com ponto (ex: 50.00) que não seja 1 ou 2 (índices comuns)
              // Geralmente o valor total é o 5º ou 6º elemento após a chave
              // Exemplo string parâmetro p: 3524...|2|1|1|10.50|...
              
              // Vamos tentar pegar especificamente o índice 4 (5º elemento) se a string começar com chave numérica grande
              if (parts[0].length > 40 && parts.length > 4) {
                  const valCandidate = parts[4];
                  if (!isNaN(parseFloat(valCandidate))) {
                      amountFound = valCandidate;
                  }
              }
          }
      } catch (e) {
          console.error("Erro ao fazer parse do QR", e);
      }

      setFormData(prev => ({
          ...prev,
          description: 'Compra via QR Code',
          type: TransactionType.EXPENSE, // NFC-e é sempre despesa
          // Se achou valor, usa. Se não, mantém o atual.
          amount: amountFound ? amountFound : prev.amount,
          date: dateFound || prev.date
      }));

      if (amountFound) {
          showAlert(`QR Code lido! Valor identificado: R$ ${amountFound}`, "success");
      } else {
          showAlert("QR Code lido, mas o valor não pôde ser extraído automaticamente desta versão de nota.", "info");
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
             newContactObj = { id: newId, name: contactSearch };
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* QR CODE BUTTON */}
          {!initialData && (
              <div className="mb-2">
                  <button 
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl font-semibold shadow-md hover:bg-black transition-all"
                  >
                      <QrCode className="w-5 h-5" /> Ler QR Code da Nota
                  </button>
                  <p className="text-[10px] text-center text-gray-400 mt-1">Preenchimento automático via NFC-e/SAT</p>
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
              onClick={() => {
                  setFormData({ ...formData, type: TransactionType.EXPENSE });
                  setCategorySearch('');
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.type === TransactionType.EXPENSE
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              disabled={formData.classification !== TransactionClassification.STANDARD}
              onClick={() => {
                  setFormData({ ...formData, type: TransactionType.INCOME });
                  setCategorySearch('');
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.type === TransactionType.INCOME
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'
              }`}
            >
              Receita
            </button>
            <button
              type="button"
              disabled={formData.classification !== TransactionClassification.STANDARD}
              onClick={() => {
                  setFormData({ ...formData, type: TransactionType.TRANSFER });
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.type === TransactionType.TRANSFER
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'
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

          {/* Contact Autocomplete */}
          {formData.type !== TransactionType.TRANSFER && (
            <div className="relative" ref={contactDropdownRef}>
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
                            setFormData({...formData, contactId: ''});
                            setShowContactDropdown(true);
                        }}
                        className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Buscar ou criar novo..."
                    />
                </div>
                
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
                                onClick={() => setShowContactDropdown(false)}
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

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
            <div className="relative">
                <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="pl-9 block w-full rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={formData.classification === TransactionClassification.CASH_REPLENISHMENT ? "Suprimento de Caixa" : "Ex: Compras do Mês"}
                />
            </div>
          </div>

          {/* Category (Autocomplete) & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
              <div className="relative" ref={categoryDropdownRef}>
                <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 z-10" />
                <input
                  type="text"
                  value={categorySearch}
                  disabled={formData.type === TransactionType.TRANSFER}
                  onFocus={() => setShowCategoryDropdown(true)}
                  onChange={(e) => {
                      setCategorySearch(e.target.value);
                      setShowCategoryDropdown(true);
                  }}
                  className="block w-full rounded-lg border-gray-200 border pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Selecione..."
                />
                 {/* Category Dropdown */}
                 {showCategoryDropdown && formData.type !== TransactionType.TRANSFER && (
                    <div className="absolute z-20 w-full bg-white mt-1 border border-gray-100 rounded-lg shadow-lg max-h-48 overflow-y-auto left-0">
                        {filteredCategories.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    setCategorySearch(c.name);
                                    setShowCategoryDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm text-gray-700"
                            >
                                {c.name}
                            </button>
                        ))}
                        {filteredCategories.length === 0 && categorySearch.length > 0 && (
                             <button
                                type="button"
                                onClick={() => setShowCategoryDropdown(false)}
                                className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-sm text-emerald-700 flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Criar: "{categorySearch}"
                            </button>
                        )}
                    </div>
                 )}
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
                         {availableDestAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                         ))}
                    </select>
                  </div>
                  {formData.classification === TransactionClassification.CASH_REPLENISHMENT && availableDestAccounts.length === 0 && (
                      <p className="col-span-2 text-[10px] text-rose-600">Atenção: Nenhuma conta tipo "Carteira" ou "Caixa" encontrada para suprimento.</p>
                  )}
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

          {/* PJ Fields */}
          {isPJ && formData.type !== TransactionType.TRANSFER && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Classificação Corporativa
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Filial</label>
                          <div className="relative">
                              <MapPin className="w-3 h-3 text-gray-400 absolute left-2 top-2" />
                              <select 
                                value={formData.branchId} 
                                onChange={e => setFormData({...formData, branchId: e.target.value})}
                                className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-md outline-none focus:border-indigo-500"
                              >
                                  <option value="">Selecione...</option>
                                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Centro de Custo</label>
                          <div className="relative">
                              <Calculator className="w-3 h-3 text-gray-400 absolute left-2 top-2" />
                              <select 
                                value={formData.costCenterId} 
                                onChange={e => setFormData({...formData, costCenterId: e.target.value})}
                                className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-md outline-none focus:border-indigo-500"
                              >
                                  <option value="">Selecione...</option>
                                  {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Departamento</label>
                          <div className="relative">
                              <Users className="w-3 h-3 text-gray-400 absolute left-2 top-2" />
                              <select 
                                value={formData.departmentId} 
                                onChange={e => setFormData({...formData, departmentId: e.target.value})}
                                className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-md outline-none focus:border-indigo-500"
                              >
                                  <option value="">Selecione...</option>
                                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Projeto</label>
                          <div className="relative">
                              <FolderKanban className="w-3 h-3 text-gray-400 absolute left-2 top-2" />
                              <select 
                                value={formData.projectId} 
                                onChange={e => setFormData({...formData, projectId: e.target.value})}
                                className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-md outline-none focus:border-indigo-500"
                              >
                                  <option value="">Selecione...</option>
                                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* Inter-Branch Specific Fields */}
          {isPJ && formData.classification === TransactionClassification.INTER_BRANCH && (
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 grid grid-cols-2 gap-3">
                  <div className="col-span-2 text-xs font-bold text-indigo-700 flex items-center gap-1">
                      <Banknote className="w-3 h-3" /> Movimentação entre Filiais
                  </div>
                  <div>
                      <label className="block text-[10px] font-medium text-indigo-600 mb-1">Filial Origem (Saída)</label>
                      <select 
                        value={formData.branchId} 
                        onChange={e => setFormData({...formData, branchId: e.target.value})}
                        className="w-full px-2 py-1.5 text-xs border border-indigo-200 rounded-md outline-none focus:border-indigo-500"
                      >
                          <option value="">Selecione...</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-[10px] font-medium text-indigo-600 mb-1">Filial Destino (Entrada)</label>
                      <select 
                        value={formData.destinationBranchId} 
                        onChange={e => setFormData({...formData, destinationBranchId: e.target.value})}
                        className="w-full px-2 py-1.5 text-xs border border-indigo-200 rounded-md outline-none focus:border-indigo-500"
                      >
                          <option value="">Selecione...</option>
                          {branches.filter(b => b.id !== formData.branchId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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

          {/* Audit Footer */}
          {initialData && initialData.id && (
              <div className="bg-gray-50 p-2 rounded-lg text-[10px] text-gray-400 mt-2 flex flex-col gap-1 border border-gray-100">
                  {initialData.createdByName && (
                      <div className="flex items-center gap-1">
                          <History className="w-3 h-3" />
                          <span>Criado por <strong>{initialData.createdByName}</strong></span>
                      </div>
                  )}
                  {initialData.updatedByName && initialData.updatedAt && (
                      <div className="flex items-center gap-1">
                          <History className="w-3 h-3" />
                          <span>
                              Alterado por <strong>{initialData.updatedByName}</strong> em {new Date(initialData.updatedAt).toLocaleDateString('pt-BR')} às {new Date(initialData.updatedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                      </div>
                  )}
              </div>
          )}

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
