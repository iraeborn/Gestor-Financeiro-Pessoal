
import React, { useRef, useState } from 'react';
import { KanbanItem, KanbanColumnConfig, OSPriority } from '../types';
import { User, Clock, MoreHorizontal, Zap, ChevronRight, ChevronLeft, UserCog, GripVertical } from 'lucide-react';

interface KanbanBoardProps {
  items: KanbanItem[];
  columns: KanbanColumnConfig[];
  onItemClick: (item: any) => void;
  onStatusChange?: (itemId: string, newStatus: string) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ items, columns, onItemClick, onStatusChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // --- Lógica de Arrastar para Scroll Horizontal ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // Só inicia o scroll se clicar no fundo do container ou entre as colunas
    const target = e.target as HTMLElement;
    if (target !== containerRef.current && !target.classList.contains('kanban-column')) return;
    
    setIsScrolling(true);
    setStartX(e.pageX - (containerRef.current?.offsetLeft || 0));
    setScrollLeft(containerRef.current?.scrollLeft || 0);
  };

  const handleMouseLeaveOrUp = () => {
    setIsScrolling(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isScrolling || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - (containerRef.current.offsetLeft || 0);
    const walk = (x - startX) * 1.5; // Velocidade do scroll
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  // --- Lógica de Drag and Drop de Cards ---
  const onDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.setData('itemId', itemId);
    e.dataTransfer.effectAllowed = 'move';
    
    // Pequeno delay para o efeito visual de sumiço do original
    setTimeout(() => {
        (e.target as HTMLElement).style.opacity = '0.4';
    }, 0);
  };

  const onDragEnd = (e: React.DragEvent) => {
    setDraggedItemId(null);
    (e.target as HTMLElement).style.opacity = '1';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    if (itemId && onStatusChange) {
        onStatusChange(itemId, newStatus);
    }
  };

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
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeaveOrUp}
      onMouseUp={handleMouseLeaveOrUp}
      onMouseMove={handleMouseMove}
      className={`flex gap-6 overflow-x-auto pb-8 min-h-[700px] items-start w-full transition-all select-none scrollbar-thin ${isScrolling ? 'cursor-grabbing' : 'cursor-default'}`}
      style={{ scrollBehavior: isScrolling ? 'auto' : 'smooth' }}
    >
      {columns.map((column) => {
          const columnItems = items.filter(i => i.status === column.id);
          
          return (
            <div 
                key={column.id} 
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, column.id)}
                className="kanban-column flex-shrink-0 w-80 bg-slate-100/60 rounded-xl border border-slate-200/50 flex flex-col max-h-[calc(100vh-200px)] transition-all"
            >
                {/* Column Header */}
                <div className="p-5 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${column.color}`}></div>
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{column.label}</h3>
                    </div>
                    <span className="bg-white border border-slate-100 px-2 py-0.5 rounded-md text-[10px] font-black text-slate-400 shadow-sm">
                        {columnItems.length}
                    </span>
                </div>

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] scrollbar-thin">
                    {columnItems.map(item => (
                        <div 
                            key={item.id}
                            draggable="true"
                            onDragStart={(e) => onDragStart(e, item.id)}
                            onDragEnd={onDragEnd}
                            onClick={() => onItemClick(item.raw || item)}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden animate-scale-up"
                        >
                            {/* Priority Indicator Line */}
                            <div className={`absolute top-0 left-0 bottom-0 w-1 ${getPriorityColor(item.priority)}`}></div>

                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-1">
                                    <GripVertical className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded">#{item.id.substring(0,6)}</span>
                                </div>
                                <button className="p-1 text-slate-300 hover:text-indigo-600 transition-all">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <h4 className="text-sm font-bold text-slate-800 leading-tight mb-2 line-clamp-2">{item.title}</h4>
                            
                            {item.subtitle && (
                                <div className="flex items-center gap-1.5 text-slate-500 mb-3 bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
                                    <User className="w-3 h-3 text-indigo-400" />
                                    <span className="text-[10px] font-bold truncate">{item.subtitle}</span>
                                </div>
                            )}

                            {item.assigneeName && (
                                <div className="flex items-center gap-1.5 text-emerald-600 mb-3 bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100/50">
                                    <UserCog className="w-3 h-3" />
                                    <span className="text-[10px] font-black truncate uppercase tracking-tighter">{item.assigneeName}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                                <div className="text-[11px] font-black text-slate-900">
                                    {formatCurrency(item.amount)}
                                </div>
                                
                                {item.date && (
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                                        <Clock className="w-2.5 h-2.5" />
                                        {new Date(item.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {columnItems.length === 0 && (
                        <div className="py-12 text-center border-2 border-dashed border-slate-200/50 rounded-xl m-2 opacity-50">
                            <Zap className="w-5 h-5 text-slate-300 mx-auto mb-2" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Vazio</span>
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
