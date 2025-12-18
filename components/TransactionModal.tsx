
import React, { useState, useEffect, useRef } from 'react';
// Added TrendingUp to the imports from lucide-react
import { X, Calendar, DollarSign, Tag, CreditCard, Repeat, ArrowRightLeft, Percent, User, Plus, FileText, Briefcase, MapPin, Calculator, FolderKanban, Users, Banknote, History, QrCode, Loader2, Check, Clock, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
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
  userEntity?: EntityType;
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
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    interestRate: '0',
    contactId: '',
    branchId: '',
    destinationBranchId: '',
    costCenterId: '',
    departmentId: '',
    projectId: '',
    classification: TransactionClassification.STANDARD
  });

  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);

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
        recurrenceFrequency: initialData.recurrenceFrequency || RecurrenceFrequency.MONTHLY,
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
      if (initialData.isRecurring || isPJ) setShowAdvanced(true);
    } else {
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
        classification: TransactionClassification.STANDARD
      }));
      setContactSearch('');
      setCategorySearch('');
      setShowAdvanced(isPJ);
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
      interestRate: parseFloat(formData.interestRate) || 0,
      contactId: finalContactId || undefined,
      branchId: isPJ ? formData.branchId : undefined,
      destinationBranchId: isPJ && formData.classification === TransactionClassification.INTER_BRANCH ? formData.destinationBranchId : undefined,
      costCenterId: isPJ ? formData.costCenterId : undefined,
      departmentId: isPJ ? formData.departmentId : undefined,
      projectId: isPJ ? formData.projectId : undefined,
      classification: isPJ ? formData.classification : undefined
    }, newContactObj, newCategoryObj);
    onClose();
  };

  if (!isOpen) return null;

  const typeColors = {
      [TransactionType.EXPENSE]: 'rose',
      [TransactionType.INCOME]: 'emerald',
      [TransactionType.TRANSFER]: 'blue'
  };
  const activeColor = typeColors[formData.type];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up border border-white/20">
        
        {/* Header - Seletor de Tipo */}
        <div className={`p-8 bg-${activeColor}-50 transition-colors duration-500`}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    {initialData?.id ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="flex bg-white/60 backdrop-blur-sm p-1.5 rounded-2xl border border-white shadow-inner">
                {[
                    { id: TransactionType.EXPENSE, label: 'Despesa', icon: Banknote, color: 'text-rose-600' },
                    { id: TransactionType.INCOME, label: 'Receita', icon: TrendingUp, color: 'text-emerald-600' },
                    { id: TransactionType.TRANSFER, label: 'Transferência', icon: ArrowRightLeft, color: 'text-blue-600' }
                ].map(type => (
                    <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: type.id })}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                            formData.type === type.id 
                            ? `bg-white shadow-lg ${type.color} scale-[1.02]` 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <type.icon className="w-4 h-4" /> {type.label}
                    </button>
                ))}
            </div>
        </div>

        {loadingQR ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                <p className="text-slate-500 font-medium">Extraindo dados da nota fiscal...</p>
            </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* Main Financial Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quanto?</label>
                <div className="relative group">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-${activeColor}-500 transition-colors`}>R$</div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      autoFocus
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className={`block w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-transparent focus:border-${activeColor}-500 focus:bg-white rounded-3xl text-3xl font-black text-slate-800 outline-none transition-all placeholder-slate-300`}
                      placeholder="0,00"
                    />
                </div>
                <div className="flex gap-2 pt-1">
                    {[10, 50, 100].map(v => (
                        <button key={v} type="button" onClick={() => setFormData({...formData, amount: String(v)})} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-500 transition-colors">+ R$ {v}</button>
                    ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">O que é?</label>
                <div className="relative group h-full flex flex-col">
                    <input
                      type="text"
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="block w-full flex-1 px-5 py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-3xl text-lg font-bold text-slate-800 outline-none transition-all placeholder-slate-300"
                      placeholder="Ex: Almoço Executivo"
                    />
                    {!initialData && formData.type === TransactionType.EXPENSE && (
                        <button type="button" onClick={() => setShowScanner(true)} className="absolute right-3 top-3 p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 transition-all">
                            <QrCode className="w-5 h-5" />
                        </button>
                    )}
                </div>
              </div>
          </div>

          {/* Context Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
              <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Vencimento</label>
                    <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                        <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-700 bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Conta / Origem</label>
                    <div className="relative">
                        <CreditCard className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                        <select value={formData.accountId} onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-700 bg-white appearance-none">
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    </div>
                  </div>
              </div>

              <div className="space-y-4">
                  {formData.type === TransactionType.TRANSFER ? (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Destino</label>
                        <div className="relative">
                            <ArrowRightLeft className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                            <select value={formData.destinationAccountId} onChange={(e) => setFormData({ ...formData, destinationAccountId: e.target.value })} className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-700 bg-white appearance-none">
                                {accounts.filter(a => a.id !== formData.accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </div>
                      </div>
                  ) : (
                      <div className="relative" ref={categoryDropdownRef}>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Categoria</label>
                          <div className="relative">
                              <Tag className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                              <input type="text" value={categorySearch} onFocus={() => setShowCategoryDropdown(true)} onChange={(e) => {setCategorySearch(e.target.value); setShowCategoryDropdown(true);}} className="block w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-700 bg-white" placeholder="Obrigatório..." />
                          </div>
                          {showCategoryDropdown && (
                              <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-xl mt-1 max-h-40 overflow-y-auto p-1">
                                  {categories.filter(c => c.type === formData.type && c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                      <button key={c.id} type="button" onClick={() => {setCategorySearch(c.name); setShowCategoryDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-indigo-50 rounded-xl text-sm font-medium text-slate-600 transition-colors">{c.name}</button>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}
                  <div className="relative" ref={contactDropdownRef}>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Pessoa / Contato</label>
                      <div className="relative">
                          <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                          <input type="text" value={contactSearch} onFocus={() => setShowContactDropdown(true)} onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}} className="block w-full pl-9 rounded-lg border-gray-200 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-700 bg-white" placeholder="Opcional..." />
                      </div>
                      {showContactDropdown && (
                          <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-xl mt-1 max-h-40 overflow-y-auto p-1">
                              {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                                  <button key={c.id} type="button" onClick={() => {setContactSearch(c.name); setFormData({...formData, contactId: c.id}); setShowContactDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-indigo-50 rounded-xl text-sm font-medium text-slate-600 transition-colors">{c.name}</button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Collapsible Advanced Section */}
          <div className="border-t border-slate-100 pt-4">
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)} 
                className="w-full flex items-center justify-between py-2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                  <span className="text-[10px] font-black uppercase tracking-widest">Mais Opções {isPJ && '(Corporativo)'}</span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                  <div className="mt-4 space-y-6 animate-fade-in">
                      <div className="flex flex-wrap gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-all relative ${formData.isRecurring ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isRecurring ? 'left-5' : 'left-1'}`}></div>
                            </div>
                            <input type="checkbox" className="sr-only" checked={formData.isRecurring} onChange={e => setFormData({...formData, isRecurring: e.target.checked})} />
                            <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-600">Repetir Mensalmente</span>
                        </label>
                        
                        {isPJ && (
                            <div className="flex-1 min-w-[200px]">
                                <select value={formData.classification} onChange={e => setFormData({...formData, classification: e.target.value as any})} className="w-full bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-500 py-2 px-3">
                                    <option value={TransactionClassification.STANDARD}>Fluxo Padrão</option>
                                    <option value={TransactionClassification.CASH_REPLENISHMENT}>Suprimento</option>
                                    <option value={TransactionClassification.INTER_BRANCH}>Transf. Filial</option>
                                </select>
                            </div>
                        )}
                      </div>

                      {isPJ && (
                          <div className="grid grid-cols-3 gap-3">
                              <select value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})} className="bg-slate-50 border-none rounded-xl text-[10px] font-bold text-slate-500 p-2">
                                  <option value="">Filial</option>
                                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                              <select value={formData.costCenterId} onChange={e => setFormData({...formData, costCenterId: e.target.value})} className="bg-slate-50 border-none rounded-xl text-[10px] font-bold text-slate-500 p-2">
                                  <option value="">C. Custo</option>
                                  {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                              </select>
                              <select value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value})} className="bg-slate-50 border-none rounded-xl text-[10px] font-bold text-slate-500 p-2">
                                  <option value="">Projeto</option>
                                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                          </div>
                      )}
                  </div>
              )}
          </div>

          {/* Footer - Status & Save */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button 
                type="button" 
                onClick={() => setFormData({...formData, status: formData.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                    formData.status === TransactionStatus.PAID 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                  {formData.status === TransactionStatus.PAID ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  {formData.status === TransactionStatus.PAID ? 'Confirmado' : 'Pendente'}
              </button>

              <button
                  type="submit"
                  className={`bg-${activeColor}-600 text-white px-10 py-4 rounded-[1.5rem] font-black text-lg hover:bg-${activeColor}-700 transition-all shadow-xl shadow-${activeColor}-200 active:scale-95`}
              >
                  Salvar
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
