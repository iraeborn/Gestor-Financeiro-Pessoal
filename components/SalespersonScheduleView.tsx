
import React, { useState, useMemo } from 'react';
import { Branch, Salesperson, SalespersonSchedule } from '../types';
import { ArrowLeft, Calendar, Plus, Users, Trash2, Clock, MapPin, ChevronLeft, ChevronRight, UserCheck, AlertTriangle, Briefcase } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface SalespersonScheduleViewProps {
    branch: Branch;
    schedules: SalespersonSchedule[];
    salespeople: Salesperson[];
    onSaveSchedule: (s: SalespersonSchedule) => void;
    onDeleteSchedule: (id: string) => void;
    onBack: () => void;
}

const SalespersonScheduleView: React.FC<SalespersonScheduleViewProps> = ({ branch, schedules = [], salespeople = [], onSaveSchedule, onDeleteSchedule, onBack }) => {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<SalespersonSchedule>>({
        branchId: branch.id,
        date: new Date().toISOString().split('T')[0],
        shift: 'FULL'
    });

    const selectedDateStr = currentDate.toISOString().split('T')[0];
    
    // Escalas de TODAS as filiais para checar conflitos
    const allSchedules = schedules;
    
    // Escalas da filial atual no dia selecionado
    const todaysSchedules = useMemo(() => {
        return schedules.filter(s => s.branchId === branch.id && s.date === selectedDateStr);
    }, [schedules, branch.id, selectedDateStr]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.salespersonId) return showAlert("Selecione um vendedor.", "warning");

        const salesperson = salespeople.find(s => s.id === formData.salespersonId);
        
        // Checar se o vendedor já está escalado em outra filial no mesmo dia (Conflito)
        const conflict = allSchedules.find(s => 
            s.salespersonId === formData.salespersonId && 
            s.date === formData.date && 
            s.branchId !== branch.id &&
            (s.shift === 'FULL' || formData.shift === 'FULL' || s.shift === formData.shift)
        );

        if (conflict) {
            return showAlert(`Atenção: Este vendedor já está escalado para a filial "${conflict.branchName || 'Outra'}" neste dia/turno.`, "error");
        }

        onSaveSchedule({
            ...formData,
            id: formData.id || crypto.randomUUID(),
            branchId: branch.id,
            branchName: branch.name,
            salespersonName: salesperson?.name,
            familyId: (salesperson as any).familyId
        } as SalespersonSchedule);

        setIsModalOpen(false);
        showAlert("Escala atualizada!", "success");
    };

    const handleDelete = async (id: string) => {
        const confirm = await showConfirm({
            title: "Remover da Escala",
            message: "Tem certeza que deseja remover este vendedor da escala deste dia?",
            variant: "danger"
        });
        if (confirm) onDeleteSchedule(id);
    };

    const shiftLabels = {
        'FULL': 'Dia Todo',
        'MORNING': 'Manhã',
        'AFTERNOON': 'Tarde'
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 text-gray-400 hover:text-indigo-600 transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            Escala de Vendedores: {branch.name}
                        </h1>
                        <p className="text-gray-500 flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3"/> Planejamento de Equipe
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => { setFormData({ branchId: branch.id, date: selectedDateStr, shift: 'FULL' }); setIsModalOpen(true); }}
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                >
                    <Plus className="w-4 h-4" /> Adicionar à Escala
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Lado Esquerdo: Calendário */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Data do Trabalho</h3>
                            <div className="flex gap-1">
                                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); }} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400"><ChevronLeft className="w-4 h-4"/></button>
                                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); }} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400"><ChevronRight className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <input 
                            type="date" 
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500 transition-all"
                            value={selectedDateStr}
                            onChange={e => setCurrentDate(new Date(e.target.value))}
                        />
                    </div>
                    
                    <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                        <div className="flex items-center gap-2 text-indigo-700 mb-3">
                            <AlertTriangle className="w-5 h-5" />
                            <h4 className="text-xs font-black uppercase tracking-widest">Informações</h4>
                        </div>
                        <p className="text-xs text-indigo-800 leading-relaxed">
                            O planejamento da escala permite que o sistema identifique qual vendedor está ativo em cada ponto de venda para fins de relatórios de produtividade por unidade.
                        </p>
                    </div>
                </div>

                {/* Lado Direito: Lista de Vendedores no dia */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Vendedores em Loja: {new Date(currentDate).toLocaleDateString('pt-BR')}</h3>
                    
                    {todaysSchedules.length === 0 ? (
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-16 text-center shadow-sm">
                            <Users className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                            <p className="text-gray-400 font-bold">Nenhum vendedor escalado para esta data.</p>
                            <button onClick={() => setIsModalOpen(true)} className="mt-4 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline">Escalar Agora</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {todaysSchedules.map(sch => (
                                <div key={sch.id} className="bg-white rounded-3xl border border-gray-100 p-6 flex flex-col shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black">
                                            {sch.salespersonName?.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{sch.salespersonName}</h4>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase font-black">
                                                <Clock className="w-3 h-3" /> {shiftLabels[sch.shift]}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {sch.notes && (
                                        <p className="text-xs text-gray-500 italic mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            "{sch.notes}"
                                        </p>
                                    )}

                                    <div className="mt-auto flex justify-end pt-2 border-t border-gray-50">
                                        <button onClick={() => handleDelete(sch.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100">
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-8 flex items-center gap-2">
                            <UserCheck className="w-6 h-6 text-indigo-600" />
                            Escalar Vendedor
                        </h2>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Selecione o Vendedor</label>
                                <select 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold"
                                    value={formData.salespersonId || ''}
                                    onChange={e => setFormData({...formData, salespersonId: e.target.value})}
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {salespeople.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Data</label><input type="date" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required /></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Turno</label>
                                    <select 
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold"
                                        value={formData.shift || 'FULL'}
                                        onChange={e => setFormData({...formData, shift: e.target.value as any})}
                                    >
                                        <option value="FULL">Dia Todo</option>
                                        <option value="MORNING">Manhã</option>
                                        <option value="AFTERNOON">Tarde</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Observações da Escala</label>
                                <textarea className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold min-h-[80px]" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Opcional..." />
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg">Confirmar Escala</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalespersonScheduleView;
