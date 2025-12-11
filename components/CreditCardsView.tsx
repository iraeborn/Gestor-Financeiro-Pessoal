
import React, { useState } from 'react';
import { Account, AccountType, Transaction, TransactionType, TransactionStatus, Contact } from '../types';
import { Plus, CreditCard, Calendar, TrendingUp, AlertCircle, Edit2, Trash2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import AccountModal from './AccountModal';
import TransactionModal from './TransactionModal';

interface CreditCardsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  contacts: Contact[];
  onSaveAccount: (a: Account) => void;
  onDeleteAccount: (id: string) => void;
  onAddTransaction: (t: Omit<Transaction, 'id'>, newContact?: Contact) => void;
}

const CreditCardsView: React.FC<CreditCardsViewProps> = ({ 
    accounts, 
    transactions, 
    contacts, 
    onSaveAccount, 
    onDeleteAccount,
    onAddTransaction 
}) => {
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  
  // Estado para preencher o TransactionModal automaticamente
  const [prefilledTransaction, setPrefilledTransaction] = useState<Partial<Transaction> | null>(null);

  const cards = accounts.filter(a => a.type === AccountType.CARD);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleEdit = (card: Account) => {
    setEditingAccount(card);
    setIsAccountModalOpen(true);
  };

  const handleCloseAccountModal = () => {
    setIsAccountModalOpen(false);
    setEditingAccount(null);
  };

  const handleAddExpense = (card: Account) => {
      setPrefilledTransaction({
          accountId: card.id,
          type: TransactionType.EXPENSE,
          date: new Date().toISOString().split('T')[0],
          status: TransactionStatus.PENDING,
          description: 'Nova Despesa (Fatura)'
      });
      setIsTransModalOpen(true);
  };

  const handleSaveTransaction = (t: Omit<Transaction, 'id'>, newContact?: Contact) => {
      onAddTransaction(t, newContact);
      setIsTransModalOpen(false);
      setPrefilledTransaction(null);
  };

  // Calcula a data de início da fatura atual
  const getBillingCycleStart = (closingDay: number): Date => {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Se hoje é antes do dia de fechamento, a fatura atual começou no fechamento do mês anterior
      if (today.getDate() < closingDay) {
          let lastMonth = currentMonth - 1;
          let year = currentYear;
          if (lastMonth < 0) {
              lastMonth = 11;
              year = currentYear - 1;
          }
          return new Date(year, lastMonth, closingDay);
      } else {
          return new Date(currentYear, currentMonth, closingDay);
      }
  };

  const calculateCardMetrics = (card: Account) => {
      const totalUsedLimit = card.balance < 0 ? Math.abs(card.balance) : 0; 
      
      let currentInvoice = 0;
      let overdueAmount = 0;
      let status = "Indefinido";

      overdueAmount = transactions
        .filter(t => 
            t.accountId === card.id && 
            t.type === TransactionType.EXPENSE &&
            t.status === TransactionStatus.OVERDUE
        )
        .reduce((acc, t) => acc + t.amount, 0);

      if (card.closingDay) {
          const startDate = getBillingCycleStart(card.closingDay);
          
          currentInvoice = transactions
            .filter(t => 
                t.accountId === card.id && 
                t.type === TransactionType.EXPENSE &&
                t.status === TransactionStatus.PENDING &&
                new Date(t.date) >= startDate
            )
            .reduce((acc, t) => acc + t.amount, 0);

          const today = new Date().getDate();
          if (today < card.closingDay) status = "Aberta";
          else if (card.dueDay && today > card.dueDay) status = "Vencida";
          else status = "Fechada";
      }

      const knownExpenses = currentInvoice + overdueAmount;
      const residualDebt = Math.max(0, totalUsedLimit - knownExpenses);

      const limit = card.creditLimit || 0;
      const available = limit - totalUsedLimit;

      const usagePercent = limit > 0 ? Math.min(100, (totalUsedLimit / limit) * 100) : 0;

      return {
          currentInvoice,
          overdueAmount,
          residualDebt,
          totalUsedLimit,
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
          onClick={() => { setEditingAccount({ type: AccountType.CARD } as Account); setIsAccountModalOpen(true); }}
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
                const { currentInvoice, overdueAmount, residualDebt, totalUsedLimit, available, usagePercent, status, limit } = calculateCardMetrics(card);

                return (
                    <div key={card.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow flex flex-col h-full">
                        {/* Card Header Visual */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg tracking-wide">{card.name}</h3>
                                    <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">Crédito</p>
                                </div>
                                <CreditCard className="w-8 h-8 text-slate-400 opacity-50" />
                            </div>
                            
                            <div className="mt-6">
                                <p className="text-xs text-slate-400 mb-1">Limite Disponível</p>
                                <span className="text-3xl font-bold text-emerald-400">{formatCurrency(available)}</span>
                            </div>

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
                        <div className="p-6 space-y-5 flex-1 flex flex-col">
                            {/* Alerta de Atraso */}
                            {overdueAmount > 0 && (
                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-rose-700 uppercase">Fatura em Atraso</p>
                                        <p className="text-lg font-bold text-rose-600">{formatCurrency(overdueAmount)}</p>
                                        <p className="text-[10px] text-rose-500 leading-tight mt-1">
                                            Regularize para evitar juros.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Resumo da Dívida */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 relative group/invoice">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Fatura Atual</p>
                                    <p className="text-base font-bold text-gray-800">{formatCurrency(currentInvoice)}</p>
                                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${status === 'Aberta' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {status}
                                    </span>
                                    
                                    {/* Botão Rápido para Adicionar na Fatura */}
                                    <button 
                                        onClick={() => handleAddExpense(card)}
                                        className="absolute top-2 right-2 p-1.5 bg-white shadow-sm border border-gray-200 rounded-full hover:bg-indigo-50 text-indigo-600 opacity-0 group-hover/invoice:opacity-100 transition-opacity"
                                        title="Lançar Despesa"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1" title="Parcelas futuras ou saldo inicial não detalhado">Outros / Parc.</p>
                                    <p className="text-base font-bold text-gray-600">{formatCurrency(residualDebt)}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-auto pt-2">
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-gray-500">Comprometimento Total</span>
                                    <span className="font-medium text-gray-700">{Math.round(usagePercent)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-1">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${usagePercent > 90 ? 'bg-rose-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${usagePercent}%` }}
                                    ></div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-gray-400">Total: {formatCurrency(limit)}</span>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                                    <div>
                                        <p className="text-[9px] text-gray-400 uppercase font-bold">Fecha dia</p>
                                        <p className="text-sm font-semibold text-gray-700">{card.closingDay || '--'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-400" />
                                    <div>
                                        <p className="text-[9px] text-gray-400 uppercase font-bold">Vence dia</p>
                                        <p className="text-sm font-semibold text-gray-700">{card.dueDay || '--'}</p>
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
        isOpen={isAccountModalOpen}
        onClose={handleCloseAccountModal}
        onSave={onSaveAccount}
        initialData={editingAccount}
      />

      <TransactionModal 
        isOpen={isTransModalOpen}
        onClose={() => setIsTransModalOpen(false)}
        onSave={handleSaveTransaction}
        accounts={accounts}
        contacts={contacts}
        initialData={prefilledTransaction as any}
      />
    </div>
  );
};

export default CreditCardsView;
