
import React from 'react';
import { Transaction, TransactionType, TransactionStatus, Account, Contact } from '../types';
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, CheckCircle, Clock, Repeat, ArrowRightLeft, User } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  accounts?: Account[];
  contacts?: Contact[]; // Injected to resolve names
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  onToggleStatus: (t: Transaction) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, accounts = [], contacts = [], onDelete, onEdit, onToggleStatus }) => {
  
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
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

  const getRecurrenceLabel = (t: Transaction) => {
    if (!t.isRecurring) return null;
    const freqMap: Record<string, string> = { 'WEEKLY': 'Semanal', 'MONTHLY': 'Mensal', 'YEARLY': 'Anual' };
    const label = freqMap[t.recurrenceFrequency || 'MONTHLY'];
    const end = t.recurrenceEndDate ? `até ${formatDate(t.recurrenceEndDate)}` : 'contínuo';
    return `${label}, ${end}`;
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Nenhuma transação encontrada.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-medium">Data</th>
              <th className="px-6 py-4 font-medium">Descrição</th>
              <th className="px-6 py-4 font-medium">Contato</th>
              <th className="px-6 py-4 font-medium">Conta</th>
              <th className="px-6 py-4 font-medium">Valor</th>
              <th className="px-6 py-4 font-medium text-center">Status</th>
              <th className="px-6 py-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((t) => {
                const contactName = getContactName(t.contactId);
                return (
              <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(t.date)}</td>
                <td className="px-6 py-4 font-medium text-gray-800">
                  <div className="flex items-center gap-3">
                    {t.type === TransactionType.INCOME ? (
                      <ArrowUpCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : t.type === TransactionType.EXPENSE ? (
                      <ArrowDownCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    ) : (
                      <ArrowRightLeft className="w-5 h-5 text-blue-500 shrink-0" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold">{t.description}</span>
                      {t.isRecurring && (
                        <span className="flex items-center gap-1 text-[10px] text-indigo-500 bg-indigo-50 w-fit px-1.5 py-0.5 rounded-full mt-1" title={getRecurrenceLabel(t) || ''}>
                          <Repeat className="w-3 h-3" />
                          {t.recurrenceFrequency === 'WEEKLY' ? 'Semanal' : t.recurrenceFrequency === 'YEARLY' ? 'Anual' : 'Mensal'}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 mt-0.5">{t.category}</span>
                    </div>
                  </div>
                </td>
                
                {/* Coluna Contato - Separada */}
                <td className="px-6 py-4 text-gray-600">
                    {contactName ? (
                        <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-gray-400" />
                            <span>{contactName}</span>
                        </div>
                    ) : (
                        <span className="text-gray-300 text-xs italic">-</span>
                    )}
                </td>

                <td className="px-6 py-4 text-gray-600">
                    {t.type === TransactionType.TRANSFER ? (
                         <div className="flex flex-col text-xs">
                             <span className="text-gray-500">De: {getAccountName(t.accountId)}</span>
                             <span className="text-gray-900 font-medium">Para: {getAccountName(t.destinationAccountId || '')}</span>
                         </div>
                    ) : (
                        <span className="bg-gray-50 border border-gray-200 px-2 py-1 rounded-md text-xs">
                            {getAccountName(t.accountId)}
                        </span>
                    )}
                </td>
                <td className={`px-6 py-4 font-semibold ${
                    t.type === TransactionType.INCOME ? 'text-emerald-600' : 
                    t.type === TransactionType.EXPENSE ? 'text-gray-900' : 'text-blue-600'
                }`}>
                  {t.type === TransactionType.EXPENSE && '- '}
                  {formatCurrency(t.amount)}
                </td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => onToggleStatus(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-100 transition-colors"
                    title="Alternar Status"
                  >
                    {getStatusIcon(t.status)}
                    <span className="hidden sm:inline">
                      {t.status === TransactionStatus.PAID ? 'Pago' : t.status === TransactionStatus.PENDING ? 'Pendente' : 'Atrasado'}
                    </span>
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(t)} className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">Editar</button>
                    <button onClick={() => onDelete(t.id)} className="text-rose-600 hover:text-rose-800 font-medium text-xs">Excluir</button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;
