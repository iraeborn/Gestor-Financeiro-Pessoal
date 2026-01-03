
import React, { useEffect, useState } from 'react';
import { AuditLog, NotificationLog, User as UserType } from '../types';
import { getAuditLogs, getNotificationLogs, restoreRecord, revertLogChange } from '../services/storageService';
import { ScrollText, RefreshCw, RotateCcw, Clock, User, FileText, CheckCircle, History, AlertTriangle, ArrowRight, MessageSquare, Mail, AlertCircle, Pencil, ShieldCheck, EyeOff, Lock } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface LogsViewProps {
    currentUser: UserType;
}

const SENSITIVE_FIELDS = [
    'amount', 'balance', 'creditLimit', 'credit_limit', 
    'pixKey', 'pix_key', 'document', 'phone', 'email',
    'grossAmount', 'discountAmount', 'taxAmount', 'totalAmount'
];

const LogsView: React.FC<LogsViewProps> = ({ currentUser }) => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'NOTIFICATIONS'>('AUDIT');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.id === currentUser.familyId;

  useEffect(() => {
    if (activeTab === 'AUDIT') loadAuditLogs();
    else loadNotificationLogs();
  }, [activeTab]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
        const data = await getAuditLogs();
        setLogs(data);
    } catch (e) {
        console.error("Failed to load audit logs", e);
    } finally {
        setLoading(false);
    }
  };

  const loadNotificationLogs = async () => {
    setLoading(true);
    try {
        const data = await getNotificationLogs();
        setNotifications(data);
    } catch (e) {
        console.error("Failed to load notification logs", e);
    } finally {
        setLoading(false);
    }
  };

  const handleRestore = async (log: AuditLog) => {
      const isTransaction = log.entity === 'transaction';
      const msg = `Deseja restaurar este registro: "${log.details}"?` + 
                  (isTransaction ? " O saldo da conta será ajustado automaticamente." : "");
      
      const confirm = await showConfirm({
          title: "Restaurar Registro",
          message: msg,
          confirmText: "Sim, Restaurar"
      });
      
      if (!confirm) return;
      
      setProcessingId(log.id);
      try {
          await restoreRecord(log.entity, log.entityId);
          await loadAuditLogs(); 
          showAlert("Registro restaurado com sucesso.", "success");
      } catch (e: any) {
          showAlert("Erro ao restaurar: " + e.message, "error");
      } finally {
          setProcessingId(null);
      }
  };

  const handleRevert = async (log: AuditLog) => {
      const msg = `Deseja desfazer as alterações deste registro? O estado anterior será reaplicado.`;
      const confirm = await showConfirm({
          title: "Reverter Alteração",
          message: msg,
          confirmText: "Sim, Reverter"
      });

      if (!confirm) return;

      setProcessingId(log.id);
      try {
          await revertLogChange(log.id);
          await loadAuditLogs();
          showAlert("Alteração revertida com sucesso.", "success");
      } catch (e: any) {
          showAlert("Erro ao reverter: " + e.message, "error");
      } finally {
          setProcessingId(null);
      }
  };

  const getActionColor = (action: string) => {
      switch (action) {
          case 'CREATE': return 'bg-emerald-100 text-emerald-700';
          case 'UPDATE': return 'bg-blue-100 text-blue-700';
          case 'DELETE': return 'bg-rose-100 text-rose-700';
          case 'RESTORE': return 'bg-amber-100 text-amber-700';
          case 'REVERT': return 'bg-purple-100 text-purple-700';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

  const maskValue = (key: string, value: any) => {
      if (isAdmin) return String(value);
      if (SENSITIVE_FIELDS.includes(key)) return '••••••';
      return String(value);
  };

  const filterSensitiveText = (text: string) => {
      if (isAdmin) return text;
      // Regex simples para mascarar padrões monetários (Ex: R$ 1.200,00) em textos
      return text.replace(/R\$\s?(\d{1,3}(\.\d{3})*|\d+)(,\d{2})?/g, 'R$ ••••••');
  };

  const formatFieldName = (key: string) => {
      const map: Record<string, string> = {
          amount: 'Valor',
          description: 'Descrição',
          date: 'Data',
          status: 'Status',
          type: 'Tipo',
          category: 'Categoria',
          accountId: 'Conta',
          name: 'Nome',
          balance: 'Saldo',
          contactId: 'Contato',
          creditLimit: 'Limite',
          pixKey: 'Chave PIX'
      };
      return map[key] || key;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ScrollText className="w-6 h-6 text-indigo-600" />
                    Auditoria & Logs
                </h1>
                <p className="text-gray-500">Rastreamento de integridade e conformidade de dados.</p>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 p-1 rounded-xl shadow-sm">
                    <button 
                        onClick={() => setActiveTab('AUDIT')}
                        className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'AUDIT' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Alterações
                    </button>
                    <button 
                        onClick={() => setActiveTab('NOTIFICATIONS')}
                        className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'NOTIFICATIONS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Envios
                    </button>
                </div>
                <button 
                    onClick={activeTab === 'AUDIT' ? loadAuditLogs : loadNotificationLogs} 
                    className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm ml-2"
                    title="Atualizar Logs"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>

        {/* Banner de Privacidade */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${isAdmin ? 'bg-indigo-50 border-indigo-100 text-indigo-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isAdmin ? 'bg-indigo-600 text-white' : 'bg-amber-600 text-white'}`}>
                    <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-sm font-black uppercase tracking-tight">
                        {isAdmin ? 'Acesso Total de Auditoria' : 'Privacidade de Dados Ativa'}
                    </p>
                    <p className="text-xs opacity-80">
                        {isAdmin 
                            ? 'Você está visualizando todos os valores históricos brutos conforme registrado no banco.' 
                            : 'Valores financeiros e dados sensíveis foram ofuscados para sua segurança.'}
                    </p>
                </div>
            </div>
            {!isAdmin && (
                <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-lg border border-amber-200/50">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest">LGPD Compliance</span>
                </div>
            )}
        </div>

        {activeTab === 'AUDIT' && (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                {loading && logs.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                        <p className="text-gray-400 font-medium">Sincronizando trilha de auditoria...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-5">Ação</th>
                                    <th className="px-6 py-5">Registro</th>
                                    <th className="px-6 py-5">Trilha de Valores</th>
                                    <th className="px-6 py-5">Autor & Data</th>
                                    {isAdmin && <th className="px-6 py-5 text-right">Controle</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col max-w-[250px]">
                                                <span className="font-bold text-gray-800 truncate" title={log.details}>
                                                    {filterSensitiveText(log.details || 'Sem detalhes')}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-black uppercase flex items-center gap-1 mt-1">
                                                    <FileText className="w-3 h-3" /> {log.entity}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.changes ? (
                                                <div className="space-y-1.5 py-1">
                                                    {Object.entries(log.changes as Record<string, any>).map(([key, val]) => (
                                                        <div key={key} className="flex items-center gap-2 text-[11px]">
                                                            <span className="font-black text-gray-400 uppercase tracking-tighter w-20 truncate">{formatFieldName(key)}:</span>
                                                            <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg px-2 py-0.5 shadow-sm">
                                                                <span className="text-rose-400 line-through opacity-60 font-medium">{maskValue(key, val.old)}</span>
                                                                <ArrowRight className="w-3 h-3 text-gray-300" />
                                                                <span className="text-emerald-600 font-black">{maskValue(key, val.new)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs italic tracking-widest font-bold">HISTÓRICO ESTÁTICO</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-gray-700 font-bold">
                                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">{log.userName?.charAt(0)}</div>
                                                    {log.userName}
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-400 text-[10px] font-medium ml-8">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                                                </div>
                                            </div>
                                        </td>
                                        {isAdmin && (
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {log.action === 'DELETE' && log.isDeleted && (
                                                        <button 
                                                            onClick={() => handleRestore(log)}
                                                            disabled={processingId === log.id}
                                                            className="flex items-center gap-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-amber-200"
                                                        >
                                                            {processingId === log.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                            Restaurar
                                                        </button>
                                                    )}
                                                    
                                                    {log.action === 'UPDATE' && log.previousState && !log.isDeleted && (
                                                        <button 
                                                            onClick={() => handleRevert(log)}
                                                            disabled={processingId === log.id}
                                                            className="flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-blue-200"
                                                        >
                                                            {processingId === log.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
                                                            Desfazer
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr><td colSpan={5} className="px-6 py-20 text-center text-gray-300 font-bold uppercase tracking-widest text-xs italic">Nenhum rastro de auditoria encontrado.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'NOTIFICATIONS' && (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Canal</th>
                                <th className="px-6 py-5">Destinatário</th>
                                <th className="px-6 py-5">Mensagem</th>
                                <th className="px-6 py-5">Autor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {notifications.map(notif => (
                                <tr key={notif.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${notif.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                            {notif.status === 'SENT' ? <CheckCircle className="w-3 h-3"/> : <AlertCircle className="w-3 h-3"/>}
                                            {notif.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-gray-600 font-black text-[10px] uppercase">
                                            {notif.channel === 'EMAIL' ? <Mail className="w-4 h-4 text-blue-500"/> : <MessageSquare className="w-4 h-4 text-emerald-500"/>}
                                            {notif.channel}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-medium">{isAdmin ? notif.recipient : '••••••'}</td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <p className="font-bold text-gray-800 truncate">{notif.subject}</p>
                                        <p className="text-[10px] text-gray-400 font-medium truncate mt-1">{filterSensitiveText(notif.content)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-gray-700 font-bold">
                                                <User className="w-3.5 h-3.5 text-gray-300" />
                                                {notif.userName}
                                            </div>
                                            <div className="text-[10px] text-gray-400 ml-5 font-medium">
                                                {new Date(notif.createdAt).toLocaleString('pt-BR')}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {notifications.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-20 text-center text-gray-300 font-bold uppercase tracking-widest text-xs italic">Nenhum envio registrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

export default LogsView;
