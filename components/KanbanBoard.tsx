
import React from 'react';
import { KanbanItem, KanbanColumnConfig, OSPriority } from '../types';
import { User, Clock, MoreHorizontal, Zap, ChevronRight, ChevronLeft, UserCog } from 'lucide-react';

interface KanbanBoardProps {
  items: KanbanItem[];
  columns: KanbanColumnConfig[];
  onItemClick: (item: any) => void;
  onStatusChange?: (itemId: string, newStatus: string) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ items, columns, onItemClick, onStatusChange }) => {
  
  const formatCurrency = (val?: number) => 
    val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '';

  const getPriorityColor = (p?: OSPriority) => {
      switch(p) {
          case 'BAIXA': return 'bg-emerald-500';
          case 'MEDIA': return 'bg-blue-500';
          case 'ALTA': return 'bg-orange-500';
          case 'URGENTE': return 'bg-rose-600 animate-pulse';
          default: return 'bg-gray-300';
      }
  };

  const moveStatus = (e: React.MouseEvent, itemId: string, currentStatus: string, direction: 'NEXT' | 'PREV') => {
      e.stopPropagation();
      if (!onStatusChange) return;

      const currentIndex = columns.findIndex(c => c.id === currentStatus);
      if (direction === 'NEXT' && currentIndex < columns.length - 1) {
          onStatusChange(itemId, columns[currentIndex + 1].id);
      } else if (direction === 'PREV' && currentIndex > 0) {
          onStatusChange(itemId, columns[currentIndex - 1].id);
      }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-10 scrollbar-thin min-h-[650px] items-start select-none w-full">
      {columns.map((column, colIdx) => {
          const columnItems = items.filter(i => i.status === column.id);
          
          return (
            <div key={column.id} className="flex-shrink-0 w-80 bg-gray-100/50 rounded-xl border border-gray-200/50 flex flex-col max-h-[calc(100vh-250px)] transition-all">
                {/* Column Header */}
                <div className="p-5 flex items-center justify-between sticky top-0 bg-transparent backdrop-blur-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${column.color}`}></div>
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">{column.label}</h3>
                    </div>
                    <span className="bg-white border border-gray-100 px-2 py-0.5 rounded-md text-[10px] font-black text-gray-400 shadow-sm">
                        {columnItems.length}
                    </span>
                </div>

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px] scrollbar-thin">
                    {columnItems.map(item => (
                        <div 
                            key={item.id}
                            onClick={() => onItemClick(item.raw || item)}
                            className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer group relative overflow-hidden animate-scale-up"
                        >
                            {/* Priority Indicator Line */}
                            <div className={`absolute top-0 left-0 bottom-0 w-1 ${getPriorityColor(item.priority)}`}></div>

                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded">#{item.id.substring(0,6)}</span>
                                <button className="p-1 text-gray-300 hover:text-indigo-600 transition-all">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <h4 className="text-sm font-bold text-gray-800 leading-tight mb-2 line-clamp-2">{item.title}</h4>
                            
                            {item.subtitle && (
                                <div className="flex items-center gap-1.5 text-gray-500 mb-3 bg-gray-50 p-1.5 rounded-md">
                                    <User className="w-3 h-3 text-indigo-400" />
                                    <span className="text-[10px] font-bold truncate">{item.subtitle}</span>
                                </div>
                            )}

                            {item.assigneeName && (
                                <div className="flex items-center gap-1.5 text-emerald-600 mb-3 bg-emerald-50/50 p-1.5 rounded-md border border-emerald-100/50">
                                    <UserCog className="w-3 h-3" />
                                    <span className="text-[10px] font-black truncate uppercase tracking-tighter">{item.assigneeName}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
                                <div className="text-[11px] font-black text-slate-900">
                                    {formatCurrency(item.amount)}
                                </div>
                                
                                {item.date && (
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase">
                                        <Clock className="w-2.5 h-2.5" />
                                        {new Date(item.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}
                                    </div>
                                )}
                            </div>

                            {/* Quick Actions (Status Move) */}
                            <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                {colIdx > 0 && (
                                    <button 
                                        onClick={(e) => moveStatus(e, item.id, item.status, 'PREV')}
                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-md text-[8px] font-black uppercase transition-colors"
                                    >
                                        <ChevronLeft className="w-2.5 h-2.5" /> Voltar
                                    </button>
                                )}
                                {colIdx < columns.length - 1 && (
                                    <button 
                                        onClick={(e) => moveStatus(e, item.id, item.status, 'NEXT')}
                                        className="flex-[2] flex items-center justify-center gap-1 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-md text-[8px] font-black uppercase transition-all shadow-sm"
                                    >
                                        Próximo <ChevronRight className="w-2.5 h-2.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {columnItems.length === 0 && (
                        <div className="py-10 text-center border-2 border-dashed border-gray-200/50 rounded-lg m-2">
                            <div className="w-8 h-8 bg-white rounded-full shadow-sm mx-auto mb-2 flex items-center justify-center">
                                <Zap className="w-3.5 h-3.5 text-gray-200" />
                            </div>
                            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest italic">Vazio</span>
                        </div>
                    )}
                </div>
            </div>
          );
      })}
    </div>
  );
};

export default KanbanBoard;
