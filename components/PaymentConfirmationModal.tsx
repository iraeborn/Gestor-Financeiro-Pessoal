
import React, { useState, useEffect } from 'react';
import { X, AlertCircle, TrendingUp, CheckCircle } from 'lucide-react';
import { Transaction, TransactionStatus } from '../types';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (transaction: Transaction, finalAmount: number) => void;
  transaction: Transaction | null;
}

const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({ isOpen, onClose, onConfirm, transaction }) => {
  const [finalAmount, setFinalAmount] = useState<string>('');
  const [calculatedInterest, setCalculatedInterest] = useState<number>(0);
  const [daysLate, setDaysLate] = useState<number>(0);

  useEffect(() => {
    if (transaction && isOpen) {
        const today = new Date();
        const dueDate = new Date(transaction.date);
        
        // Calcular dias de atraso
        const diffTime = today.getTime() - dueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        // Se a diferença for negativa, não está atrasado.
        const late = diffDays > 0 ? diffDays : 0;
        setDaysLate(late);

        // Calcular Juros (Simples - Pro rata die mensal)
        // Fórmula: Valor * (TaxaMensal / 30) * DiasAtraso
        let interest = 0;
        if (late > 0 && transaction.interestRate && transaction.interestRate > 0) {
            const dailyRate = (transaction.interestRate / 100) / 30;
            interest = transaction.amount * dailyRate * late;
        }

        setCalculatedInterest(interest);
        setFinalAmount((transaction.amount + interest).toFixed(2));
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const handleConfirm = () => {
    const val = parseFloat(finalAmount);
    if (isNaN(val) || val < 0) {
        alert("Valor inválido");
        return;
    }
    onConfirm(transaction, val);
    onClose();
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Confirmar Pagamento
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Valor Original</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(transaction.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Vencimento</span>
                    <span className="font-semibold text-gray-900">{new Date(transaction.date).toLocaleDateString('pt-BR')}</span>
                </div>
                
                {daysLate > 0 ? (
                    <div className="flex justify-between text-sm text-rose-600 bg-rose-50 p-2 rounded-lg">
                        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Atraso</span>
                        <span className="font-bold">{daysLate} dias</span>
                    </div>
                ) : (
                    <div className="flex justify-between text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                         <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Em dia</span>
                    </div>
                )}
                
                {daysLate > 0 && transaction.interestRate ? (
                    <div className="flex justify-between text-sm text-amber-600 border-t border-gray-200 pt-2">
                        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Juros sugeridos ({transaction.interestRate}%)</span>
                        <span className="font-bold">+ {formatCurrency(calculatedInterest)}</span>
                    </div>
                ) : null}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Final Pago</label>
                <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 font-bold">R$</span>
                    <input 
                        type="number" 
                        step="0.01"
                        value={finalAmount}
                        onChange={(e) => setFinalAmount(e.target.value)}
                        className="pl-9 block w-full rounded-xl border-gray-200 border py-2 text-lg font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <p className="text-xs text-gray-400 mt-1">Você pode ajustar este valor manualmente se necessário.</p>
            </div>

            <button
                onClick={handleConfirm}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
            >
                Confirmar Pagamento
            </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmationModal;
