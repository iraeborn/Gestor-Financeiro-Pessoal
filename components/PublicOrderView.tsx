
import React, { useState, useEffect } from 'react';
import { getPublicOrder, updatePublicOrderStatus } from '../services/storageService';
import { ShoppingBag, CheckCircle, XCircle, Clock, Info, User, Package, Calculator, ReceiptText, Smartphone, Mail, Globe } from 'lucide-react';

interface PublicOrderViewProps {
  token: string;
}

const PublicOrderView: React.FC<PublicOrderViewProps> = ({ token }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [token]);

  const loadOrder = async () => {
    try {
      const data = await getPublicOrder(token);
      setOrder(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar orçamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (status: string) => {
    setActionLoading(true);
    try {
      await updatePublicOrderStatus(token, status);
      setSuccess(`Obrigado! O status do orçamento foi atualizado para: ${status === 'APPROVED' ? 'Aprovado' : status === 'REJECTED' ? 'Reprovado' : 'Em Espera'}.`);
      setOrder({ ...order, status });
    } catch (e: any) {
      alert("Erro ao processar ação: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="animate-pulse space-y-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full mx-auto flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-indigo-400"/></div>
            <p className="text-gray-400 font-medium">Carregando orçamento...</p>
        </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm border border-rose-100">
            <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800">Ops!</h2>
            <p className="text-gray-500 mt-2">{error}</p>
        </div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md border border-emerald-100 animate-scale-up">
            <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">Sucesso!</h2>
            <p className="text-gray-600 mt-4 leading-relaxed font-medium">{success}</p>
            <p className="text-sm text-gray-400 mt-8">Você pode fechar esta janela agora.</p>
        </div>
    </div>
  );

  // Proteção contra renderização sem dados
  if (!order) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-gray-50 font-inter pb-20">
        <header className="bg-white border-b border-gray-100 p-6 sticky top-0 z-10 shadow-sm">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-indigo-100">F</div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-black text-gray-900 uppercase tracking-tighter leading-none">{order.trade_name || order.company_name}</h1>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Portal do Cliente</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    {order.company_phone && <a href={`https://wa.me/${order.company_phone.replace(/\D/g, '')}`} className="text-gray-400 hover:text-emerald-500 transition-colors"><Smartphone className="w-5 h-5"/></a>}
                    {order.company_email && <a href={`mailto:${order.company_email}`} className="text-gray-400 hover:text-indigo-500 transition-colors"><Mail className="w-5 h-5"/></a>}
                </div>
            </div>
        </header>

        <main className="max-w-4xl mx-auto mt-8 px-4 space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-white relative">
                    <ShoppingBag className="absolute right-8 top-8 w-24 h-24 opacity-10" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                             <span className="bg-white/20 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Orçamento #{order.id.substring(0,6).toUpperCase()}</span>
                             <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Aguardando Aprovação</span>
                        </div>
                        <h2 className="text-3xl font-black">{order.description}</h2>
                        <p className="text-indigo-100 mt-2 font-medium opacity-80 flex items-center gap-2"><User className="w-4 h-4"/> Olá, {order.contact_name}!</p>
                    </div>
                </div>

                <div className="p-8">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Package className="w-4 h-4"/> Detalhamento da Proposta</h3>
                    
                    <div className="space-y-4 mb-8">
                        {order.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0">
                                <div className="flex-1 pr-4">
                                    <p className="font-bold text-gray-800">{item.description}</p>
                                    <p className="text-xs text-gray-400 font-medium">{item.quantity} {item.unit || 'un'} × {formatCurrency(item.unitPrice)}</p>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-gray-900">{formatCurrency(item.totalPrice)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-50 rounded-3xl p-8 space-y-3 border border-slate-100 shadow-inner">
                        <div className="flex justify-between text-gray-500 font-medium">
                            <span className="text-sm">Subtotal Bruto</span>
                            <span className="text-sm">{formatCurrency(order.gross_amount || order.amount)}</span>
                        </div>
                        {Number(order.discount_amount) > 0 && (
                            <div className="flex justify-between text-rose-500 font-bold">
                                <span className="text-sm">Desconto Aplicado</span>
                                <span className="text-sm">- {formatCurrency(order.discount_amount)}</span>
                            </div>
                        )}
                        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-lg font-black text-gray-800">Total da Proposta</span>
                            <span className="text-3xl font-black text-indigo-700">{formatCurrency(order.amount)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-8 flex flex-col md:flex-row gap-4 border-t border-gray-100">
                    <button 
                        onClick={() => handleAction('APPROVED')}
                        disabled={actionLoading}
                        className="flex-1 bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        <CheckCircle className="w-6 h-6" /> Aprovar Orçamento
                    </button>
                    <button 
                        onClick={() => handleAction('ON_HOLD')}
                        disabled={actionLoading}
                        className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-5 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        <Clock className="w-6 h-6" /> Colocar em Espera
                    </button>
                    <button 
                        onClick={() => handleAction('REJECTED')}
                        disabled={actionLoading}
                        className="flex-1 bg-rose-50 text-rose-600 py-5 rounded-2xl font-black hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        <XCircle className="w-6 h-6" /> Recusar Proposta
                    </button>
                </div>
            </div>

            <div className="text-center text-gray-400 text-xs font-medium space-y-1">
                <p>Este link é seguro e exclusivo para {order.contact_name}.</p>
                <p>Processado por FinManager Pro © 2024</p>
            </div>
        </main>
    </div>
  );
};

export default PublicOrderView;
