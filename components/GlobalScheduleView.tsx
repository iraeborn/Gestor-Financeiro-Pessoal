
import React, { useState, useMemo } from 'react';
import { Branch, Salesperson, SalespersonSchedule, AppState } from '../types';
// Added RefreshCw to lucide-react imports
import { 
    CalendarRange, ChevronLeft, ChevronRight, Store, 
    User, Clock, Filter, Search, MoreHorizontal, 
    AlertTriangle, CheckCircle2, UserCircle2, Briefcase, 
    PanelLeft, LayoutGrid, ListFilter, Download, Info, Plus, X, Save, Trash2, UserPlus, Check, RefreshCw
} from 'lucide-react';
import { api } from '../services/storageService';
import { useAlert, useConfirm } from './AlertSystem';

interface GlobalScheduleViewProps {
    state: AppState;
    branches: Branch[];
    salespeople: Salesperson[];
    schedules: SalespersonSchedule[];
    onRefresh: () => void;
}

const GlobalScheduleView: React.FC<GlobalScheduleViewProps> = ({ state, branches, salespeople, schedules, onRefresh }) => {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    
    const [baseDate, setBaseDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('ALL');

    // Estado do Modal de Gestão
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Partial<SalespersonSchedule>>({});

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

    const handleOpenAdd = (branchId: string, date: string) => {
        setEditingSchedule({
            branchId,
            date,
            shift: 'FULL'
        });
        setIsModalOpen(true);
    };

    const handleEdit = (sch: SalespersonSchedule) => {
        setEditingSchedule(sch);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        const confirm = await showConfirm({
            title: "Remover da Escala",
            message: "Deseja remover este colaborador deste turno?",
            variant: "danger"
        });
        if (confirm) {
            try {
                await api.deleteSalespersonSchedule(id);
                onRefresh();
                setIsModalOpen(false);
                showAlert("Escala removida.", "success");
            } catch (e) {
                showAlert("Erro ao remover.", "error");
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSchedule.salespersonId || !editingSchedule.branchId || !editingSchedule.date) {
            return showAlert("Preencha todos os campos obrigatórios.", "warning");
        }

        setIsSaving(true);
        try {
            const salesperson = salespeople.find(s => s.id === editingSchedule.salespersonId);
            const branch = branches.find(b => b.id === editingSchedule.branchId);

            // Verificação de conflito (Exceto se for edição do mesmo registro)
            const conflict = schedules.find(s => 
                s.salespersonId === editingSchedule.salespersonId && 
                s.date === editingSchedule.date && 
                s.id !== editingSchedule.id
            );

            if (conflict) {
                setIsSaving(false);
                return showAlert(`Conflito: Este colaborador já está na filial ${conflict.branchName || '---'} neste dia.`, "error");
            }

            await api.saveSalespersonSchedule({
                ...editingSchedule,
                id: editingSchedule.id || crypto.randomUUID(),
                salespersonName: salesperson?.name,
                branchName: branch?.name,
                familyId: state.companyProfile?.familyId || (state as any).familyId
            } as SalespersonSchedule);

            onRefresh();
            setIsModalOpen(false);
            showAlert("Escala salva com sucesso!", "success");
        } catch (e) {
            showAlert("Erro ao salvar escala.", "error");
        } finally {
            setIsSaving(false);
        }
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
                            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gestão Global de Escala</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Clique nas células para gerenciar horários</p>
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
                </div>
            </div>

            {/* Quadro de Escala (Matriz) */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
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

                                        return (
                                            <td 
                                                key={dIdx} 
                                                className={`p-2 align-top min-h-[130px] transition-all relative group/cell ${isToday ? 'bg-indigo-50/20' : ''} ${daySchedules.length === 0 ? 'bg-slate-50/30' : ''}`}
                                            >
                                                <div className="space-y-1.5 min-h-[100px]">
                                                    {daySchedules.map(sch => (
                                                        <button 
                                                            key={sch.id} 
                                                            onClick={() => handleEdit(sch)}
                                                            className="w-full text-left bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group/card relative overflow-hidden active:scale-95"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 uppercase border border-indigo-100">
                                                                    {sch.salespersonName?.charAt(0)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] font-bold text-slate-700 truncate">{sch.salespersonName?.split(' ')[0]}</p>
                                                                </div>
                                                                <div className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 flex items-center gap-1">
                                                                    {getShiftIcon(sch.shift)}
                                                                    <span className="text-[8px] font-black text-slate-600">{shiftLabels[sch.shift]}</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}

                                                    {/* Botão de Adição na Célula */}
                                                    <button 
                                                        onClick={() => handleOpenAdd(branch.id, dateStr)}
                                                        className={`w-full py-4 rounded-xl border-2 border-dashed border-slate-200 text-slate-300 flex flex-col items-center justify-center gap-1 transition-all hover:bg-white hover:border-indigo-300 hover:text-indigo-400 ${daySchedules.length === 0 ? 'opacity-100' : 'opacity-0 group-hover/cell:opacity-100 mt-2'}`}
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        <span className="text-[8px] font-black uppercase">Escalar</span>
                                                    </button>
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

            {/* Legenda e Dicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ListFilter className="w-4 h-4 text-indigo-500" /> Legenda de Turnos
                    </h4>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase">Dia Todo (D)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase">Manhã (M)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase">Tarde (T)</span>
                        </div>
                    </div>
                </div>

                <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex items-start gap-4">
                    <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">Dica de Gestão</h4>
                        <p className="text-[10px] text-indigo-800 leading-relaxed font-medium">
                            Clique em qualquer space vazio de uma filial para escalar um colaborador. O sistema valida automaticamente se a pessoa já está em outra unidade.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[2rem] text-white flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Alocações na Semana</p>
                        <h4 className="text-xl font-black">{schedules.filter(s => weekDatesStr.includes(s.date)).length} Colaboradores</h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Total de turnos ativos</p>
                    </div>
                    <Briefcase className="w-10 h-10 text-slate-700" />
                </div>
            </div>

            {/* MODAL DE GESTÃO DE ESCALA */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100 relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-indigo-600 rounded-2xl text-white">
                                <UserPlus className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                    {editingSchedule.id ? 'Ajustar Escala' : 'Escalar Colaborador'}
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    {branches.find(b => b.id === editingSchedule.branchId)?.name} • {new Date(editingSchedule.date + 'T12:00:00').toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Colaborador</label>
                                <select 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={editingSchedule.salespersonId || ''}
                                    onChange={e => setEditingSchedule({...editingSchedule, salespersonId: e.target.value})}
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {salespeople.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 ml-1">Período / Turno</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'MORNING', label: 'Manhã', icon: Clock },
                                        { id: 'AFTERNOON', label: 'Tarde', icon: Clock },
                                        { id: 'FULL', label: 'Dia Todo', icon: Check }
                                    ].map(shift => (
                                        <button 
                                            key={shift.id}
                                            type="button"
                                            onClick={() => setEditingSchedule({...editingSchedule, shift: shift.id as any})}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${editingSchedule.shift === shift.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                        >
                                            <shift.icon className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase">{shift.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Observações (Opcional)</label>
                                <textarea 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold min-h-[80px] outline-none"
                                    value={editingSchedule.notes || ''}
                                    onChange={e => setEditingSchedule({...editingSchedule, notes: e.target.value})}
                                    placeholder="Ex: Treinamento, Cobertura folga..."
                                />
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                {editingSchedule.id && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleDelete(editingSchedule.id!)}
                                        className="flex-1 py-4 text-rose-500 font-black uppercase text-[10px] tracking-widest bg-rose-50 rounded-2xl hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Remover
                                    </button>
                                )}
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar Escala
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalScheduleView;
