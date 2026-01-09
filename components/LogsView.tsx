
import React, { useEffect, useState } from 'react';
import { AuditLog, NotificationLog, User as UserType } from '../types';
import { getAuditLogs, getNotificationLogs, revertLogChange } from '../services/storageService';
import { 
    ScrollText, RefreshCw, RotateCcw, Clock, User, FileText, 
    CheckCircle, History, AlertTriangle, ArrowRight, MessageSquare, 
    Mail, AlertCircle, Pencil, ShieldCheck, Lock, Trash2, PlusCircle,
    Undo2, Database, ChevronRight
} from 'lucide-react';
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

  const familyId = currentUser.familyId || (currentUser as any).family_id;
  const workspace = currentUser.workspaces?.find(w => w.id === familyId);
  const isAdmin = workspace?.role === 'ADMIN' || currentUser.role === 'ADMIN';

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

  const handleRevert = async (log: AuditLog) => {
      let title = "Reverter Ação";
      let msg = `Deseja desfazer as alterações deste registro?`;
      
      if (log.action === 'CREATE') {
          title = "Desfazer Criação";
          msg = `Atenção: Ao desfazer a criação, o registro "${log.details}" será removido do sistema (Exclusão Lógica).`;
      } else if (log.action === 'DELETE') {
          title = "Restaurar Registro";
          msg = `Deseja restaurar "${log.details}"? Os dados originais e impactos financeiros serão re-aplicados.`;
      }

      const confirm = await showConfirm({
          title,
          message: msg,
          confirmText: "Sim, Desfazer",
          variant: log.action === 'CREATE' ? 'warning' : 'info'
      });

      if (!confirm) return;

      setProcessingId(log.id);
      try {
          await revertLogChange(log.id);
          await loadAuditLogs();
          showAlert("Ação desfeita com sucesso!", "success");
      } catch (e: any) {
          showAlert("Erro ao processar: " + e.message, "error");
      } finally {
          setProcessingId(null);
      }
  };

  const getActionInfo = (action: string) => {
      switch (action) {
          case 'CREATE': return { icon: <PlusCircle className="w-3 h-3"/>, color: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Inserção' };
          case 'UPDATE': return { icon: <Pencil className="w-3 h-3"/>, color: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Alteração' };
          case 'DELETE': return { icon: <Trash2 className="w-3 h-3"/>, color: 'bg-rose-50 text-rose-700 border-rose-100', label: 'Exclusão' };
          case 'RESTORE': return { icon: <RotateCcw className="w-3 h-3"/>, color: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Restauração' };
          case 'REVERT': return { icon: <Undo2 className="w-3 h-3"/>, color: 'bg-purple-50 text-purple-700 border-purple-100', label: 'Reversão' };
          default: return { icon: <Database className="w-3 h-3"/>, color: 'bg-gray-50 text-gray-700 border-gray-100', label: action };
      }
  };

  const maskValue = (key: string, value: any) => {
      if (isAdmin) return String(value ?? '---');
      if (SENSITIVE_FIELDS.includes(key)) return '••••••';
      return String(value ?? '---');
  };

  const filterSensitiveText = (text: string) => {
      if (isAdmin) return text;
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
          branchId: 'Filial',
          pixKey: 'Chave PIX'
      };
      return map[key] || key;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <ScrollText className="w-6 h-6 text-indigo-600" />
                    Auditoria & Conformidade
                </h1>
                <p className="text-gray-500 font-medium">Trilha completa de eventos e reversão de dados.</p>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner">
                    <button 
                        onClick={() => setActiveTab('AUDIT')}
                        className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'AUDIT' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Histórico
                    </button>
                    <button 
                        onClick={() => setActiveTab('NOTIFICATIONS')}
                        className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NOTIFICATIONS' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Comunicação
                    </button>
                </div>
                <button 
                    onClick={activeTab === 'AUDIT' ? loadAuditLogs : loadNotificationLogs} 
                    className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm ml-2"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>

        {/* Banner Privacy */}
        <div className={`p-5 rounded-[2rem] border flex items-center justify-between gap-4 transition-all ${isAdmin ? 'bg-indigo-900 text-white shadow-xl' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${isAdmin ? 'bg-white/10' : 'bg-amber-600 text-white'}`}>
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm font-black uppercase tracking-tight leading-none">
                        {isAdmin ? 'Modo Auditor Master' : 'Segurança de Dados Ativa'}
                    </p>
                    <p className={`text-xs mt-1 font-medium ${isAdmin ? 'text-indigo-200' : 'opacity-80'}`}>
                        {isAdmin 
                            ? 'Você possui privilégios para visualizar valores brutos e desfazer qualquer ação da equipe.' 
                            : 'Valores financeiros foram ofuscados para sua privacidade conforme normas de conformidade.'}
                    </p>
                </div>
            </div>
            {!isAdmin && (
                <div className="flex items-center gap-2 bg-white/50 px-4 py-2 rounded-xl border border-amber-200/50 shadow-sm">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest">LGPD Compliance</span>
                </div>
            )}
        </div>

        {activeTab === 'AUDIT' && (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/50 text-gray-400 font-black uppercase text-[10px] tracking-widest border-b border-gray-100">
                            <tr>
                                <th className="px-8 py-5">Tipo & Ação</th>
                                <th className="px-8 py-5">Registro Afetado</th>
                                <th className="px-8 py-5">Mudanças de Estado</th>
                                <th className="px-8 py-5">Autor da Ação</th>
                                {isAdmin && <th className="px-8 py-5 text-right">Controle</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.map(log => {
                                const actionInfo = getActionInfo(log.action);
                                return (
                                <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter border shadow-sm ${actionInfo.color}`}>
                                            {actionInfo.icon}
                                            {actionInfo.label}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col min-w-[200px]">
                                            <span className="font-bold text-slate-800 line-clamp-1" title={log.details}>
                                                {filterSensitiveText(log.details || 'Sem detalhes')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-black uppercase flex items-center gap-1.5 mt-1.5">
                                                <FileText className="w-3.5 h-3.5" /> {log.entity}
                                                <span className="w-1 h-1 rounded-full bg-slate-200 mx-1"></span>
                                                ID: {log.entityId.substring(0,6).toUpperCase()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {log.changes ? (
                                            <div className="space-y-2 py-1 max-w-[300px]">
                                                {Object.entries(log.changes as Record<string, any>).map(([key, val]) => {
                                                    // Se for criação, mostra apenas o novo valor
                                                    const isCreate = log.action === 'CREATE';
                                                    return (
                                                        <div key={key} className="flex flex-col text-[10px]">
                                                            <span className="font-black text-slate-400 uppercase tracking-tighter mb-1">{formatFieldName(key)}</span>
                                                            <div className="flex items-center gap-2">
                                                                {!isCreate && (
                                                                    <>
                                                                        <span className="text-rose-400 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">{maskValue(key, val.old)}</span>
                                                                        <ChevronRight className="w-3 h-3 text-slate-300" />
                                                                    </>
                                                                )}
                                                                <span className="text-emerald-600 font-black bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                                    {maskValue(key, isCreate ? val : val.new)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        // Fix: Property 'previous_state' does not exist on type 'AuditLog'. Did you mean 'previousState'?
                                        ) : log.previousState ? (
                                            <div className="text-slate-400 text-[10px] font-bold uppercase italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                Captura de estado preservada
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-[10px] font-black uppercase italic tracking-widest">Nenhuma Alteração</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-indigo-600 font-black text-xs shadow-inner">
                                                {log.userName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <p className="text-sm font-bold text-slate-700">{log.userName}</p>
                                                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-medium mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    {isAdmin && (
                                        <td className="px-8 py-6 text-right">
                                            {/* Log reversível se: não for uma reversão, tiver estado salvo OU for criação */}
                                            {log.action !== 'REVERT' && log.action !== 'RESTORE' && (
                                                <button 
                                                    onClick={() => handleRevert(log)}
                                                    disabled={processingId === log.id}
                                                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50 ${
                                                        log.action === 'DELETE' 
                                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' 
                                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {processingId === log.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                                                    {log.action === 'CREATE' ? 'Anular Inserção' : log.action === 'DELETE' ? 'Restaurar Agora' : 'Desfazer Mudança'}
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            )})}
                            {logs.length === 0 && !loading && (
                                <tr><td colSpan={5} className="px-8 py-32 text-center text-slate-300 font-black uppercase tracking-widest text-xs italic">A trilha de auditoria está vazia.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'NOTIFICATIONS' && (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/50 text-gray-400 font-black uppercase text-[10px] tracking-widest border-b border-gray-100">
                            <tr>
                                <th className="px-8 py-5">Status</th>
                                <th className="px-8 py-5">Canal</th>
                                <th className="px-8 py-5">Destinatário</th>
                                <th className="px-8 py-5">Resumo do Conteúdo</th>
                                <th className="px-8 py-5">Sistema/Autor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {notifications.map(notif => (
                                <tr key={notif.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter border ${notif.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                            {notif.status === 'SENT' ? <CheckCircle className="w-3 h-3"/> : <AlertCircle className="w-3 h-3"/>}
                                            {notif.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-slate-600 font-black text-[10px] uppercase tracking-widest">
                                            {notif.channel === 'EMAIL' ? <Mail className="w-4 h-4 text-blue-500"/> : <MessageSquare className="w-4 h-4 text-emerald-500"/>}
                                            {notif.channel}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-slate-700 font-bold">{isAdmin ? notif.recipient : '••••••'}</td>
                                    <td className="px-8 py-6 max-w-xs">
                                        <p className="font-black text-slate-800 text-sm truncate">{notif.subject}</p>
                                        <p className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-1">{filterSensitiveText(notif.content)}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-bold text-slate-700">{notif.userName}</p>
                                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                                {new Date(notif.createdAt).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};

export default LogsView;
