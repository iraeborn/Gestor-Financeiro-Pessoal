
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { Calendar, ArrowRight, TrendingUp, Repeat, Clock, BarChart3, Filter } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

interface ReportsProps {
  transactions: Transaction[];
}

interface ProjectedItem {
  date: Date;
  amount: number;
  type: TransactionType;
  description: string;
  isVirtual: boolean; 
}

const Reports: React.FC<ReportsProps> = ({ transactions = [] }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
  );

  const [chartRange, setChartRange] = useState<number>(6); 

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatCompact = (val: number) => 
    new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(val || 0);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '---';
    const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = dateOnly.split('-');
    if (parts.length < 3) return dateOnly;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const getMonthLabel = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  };

  const recurringTransactions = useMemo(() => {
    return (transactions || []).filter(t => t && t.isRecurring);
  }, [transactions]);

  const generateFinancialData = (start: Date, end: Date, includeProjections: boolean) => {
    const items: ProjectedItem[] = [];
    const isFutureRange = start >= new Date(new Date().setHours(0,0,0,0));

    (transactions || []).filter(Boolean).forEach(t => {
      if (!t.isRecurring) {
        const tDate = new Date(t.date);
        if (tDate >= start && tDate <= end) {
          items.push({
            date: tDate,
            amount: Number(t.amount) || 0,
            type: t.type,
            description: t.description,
            isVirtual: false
          });
        }
        return;
      }

      if (t.isRecurring) {
        if (!includeProjections && !isFutureRange) {
             const tDate = new Date(t.date);
             if (tDate >= start && tDate <= end) {
                items.push({
                    date: tDate,
                    amount: Number(t.amount) || 0,
                    type: t.type,
                    description: t.description,
                    isVirtual: false
                });
             }
             return;
        }

        let currentDate = new Date(t.date);
        const recurrenceEnd = t.recurrenceEndDate ? new Date(t.recurrenceEndDate) : null;
        const safeLimit = new Date(start); 
        safeLimit.setFullYear(safeLimit.getFullYear() + 5);

        while (currentDate <= end && currentDate <= safeLimit) {
          if (recurrenceEnd && currentDate > recurrenceEnd) break;

          if (currentDate >= start && currentDate <= end) {
            items.push({
              date: new Date(currentDate),
              amount: Number(t.amount) || 0,
              type: t.type,
              description: t.description + ' (Recorrente)',
              isVirtual: true
            });
          }

          if (t.recurrenceFrequency === 'WEEKLY') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (t.recurrenceFrequency === 'YEARLY') {
            currentDate.setFullYear(currentDate.getFullYear() + 1);
          } else {
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }
      }
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const evolutionChartData = useMemo(() => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    const isFuture = chartRange > 0;

    if (isFuture) {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + chartRange, 0);
    } else {
        start = new Date(today.getFullYear(), today.getMonth() + chartRange, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    const items = generateFinancialData(start, end, isFuture);
    const groupedMap = new Map<string, { income: number; expense: number; sortDate: number }>();

    items.forEach(item => {
        const key = getMonthLabel(item.date);
        const sortKey = item.date.getFullYear() * 100 + item.date.getMonth();

        if (!groupedMap.has(key)) {
            groupedMap.set(key, { income: 0, expense: 0, sortDate: sortKey });
        }
        const curr = groupedMap.get(key)!;
        if (item.type === TransactionType.INCOME) curr.income += item.amount;
        else curr.expense += item.amount;
    });

    return Array.from(groupedMap.entries())
        .map(([name, val]) => ({ name, ...val }))
        .sort((a, b) => a.sortDate - b.sortDate);

  }, [transactions, chartRange]);

  const projectionListData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
         return { items: [], totalIncome: 0, totalExpense: 0, balance: 0 };
    }

    const items = generateFinancialData(start, end, true);

    const totalIncome = items
      .filter(i => i.type === TransactionType.INCOME)
      .reduce((acc, i) => acc + i.amount, 0);
    
    const totalExpense = items
      .filter(i => i.type === TransactionType.EXPENSE)
      .reduce((acc, i) => acc + i.amount, 0);

    return {
      items,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    };
  }, [transactions, startDate, endDate]);

  const freqMap: Record<string, string> = { 'WEEKLY': 'Semanal', 'MONTHLY': 'Mensal', 'YEARLY': 'Anual' };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter">
                    <BarChart3 className="w-6 h-6 text-indigo-600" />
                    Evolução Financeira
                </h2>
                <p className="text-sm text-gray-500 font-medium">
                    Analise suas entradas e saídas ao longo do tempo.
                </p>
            </div>
            <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner">
                <button onClick={() => setChartRange(-6)} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartRange === -6 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Passado</button>
                <button onClick={() => setChartRange(6)} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartRange === 6 ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-indigo-600'}`}>6 Meses</button>
                <button onClick={() => setChartRange(12)} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartRange === 12 ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-indigo-600'}`}>1 Ano</button>
            </div>
        </div>

        <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionChartData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 10}} 
                        tickFormatter={(val) => `R$ ${formatCompact(val)}`} 
                    />
                    <RechartsTooltip 
                        formatter={(value: number) => [formatCurrency(value), ""]} 
                        cursor={{fill: '#f8fafc'}} 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }}/>
                    <Bar name="Receitas" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar name="Despesas" dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                <Repeat className="w-5 h-5 text-indigo-600" />
                Contas Recorrentes
            </h2>
            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">
                {recurringTransactions.length} registros
            </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[10px] tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Frequência</th>
                <th className="px-6 py-4">Início</th>
                <th className="px-6 py-4">Término</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recurringTransactions.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-300 font-medium italic">Nenhuma conta recorrente cadastrada.</td></tr>
              ) : (
                recurringTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-5 font-bold text-slate-700">{t.description}</td>
                    <td className={`px-6 py-5 font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(Number(t.amount))}</td>
                    <td className="px-6 py-5"><span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter bg-slate-100 text-slate-500 border border-slate-200">{freqMap[t.recurrenceFrequency || 'MONTHLY']}</span></td>
                    <td className="px-6 py-5 text-slate-400 font-medium">{formatDate(t.date)}</td>
                    <td className="px-6 py-5">{t.recurrenceEndDate ? <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg text-[10px] w-fit font-black uppercase tracking-tighter"><Clock className="w-3 h-3" /> {formatDate(t.recurrenceEndDate)}</span> : <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter">Fluxo Contínuo</span>}</td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div>
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                    <Filter className="w-6 h-6 text-indigo-600" />
                    Extrato Projetado
                </h2>
                <p className="text-sm text-gray-500 mt-1 font-medium italic">Simulação dia-a-dia do fluxo futuro.</p>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-[1.5rem] border border-gray-100">
                <div className="relative"><Calendar className="w-4 h-4 text-gray-300 absolute left-3 top-3.5" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-9 pr-2 py-3 bg-white border border-gray-100 rounded-xl text-[11px] font-black uppercase focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/></div>
                <ArrowRight className="w-4 h-4 text-gray-300" />
                <div className="relative"><Calendar className="w-4 h-4 text-gray-300 absolute left-3 top-3.5" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-9 pr-2 py-3 bg-white border border-gray-100 rounded-xl text-[11px] font-black uppercase focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/></div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-6 rounded-[2rem] bg-emerald-50 border border-emerald-100 shadow-sm"><p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-1">Previsão Receitas</p><h3 className="text-2xl font-black text-emerald-700">{formatCurrency(projectionListData.totalIncome)}</h3></div>
            <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 shadow-sm"><p className="text-[10px] text-rose-600 font-black uppercase tracking-widest mb-1">Previsão Saídas</p><h3 className="text-2xl font-black text-rose-700">{formatCurrency(projectionListData.totalExpense)}</h3></div>
            <div className={`p-6 rounded-[2rem] border shadow-sm ${projectionListData.balance >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}><p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${projectionListData.balance >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>Resultado Simulador</p><h3 className={`text-2xl font-black ${projectionListData.balance >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>{formatCurrency(projectionListData.balance)}</h3></div>
        </div>

        <div className="border border-gray-100 rounded-[2rem] overflow-hidden flex flex-col max-h-[500px] shadow-inner">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center"><h3 className="font-black text-gray-600 uppercase text-[10px] tracking-widest">Linha do Tempo ({projectionListData.items.length})</h3> <TrendingUp className="w-4 h-4 text-indigo-400" /></div>
            <div className="overflow-y-auto flex-1 scrollbar-thin">
                {projectionListData.items.length === 0 ? (
                    <div className="p-16 text-center text-gray-300 font-medium italic">Nenhuma movimentação prevista no período.</div>
                ) : (
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-50">
                            {projectionListData.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 text-slate-400 font-black text-[11px] w-32">{item.date.toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">{item.description}</span>
                                            {item.isVirtual && <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full w-fit uppercase tracking-tighter mt-1 border border-indigo-100">Projeção Virtual</span>}
                                        </div>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black ${item.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>{item.type === TransactionType.EXPENSE && '- '}{formatCurrency(item.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
