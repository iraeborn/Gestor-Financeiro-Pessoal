
import React, { useState } from 'react';
import { X, CheckCircle, DollarSign, FileText, Building2, AlertCircle } from 'lucide-react';
import { CommercialOrder, Account } from '../types';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CommercialOrder | null;
  accounts: Account[];
  onConfirm: (data: { 
    accountId: string, 
    generateTransaction: boolean, 
    generateInvoice: boolean,
    invoiceType: 'ISS' | 'ICMS'
  }) => void;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onClose, order, accounts, onConfirm }) => {
  const [generateTransaction, setGenerateTransaction] = useState(true);
  const [generateInvoice, setGenerateInvoice] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'ISS' | 'ICMS'>('ISS');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');

  if (!isOpen || !order) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-slate-100">
        <div className="bg-indigo-600 p-8 text-white relative">
            <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-2xl font-black">Aprovar Orçamento</h2>
                    <p className="text-indigo-100 text-sm">Configure o faturamento desta venda.</p>
                </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 mt-4 border border-white/10">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase opacity-70 tracking-widest">Valor Total</span>
                    <span className="text-2xl font-black">{formatCurrency(order.amount)}</span>
                </div>
            </div>
        </div>

        <div className="p-8 space-y-6">
            <div className="space-y-4">
                {/* Lançamento Financeiro */}
                <label className="flex items-start gap-4 p-4 rounded-2xl border-2 border-slate-50 hover:border-indigo-100 transition-all cursor-pointer group">
                    <div className={`mt-1 p-2 rounded-xl transition-colors ${generateTransaction ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">Gerar Receita no Financeiro</span>
                            <input type="checkbox" checked={generateTransaction} onChange={e => setGenerateTransaction(e.target.checked)} className="w-5 h-5 rounded-lg text-indigo-600 focus:ring-indigo-500" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Cria um lançamento de "Contas a Receber" com referência ao pedido.</p>
                    </div>
                </label>

                {generateTransaction && (
                    <div className="ml-12 animate-fade-in">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Previsão de Recebimento na Conta</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-300" />
                            <select 
                                value={accountId} 
                                onChange={e => setAccountId(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                            >
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (Saldo: {formatCurrency(acc.balance)})</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Nota Fiscal */}
                <label className="flex items-start gap-4 p-4 rounded-2xl border-2 border-slate-50 hover:border-indigo-100 transition-all cursor-pointer group">
                    <div className={`mt-1 p-2 rounded-xl transition-colors ${generateInvoice ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">Emitir Nota Fiscal</span>
                            <input type="checkbox" checked={generateInvoice} onChange={e => setGenerateInvoice(e.target.checked)} className="w-5 h-5 rounded-lg text-indigo-600 focus:ring-indigo-500" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Registra a emissão de uma Nota Fiscal.</p>
                    </div>
                </label>

                {generateInvoice && (
                    <div className="ml-12 flex gap-4 animate-fade-in">
                        <button type="button" onClick={() => setInvoiceType('ISS')} className={`flex-1 py-2 rounded-xl text-xs font-black border-2 transition-all ${invoiceType === 'ISS' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-100 text-slate-400'}`}>ISS (Serviço)</button>
                        <button type="button" onClick={() => setInvoiceType('ICMS')} className={`flex-1 py-2 rounded-xl text-xs font-black border-2 transition-all ${invoiceType === 'ICMS' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-100 text-slate-400'}`}>ICMS (Produto)</button>
                    </div>
                )}
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase">Ao confirmar, o status deste pedido mudará para "Confirmado".</p>
            </div>

            <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-4 text-sm font-black text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                <button 
                    onClick={() => onConfirm({ accountId, generateTransaction, generateInvoice, invoiceType })}
                    className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black text-base hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
                >
                    <CheckCircle className="w-5 h-5" /> Confirmar e Aprovar
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
