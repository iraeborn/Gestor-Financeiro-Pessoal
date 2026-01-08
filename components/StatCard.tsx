
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  amount: number;
  type: 'neutral' | 'positive' | 'negative' | 'info';
  subtitle?: string;
  icon?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, amount, type, subtitle, icon }) => {
  const formatCurrency = (val: number) => {
    // Fallback para NaN ou valores nulos de forma definitiva
    const safeValue = (typeof val === 'number' && !isNaN(val)) ? val : 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeValue);
  };

  let colorClass = '';
  let IconComp = Minus;

  switch (type) {
    case 'positive':
      colorClass = 'text-emerald-600 bg-emerald-50';
      IconComp = ArrowUpRight;
      break;
    case 'negative':
      colorClass = 'text-rose-600 bg-rose-50';
      IconComp = ArrowDownRight;
      break;
    case 'info':
      colorClass = 'text-blue-600 bg-blue-50';
      IconComp = ArrowUpRight;
      break;
    default:
      colorClass = 'text-gray-600 bg-gray-50';
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-full transition-transform hover:scale-[1.02] duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className={`text-2xl font-bold ${type === 'negative' ? 'text-rose-600' : 'text-gray-900'}`}>
            {formatCurrency(amount)}
          </h3>
        </div>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          {icon ? icon : <IconComp className="w-5 h-5" />}
        </div>
      </div>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-auto pt-2 border-t border-gray-50">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;
