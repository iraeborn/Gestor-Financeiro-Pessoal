
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
  isVirtual: boolean; // True if generated from a recurrence
}

const Reports: React.FC<ReportsProps> = ({ transactions }) => {
  // --- Estado para Projeção (Lista) ---
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
  );

  // --- Estado para Gráfico de Evolução ---
  // Valor representa meses. Positivo = Futuro, Negativo = Passado.
  const [chartRange, setChartRange] = useState<number>(6); 

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Indeterminado';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const getMonthLabel = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  };

  // --- 1. Lógica de Itens Recorrentes Ativos (Tabela Superior) ---
  const recurringTransactions = useMemo(() => {
    return transactions.filter(t => t.isRecurring);
  }, [transactions]);

  // --- 2. Lógica Genérica de Projeção/Histórico (Usada pelo Gráfico e Pela Lista) ---
  const generateFinancialData = (start: Date, end: Date, includeProjections: boolean) => {
    const items: ProjectedItem[] = [];
    const isFutureRange = start >= new Date(new Date().setHours(0,0,0,0));

    transactions.forEach(t => {
      // A. Transações Reais (Não recorrentes ou já lançadas)
      // Se estamos olhando para o passado, queremos apenas o que realmente aconteceu (status != pending se for rigoroso, mas aqui mostramos tudo que tem data)
      if (!t.isRecurring) {
        const tDate = new Date(t.date);
        if (tDate >= start && tDate <= end) {
          items.push({
            date: tDate,
            amount: t.amount,
            type: t.type,
            description: t.description,
            isVirtual: false
          });
        }
        return;
      }

      // B. Transações Recorrentes (Explosão de datas)
      // Só projetamos recorrência se a flag includeProjections for true (geralmente para datas futuras)
      if (t.isRecurring) {
        // Se for histórico (passado), normalmente só mostramos se houve transação real gerada. 
        // Mas como este app simplificado usa a flag isRecurring no registro pai,
        // vamos assumir que para o PASSADO, contamos apenas a data original da transação se ela cair no range.
        // Para o FUTURO, projetamos.
        
        if (!includeProjections && !isFutureRange) {
             const tDate = new Date(t.date);
             if (tDate >= start && tDate <= end) {
                items.push({
                    date: tDate,
                    amount: t.amount,
                    type: t.type,
                    description: t.description,
                    isVirtual: false
                });
             }
             return;
        }

        // Lógica de Projeção para o Futuro/Range Misto
        let currentDate = new Date(t.date);
        const recurrenceEnd = t.recurrenceEndDate ? new Date(t.recurrenceEndDate) : null;
        const safeLimit = new Date(start); 
        safeLimit.setFullYear(safeLimit.getFullYear() + 5); // Limite de 5 anos

        while (currentDate <= end && currentDate <= safeLimit) {
          if (recurrenceEnd && currentDate > recurrenceEnd) break;

          if (currentDate >= start && currentDate <= end) {
            items.push({
              date: new Date(currentDate),
              amount: t.amount,
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

  // --- 3. Dados para o Gráfico de Evolução ---
  const evolutionChartData = useMemo(() => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    const isFuture = chartRange > 0;

    if (isFuture) {
        // Do dia 1 do mês atual até X meses para frente
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + chartRange, 0);
    } else {
        // De X meses atrás até o último dia do mês passado (ou atual)
        start = new Date(today.getFullYear(), today.getMonth() + chartRange, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    const items = generateFinancialData(start, end, isFuture);

    // Agrupar por Mês
    const groupedMap = new Map<string, { income: number; expense: number; sortDate: number }>();

    items.forEach(item => {
        const key = getMonthLabel(item.date); // ex: "nov/24"
        // Criar chave de ordenação (YYYYMM)
        const sortKey = item.date.getFullYear() * 100 + item.date.getMonth();

        if (!groupedMap.has(key)) {
            groupedMap.set(key, { income: 0, expense: 0, sortDate: sortKey });
        }
        const curr = groupedMap.get(key)!;
        if (item.type === TransactionType.INCOME) curr.income += item.amount;
        else curr.expense += item.amount;
    });

    // Converter para array e ordenar cronologicamente
    return Array.from(groupedMap.entries())
        .map(([name, val]) => ({ name, ...val }))
        .sort((a, b) => a.sortDate - b.sortDate);

  }, [transactions, chartRange]);

  // --- 4. Dados para a Lista de Projeção (Extrato) ---
  const projectionListData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validar
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
    <div className="space-y-8 animate-fade-in">
      
      {/* SEÇÃO 1: GRÁFICO DE EVOLUÇÃO (NOVO) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Evolução Financeira
                </h2>
                <p className="text-sm text-gray-500">
                    Analise suas entradas e saídas ao longo do tempo.
                </p>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setChartRange(-6)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartRange === -6 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Últimos 6 meses
                </button>
                <button 
                    onClick={() => setChartRange(6)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartRange === 6 ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Próximos 6 meses
                </button>
                <button 
                    onClick={() => setChartRange(12)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartRange === 12 ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Próximos 12 meses
                </button>
            </div>
        </div>

        <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionChartData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}} 
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 11}} 
                        tickFormatter={(val) => `R$ ${val/1000}k`}
                    />
                    <RechartsTooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                    <Bar name="Receitas" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar name="Despesas" dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* SEÇÃO 2: Recorrências Ativas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Repeat className="w-5 h-5 text-indigo-600" />
                Contas Recorrentes Ativas
            </h2>
            <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">
                {recurringTransactions.length} registros
            </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-3">Descrição</th>
                <th className="px-6 py-3">Valor</th>
                <th className="px-6 py-3">Frequência</th>
                <th className="px-6 py-3">Início</th>
                <th className="px-6 py-3">Término</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recurringTransactions.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                        Nenhuma conta recorrente cadastrada.
                    </td>
                </tr>
              ) : (
                recurringTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">{t.description}</td>
                    <td className={`px-6 py-4 font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(t.amount)}
                    </td>
                    <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {freqMap[t.recurrenceFrequency || 'MONTHLY']}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(t.date)}</td>
                    <td className="px-6 py-4">
                        {t.recurrenceEndDate ? (
                            <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded-md text-xs w-fit font-medium">
                                <Clock className="w-3 h-3" />
                                {formatDate(t.recurrenceEndDate)}
                            </span>
                        ) : (
                            <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-medium">
                                Contínuo
                            </span>
                        )}
                    </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO 3: Calculadora de Projeção */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Filter className="w-5 h-5 text-indigo-600" />
                    Extrato Projetado (Simulador)
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Detalhe dia-a-dia de um período específico.
                </p>
            </div>
            
            {/* Filtros de Data */}
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-9 pr-2 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-9 pr-2 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>
        </div>

        {/* Cards de Resumo da Projeção */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-sm text-emerald-600 font-medium mb-1">Faturamento Previsto</p>
                <h3 className="text-2xl font-bold text-emerald-700">{formatCurrency(projectionListData.totalIncome)}</h3>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                <p className="text-sm text-rose-600 font-medium mb-1">Débitos Previstos</p>
                <h3 className="text-2xl font-bold text-rose-700">{formatCurrency(projectionListData.totalExpense)}</h3>
            </div>
            <div className={`p-4 rounded-xl border ${projectionListData.balance >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
                <p className={`text-sm font-medium mb-1 ${projectionListData.balance >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>Saldo do Período</p>
                <h3 className={`text-2xl font-bold ${projectionListData.balance >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
                    {formatCurrency(projectionListData.balance)}
                </h3>
            </div>
        </div>

        {/* Lista Detalhada */}
        <div className="border border-gray-100 rounded-xl overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-700 text-sm">Transações ({projectionListData.items.length})</h3>
            </div>
            <div className="overflow-y-auto flex-1 p-0">
                {projectionListData.items.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">Nenhuma movimentação prevista neste período.</div>
                ) : (
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-50">
                            {projectionListData.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-500 w-24">{item.date.toLocaleDateString('pt-BR')}</td>
                                    <td className="px-4 py-3 text-gray-800">
                                        <div className="flex flex-col">
                                            <span>{item.description}</span>
                                            {item.isVirtual && (
                                                <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1 rounded w-fit">Projeção</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-medium ${item.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {item.type === TransactionType.EXPENSE && '- '}
                                        {formatCurrency(item.amount)}
                                    </td>
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
