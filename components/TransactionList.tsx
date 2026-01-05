
import React, { useState, useRef, useEffect } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, Contact } from '../types';
import { 
  ArrowUpCircle, ArrowDownCircle, AlertCircle, CheckCircle, Clock, 
  Repeat, ArrowRightLeft, UserCircle, Pencil, Trash2, MoreVertical, 
  Paperclip, Loader2, Check, Settings2, FileText
} from 'lucide-react';
import AttachmentModal from './AttachmentModal';

interface TransactionListProps {
  transactions: Transaction[];
  accounts?: Account[];
  contacts?: Contact[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  onToggleStatus: (t: Transaction) => void;
  onUpdateAttachments?: (t: Transaction, urls: string[]) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  accounts = [], 
  contacts = [], 
  onDelete, 
  onEdit, 
  onToggleStatus,
  onUpdateAttachments
}) => {
  
  const [activeAttachmentT, setActiveAttachmentT] = useState<Transaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--/--';
    const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = dateOnly.split('-');
    if (parts.length < 3) return dateOnly;
    const [year, month, day] = parts;
    return `${day}/${month}/${year.slice(-2)}`;
  };

  const getAccountName = (id: string) => {
      const acc = accounts.find(a => a.id === id);
      return acc ? acc.name : 'Desconhecida';
  };

  const getContactName = (id?: string) => {
      if (!id) return null;
      const c = contacts.find(co => co.id === id);
      return c ? c.name : null;
  };

  const getStatusIcon = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.PAID: return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case TransactionStatus.PENDING: return <Clock className="w-4 h-4 text-amber-500" />;
      case TransactionStatus.OVERDUE: return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default: return null;
    }
  };

  const handleAddFiles = async (t: Transaction, files: FileList) => {
      if (!onUpdateAttachments) return;
      setIsProcessing(true);
      try {
          const token = localStorage.getItem('token');
          const uploadData = new FormData();
          Array.from(files).forEach(f => uploadData.append('files', f));

          const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Authorization': token ? `Bearer ${token}` : '' },
              body: uploadData
          });

          if (!res.ok) throw new Error("Upload Error");
          const { urls } = await res.json();
          
          const updatedUrls = [...(t.receiptUrls || []), ...urls];
          onUpdateAttachments(t, updatedUrls);
          setActiveAttachmentT(prev => prev ? {...prev, receiptUrls: updatedUrls} : null);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRemoveFile = (t: Transaction, index: number) => {
      if (!onUpdateAttachments) return;
      const updatedUrls = (t.receiptUrls || []).filter((_, i) => i !== index);
      onUpdateAttachments(t, updatedUrls);
      setActiveAttachmentT(prev => prev ? {...prev, receiptUrls: updatedUrls} : null);
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="font-medium">Nenhuma movimentação neste período.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Data</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Descrição</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Contato</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Conta</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Valor</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-center">Status</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((t) => {
                const contactName = getContactName(t.contactId);
                const hasAttachments = (t.receiptUrls?.length || 0) > 0;
                const isMenuOpen = openMenuId === t.id;

                return (
              <tr key={t.id} className="hover:bg-indigo-50/20 transition-colors group">
                <td className="px-6 py-4 text-gray-500 whitespace-nowrap font-medium">{formatDate(t.date)}</td>
                <td className="px-6 py-4 font-medium text-gray-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${
                        t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600' : 
                        t.type === TransactionType.EXPENSE ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                        {t.type === TransactionType.INCOME ? <ArrowUpCircle className="w-5 h-5" /> : 
                         t.type === TransactionType.EXPENSE ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-800 truncate">{t.description}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t.category}</span>
                        {t.createdByName && (
                            <span className="text-[9px] font-black bg-white border border-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                <UserCircle className="w-2.5 h-2.5" /> {t.createdByName.split(' ')[0]}
                            </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 text-gray-600">
                    {contactName ? (
                        <span className="truncate max-w-[120px] block font-medium">{contactName}</span>
                    ) : (
                        <span className="text-gray-300 text-xs italic">-</span>
                    )}
                </td>

                <td className="px-6 py-4 text-gray-600">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-slate-200">
                        {getAccountName(t.accountId)}
                    </span>
                </td>

                <td className={`px-6 py-4 font-black ${
                    t.type === TransactionType.INCOME ? 'text-emerald-600' : 
                    t.type === TransactionType.EXPENSE ? 'text-slate-900' : 'text-blue-600'
                }`}>
                  {t.type === TransactionType.EXPENSE && '- '}
                  {formatCurrency(t.amount)}
                </td>

                <td className="px-6 py-4 text-center">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      t.status === TransactionStatus.PAID ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                      t.status === TransactionStatus.PENDING ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                    {getStatusIcon(t.status)}
                    <span className="hidden sm:inline">
                      {t.status === TransactionStatus.PAID ? 'Pago' : t.status === TransactionStatus.PENDING ? 'Pendente' : 'Atrasado'}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="relative inline-block text-left" ref={isMenuOpen ? menuRef : null}>
                    <button 
                        onClick={() => setOpenMenuId(isMenuOpen ? null : t.id)}
                        className={`p-2.5 rounded-xl transition-all ${isMenuOpen ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] py-2 animate-scale-up origin-top-right">
                            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                                <p className="text-[9px] font-black uppercase text-gray-400 tracking-[0.2em]">Operações</p>
                            </div>
                            
                            <button 
                                onClick={() => { onEdit(t); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                            >
                                <Pencil className="w-4 h-4 text-indigo-500" /> Editar Registro
                            </button>

                            <button 
                                onClick={() => { setActiveAttachmentT(t); setOpenMenuId(null); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Paperclip className="w-4 h-4 text-emerald-500" /> Arquivos e Anexos
                                </div>
                                {hasAttachments && (
                                    <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                        {t.receiptUrls?.length}
                                    </span>
                                )}
                            </button>

                            <button 
                                onClick={() => { onToggleStatus(t); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                            >
                                <Settings2 className="w-4 h-4 text-amber-500" /> Inverter Status
                            </button>

                            <div className="h-px bg-gray-50 my-1"></div>

                            <button 
                                onClick={() => { onDelete(t.id); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-black text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Excluir permanentemente
                            </button>
                        </div>
                    )}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {activeAttachmentT && (
          <AttachmentModal 
            isOpen={!!activeAttachmentT}
            onClose={() => setActiveAttachmentT(null)}
            urls={activeAttachmentT.receiptUrls || []}
            onAdd={(files) => handleAddFiles(activeAttachmentT, files)}
            onRemove={(idx) => handleRemoveFile(activeAttachmentT, idx)}
            title={activeAttachmentT.description}
          />
      )}
    </div>
  );
};

export default TransactionList;
