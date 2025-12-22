
import React, { useState, useEffect, useRef } from 'react';
import { getPublicOrder, updatePublicOrderStatus } from '../services/storageService';
import { ShoppingBag, CheckCircle, XCircle, Clock, Info, User, Package, Calculator, ReceiptText, Smartphone, Mail, Globe, Lock, Loader2, AlertCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface PublicOrderViewProps {
  token: string;
}

const PublicOrderView: React.FC<PublicOrderViewProps> = ({ token }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{msg: string, type: 'error' | 'success'} | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const loadOrder = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getPublicOrder(token);
      setOrder(data);
    } catch (e: any) {
      setError(e.message || 'Orçamento não encontrado ou link expirado.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [token]);

  useEffect(() => {
    if (order?.workspace_id || order?.family_id || order?.user_id) {
        const targetRoom = order.workspace_id || order.family_id || order.user_id;
        
        if (socketRef.current) socketRef.current.disconnect();

        const socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join_family', targetRoom);
        });

        socket.on('DATA_UPDATED', (payload) => {
            if (payload.entity === 'order' && payload.entityId === order.id) {
                if (!actionLoading) {
                    loadOrder(true);
                }
            }
        });

        return () => { socket.disconnect(); };
    }
  }, [order?.id, order?.workspace_id, order?.family_id, order?.user_id, actionLoading]);

  const handleAction = async (status: string) => {
    if (actionLoading) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await updatePublicOrderStatus(token, status);
      setSuccess(`Proposta atualizada! O status agora é: ${status === 'APPROVED' ? 'Aprovado' : status === 'REJECTED' ? 'Recusado' : 'Em Análise'}.`);
      setOrder({ ...order, status });
    } catch (e: any) {
      setFeedback({ msg: "Não foi possível enviar sua resposta: " + e.message, type: 'error' });
    } finally {
      setTimeout(() => setActionLoading(false), 1500);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="animate-pulse space-y-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full mx-auto flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-indigo-400"/></div>
            <p className="text-gray-400 font-medium">Carregando sua proposta...</p>
        </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-sm border border-rose-100 animate-fade-in">
            <div className="w-20 h-20 bg-rose-50 rounded-full mx-auto flex items-center justify-center mb-6">
                <Lock className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">Link Indisponível</h2>
            <p className="text-gray-500 mt-4 leading-relaxed">{error}</p>
            <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400">Este link pode ter expirado ou o orçamento foi removido pelo gestor.</p>
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
            <h2 className="text-2xl font-black text-gray-900">Tudo certo!</h2>
            <p className="text-gray-600 mt-4 leading-relaxed font-medium">{success}</p>
            <p className="text-sm text-gray-400 mt-8">Obrigado pela sua resposta. O gestor já foi notificado em tempo real.</p>
        </div>
    </div>
  );

  if (!order) return null;

  const isFinalized = ['APPROVED', 'CONFIRMED', 'CANCELED', 'REJECTED'].includes(order.status);
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-gray-50 font-inter pb-20 animate-fade-in">
        <header className="bg-white border-b border-gray-100 p-6 sticky top-0 z-10 shadow-sm">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-indigo-100">F</div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-black text-gray-900 uppercase tracking-tighter leading-none">{order.trade_name || order.company_name}</h1>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Proposta Digital</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    {order.company_phone && <a href={`https://wa.me/${order.company_phone.replace(/\D/g, '')}`} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><Smartphone className="w-5 h-5"/></a>}
                    {order.company_email && <a href={`mailto:${order.company_email}`} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"><Mail className="w-5 h-5"/></a>}
                </div>
            </div>
        </header>

        <main className="max-w-4xl mx-auto mt-8 px-4 space-y-6">
            {feedback && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-slide-in-top ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                    {feedback.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    <p className="text-sm font-bold">{feedback.msg}</p>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-10 text-white relative">
                    <ShoppingBag className="absolute right-10 top-10 w-32 h-32 opacity-10" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                             <span className="bg-white/20 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Ref: #${order.id.substring(0,8).toUpperCase()}</span>
                             <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isFinalized ? 'bg-emerald-400 text-emerald-900' : 'bg-amber-400 text-amber-900'}`}>
                                {order.status === 'APPROVED' ? 'Aprovada' : order.status === 'CONFIRMED' ? 'Confirmada' : order.status === 'REJECTED' ? 'Recusada' : 'Aguardando Análise'}
                             </span>
                        </div>
                        <h2 className="text-4xl font-black leading-tight">{order.description}</h2>
                        <p className="text-indigo-100 mt-4 font-medium opacity-90 flex items-center gap-2 text-lg"><User className="w-5 h-5"/> Olá, {order.contact_name}!</p>
                    </div>
                </div>

                <div className="p-8 md:p-12">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Package className="w-4 h-4"/> Detalhamento da Proposta</h3>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Valores Fixados</span>
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
                    </div>

                    <div className="bg-slate-900 rounded-[2rem] p-10 text-white space-y-4 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        
                        <div className="flex justify-between items-center opacity-60 text-sm font-bold uppercase tracking-widest">
                            <span>Subtotal</span>
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
                                <span className="text-indigo-400 text-xs font-black uppercase tracking-[0.2em] block mb-1">Total da Proposta</span>
                                <span className="text-5xl font-black">{formatCurrency(order.amount)}</span>
                            </div>
                            <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10 text-xs font-bold flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400" />
                                <span>Expira em: {new Date(new Date(order.date).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</span>
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
                            {actionLoading ? <Loader2 className="animate-spin w-7 h-7" /> : <CheckCircle className="w-7 h-7" />}
                            Aceitar e Aprovar
                        </button>
                        <button 
                            onClick={() => handleAction('ON_HOLD')}
                            disabled={actionLoading}
                            className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-6 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            Dúvidas
                        </button>
                        <button 
                            onClick={() => handleAction('REJECTED')}
                            disabled={actionLoading}
                            className="flex-1 bg-rose-50 text-rose-600 py-6 rounded-2xl font-black hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            Recusar
                        </button>
                    </div>
                ) : (
                    <div className="bg-emerald-50 p-8 md:p-12 flex flex-col items-center text-center gap-4 border-t border-emerald-100">
                        <div className="p-4 bg-emerald-100 rounded-full">
                            <CheckCircle className="w-10 h-10 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-emerald-900">Proposta Concluída</h3>
                            <p className="text-emerald-700 font-medium max-w-sm mt-1">Este orçamento já foi respondido e está em processamento.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest space-y-2 opacity-50">
                <p>Link de acesso exclusivo e rastreado para {order.contact_name}.</p>
                <p>FinManager Pro Security • Ambiente Criptografado</p>
            </div>
        </main>
    </div>
  );
};

export default PublicOrderView;
