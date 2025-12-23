
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Account, TransactionStatus, Contact, Category } from '../types';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import TransactionModal from './TransactionModal';

interface CalendarViewProps {
  transactions: Transaction[];
  accounts: Account[];
  contacts: Contact[];
  categories: Category[];
  onAdd: (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => void;
  onEdit: (t: Transaction, newContact?: Contact, newCategory?: Category) => void;
}

interface CalendarItem {
  original: Transaction; 
  amount: number;
  type: TransactionType;
  description: string;
  isVirtual: boolean; 
  date: Date; 
}

interface CalendarEvent {
  dateStr: string; 
  items: CalendarItem[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ transactions, accounts, contacts, categories, onAdd, onEdit }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForNew, setSelectedDateForNew] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const calendarData = useMemo(() => {
    const events: Record<string, CalendarEvent['items']> = {};
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    transactions.forEach(t => {
      if (!t.isRecurring) {
        const tDate = new Date(t.date);
        const dateKey = t.date.includes('T') ? t.date.split('T')[0] : t.date;
        
        if (tDate.getMonth() === month && tDate.getFullYear() === year) {
           if (!events[dateKey]) events[dateKey] = [];
           events[dateKey].push({
             original: t,
             amount: t.amount,
             type: t.type,
             description: t.description,
             isVirtual: false,
             date: tDate
           });
        }
        return;
      }

      let iterDate = new Date(t.date);
      const recurrenceEnd = t.recurrenceEndDate ? new Date(t.recurrenceEndDate) : null;
      const safetyLimit = new Date(year + 1, 0, 1);

      while (iterDate <= endOfMonth && iterDate <= safetyLimit) {
        if (recurrenceEnd && iterDate > recurrenceEnd) break;

        if (iterDate.getMonth() === month && iterDate.getFullYear() === year) {
            const dateKey = iterDate.toISOString().split('T')[0];
            if (!events[dateKey]) events[dateKey] = [];
            events[dateKey].push({
                original: t,
                amount: t.amount,
                type: t.type,
                description: t.description,
                isVirtual: true,
                date: new Date(iterDate)
            });
        }

        if (t.recurrenceFrequency === 'WEEKLY') {
            iterDate.setDate(iterDate.getDate() + 7);
        } else if (t.recurrenceFrequency === 'YEARLY') {
            iterDate.setFullYear(iterDate.getFullYear() + 1);
        } else {
            iterDate.setMonth(iterDate.getMonth() + 1);
        }
      }
    });

    return events;
  }, [transactions, year, month]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDayClick = (day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    setSelectedDateForNew(dateStr);
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    setEditingTransaction(item.original);
    setIsModalOpen(true);
  };

  const handleSave = (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => {
    if (editingTransaction) {
        onEdit({ ...t, id: editingTransaction.id }, newContact, newCategory);
    } else {
        onAdd(t, newContact, newCategory);
    }
    setIsModalOpen(false);
    setEditingTransaction(null);
    setSelectedDateForNew('');
  };

  const daysInCurrentMonth = getDaysInMonth(year, month);
  const startDay = getFirstDayOfMonth(year, month);
  
  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} className="bg-gray-50/30 border-r border-b border-gray-100 min-h-[100px]" />);
  }

  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dateStr = new Date(year, month, d).toISOString().split('T')[0];
    const dailyItems = calendarData[dateStr] || [];
    dailyItems.sort((a, b) => (a.type === TransactionType.INCOME ? -1 : 1));
    const dayTotal = dailyItems.reduce((acc, i) => i.type === TransactionType.INCOME ? acc + i.amount : acc - i.amount, 0);
    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

    days.push(
      <div key={d} onClick={() => handleDayClick(d)} className={`group relative min-h-[100px] border-r border-b border-gray-100 p-2 transition-colors hover:bg-indigo-50/30 cursor-pointer ${isToday ? 'bg-indigo-50/10' : 'bg-white'}`}>
        <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>{d}</span>
            {dailyItems.length > 0 && <span className={`text-[10px] font-semibold ${dayTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{dayTotal !== 0 && (dayTotal > 0 ? '+' : '') + Math.round(dayTotal)}</span>}
        </div>
        <div className="space-y-1">
            {dailyItems.slice(0, 3).map((item, idx) => (
                <div key={idx} onClick={(e) => handleEventClick(e, item)} className={`text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 border hover:opacity-80 transition-opacity ${item.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'} ${item.original.status === TransactionStatus.PAID ? 'opacity-100' : 'opacity-70 border-dashed'}`} title={`${item.description} - ${formatCurrency(item.amount)} ${item.isVirtual ? '(Projeção)' : ''}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${item.type === TransactionType.INCOME ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {item.description}
                </div>
            ))}
            {dailyItems.length > 3 && <div className="text-[10px] text-gray-400 pl-1">+ {dailyItems.length - 3} mais</div>}
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity md:hidden lg:block"><Plus className="w-4 h-4 text-gray-300 hover:text-indigo-600" /></div>
      </div>
    );
  }

  const allItems = Object.values(calendarData).flat() as CalendarItem[];
  const totalIncome = allItems.filter(i => i.type === TransactionType.INCOME).reduce((acc, i) => acc + i.amount, 0);
  const totalExpense = allItems.filter(i => i.type === TransactionType.EXPENSE).reduce((acc, i) => acc + i.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
                <div className="flex items-center bg-gray-50 rounded-xl p-1">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition-all"><ChevronLeft className="w-5 h-5" /></button>
                    <span className="px-4 font-bold text-gray-800 min-w-[140px] text-center">{monthNames[month]} {year}</span>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition-all"><ChevronRight className="w-5 h-5" /></button>
                </div>
            </div>
            <div className="flex gap-6 text-sm">
                <div><span className="text-gray-500 block text-xs">Previsão Receitas</span><span className="font-bold text-emerald-600">{formatCurrency(totalIncome)}</span></div>
                <div><span className="text-gray-500 block text-xs">Previsão Despesas</span><span className="font-bold text-rose-600">{formatCurrency(totalExpense)}</span></div>
                <div><span className="text-gray-500 block text-xs">Saldo Previsto</span><span className={`font-bold ${totalIncome - totalExpense >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>{formatCurrency(totalIncome - totalExpense)}</span></div>
            </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (<div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">{day}</div>))}</div>
            <div className="grid grid-cols-7 bg-gray-200 gap-px border-b border-gray-200">{days}</div>
        </div>
        <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} accounts={accounts} contacts={contacts} categories={categories} initialData={editingTransaction ? editingTransaction : (selectedDateForNew ? { date: selectedDateForNew } as any : null)} />
    </div>
  );
};

export default CalendarView;
