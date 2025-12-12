
import React, { useEffect, useState } from 'react';
import { AuditLog } from '../types';
import { getAuditLogs, restoreRecord } from '../services/storageService';
import { ScrollText, RefreshCw, RotateCcw, Clock, User, FileText, CheckCircle } from 'lucide-react';

const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
        const data = await getAuditLogs();
        setLogs(data);
    } catch (e) {
        console.error("Failed to load logs", e);
    } finally {
        setLoading(false);
    }
  };

  const handleRestore = async (log: AuditLog) => {
      if (!window.confirm(`Deseja restaurar este registro: ${log.details}?`)) return;
      
      setRestoringId(log.id);
      try {
          await restoreRecord(log.entity, log.entityId);
          await loadLogs(); // Reload to show new state
          alert("Registro restaurado com sucesso. Recarregue a página para ver os dados restaurados nas outras telas.");
      } catch (e: any) {
          alert("Erro ao restaurar: " + e.message);
      } finally {
          setRestoringId(null);
      }
  };

  const getActionColor = (action: string) => {
      switch (action) {
          case 'CREATE': return 'bg-emerald-100 text-emerald-700';
          case 'UPDATE': return 'bg-blue-100 text-blue-700';
          case 'DELETE': return 'bg-rose-100 text-rose-700';
          case 'RESTORE': return 'bg-amber-100 text-amber-700';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

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

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ScrollText className="w-6 h-6 text-indigo-600" />
                    Auditoria & Logs
                </h1>
                <p className="text-gray-500">Histórico completo de alterações e restauração de dados.</p>
            </div>
            <button 
                onClick={loadLogs} 
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"
                title="Atualizar Logs"
            >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
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
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4 text-right">Opções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${getActionColor(log.action)}`}>
                                            {log.action === 'CREATE' ? 'CRIAÇÃO' : 
                                             log.action === 'UPDATE' ? 'EDIÇÃO' : 
                                             log.action === 'DELETE' ? 'EXCLUSÃO' : 'RESTAURAÇÃO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-800">{log.details || 'Sem detalhes'}</span>
                                            <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                <FileText className="w-3 h-3" /> {getEntityLabel(log.entity)} #{log.entityId.slice(0,8)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <User className="w-4 h-4 text-gray-400" />
                                            {log.userName}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-300" />
                                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {log.action === 'DELETE' && log.isDeleted && (
                                            <button 
                                                onClick={() => handleRestore(log)}
                                                disabled={restoringId === log.id}
                                                className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                {restoringId === log.id ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                )}
                                                Restaurar
                                            </button>
                                        )}
                                        {log.action === 'RESTORE' && (
                                            <span className="text-emerald-600 text-xs flex items-center justify-end gap-1">
                                                <CheckCircle className="w-3.5 h-3.5" /> Restaurado
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Nenhum registro de auditoria encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
};

export default LogsView;
