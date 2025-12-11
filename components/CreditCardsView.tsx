
import React, { useState } from 'react';
import { Account, AccountType, Transaction, TransactionType } from '../types';
import { Plus, CreditCard, Calendar, TrendingUp, AlertCircle, Edit2, Trash2, ArrowRightLeft } from 'lucide-react';
import AccountModal from './AccountModal';

interface CreditCardsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  onSaveAccount: (a: Account) => void;
  onDeleteAccount: (id: string) => void;
}

const CreditCardsView: React.FC<CreditCardsViewProps> = ({ accounts, transactions, onSaveAccount, onDeleteAccount }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const cards = accounts.filter(a => a.type === AccountType.CARD);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleEdit = (card: Account) => {
    setEditingAccount(card);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  // Calcula a data de início da fatura atual (dia após o fechamento do mês anterior ou atual)
  const getBillingCycleStart = (closingDay: number): Date => {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Se hoje é antes do dia de fechamento, a fatura atual começou no fechamento do mês anterior
      if (today.getDate() < closingDay) {
          // Mês passado
          let lastMonth = currentMonth - 1;
          let year = currentYear;
          if (lastMonth < 0) {
              lastMonth = 11;
              year = currentYear - 1;
          }
          return new Date(year, lastMonth, closingDay);
      } else {
          // Se hoje já passou do dia de fechamento, o ciclo começou neste mês
          return new Date(currentYear, currentMonth, closingDay);
      }
  };

  const calculateCardMetrics = (card: Account) => {
      // 1. Saldo Total (Dívida Acumulada no Banco de Dados)
      // Se o usuário faz tudo certo, isso deve ser negativo.
      const totalDebt = card.balance < 0 ? Math.abs(card.balance) : 0; 
      
      // 2. Fatura Atual (Gastos do Ciclo)
      let currentInvoice = 0;
      let status = "Indefinido";

      if (card.closingDay) {
          const startDate = getBillingCycleStart(card.closingDay);
          
          // Somar todas as DESPESAS feitas neste cartão após a data de início do ciclo
          currentInvoice = transactions
            .filter(t => 
                t.accountId === card.id && 
                t.type === TransactionType.EXPENSE &&
                new Date(t.date) >= startDate
            )
            .reduce((acc, t) => acc + t.amount, 0);

          const today = new Date().getDate();
          if (today < card.closingDay) status = "Aberta";
          else if (card.dueDay && today > card.dueDay) status = "Vencida";
          else status = "Fechada";
      } else {
          // Fallback se não tiver dia configurado
          currentInvoice = totalDebt;
      }

      // 3. Limite Disponível
      // O limite disponível é baseado na Dívida Total Real, não apenas na fatura do mês.
      // Ex: Limite 5000. Dívida Total 2000 (1000 parcelado + 1000 mês atual). Disponível 3000.
      const limit = card.creditLimit || 0;
      // Balance positivo no cartão significa crédito extra, negativo significa dívida.
      // Disponível = Limite + Saldo (se saldo for -200, Limite - 200).
      const available = limit + card.balance;

      const usagePercent = limit > 0 ? Math.min(100, (totalDebt / limit) * 100) : 0;

      return {
          currentInvoice,
          totalDebt,
          available,
          usagePercent,
          status,
          limit
      };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cartões de Crédito</h1>
          <p className="text-gray-500">Gerencie limites, faturas e datas importantes.</p>
        </div>
        <button 
          onClick={() => { setEditingAccount({ type: AccountType.CARD } as Account); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Adicionar Cartão
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <CreditCard className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum cartão cadastrado</h3>
            <p className="text-gray-500 max-w-sm mx-auto mt-2">
                Cadastre seus cartões de crédito para acompanhar limites e datas de vencimento em um só lugar.
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cards.map(card => {
                const { currentInvoice, totalDebt, available, usagePercent, status, limit } = calculateCardMetrics(card);

                return (
                    <div key={card.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                        {/* Card Header Visual */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg tracking-wide">{card.name}</h3>
                                    <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">Crédito</p>
                                </div>
                                <CreditCard className="w-8 h-8 text-slate-400 opacity-50" />
                            </div>
                            <div className="mt-6 flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Fatura Atual (Ciclo)</p>
                                    <span className="text-2xl font-bold">{formatCurrency(currentInvoice)}</span>
                                </div>
                                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${status === 'Aberta' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                    {status}
                                </div>
                            </div>
                            {/* Action Buttons Overlay */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(card)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded backdrop-blur-sm">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => {
                                        if(confirm("Tem certeza que deseja excluir este cartão?")) onDeleteAccount(card.id);
                                    }} 
                                    className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded backdrop-blur-sm"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Card Details */}
                        <div className="p-6 space-y-4">
                            {/* Progress Bar */}
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-gray-500">Limite Utilizado (Total)</span>
                                    <span className="font-medium text-gray-700">{Math.round(usagePercent)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${usagePercent > 80 ? 'bg-rose-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${usagePercent}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs mt-1.5">
                                    <span className="text-gray-400">Disp: {formatCurrency(available)}</span>
                                    <span className="text-gray-400">Total: {formatCurrency(limit)}</span>
                                </div>
                            </div>

                            {/* Help Text for Payment */}
                            <div className="bg-blue-50 p-2 rounded-lg flex gap-2 items-start">
                                <ArrowRightLeft className="w-4 h-4 text-blue-500 mt-0.5" />
                                <p className="text-[10px] text-blue-700 leading-tight">
                                    Para pagar a fatura, realize uma <strong>Transferência</strong> da sua conta bancária para este cartão. Isso reduzirá a dívida total.
                                </p>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Fechamento</p>
                                        <p className="text-sm font-semibold text-gray-700">Dia {card.closingDay || '--'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                                        <AlertCircle className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Vencimento</p>
                                        <p className="text-sm font-semibold text-gray-700">Dia {card.dueDay || '--'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      <AccountModal 
        isOpen={isModalOpen}
        onClose={handleClose}
        onSave={onSaveAccount}
        initialData={editingAccount}
      />
    </div>
  );
};

export default CreditCardsView;
