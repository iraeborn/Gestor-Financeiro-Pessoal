
import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Tag, CreditCard, ArrowRightLeft, User, QrCode, Loader2, Check, Clock, AlertCircle, Banknote, TrendingUp, Plus, ChevronDown } from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus, Account, RecurrenceFrequency, Contact, Category, EntityType, TransactionClassification, Branch, CostCenter, Department, Project } from '../types';
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
    if (contactSearch && formData.type !== TransactionType.TRANSFER) {
         const existing = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
         if (existing) {
             finalContactId = existing.id;
         } else {
             const newId = crypto.randomUUID();
             newContactObj = { id: newId, name: contactSearch, type: 'PF' };
             finalContactId = newId;
         }
    }

    let finalCategory = categorySearch;
    let newCategoryObj: Category | undefined;
    if (categorySearch && formData.type !== TransactionType.TRANSFER) {
        const existingCat = categories.find(c => c.name.toLowerCase() === categorySearch.toLowerCase() && c.type === formData.type);
        if (!existingCat) {
            newCategoryObj = { id: crypto.randomUUID(), name: categorySearch, type: formData.type };
        }
    }

    onSave({
      ...formData,
      amount: parseFloat(formData.amount),
      category: formData.type === TransactionType.TRANSFER ? 'Transferência' : finalCategory,
      contactId: finalContactId || undefined,
      destinationAccountId: (formData.type === TransactionType.TRANSFER) ? formData.destinationAccountId : undefined,
    }, newContactObj, newCategoryObj);
    onClose();
  };

  if (!isOpen) return null;

  const typeColors = {
      [TransactionType.EXPENSE]: 'text-rose-600',
      [TransactionType.INCOME]: 'text-emerald-600',
      [TransactionType.TRANSFER]: 'text-blue-600'
  };

  const statusOptions = [
      { id: TransactionStatus.PAID, label: 'Pago', icon: Check, color: 'bg-emerald-50 text-emerald-700' },
      { id: TransactionStatus.PENDING, label: 'Pendente', icon: Clock, color: 'bg-amber-50 text-amber-700' },
      { id: TransactionStatus.OVERDUE, label: 'Atrasado', icon: AlertCircle, color: 'bg-rose-50 text-rose-700' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-scale-up border border-slate-100">
        
        {/* Header Compacto */}
        <div className="px-8 py-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-800">
                {initialData?.id ? 'Editar Registro' : 'Novo Registro'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-all text-slate-400">
                <X className="w-5 h-5" />
            </button>
        </div>

        {loadingQR ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-500 text-sm font-medium">Extraindo dados...</p>
            </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[85vh] overflow-y-auto scrollbar-thin">
          
          {/* Valor Principal */}
          <div className="space-y-3">
              <div className="relative group">
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-black ${typeColors[formData.type]} transition-colors`}>R$</div>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="block w-full pl-14 pr-12 py-2 bg-transparent border-b-2 border-slate-100 focus:border-indigo-500 rounded-none text-5xl font-black text-slate-900 outline-none transition-all placeholder-slate-200"
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
                    <button key={v} type="button" onClick={() => setFormData({...formData, amount: String((Number(formData.amount)||0) + v)})} className="px-4 py-1.5 bg-slate-50 hover:bg-indigo-50 rounded-full text-[11px] font-black text-slate-500 hover:text-indigo-600 border border-slate-100 transition-all">+ {v}</button>
                ))}
                <button type="button" onClick={() => setFormData({...formData, amount: ''})} className="px-4 py-1.5 bg-slate-50 hover:bg-rose-50 rounded-full text-[11px] font-black text-slate-400 hover:text-rose-600 border border-slate-100 transition-all">Limpar</button>
              </div>
          </div>

          {/* Tipo de Lançamento (Tabs) */}
          <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-100">
                {[
                    { id: TransactionType.EXPENSE, label: 'Despesa', icon: Banknote },
                    { id: TransactionType.INCOME, label: 'Receita', icon: TrendingUp },
                    { id: TransactionType.TRANSFER, label: 'Transferência', icon: ArrowRightLeft }
                ].map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: item.id })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                            formData.type === item.id 
                            ? 'bg-white shadow-sm text-indigo-600' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <item.icon className="w-4 h-4" /> {item.label}
                    </button>
                ))}
          </div>

          {/* Grid de Informações Essenciais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descrição</label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-1 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 bg-transparent transition-all"
                    placeholder="Ex: Aluguel da Sede"
                  />
              </div>

              <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data / Vencimento</label>
                  <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-300 absolute left-0 top-2" />
                      <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full pl-6 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 bg-transparent" />
                  </div>
              </div>

              <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Conta Financeira</label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-300 absolute left-0 top-2" />
                    <select value={formData.accountId} onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} className="w-full pl-6 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 bg-transparent appearance-none cursor-pointer">
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                  </div>
              </div>

              {formData.type === TransactionType.TRANSFER ? (
                  <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Conta Destino</label>
                      <div className="relative">
                        <ArrowRightLeft className="w-4 h-4 text-slate-300 absolute left-0 top-2" />
                        <select value={formData.destinationAccountId} onChange={(e) => setFormData({ ...formData, destinationAccountId: e.target.value })} className="w-full pl-6 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 bg-transparent appearance-none cursor-pointer">
                            {accounts.filter(a => a.id !== formData.accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-1 relative" ref={categoryDropdownRef}>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoria</label>
                      <div className="relative">
                        <Tag className="w-4 h-4 text-slate-300 absolute left-0 top-2" />
                        <input 
                            type="text" 
                            value={categorySearch} 
                            onFocus={() => setShowCategoryDropdown(true)} 
                            onChange={(e) => {setCategorySearch(e.target.value); setShowCategoryDropdown(true);}} 
                            className="w-full pl-6 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 bg-transparent" 
                            placeholder="Buscar ou Criar..." 
                        />
                      </div>
                      {showCategoryDropdown && (
                          <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in border-t-4 border-t-indigo-500">
                              {categories.filter(c => c.type === formData.type && c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                  <button key={c.id} type="button" onClick={() => {setCategorySearch(c.name); setShowCategoryDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-colors flex items-center justify-between">
                                      {c.name}
                                  </button>
                              ))}
                              {categorySearch && !categories.some(c => c.name.toLowerCase() === categorySearch.toLowerCase()) && (
                                  <button type="button" onClick={() => setShowCategoryDropdown(false)} className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-2 mt-1">
                                      <Plus className="w-3 h-3" /> Criar nova: "{categorySearch}"
                                  </button>
                              )}
                          </div>
                      )}
                  </div>
              )}

              <div className="space-y-1 relative" ref={contactDropdownRef}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contato / Fornecedor</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-300 absolute left-0 top-2" />
                    <input 
                        type="text" 
                        value={contactSearch} 
                        onFocus={() => setShowContactDropdown(true)} 
                        onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}} 
                        className="w-full pl-6 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 bg-transparent" 
                        placeholder="Opcional..." 
                    />
                  </div>
                  {showContactDropdown && (
                      <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in border-t-4 border-t-indigo-500">
                          {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                              <button key={c.id} type="button" onClick={() => {setContactSearch(c.name); setFormData({...formData, contactId: c.id}); setShowContactDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-colors">
                                  {c.name}
                              </button>
                          ))}
                          {contactSearch && !contacts.some(c => c.name.toLowerCase() === contactSearch.toLowerCase()) && (
                              <button type="button" onClick={() => setShowContactDropdown(false)} className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-2 mt-1">
                                  <Plus className="w-3 h-3" /> Criar novo: "{contactSearch}"
                              </button>
                          )}
                      </div>
                  )}
              </div>

              {/* Status Selector Integrado */}
              <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Situação do Lançamento</label>
                  <div className="flex gap-1.5 mt-1">
                      {statusOptions.map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFormData({...formData, status: opt.id})}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black transition-all ${
                                formData.status === opt.id ? opt.color : 'bg-slate-50 text-slate-400 grayscale'
                            }`}
                          >
                            <opt.icon className="w-3 h-3" /> {opt.label}
                          </button>
                      ))}
                  </div>
              </div>
          </div>

          {/* Recorrência e Campos PJ no mesmo fluxo */}
          <div className="pt-6 border-t border-slate-50 space-y-6">
              <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-10 h-6 rounded-full transition-all relative ${formData.isRecurring ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isRecurring ? 'left-5' : 'left-1'}`}></div>
                      </div>
                      <input type="checkbox" className="sr-only" checked={formData.isRecurring} onChange={e => setFormData({...formData, isRecurring: e.target.checked})} />
                      <span className="text-xs font-black text-slate-500 group-hover:text-indigo-600 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4" /> Repetir Lançamento
                      </span>
                  </label>

                  {formData.isRecurring && (
                      <select 
                        value={formData.recurrenceFrequency} 
                        onChange={e => setFormData({...formData, recurrenceFrequency: e.target.value as any})}
                        className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl outline-none border-none cursor-pointer"
                      >
                          <option value={RecurrenceFrequency.WEEKLY}>Semanal</option>
                          <option value={RecurrenceFrequency.MONTHLY}>Mensal</option>
                          <option value={RecurrenceFrequency.YEARLY}>Anual</option>
                      </select>
                  )}
              </div>

              {userEntity === EntityType.BUSINESS && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Filial</label>
                          <select value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})} className="w-full bg-transparent border-b border-slate-200 py-1 text-xs font-bold text-slate-700 outline-none">
                              <option value="">Nenhuma</option>
                              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">C. Custo</label>
                          <select value={formData.costCenterId} onChange={e => setFormData({...formData, costCenterId: e.target.value})} className="w-full bg-transparent border-b border-slate-200 py-1 text-xs font-bold text-slate-700 outline-none">
                              <option value="">Nenhum</option>
                              {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Depto</label>
                          <select value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})} className="w-full bg-transparent border-b border-slate-200 py-1 text-xs font-bold text-slate-700 outline-none">
                              <option value="">Nenhum</option>
                              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Projeto</label>
                          <select value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value})} className="w-full bg-transparent border-b border-slate-200 py-1 text-xs font-bold text-slate-700 outline-none">
                              <option value="">Nenhum</option>
                              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                      </div>
                  </div>
              )}
          </div>

          {/* Footer - Ação Final */}
          <div className="pt-6 flex items-center justify-end gap-4 border-t border-slate-50">
              <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
              <button
                  type="submit"
                  className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black text-base hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95"
              >
                  {initialData?.id ? 'Atualizar' : 'Salvar Lançamento'}
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
