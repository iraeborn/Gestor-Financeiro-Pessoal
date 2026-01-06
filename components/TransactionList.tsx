
import React, { useState } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, Contact } from '../types';
import { 
  ArrowUpCircle, ArrowDownCircle, AlertCircle, CheckCircle, Clock, 
  Repeat, ArrowRightLeft, UserCircle, Pencil, Trash2, MoreVertical, 
  Paperclip, Loader2, Check, Settings2, FileText, X, ChevronRight, Landmark, Tag, RotateCcw
} from 'lucide-react';
import AttachmentModal from './AttachmentModal';
import { useConfirm } from './AlertSystem';

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
  const { showConfirm } = useConfirm();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [activeAttachmentT, setActiveAttachmentT] = useState<Transaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const getStatusInfo = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.PAID: return { icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, label: 'Pago', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
      case TransactionStatus.PENDING: return { icon: <Clock className="w-4 h-4 text-amber-500" />, label: 'Pendente', color: 'text-amber-700 bg-amber-50 border-amber-100' };
      case TransactionStatus.OVERDUE: return { icon: <AlertCircle className="w-4 h-4 text-rose-500" />, label: 'Atrasado', color: 'text-rose-700 bg-rose-50 border-rose-100' };
      default: return { icon: null, label: '', color: '' };
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
          if (selectedTransaction?.id === t.id) {
              setSelectedTransaction({...t, receiptUrls: updatedUrls});
          }
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRemoveFile = (t: Transaction, index: number) => {
      if (!onUpdateAttachments) return;
      const updatedUrls = (t.receiptUrls || []).filter((_, i) => i !== index);
      onUpdateAttachments(t, updatedUrls);
      setActiveAttachmentT(prev => prev ? {...prev, receiptUrls: updatedUrls} : null);
      if (selectedTransaction?.id === t.id) {
          setSelectedTransaction({...t, receiptUrls: updatedUrls});
      }
  };

  const handleEstorno = async (t: Transaction) => {
      const confirm = await showConfirm({
          title: "Confirmar Estorno",
          message: `Deseja realmente estornar o pagamento de "${t.description}"? O saldo da conta será revertido.`,
          confirmText: "Sim, Estornar",
          variant: "warning"
      });
      if (confirm) {
          onToggleStatus(t);
          setSelectedTransaction(null);
      }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="font-medium">Nenhuma movimentação neste período.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm relative">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Data</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Descrição</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Contato</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Conta</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Valor</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((t) => {
                const contactName = getContactName(t.contactId);
                const statusInfo = getStatusInfo(t.status);

                return (
              <tr 
                key={t.id} 
                onClick={() => setSelectedTransaction(t)}
                className="hover:bg-indigo-50/40 transition-all group cursor-pointer active:bg-indigo-100/50"
              >
                <td className="px-6 py-5 text-gray-500 whitespace-nowrap font-medium">{formatDate(t.date)}</td>
                <td className="px-6 py-5 font-medium text-gray-800">
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
                
                <td className="px-6 py-5 text-gray-600">
                    {contactName ? (
                        <span className="truncate max-w-[120px] block font-medium">{contactName}</span>
                    ) : (
                        <span className="text-gray-300 text-xs italic">-</span>
                    )}
                </td>

                <td className="px-6 py-5 text-gray-600">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-slate-200">
                        {getAccountName(t.accountId)}
                    </span>
                </td>

                <td className={`px-6 py-5 font-black whitespace-nowrap ${
                    t.type === TransactionType.INCOME ? 'text-emerald-600' : 
                    t.type === TransactionType.EXPENSE ? 'text-slate-900' : 'text-blue-600'
                }`}>
                  {t.type === TransactionType.EXPENSE && '- '}
                  {formatCurrency(t.amount)}
                </td>

                <td className="px-6 py-5 text-center">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusInfo.color}`}>
                    {statusInfo.icon}
                    <span className="hidden sm:inline">{statusInfo.label}</span>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Modal de Ações do Lançamento */}
      {selectedTransaction && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)} />
              
              <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-slide-in-bottom sm:animate-scale-up">
                  {/* Header do Modal */}
                  <div className={`p-8 text-white relative ${selectedTransaction.type === 'INCOME' ? 'bg-emerald-600' : selectedTransaction.type === 'EXPENSE' ? 'bg-slate-900' : 'bg-blue-600'}`}>
                      <button 
                        onClick={() => setSelectedTransaction(null)}
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                      >
                          <X className="w-5 h-5" />
                      </button>
                      
                      <div className="space-y-4">
                          <div className="flex items-center gap-2">
                              <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                  #{selectedTransaction.id.substring(0,8).toUpperCase()}
                              </span>
                              <span className="bg-white text-gray-900 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                  {selectedTransaction.type === 'INCOME' ? 'Receita' : selectedTransaction.type === 'EXPENSE' ? 'Despesa' : 'Transferência'}
                              </span>
                          </div>
                          
                          <h3 className="text-2xl font-black leading-tight">{selectedTransaction.description}</h3>
                          
                          <div className="pt-4 border-t border-white/10 flex items-end justify-between">
                              <div>
                                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Valor do Lançamento</p>
                                  <p className="text-4xl font-black">{formatCurrency(selectedTransaction.amount)}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Vencimento</p>
                                  <p className="font-bold">{new Date(selectedTransaction.date).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Corpo das Ações - Lógica de Status */}
                  <div className="p-8 bg-white grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                              <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-500"><Landmark className="w-4 h-4"/></div>
                              <div>
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Conta</p>
                                  <p className="text-xs font-bold text-gray-700 truncate">{getAccountName(selectedTransaction.accountId)}</p>
                              </div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                              <div className="p-2 bg-white rounded-xl shadow-sm text-amber-500"><Tag className="w-4 h-4"/></div>
                              <div>
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Categoria</p>
                                  <p className="text-xs font-bold text-gray-700 truncate">{selectedTransaction.category}</p>
                              </div>
                          </div>
                      </div>

                      {selectedTransaction.status !== 'PAID' ? (
                        <>
                          <button 
                            onClick={() => { onEdit(selectedTransaction); setSelectedTransaction(null); }}
                            className="w-full flex items-center justify-between p-5 bg-indigo-50 text-indigo-700 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-indigo-100 transition-all group"
                          >
                              <div className="flex items-center gap-4">
                                  <Pencil className="w-5 h-5" /> Editar Lançamento
                              </div>
                              <ChevronRight className="w-4 h-4 opacity-30 group-hover:translate-x-1 transition-transform" />
                          </button>

                          <button 
                            onClick={() => { onToggleStatus(selectedTransaction); setSelectedTransaction(null); }}
                            className="w-full flex items-center justify-between p-5 bg-emerald-50 text-emerald-700 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-emerald-100 transition-all group"
                          >
                              <div className="flex items-center gap-4">
                                  <CheckCircle className="w-5 h-5" /> Confirmar Pagamento
                              </div>
                              <ChevronRight className="w-4 h-4 opacity-30 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </>
                      ) : (
                        <button 
                            onClick={() => handleEstorno(selectedTransaction)}
                            className="w-full flex items-center justify-between p-5 bg-amber-50 text-amber-700 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-amber-100 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <RotateCcw className="w-5 h-5" /> Realizar Estorno
                            </div>
                            <ChevronRight className="w-4 h-4 opacity-30 group-hover:translate-x-1 transition-transform" />
                        </button>
                      )}

                      <button 
                        onClick={() => { setActiveAttachmentT(selectedTransaction); }}
                        className="w-full flex items-center justify-between p-5 bg-blue-50 text-blue-700 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-blue-100 transition-all group"
                      >
                          <div className="flex items-center gap-4">
                              <Paperclip className="w-5 h-5" /> Comprovantes e Anexos
                              {(selectedTransaction.receiptUrls?.length || 0) > 0 && (
                                  <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                                      {selectedTransaction.receiptUrls?.length}
                                  </span>
                              )}
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-30 group-hover:translate-x-1 transition-transform" />
                      </button>

                      {selectedTransaction.status !== 'PAID' && (
                        <>
                          <div className="h-px bg-gray-100 my-2" />
                          <button 
                            onClick={() => { onDelete(selectedTransaction.id); setSelectedTransaction(null); }}
                            className="w-full flex items-center gap-4 p-5 text-rose-500 hover:bg-rose-50 rounded-3xl font-black uppercase text-xs tracking-widest transition-all"
                          >
                              <Trash2 className="w-5 h-5" /> Excluir permanentemente
                          </button>
                        </>
                      )}
                  </div>
              </div>
          </div>
      )}

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
