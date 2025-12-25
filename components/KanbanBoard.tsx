
import React from 'react';
import { KanbanItem, KanbanColumnConfig, OSPriority } from '../types';
import { User, Clock, DollarSign, MoreHorizontal, Zap, AlertCircle } from 'lucide-react';

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

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin min-h-[600px] items-start">
      {columns.map(column => {
          const columnItems = items.filter(i => i.status === column.id);
          
          return (
            <div key={column.id} className="flex-shrink-0 w-80 bg-gray-100/50 rounded-[2rem] border border-gray-200 flex flex-col max-h-full">
                {/* Column Header */}
                <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${column.color}`}></div>
                        <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">{column.label}</h3>
                    </div>
                    <span className="bg-white border border-gray-200 px-2.5 py-0.5 rounded-full text-[10px] font-black text-gray-400">
                        {columnItems.length}
                    </span>
                </div>

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[100px]">
                    {columnItems.map(item => (
                        <div 
                            key={item.id}
                            onClick={() => onItemClick(item.raw || item)}
                            className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            {/* Priority Indicator Line */}
                            <div className={`absolute top-0 left-0 bottom-0 w-1 ${getPriorityColor(item.priority)}`}></div>

                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">#{item.id.substring(0,6)}</span>
                                <button className="p-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-600 transition-all">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>

                            <h4 className="text-sm font-bold text-gray-900 leading-tight mb-2 line-clamp-2">{item.title}</h4>
                            
                            {item.subtitle && (
                                <div className="flex items-center gap-1.5 text-gray-500 mb-3">
                                    <User className="w-3 h-3" />
                                    <span className="text-xs font-medium truncate">{item.subtitle}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
                                <div className="flex items-center gap-2">
                                    {item.amount !== undefined && (
                                        <div className="flex items-center text-xs font-black text-gray-800">
                                            {formatCurrency(item.amount)}
                                        </div>
                                    )}
                                </div>
                                
                                {item.date && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                        <Clock className="w-3 h-3" />
                                        {new Date(item.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}
                                    </div>
                                )}
                            </div>

                            {/* Tags Section */}
                            {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                    {item.tags.map((tag, idx) => (
                                        <span key={idx} className="bg-gray-50 text-gray-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-gray-100 tracking-tighter">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {columnItems.length === 0 && (
                        <div className="py-8 text-center">
                            <div className="w-8 h-8 border-2 border-dashed border-gray-200 rounded-lg mx-auto mb-2"></div>
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Vazio</span>
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
