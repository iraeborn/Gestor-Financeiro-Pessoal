
import React, { useState, useMemo } from 'react';
import { Branch, ServiceAppointment, ServiceClient } from '../types';
import { Calendar, ArrowLeft, Plus, Clock, User, Trash2, Pencil, MapPin, ChevronLeft, ChevronRight, CheckCircle2, History } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface BranchScheduleViewProps {
    branch: Branch;
    appointments: ServiceAppointment[];
    clients: ServiceClient[];
    onSaveAppointment: (a: Partial<ServiceAppointment>) => void;
    onDeleteAppointment: (id: string) => void;
    onBack: () => void;
}

const BranchScheduleView: React.FC<BranchScheduleViewProps> = ({ branch, appointments = [], clients = [], onSaveAppointment, onDeleteAppointment, onBack }) => {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ServiceAppointment>>({
        branchId: branch.id,
        date: new Date().toISOString().split('T')[0]
    });

    const branchAppointments = (appointments || []).filter(a => a.branchId === branch.id);
    
    // Agrupa por data para o calendário
    const eventsMap = useMemo(() => {
        const map: Record<string, ServiceAppointment[]> = {};
        branchAppointments.forEach(a => {
            if (!a.date) return;
            const d = a.date.split('T')[0];
            if (!map[d]) map[d] = [];
            map[d].push(a);
        });
        return map;
    }, [branchAppointments]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSaveAppointment({
            ...formData,
            id: formData.id || crypto.randomUUID(),
            branchId: branch.id,
            moduleTag: 'optical',
            status: formData.status || 'SCHEDULED'
        });
        setIsModalOpen(false);
        showAlert("Agendamento salvo!", "success");
    };

    const handleOpenModal = (appt?: ServiceAppointment) => {
        if (appt) setFormData(appt);
        else setFormData({ branchId: branch.id, date: new Date().toISOString().split('T')[0], status: 'SCHEDULED' });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        const confirm = await showConfirm({ title: "Cancelar Agendamento", message: "Tem certeza?", variant: "danger" });
        if (confirm) onDeleteAppointment(id);
    };

    // Lógica básica de calendário simplificada para a view de lista de agenda por dia selecionado
    const selectedDateStr = currentDate.toISOString().split('T')[0];
    const todaysEvents = eventsMap[selectedDateStr] || [];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 text-gray-400 hover:text-indigo-600 transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            Agenda: {branch.name}
                        </h1>
                        <p className="text-gray-500 flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3"/> {branch.city || 'Localidade Móvel'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                >
                    <Plus className="w-4 h-4" /> Agendar Atendimento
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Lado Esquerdo: Mini Calendário & Seletor */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Selecionar Dia</h3>
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
                        <div className="mt-8 pt-6 border-t border-gray-50 space-y-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400 font-bold uppercase">Agendados hoje</span>
                                <span className="text-indigo-600 font-black">{todaysEvents.length}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400 font-bold uppercase">Total Filial</span>
                                <span className="text-gray-700 font-black">{branchAppointments.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lado Direito: Lista de Atendimentos */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Atendimentos p/ {new Date(currentDate).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</h3>
                    
                    {todaysEvents.length === 0 ? (
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-16 text-center shadow-sm">
                            <Calendar className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                            <p className="text-gray-400 font-bold">Nenhum atendimento agendado para esta unidade neste dia.</p>
                            <button onClick={() => handleOpenModal()} className="mt-4 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline">Agendar Agora</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {todaysEvents.sort((a,b) => (a.date || '').localeCompare(b.date || '')).map(appt => (
                                <div key={appt.id} className="bg-white rounded-3xl border border-gray-100 p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex flex-col items-center justify-center text-indigo-600">
                                            <Clock className="w-4 h-4 mb-0.5" />
                                            <span className="text-xs font-black uppercase">{appt.date ? new Date(appt.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{appt.clientName || 'Cliente Indefinido'}</h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{appt.status}</span>
                                                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1"><History className="w-3 h-3"/> Histórico Atrelado</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(appt)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"><Pencil className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete(appt.id)} className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100">
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-8 flex items-center gap-2">
                            <Clock className="w-6 h-6 text-indigo-600" />
                            Novo Atendimento
                        </h2>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Paciente / Cliente</label>
                                <select 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold"
                                    value={formData.clientId || ''}
                                    onChange={e => setFormData({...formData, clientId: e.target.value, clientName: clients.find(c => c.id === e.target.value)?.contactName})}
                                    required
                                >
                                    <option value="">Selecione o paciente...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.contactName}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Data e Hora</label><input type="datetime-local" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.date?.substring(0, 16)} onChange={e => setFormData({...formData, date: e.target.value})} required /></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Situação</label><select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.status || 'SCHEDULED'} onChange={e => setFormData({...formData, status: e.target.value as any})}><option value="SCHEDULED">Agendado</option><option value="COMPLETED">Concluído</option><option value="CANCELED">Cancelado</option></select></div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Notas da Recepção / Motivo</label>
                                <textarea className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold min-h-[100px]" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
                            </div>
                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-400 font-bold uppercase text-[10px]">Descartar</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg">Confirmar Agenda</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchScheduleView;
