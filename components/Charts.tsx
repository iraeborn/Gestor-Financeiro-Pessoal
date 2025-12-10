
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Transaction, TransactionType, Account } from '../types';

interface ChartsProps {
  transactions?: Transaction[];
  accounts?: Account[];
}

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const ACC_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']; // Bank, Wallet, Card, Inv

export const CashFlowChart: React.FC<ChartsProps> = ({ transactions = [] }) => {
  const dataMap = new Map<string, { income: number; expense: number }>();
  
  // Sort by date and take last 7-10 entries
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Simple grouping by day (MM-DD)
  sorted.forEach(t => {
    // Ignore Transfers for Cash Flow (Net 0)
    if (t.type === TransactionType.TRANSFER) return;

    const date = t.date.substring(5); // MM-DD
    if (!dataMap.has(date)) {
      dataMap.set(date, { income: 0, expense: 0 });
    }
    const curr = dataMap.get(date)!;
    if (t.type === TransactionType.INCOME) curr.income += t.amount;
    else if (t.type === TransactionType.EXPENSE) curr.expense += t.amount;
  });

  // Take only last 7 days of activity for cleaner dashboard view
  const data = Array.from(dataMap.entries()).map(([date, vals]) => ({
    name: date,
    ...vals
  })).slice(-7);

  if (data.length === 0) {
      return <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem dados recentes</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
          <Tooltip 
            cursor={{fill: '#f8fafc'}}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ExpensesByCategory: React.FC<ChartsProps> = ({ transactions = [] }) => {
  const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
  const dataMap = new Map<string, number>();

  expenses.forEach(t => {
    const current = dataMap.get(t.category) || 0;
    dataMap.set(t.category, current + t.amount);
  });

  const data = Array.from(dataMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // Top 5 categories

  if (data.length === 0) {
      return <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem despesas registradas</div>;
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BalanceDistributionChart: React.FC<ChartsProps> = ({ accounts = [] }) => {
    // Filter out negative balances (credit cards) for distribution chart usually, or treat them separately.
    // Let's show positive assets distribution.
    const data = accounts
        .filter(a => a.balance > 0)
        .map(a => ({
            name: a.name,
            value: a.balance,
            type: a.type
        }));

    if (data.length === 0) {
        return <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem saldo positivo</div>;
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
                <Cell key={`cell-${index}`} fill={ACC_COLORS[index % ACC_COLORS.length]} />
                ))}
            </Pie>
            <Tooltip 
                formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}} />
            </PieChart>
        </ResponsiveContainer>
        </div>
    );
};
