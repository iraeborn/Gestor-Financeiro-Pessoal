
import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, DollarSign, Tag, CreditCard, Repeat, ArrowRightLeft, User, QrCode, Loader2, Check, Clock, AlertCircle, Banknote, TrendingUp, ChevronDown } from 'lucide-react';
/* Import missing PJ types from types.ts */
import { Transaction, TransactionType, TransactionStatus, Account, RecurrenceFrequency, Contact, Category, EntityType, TransactionClassification, Branch, CostCenter, Department, Project } from '../types';
import { useAlert } from './AlertSystem';
import QRCodeScanner from './QRCodeScanner';

/* Add PJ-related properties to TransactionModalProps to fix type error in TransactionsView.tsx */
interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  accounts: Account[];
  contacts: Contact[];
  categories?: Category[];
  initialData?: Partial<Transaction> | null;
  userEntity?: EntityType;
  branches?: Branch[];
  costCenters?: CostCenter[];
  departments?: Department[];
  projects?: Project[];
}

const TransactionModal: React.FC<TransactionModalProps> = ({ 
    isOpen, onClose, onSave, accounts, contacts, categories = [], initialData, 
    userEntity = EntityType.PERSONAL,
    /* Destructure PJ properties provided from TransactionsView.tsx */
    branches = [], costCenters = [], departments = [], projects = []
}) => {
  const { showAlert } = useAlert();
  /* Update formData to include PJ-specific fields for business management */
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
    recurrenceFrequency: RecurrenceFrequency.MONTHLY,
    recurrenceEndDate: '',
    contactId: '',
    branchId: '',
    costCenterId: '',
    departmentId: '',
    projectId: '',
    classification: TransactionClassification.STANDARD,
  });

  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);

  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      const contact = contacts.find(c => c.id === initialData.contactId);
      /* Populate formData including PJ fields from existing transaction data */
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
        recurrenceFrequency: initialData.recurrenceFrequency || RecurrenceFrequency.MONTHLY,
        recurrenceEndDate: initialData.recurrenceEndDate || '',
        contactId: initialData.contactId || '',
        branchId: initialData.branchId || '',
        costCenterId: initialData.costCenterId || '',
        departmentId: initialData.departmentId || '',
        projectId: initialData.projectId || '',
        classification: initialData.classification || TransactionClassification.STANDARD,
      });
      setContactSearch(contact ? contact.name : '');
      setCategorySearch(initialData.category || '');
    } else {
      /* Initialize formData with defaults including PJ-specific management fields */
      setFormData(prev => ({
        ...prev,
        description: '',
        amount: '',
        type: TransactionType.EXPENSE,
        date: new Date().toISOString().split('T')[0],
        status: TransactionStatus.PAID,
        accountId: accounts.length > 0 ? accounts[0].id : '',
        destinationAccountId: accounts.length > 1 ? accounts[1].id : '',
        contactId: '',
        isRecurring: false,
        branchId: '',
        costCenterId: '',
        departmentId: '',
        projectId: '',
        classification: TransactionClassification.STANDARD,
      }));
      setContactSearch('');
      setCategorySearch('');
    }
  }, [initialData, isOpen, accounts, contacts]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) setShowContactDropdown(false);
        if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) setShowCategoryDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQRSuccess = async (decodedText: string) => {
      setShowScanner(false);
      setLoadingQR(true);
      try {
          const token = localStorage.getItem('token');
          const res = await fetch('/api/scrape-nfce', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
              body: JSON.stringify({ url: decodedText })
          });
          const data = await res.json();
          if (res.ok) {
              setFormData(prev => ({
                  ...prev,
                  description: data.merchant || 'Compra NFC-e',
                  amount: data.amount ? data.amount.toString() : prev.amount,
                  date: data.date || prev.date,
              }));
              showAlert(`Nota processada: R$ ${data.amount}`, "success");
          } else showAlert(data.error || "Erro ao ler nota.", "error");
      } catch (e) { showAlert("Erro de conexão.", "error"); } finally { setLoadingQR(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId) return showAlert("Selecione uma conta.", "warning");
    
    let finalContactId = formData.contactId;
    let newContactObj: Contact | undefined;
    if (!finalContactId && contactSearch && formData.type !== TransactionType.TRANSFER) {
         const existing = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
         if (existing) finalContactId = existing.id;
         else {
             const newId = crypto.randomUUID();
             newContactObj = { id: newId, name: contactSearch, type: 'PF' };
             finalContactId = newId;
         }
    }

    let finalCategory = categorySearch;
    let newCategoryObj: Category | undefined;
    if (categorySearch && formData.type !== TransactionType.TRANSFER) {
        const existingCat = categories.find(c => c.name.toLowerCase() === categorySearch.toLowerCase() && c.type === formData.type);
        if (!existingCat) newCategoryObj = { id: crypto.randomUUID(), name: categorySearch, type: formData.type };
    }

    /* Include PJ management fields in the object passed to onSave */
    onSave({
      description: formData.description, 
      amount: parseFloat(formData.amount),
      type: formData.type,
      category: formData.type === TransactionType.TRANSFER ? 'Transferência' : finalCategory,
      date: formData.date,
      status: formData.status,
      accountId: formData.accountId,
      destinationAccountId: (formData.type === TransactionType.TRANSFER) ? formData.destinationAccountId : undefined,
      isRecurring: formData.isRecurring,
      recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : undefined,
      recurrenceEndDate: (formData.isRecurring && formData.recurrenceEndDate) ? formData.recurrenceEndDate : undefined,
      contactId: finalContactId || undefined,
      branchId: formData.branchId || undefined,
      costCenterId: formData.costCenterId || undefined,
      departmentId: formData.departmentId || undefined,
      projectId: formData.projectId || undefined,
      classification: formData.classification
    }, newContactObj, newCategoryObj);
    onClose();
  };

  if (!isOpen) return null;

  const typeColors = {
      [TransactionType.EXPENSE]: 'text-rose-600',
      [TransactionType.INCOME]: 'text-emerald-600',
      [TransactionType.TRANSFER]: 'text-blue-600'
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-scale-up border border-slate-100">
        
        {/* Header Compacto */}
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">
                {initialData?.id ? 'Editar Lançamento' : 'Novo Lançamento'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <X className="w-5 h-5" />
            </button>
        </div>

        {loadingQR ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-500 text-sm">Lendo nota fiscal...</p>
            </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
          
          {/* Valor de Destaque */}
          <div className="space-y-3">
              <div className="relative">
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-bold ${typeColors[formData.type]}`}>R$</div>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className={`block w-full pl-12 pr-4 py-2 bg-transparent border-b-2 border-slate-100 focus:border-indigo-500 rounded-none text-4xl font-black text-slate-800 outline-none transition-all placeholder-slate-200`}
                  placeholder="0,00"
                />
                {!initialData && formData.type === TransactionType.EXPENSE && (
                    <button type="button" onClick={() => setShowScanner(true)} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                        <QrCode className="w-6 h-6" />
                    </button>
                )}
              </div>
              <div className="flex gap-2">
                {[10, 50, 100].map(v => (
                    <button key={v} type="button" onClick={() => setFormData({...formData, amount: String((Number(formData.amount)||0) + v)})} className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg text-[10px] font-bold text-slate-500 hover:text-indigo-600 border border-slate-100 transition-all">+ R$ {v}</button>
                ))}
                <button type="button" onClick={() => setFormData({...formData, amount: ''})} className="px-3 py-1 bg-slate-50 hover:bg-rose-50 rounded-lg text-[10px] font-bold text-slate-400 hover:text-rose-600 border border-slate-100 transition-all">Limpar</button>
              </div>
          </div>

          {/* Tipo de Lançamento (Tabs Minimalistas) */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                {[
                    { id: TransactionType.EXPENSE, label: 'Despesa', icon: Banknote },
                    { id: TransactionType.INCOME, label: 'Receita', icon: TrendingUp },
                    { id: TransactionType.TRANSFER, label: 'Transferência', icon: ArrowRightLeft }
                ].map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: item.id })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                            formData.type === item.id 
                            ? 'bg-white shadow-sm text-indigo-600' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <item.icon className="w-3.5 h-3.5" /> {item.label}
                    </button>
                ))}
          </div>

          {/* Grid de Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Descrição</label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent"
                    placeholder="Ex: Supermercado"
                  />
              </div>

              <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data</label>
                  <div className="relative">
                      <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent" />
                  </div>
              </div>

              <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conta</label>
                  <select value={formData.accountId} onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent appearance-none">
                      {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
              </div>

              {formData.type === TransactionType.TRANSFER ? (
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destino</label>
                      <select value={formData.destinationAccountId} onChange={(e) => setFormData({ ...formData, destinationAccountId: e.target.value })} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent appearance-none">
                          {accounts.filter(a => a.id !== formData.accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                      </select>
                  </div>
              ) : (
                  <div className="space-y-1 relative" ref={categoryDropdownRef}>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Categoria</label>
                      <input type="text" value={categorySearch} onFocus={() => setShowCategoryDropdown(true)} onChange={(e) => {setCategorySearch(e.target.value); setShowCategoryDropdown(true);}} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent" placeholder="Selecione ou crie..." />
                      {showCategoryDropdown && (
                          <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto p-1 animate-fade-in">
                              {categories.filter(c => c.type === formData.type && c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                  <button key={c.id} type="button" onClick={() => {setCategorySearch(c.name); setShowCategoryDropdown(false);}} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition-colors">{c.name}</button>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value as TransactionStatus})}
                    className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent appearance-none"
                  >
                      <option value={TransactionStatus.PAID}>Pago / Recebido</option>
                      <option value={TransactionStatus.PENDING}>Pendente</option>
                      <option value={TransactionStatus.OVERDUE}>Atrasado</option>
                  </select>
              </div>

              <div className="space-y-1 relative" ref={contactDropdownRef}>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pessoa / Contato</label>
                  <input type="text" value={contactSearch} onFocus={() => setShowContactDropdown(true)} onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent" placeholder="Opcional..." />
                  {showContactDropdown && (
                      <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto p-1 animate-fade-in">
                          {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                              <button key={c.id} type="button" onClick={() => {setContactSearch(c.name); setFormData({...formData, contactId: c.id}); setShowContactDropdown(false);}} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition-colors">{c.name}</button>
                          ))}
                      </div>
                  )}
              </div>

              {/* Business Entity (PJ) Specific Selection Fields */}
              {userEntity === EntityType.BUSINESS && (
                  <>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filial</label>
                          <select value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent appearance-none">
                              <option value="">Selecione...</option>
                              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Centro de Custo</label>
                          <select value={formData.costCenterId} onChange={e => setFormData({...formData, costCenterId: e.target.value})} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent appearance-none">
                              <option value="">Selecione...</option>
                              {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Departamento</label>
                          <select value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent appearance-none">
                              <option value="">Selecione...</option>
                              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projeto</label>
                          <select value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value})} className="w-full px-0 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-transparent appearance-none">
                              <option value="">Selecione...</option>
                              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                      </div>
                  </>
              )}
          </div>

          {/* Recorrência Minimalista */}
          <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-8 h-5 rounded-full transition-all relative ${formData.isRecurring ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.isRecurring ? 'left-3.5' : 'left-0.5'}`}></div>
                  </div>
                  <input type="checkbox" className="sr-only" checked={formData.isRecurring} onChange={e => setFormData({...formData, isRecurring: e.target.checked})} />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700">Repetir Lançamento</span>
              </label>

              {formData.isRecurring && (
                  <select 
                    value={formData.recurrenceFrequency} 
                    onChange={e => setFormData({...formData, recurrenceFrequency: e.target.value as any})}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg outline-none border-none"
                  >
                      <option value={RecurrenceFrequency.WEEKLY}>Semanal</option>
                      <option value={RecurrenceFrequency.MONTHLY}>Mensal</option>
                      <option value={RecurrenceFrequency.YEARLY}>Anual</option>
                  </select>
              )}
          </div>

          {/* Footer Ações */}
          <div className="pt-4 flex items-center justify-end gap-4">
              <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
              <button
                  type="submit"
                  className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                  Salvar Lançamento
              </button>
          </div>
        </form>
        )}
      </div>
      {showScanner && <QRCodeScanner onScanSuccess={handleQRSuccess} onClose={() => setShowScanner(false)} />}
    </div>
  );
};

export default TransactionModal;
