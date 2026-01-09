
import React, { useState, useMemo } from 'react';
import { Branch, Salesperson, SalespersonSchedule, AppState } from '../types';
import { 
    CalendarRange, ChevronLeft, ChevronRight, Store, 
    User, Clock, Filter, Search, MoreHorizontal, 
    AlertTriangle, CheckCircle2, UserCircle2, Briefcase, 
    PanelLeft, LayoutGrid, ListFilter, Download, Info
} from 'lucide-react';

interface GlobalScheduleViewProps {
    state: AppState;
    branches: Branch[];
    salespeople: Salesperson[];
    schedules: SalespersonSchedule[];
}

const GlobalScheduleView: React.FC<GlobalScheduleViewProps> = ({ state, branches, salespeople, schedules }) => {
    const [baseDate, setBaseDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('ALL');

    // Gera os dias da semana a partir da baseDate
    const weekDays = useMemo(() => {
        const days = [];
        const startOfWeek = new Date(baseDate);
        startOfWeek.setDate(baseDate.getDate() - baseDate.getDay()); // Domingo

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    }, [baseDate]);

    const weekDatesStr = weekDays.map(d => d.toISOString().split('T')[0]);

    const navigateWeek = (dir: number) => {
        const next = new Date(baseDate);
        next.setDate(baseDate.getDate() + (dir * 7));
        setBaseDate(next);
    };

    const getShiftIcon = (shift: string) => {
        switch(shift) {
            case 'MORNING': return <Clock className="w-3 h-3 text-amber-500" />;
            case 'AFTERNOON': return <Clock className="w-3 h-3 text-indigo-500" />;
            case 'FULL': return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
            default: return null;
        }
    };

    const shiftLabels: any = { 'FULL': 'D', 'MORNING': 'M', 'AFTERNOON': 'T' };

    const filteredBranches = branches.filter(b => 
        (branchFilter === 'ALL' || b.id === branchFilter) &&
        b.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header com Navegação e Filtros */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100">
                            <CalendarRange className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Quadro Global de Escala</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Planejamento Semanal Multiloja</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-white rounded-lg transition-all text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="px-4 py-2 text-[10px] font-black uppercase text-slate-600 min-w-[150px] text-center">
                            Semana de {weekDays[0].toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}
                        </span>
                        <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-white rounded-lg transition-all text-slate-500"><ChevronRight className="w-4 h-4" /></button>
                    </div>

                    <div className="relative flex-1 lg:w-48">
                        <Search className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-3" />
                        <input 
                            type="text" 
                            placeholder="Buscar filial..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>

                    <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Quadro de Escala (Matriz) */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-gray-100">
                            <tr>
                                <th className="p-6 sticky left-0 bg-slate-50 z-10 w-64 border-r border-gray-100">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <Store className="w-3.5 h-3.5" /> Filial / Unidade
                                    </div>
                                </th>
                                {weekDays.map((day, idx) => {
                                    const isToday = day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                                    return (
                                        <th key={idx} className={`p-4 text-center min-w-[140px] ${isToday ? 'bg-indigo-50/50' : ''}`}>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                                                <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{day.getDate()} {day.toLocaleDateString('pt-BR', { month: 'short' }).replace('.','')}</span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredBranches.map(branch => (
                                <tr key={branch.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="p-6 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 border-r border-gray-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm" style={{ backgroundColor: branch.color || '#4f46e5' }}>
                                                {branch.code || branch.name.charAt(0)}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-gray-800 text-sm truncate">{branch.name}</p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{branch.city || '---'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {weekDatesStr.map((dateStr, dIdx) => {
                                        const daySchedules = schedules.filter(s => s.branchId === branch.id && s.date === dateStr);
                                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                                        const hasPeople = daySchedules.length > 0;

                                        return (
                                            <td key={dIdx} className={`p-3 align-top min-h-[120px] ${isToday ? 'bg-indigo-50/20' : ''}`}>
                                                <div className="space-y-1.5">
                                                    {daySchedules.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-4 opacity-10 grayscale">
                                                            <AlertTriangle className="w-4 h-4 text-rose-500 mb-1" />
                                                            <span className="text-[8px] font-black uppercase text-slate-400">Sem Escala</span>
                                                        </div>
                                                    ) : (
                                                        daySchedules.map(sch => (
                                                            <div key={sch.id} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm hover:shadow-md transition-all group/card relative overflow-hidden">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 uppercase border border-indigo-100">
                                                                        {sch.salespersonName?.charAt(0)}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[10px] font-bold text-slate-700 truncate" title={sch.salespersonName}>{sch.salespersonName?.split(' ')[0]}</p>
                                                                    </div>
                                                                    <div className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 flex items-center gap-1">
                                                                        {getShiftIcon(sch.shift)}
                                                                        <span className="text-[8px] font-black text-slate-600">{shiftLabels[sch.shift]}</span>
                                                                    </div>
                                                                </div>
                                                                {sch.notes && (
                                                                    <div className="mt-1.5 pt-1.5 border-t border-slate-50 flex items-center gap-1.5">
                                                                        {/* Fix: Using imported Info icon */}
                                                                        <Info className="w-2.5 h-2.5 text-slate-300" />
                                                                        <span className="text-[8px] text-slate-400 font-medium truncate italic" title={sch.notes}>{sch.notes}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legenda e Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-1">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ListFilter className="w-4 h-4 text-indigo-500" /> Legenda de Turnos
                    </h4>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase">Dia Todo (D)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase">Manhã (M)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm"></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase">Tarde (T)</span>
                        </div>
                    </div>
                </div>

                <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex items-start gap-4">
                    {/* Fix: Using imported Info icon */}
                    <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">Dica de Gestão</h4>
                        <p className="text-[10px] text-indigo-800 leading-relaxed font-medium">
                            Acompanhe se alguma unidade está sem cobertura de vendas (Alerta Vermelho). Utilize a visualização global para redistribuir a equipe conforme o fluxo esperado de cada loja.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[2rem] text-white flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Estatística da Semana</p>
                        <h4 className="text-xl font-black">{schedules.filter(s => weekDatesStr.includes(s.date)).length} Alocações</h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Total de turnos preenchidos no período</p>
                    </div>
                    <Briefcase className="w-10 h-10 text-slate-700" />
                </div>
            </div>
        </div>
    );
};

export default GlobalScheduleView;
