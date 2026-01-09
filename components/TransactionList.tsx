
import React, { useState } from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, Contact } from '../types';
import { 
  ArrowUpCircle, ArrowDownCircle, AlertCircle, CheckCircle, Clock, 
  Repeat, ArrowRightLeft, UserCircle, Pencil, Trash2, MoreVertical, 
  Paperclip, Loader2, Check, Settings2, FileText, X, ChevronRight, Landmark, Tag, RotateCcw,
  ShoppingBag, Store
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

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--/--';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
  };

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || 'Desconhecida';
  const getContactName = (id?: string) => contacts.find(co => co.id === id)?.name || null;

  const getStatusInfo = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.PAID: return { icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, label: 'Pago', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
      case TransactionStatus.PENDING: return { icon: <Clock className="w-4 h-4 text-amber-500" />, label: 'Pendente', color: 'text-amber-700 bg-amber-50 border-amber-100' };
      case TransactionStatus.OVERDUE: return { icon: <AlertCircle className="w-4 h-4 text-rose-500" />, label: 'Atrasado', color: 'text-rose-700 bg-rose-50 border-rose-100' };
      default: return { icon: null, label: '', color: '' };
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm relative">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Data</th>
              <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Descrição & Origem</th>
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
                const isPDV = t.description.includes('Receita Venda #');

                return (
              <tr key={t.id} onClick={() => setSelectedTransaction(t)} className="hover:bg-indigo-50/40 transition-all group cursor-pointer active:bg-indigo-100/50">
                <td className="px-6 py-5 text-gray-500 whitespace-nowrap font-medium">{formatDate(t.date)}</td>
                <td className="px-6 py-5 font-medium text-gray-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600' : t.type === TransactionType.EXPENSE ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                        {t.type === TransactionType.INCOME ? <ArrowUpCircle className="w-5 h-5" /> : t.type === TransactionType.EXPENSE ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-800 truncate">{t.description}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded">{t.category}</span>
                        {isPDV && <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm border border-indigo-100"><ShoppingBag className="w-2.5 h-2.5" /> PDV</span>}
                        {t.branchId && <span className="text-[9px] font-black bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm border border-amber-100"><Store className="w-2.5 h-2.5" /> FILIAL</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-gray-600">{contactName || <span className="text-gray-300 text-xs italic">-</span>}</td>
                <td className="px-6 py-5"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-slate-200">{getAccountName(t.accountId)}</span></td>
                <td className={`px-6 py-5 font-black whitespace-nowrap ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>{t.type === TransactionType.EXPENSE && '- '}{formatCurrency(t.amount)}</td>
                <td className="px-6 py-5 text-center"><div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusInfo.color}`}>{statusInfo.icon}<span className="hidden sm:inline">{statusInfo.label}</span></div></td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {selectedTransaction && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)} />
              <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-slide-in-bottom sm:animate-scale-up">
                  <div className={`p-8 text-white relative ${selectedTransaction.type === 'INCOME' ? 'bg-emerald-600' : selectedTransaction.type === 'EXPENSE' ? 'bg-slate-900' : 'bg-blue-600'}`}>
                      <button onClick={() => setSelectedTransaction(null)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                      <div className="space-y-4">
                          <div className="flex items-center gap-2">
                              <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">#{selectedTransaction.id.substring(0,8).toUpperCase()}</span>
                              <span className="bg-white text-gray-900 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedTransaction.type}</span>
                          </div>
                          <h3 className="text-2xl font-black leading-tight">{selectedTransaction.description}</h3>
                          <div className="pt-4 border-t border-white/10 flex items-end justify-between">
                              <div><p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Valor</p><p className="text-4xl font-black">{formatCurrency(selectedTransaction.amount)}</p></div>
                              <div className="text-right"><p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Data</p><p className="font-bold">{new Date(selectedTransaction.date).toLocaleDateString()}</p></div>
                          </div>
                      </div>
                  </div>
                  <div className="p-8 bg-white grid grid-cols-1 gap-3">
                      <button onClick={() => { onEdit(selectedTransaction); setSelectedTransaction(null); }} className="w-full flex items-center justify-between p-5 bg-indigo-50 text-indigo-700 rounded-3xl font-black uppercase text-xs hover:bg-indigo-100 transition-all"><div className="flex items-center gap-4"><Pencil className="w-5 h-5" /> Editar Lançamento</div><ChevronRight className="w-4 h-4" /></button>
                      <button onClick={() => { onToggleStatus(selectedTransaction); setSelectedTransaction(null); }} className="w-full flex items-center justify-between p-5 bg-emerald-50 text-emerald-700 rounded-3xl font-black uppercase text-xs hover:bg-emerald-100 transition-all"><div className="flex items-center gap-4"><CheckCircle className="w-5 h-5" /> Alternar Situação</div><ChevronRight className="w-4 h-4" /></button>
                      <button onClick={() => { onDelete(selectedTransaction.id); setSelectedTransaction(null); }} className="w-full flex items-center gap-4 p-5 text-rose-500 hover:bg-rose-50 rounded-3xl font-black uppercase text-xs transition-all"><Trash2 className="w-5 h-5" /> Excluir Registro</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TransactionList;
