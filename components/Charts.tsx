
import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { Transaction, TransactionType, Account, TransactionStatus } from '../types';

interface ChartsProps {
  transactions?: Transaction[];
  accounts?: Account[];
}

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const ACC_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']; 

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatCompact = (val: number) => 
  new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(val || 0);

export const CashFlowChart: React.FC<ChartsProps> = ({ transactions = [] }) => {
  const dataMap = new Map<string, { income: number; expense: number }>();
  
  const sorted = [...transactions]
    .filter(t => t && t.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  sorted.forEach(t => {
    if (t.type === TransactionType.TRANSFER) return;

    const date = t.date.substring(5); // MM-DD
    if (!dataMap.has(date)) {
      dataMap.set(date, { income: 0, expense: 0 });
    }
    const curr = dataMap.get(date)!;
    if (t.type === TransactionType.INCOME) curr.income += Number(t.amount) || 0;
    else if (t.type === TransactionType.EXPENSE) curr.expense += Number(t.amount) || 0;
  });

  const data = Array.from(dataMap.entries()).map(([date, vals]) => ({
    name: date,
    ...vals
  })).slice(-7);

  if (data.length === 0) {
      return <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-medium italic">Sem dados de movimentação recente</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{fill: '#94a3b8', fontSize: 11}} 
            tickFormatter={(value) => `R$ ${formatCompact(value)}`}
          />
          <Tooltip 
            cursor={{fill: '#f8fafc'}}
            formatter={(value: number) => [formatCurrency(value), ""]}
            labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
          />
          <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expense" name="Saídas" fill="#f43f5e" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ExpensesByCategory: React.FC<ChartsProps> = ({ transactions = [] }) => {
  const expenses = transactions.filter(t => t && t.type === TransactionType.EXPENSE);
  const dataMap = new Map<string, number>();

  expenses.forEach(t => {
    const current = dataMap.get(t.category) || 0;
    dataMap.set(t.category, current + (Number(t.amount) || 0));
  });

  const data = Array.from(dataMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (data.length === 0) {
      return <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-medium italic">Sem despesas registradas</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={8}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [formatCurrency(value), "Total"]}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} 
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 600, color: '#64748b'}} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BalanceDistributionChart: React.FC<ChartsProps> = ({ accounts = [] }) => {
    const data = accounts
        .filter(a => a && a.balance > 0)
        .map(a => ({
            name: a.name,
            value: Number(a.balance) || 0,
            type: a.type
        }));

    if (data.length === 0) {
        return <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-medium italic">Nenhum saldo positivo</div>;
    }

    return (
        <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
            <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
            >
                {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={ACC_COLORS[index % ACC_COLORS.length]} stroke="none" />
                ))}
            </Pie>
            <Tooltip 
                formatter={(value: number) => [formatCurrency(value), "Saldo"]}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 600}} />
            </PieChart>
        </ResponsiveContainer>
        </div>
    );
};

export const BalanceHistoryChart: React.FC<ChartsProps> = ({ accounts = [], transactions = [] }) => {
    const data = useMemo(() => {
        if (!accounts || accounts.length === 0) return [];
        const historyData = [];
        let currentBalance = accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
        
        const transMap = new Map<string, number>();
        (transactions || []).forEach(t => {
            if (t && t.status === TransactionStatus.PAID) {
                const date = t.date.split('T')[0];
                let amount = 0;
                if (t.type === TransactionType.INCOME) amount = Number(t.amount) || 0;
                else if (t.type === TransactionType.EXPENSE) amount = -(Number(t.amount) || 0);
                
                transMap.set(date, (transMap.get(date) || 0) + amount);
            }
        });

        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const displayDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            historyData.push({
                name: displayDate,
                balance: currentBalance,
                rawDate: d
            });

            const change = transMap.get(dateStr) || 0;
            currentBalance -= change; 
        }

        return historyData.reverse();
    }, [accounts, transactions]);

    if (data.length === 0) {
        return <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-medium italic">Dados insuficientes para histórico</div>;
    }

    return (
        <div className="h-full w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                        interval={4}
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), "Saldo Total"]}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#6366f1" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorBalance)" 
                        name="Saldo Acumulado"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
