
import React, { useEffect, useState } from 'react';
import { AuditLog, NotificationLog } from '../types';
import { getAuditLogs, getNotificationLogs, restoreRecord, revertLogChange } from '../services/storageService';
import { ScrollText, RefreshCw, RotateCcw, Clock, User, FileText, CheckCircle, History, AlertTriangle, ArrowRight, MessageSquare, Mail, AlertCircle } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

const LogsView: React.FC = () => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'NOTIFICATIONS'>('AUDIT');
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

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
                  (isTransaction ? " O saldo da conta será ajustado automaticamente para refletir esta transação." : "");
      
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
      const isTransaction = log.entity === 'transaction';
      const msg = `Deseja desfazer as alterações deste registro? O estado anterior será reaplicado.` +
                  (isTransaction ? " O sistema tentará ajustar a diferença de valores no saldo da conta, se aplicável." : "");

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

  const getActionLabel = (action: string) => {
      switch (action) {
          case 'CREATE': return 'CRIAÇÃO';
          case 'UPDATE': return 'EDIÇÃO';
          case 'DELETE': return 'EXCLUSÃO';
          case 'RESTORE': return 'RESTAURAÇÃO';
          case 'REVERT': return 'REVERSÃO';
          default: return action;
      }
  }

  const getEntityLabel = (entity: string) => {
      switch(entity) {
          case 'transaction': return 'Transação';
          case 'account': return 'Conta';
          case 'contact': return 'Contato';
          case 'category': return 'Categoria';
          case 'user': return 'Usuário';
          default: return entity;
      }
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
      };
      return map[key] || key;
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ScrollText className="w-6 h-6 text-indigo-600" />
                    Auditoria & Logs
                </h1>
                <p className="text-gray-500">Histórico de alterações e notificações do sistema.</p>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('AUDIT')}
                        className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'AUDIT' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Alterações de Dados
                    </button>
                    <button 
                        onClick={() => setActiveTab('NOTIFICATIONS')}
                        className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'NOTIFICATIONS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Histórico de Envios
                    </button>
                </div>
                <button 
                    onClick={activeTab === 'AUDIT' ? loadAuditLogs : loadNotificationLogs} 
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors shadow-sm ml-2"
                    title="Atualizar Logs"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>

        {activeTab === 'AUDIT' && (
            <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <p className="text-sm text-amber-800">
                        <strong>Atenção:</strong> Reverter ou Restaurar transações antigas afeta o saldo atual das contas. O sistema tentará ajustar automaticamente, mas recomendamos conferir seus saldos após realizar estas operações.
                    </p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading && logs.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">Carregando histórico...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4">Ação</th>
                                        <th className="px-6 py-4">Registro</th>
                                        <th className="px-6 py-4">Detalhes da Alteração</th>
                                        <th className="px-6 py-4">Usuário / Data</th>
                                        <th className="px-6 py-4 text-right">Opções</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 w-24">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${getActionColor(log.action)}`}>
                                                    {getActionLabel(log.action)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 w-48">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-800 truncate max-w-[200px]" title={log.details}>{log.details || 'Sem detalhes'}</span>
                                                    <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <FileText className="w-3 h-3" /> {getEntityLabel(log.entity)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.changes ? (
                                                    <div className="space-y-1">
                                                        {Object.entries(log.changes).map(([key, val]) => (
                                                            <div key={key} className="flex items-center gap-2 text-xs">
                                                                <span className="font-semibold text-gray-500 w-20 truncate">{formatFieldName(key)}:</span>
                                                                <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{String(val.old)}</span>
                                                                <ArrowRight className="w-3 h-3 text-gray-400" />
                                                                <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">{String(val.new)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <User className="w-3 h-3 text-gray-400" />
                                                        {log.userName}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                                                        <Clock className="w-3 h-3 text-gray-300" />
                                                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {log.action === 'DELETE' && log.isDeleted && (
                                                    <button 
                                                        onClick={() => handleRestore(log)}
                                                        disabled={processingId === log.id}
                                                        className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        {processingId === log.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                                        Restaurar
                                                    </button>
                                                )}
                                                
                                                {log.action === 'UPDATE' && log.previousState && !log.isDeleted && (
                                                    <button 
                                                        onClick={() => handleRevert(log)}
                                                        disabled={processingId === log.id}
                                                        className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        {processingId === log.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
                                                        Desfazer
                                                    </button>
                                                )}

                                                {log.action === 'RESTORE' && <span className="text-emerald-600 text-xs flex items-center justify-end gap-1"><CheckCircle className="w-3.5 h-3.5" /> Restaurado</span>}
                                                {log.action === 'REVERT' && <span className="text-purple-600 text-xs flex items-center justify-end gap-1"><RotateCcw className="w-3.5 h-3.5" /> Revertido</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Nenhum registro de auditoria encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </>
        )}

        {activeTab === 'NOTIFICATIONS' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading && notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">Carregando notificações...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Canal</th>
                                    <th className="px-6 py-4">Destinatário</th>
                                    <th className="px-6 py-4">Mensagem</th>
                                    <th className="px-6 py-4">Enviado por</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {notifications.map(notif => (
                                    <tr key={notif.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 w-24">
                                            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${notif.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {notif.status === 'SENT' ? <CheckCircle className="w-3 h-3"/> : <AlertCircle className="w-3 h-3"/>}
                                                {notif.status === 'SENT' ? 'ENVIADO' : 'FALHA'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-gray-600 font-medium">
                                                {notif.channel === 'EMAIL' ? <Mail className="w-4 h-4 text-blue-500"/> : <MessageSquare className="w-4 h-4 text-emerald-500"/>}
                                                {notif.channel}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{notif.recipient}</td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="font-medium text-gray-800 truncate" title={notif.subject}>{notif.subject}</p>
                                            <p className="text-xs text-gray-400 truncate" title={notif.content}>{notif.content}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <User className="w-3 h-3 text-gray-400" />
                                                    {notif.userName}
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-500 text-xs">
                                                    <Clock className="w-3 h-3 text-gray-300" />
                                                    {new Date(notif.createdAt).toLocaleString('pt-BR')}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {notifications.length === 0 && (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Nenhum envio registrado.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default LogsView;
