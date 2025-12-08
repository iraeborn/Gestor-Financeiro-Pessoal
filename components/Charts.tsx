import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Transaction, TransactionType } from '../types';

interface ChartsProps {
  transactions: Transaction[];
}

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899'];

export const CashFlowChart: React.FC<ChartsProps> = ({ transactions }) => {
  // Group by date (last 7 days typically, but let's do simple aggregation)
  const dataMap = new Map<string, { income: number; expense: number }>();
  
  // Sort by date
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sorted.forEach(t => {
    const date = t.date.substring(5); // MM-DD
    if (!dataMap.has(date)) {
      dataMap.set(date, { income: 0, expense: 0 });
    }
    const curr = dataMap.get(date)!;
    if (t.type === TransactionType.INCOME) curr.income += t.amount;
    else curr.expense += t.amount;
  });

  const data = Array.from(dataMap.entries()).map(([date, vals]) => ({
    name: date,
    ...vals
  })).slice(-10); // Last 10 days with activity

  return (
    <div className="h-72 w-full">
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

export const ExpensesByCategory: React.FC<ChartsProps> = ({ transactions }) => {
  const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
  const dataMap = new Map<string, number>();

  expenses.forEach(t => {
    const current = dataMap.get(t.category) || 0;
    dataMap.set(t.category, current + t.amount);
  });

  const data = Array.from(dataMap.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="h-72 w-full">
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
          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
