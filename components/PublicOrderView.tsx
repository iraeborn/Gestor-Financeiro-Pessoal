
import React, { useState, useEffect } from 'react';
import { getPublicOrder, updatePublicOrderStatus } from '../services/storageService';
import { ShoppingBag, CheckCircle, XCircle, Clock, Info, User, Package, Calculator, ReceiptText, Smartphone, Mail, Globe, Lock } from 'lucide-react';

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
      setError(e.message || 'Orçamento não encontrado ou link expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (status: string) => {
    setActionLoading(true);
    try {
      await updatePublicOrderStatus(token, status);
      setSuccess(`Recebemos sua resposta! O status do orçamento foi atualizado para: ${status === 'APPROVED' ? 'Aprovado' : status === 'REJECTED' ? 'Recusado' : 'Em Espera'}.`);
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
            <p className="text-gray-400 font-medium">Sincronizando proposta...</p>
        </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-sm border border-rose-100 animate-fade-in">
            <div className="w-20 h-20 bg-rose-50 rounded-full mx-auto flex items-center justify-center mb-6">
                <Lock className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">Acesso Indisponível</h2>
            <p className="text-gray-500 mt-4 leading-relaxed">{error}</p>
            <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400">Se você acredita que isso é um erro, entre em contato com o fornecedor.</p>
            </div>
        </div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md border border-emerald-100 animate-scale-up">
            <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">Resposta Enviada!</h2>
            <p className="text-gray-600 mt-4 leading-relaxed font-medium">{success}</p>
            <p className="text-sm text-gray-400 mt-8">Nossa equipe entrará em contato em breve.</p>
        </div>
    </div>
  );

  if (!order) return null;

  const isFinalized = order.status === 'APPROVED' || order.status === 'CONFIRMED';
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-gray-50 font-inter pb-20 animate-fade-in">
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
                    {order.company_phone && <a href={`https://wa.me/${order.company_phone.replace(/\D/g, '')}`} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><Smartphone className="w-5 h-5"/></a>}
                    {order.company_email && <a href={`mailto:${order.company_email}`} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"><Mail className="w-5 h-5"/></a>}
                </div>
            </div>
        </header>

        <main className="max-w-4xl mx-auto mt-8 px-4 space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-10 text-white relative">
                    <ShoppingBag className="absolute right-10 top-10 w-32 h-32 opacity-10" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                             <span className="bg-white/20 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">OS #{order.id.substring(0,8).toUpperCase()}</span>
                             <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isFinalized ? 'bg-emerald-400 text-emerald-900' : 'bg-amber-400 text-amber-900'}`}>
                                {isFinalized ? 'Proposta Aprovada' : 'Aguardando sua Análise'}
                             </span>
                        </div>
                        <h2 className="text-4xl font-black leading-tight">{order.description}</h2>
                        <p className="text-indigo-100 mt-4 font-medium opacity-90 flex items-center gap-2 text-lg"><User className="w-5 h-5"/> Olá, {order.contact_name}!</p>
                    </div>
                </div>

                <div className="p-8 md:p-12">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Package className="w-4 h-4"/> Detalhamento da Proposta</h3>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Snapshot de Valores: V.1.0</span>
                    </div>
                    
                    <div className="space-y-1 mb-8">
                        {order.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center py-5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 px-2 rounded-xl transition-colors">
                                <div className="flex-1 pr-6">
                                    <p className="font-bold text-gray-800 text-lg">{item.description}</p>
                                    <p className="text-sm text-gray-500 font-medium mt-1">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded mr-2">{item.quantity} {item.unit || 'un'}</span>
                                        × {formatCurrency(item.unitPrice)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-gray-900 text-xl">{formatCurrency(item.totalPrice)}</span>
                                </div>
                            </div>
                        ))}
                        {(!order.items || order.items.length === 0) && (
                            <div className="py-10 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                <p className="text-gray-400 font-medium">Nenhum item detalhado disponível para esta proposta.</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-900 rounded-[2rem] p-10 text-white space-y-4 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        
                        <div className="flex justify-between items-center opacity-60 text-sm font-bold uppercase tracking-widest">
                            <span>Subtotal Bruto</span>
                            <span>{formatCurrency(order.gross_amount || order.amount)}</span>
                        </div>
                        
                        {Number(order.discount_amount) > 0 && (
                            <div className="flex justify-between items-center text-rose-400 font-bold text-sm uppercase tracking-widest">
                                <span>Desconto Negociado</span>
                                <span>- {formatCurrency(order.discount_amount)}</span>
                            </div>
                        )}
                        
                        <div className="pt-6 mt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <span className="text-indigo-400 text-xs font-black uppercase tracking-[0.2em] block mb-1">Total do Investimento</span>
                                <span className="text-5xl font-black">{formatCurrency(order.amount)}</span>
                            </div>
                            <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10 text-xs font-bold flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400" />
                                <span>Válido até: {new Date(new Date(order.date).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {!isFinalized ? (
                    <div className="bg-gray-100 p-8 md:p-12 flex flex-col md:flex-row gap-4 border-t border-gray-200">
                        <button 
                            onClick={() => handleAction('APPROVED')}
                            disabled={actionLoading}
                            className="flex-[2] bg-emerald-600 text-white py-6 rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            <CheckCircle className="w-7 h-7" /> Aceitar Proposta
                        </button>
                        <button 
                            onClick={() => handleAction('ON_HOLD')}
                            disabled={actionLoading}
                            className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-6 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            <Clock className="w-5 h-5" /> Tenho Dúvidas
                        </button>
                        <button 
                            onClick={() => handleAction('REJECTED')}
                            disabled={actionLoading}
                            className="flex-1 bg-rose-50 text-rose-600 py-6 rounded-2xl font-black hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            <XCircle className="w-5 h-5" /> Recusar
                        </button>
                    </div>
                ) : (
                    <div className="bg-emerald-50 p-8 md:p-12 flex flex-col items-center text-center gap-4 border-t border-emerald-100">
                        <div className="p-4 bg-emerald-100 rounded-full">
                            <CheckCircle className="w-10 h-10 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-emerald-900">Proposta já Processada</h3>
                            <p className="text-emerald-700 font-medium max-w-sm mt-1">Este orçamento foi {order.status === 'APPROVED' ? 'Aprovado' : 'Confirmado'} e está seguindo para faturamento.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest space-y-2 opacity-50">
                <p>Este link é seguro e exclusivo para o cliente {order.contact_name}.</p>
                <p>Tecnologia FinManager Pro • Todos os Direitos Reservados</p>
            </div>
        </main>
    </div>
  );
};

export default PublicOrderView;
