
import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Tag, CreditCard, ArrowRightLeft, User, QrCode, Loader2, Check, Clock, AlertCircle, Banknote, TrendingUp, Plus, FilePlus, FileCheck, Eye, Download, Trash2, Paperclip } from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus, Account, RecurrenceFrequency, Contact, Category, EntityType, TransactionClassification, Branch, CostCenter, Department, Project } from '../types';
import { useAlert } from './AlertSystem';
import QRCodeScanner from './QRCodeScanner';
import AttachmentModal from './AttachmentModal';

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
    receiptUrls: [] as string[]
  });

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  
  const [showScanner, setShowScanner] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
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
        receiptUrls: Array.isArray(initialData.receiptUrls) ? initialData.receiptUrls : []
      });
      setCategorySearch(initialData.category || '');
      
      const contact = contacts.find(c => c.id === initialData.contactId);
      setContactSearch(contact ? contact.name : '');
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
        receiptUrls: []
      }));
      setCategorySearch('');
      setContactSearch('');
    }
  }, [initialData, isOpen, accounts, contacts]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddFiles = async (files: FileList) => {
      setIsProcessingFiles(true);
      try {
          const token = localStorage.getItem('token');
          const uploadData = new FormData();
          Array.from(files).forEach(f => uploadData.append('files', f));

          const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Authorization': token ? `Bearer ${token}` : '' },
              body: uploadData
          });

          if (!res.ok) throw new Error("Falha no upload");
          const { urls } = await res.json();

          setFormData(prev => ({
              ...prev,
              receiptUrls: [...prev.receiptUrls, ...urls],
              status: TransactionStatus.PAID
          }));
          showAlert(`${files.length} arquivo(s) enviados com sucesso.`, "success");
      } catch (e) {
          showAlert("Erro ao enviar arquivos para o Storage.", "error");
          throw e;
      } finally {
          setIsProcessingFiles(false);
      }
  };

  const handleRemoveFile = (index: number) => {
      setFormData(prev => ({
          ...prev,
          receiptUrls: prev.receiptUrls.filter((_, i) => i !== index)
      }));
  };

  const handleQRSuccess = async (url: string) => {
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
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (res.ok) {
            setFormData(prev => ({
                ...prev,
                amount: data.amount.toString(),
                date: data.date,
                description: data.merchant || prev.description,
                status: TransactionStatus.PAID
            }));
            showAlert("Dados da nota extraídos!", "success");
        } else {
            showAlert(data.error || "Erro ao ler QR Code.", "error");
        }
    } catch (e) {
        showAlert("Erro de conexão ao processar nota.", "error");
    } finally {
        setLoadingQR(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId) return showAlert("Selecione uma conta.", "warning");
    
    // Process Category
    let finalCategory = categorySearch;
    let newCategoryObj: Category | undefined;
    if (categorySearch && formData.type !== TransactionType.TRANSFER) {
        const existingCat = categories.find(c => c.name.toLowerCase() === categorySearch.toLowerCase() && c.type === formData.type);
        if (!existingCat) {
            newCategoryObj = { id: crypto.randomUUID(), name: categorySearch, type: formData.type };
        }
    }

    // Process Contact
    let finalContactId = formData.contactId;
    let newContactObj: Contact | undefined;
    if (contactSearch) {
        const existingContact = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
        if (existingContact) {
            finalContactId = existingContact.id;
        } else {
            newContactObj = { id: crypto.randomUUID(), name: contactSearch, type: 'PF' }; // Default PF
            finalContactId = newContactObj.id;
        }
    } else {
        finalContactId = '';
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
              </div>
          </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              <div className="md:col-span-2 space-y-1">
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data</label>
                  <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-300 absolute left-0 top-2" />
                      <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full pl-6 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 bg-transparent" />
                  </div>
              </div>

              <div className="space-y-1 relative" ref={contactDropdownRef}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pessoa / Empresa</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-300 absolute left-0 top-2" />
                    <input 
                        type="text"
                        value={contactSearch}
                        onFocus={() => setShowContactDropdown(true)}
                        onChange={(e) => {
                            setContactSearch(e.target.value);
                            setShowContactDropdown(true);
                            // Reset contactId if search text doesn't match selected contact exactly
                            setFormData(prev => ({ ...prev, contactId: '' }));
                        }}
                        className="w-full pl-6 py-2 border-b border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 bg-transparent"
                        placeholder="Buscar ou Criar..."
                    />
                  </div>
                  {showContactDropdown && (
                      <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in border-t-4 border-t-indigo-500">
                          {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                              <button key={c.id} type="button" onClick={() => {setContactSearch(c.name); setFormData(prev => ({ ...prev, contactId: c.id })); setShowContactDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-colors flex items-center justify-between">
                                  {c.name}
                                  {formData.contactId === c.id && <Check className="w-3 h-3 text-indigo-600" />}
                              </button>
                          ))}
                          {contactSearch && !contacts.some(c => c.name.toLowerCase() === contactSearch.toLowerCase()) && (
                              <button type="button" onClick={() => setShowContactDropdown(false)} className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-2 mt-1">
                                  <Plus className="w-3 h-3" /> Criar novo: "{contactSearch}"
                              </button>
                          )}
                          {contacts.length === 0 && !contactSearch && (
                              <div className="px-4 py-4 text-center text-xs text-slate-400 font-medium">Nenhum contato cadastrado</div>
                          )}
                      </div>
                  )}
              </div>

              <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Conta</label>
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
                          <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in border-t-4 border-t-indigo-500">
                              {categories.filter(c => c.type === formData.type && c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                  <button key={c.id} type="button" onClick={() => {setCategorySearch(c.name); setShowCategoryDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-colors">
                                      {c.name}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              )}
          </div>

          <div className="pt-6 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Situação</label>
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

              <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Documentos Digitais</label>
                  <div className="mt-1">
                      <button 
                        type="button" 
                        disabled={isProcessingFiles}
                        onClick={() => setShowAttachments(true)}
                        className={`w-full flex items-center justify-between gap-2 py-2.5 px-4 rounded-xl text-[10px] font-black transition-all border ${
                            formData.receiptUrls.length > 0 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                            : 'bg-slate-50 border-slate-100 border-dashed text-slate-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                            {isProcessingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : (formData.receiptUrls.length > 0 ? <FileCheck className="w-4 h-4" /> : <FilePlus className="w-4 h-4" />)}
                            <span>{formData.receiptUrls.length > 0 ? `${formData.receiptUrls.length} Arquivos (Nuvem)` : 'Anexar Comprovantes'}</span>
                        </div>
                        <Plus className="w-3 h-3" />
                      </button>
                  </div>
              </div>
          </div>

          <div className="pt-6 flex items-center justify-end gap-4 border-t border-slate-50">
              <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
              <button
                  type="submit"
                  disabled={isProcessingFiles}
                  className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black text-base hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
              >
                  {initialData?.id ? 'Atualizar' : 'Salvar Registro'}
              </button>
          </div>
        </form>
        )}
      </div>

      {showScanner && <QRCodeScanner onScanSuccess={handleQRSuccess} onClose={() => setShowScanner(false)} />}
      
      <AttachmentModal 
        isOpen={showAttachments}
        onClose={() => setShowAttachments(false)}
        urls={formData.receiptUrls}
        onAdd={handleAddFiles}
        onRemove={handleRemoveFile}
        title={formData.description || 'Anexos'}
      />
    </div>
  );
};

export default TransactionModal;
