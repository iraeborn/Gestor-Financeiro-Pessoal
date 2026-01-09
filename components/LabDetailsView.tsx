
import React, { useMemo, useState } from 'react';
import { Laboratory, OpticalRx, AppState, OpticalDeliveryStatus } from '../types';
import { 
    ArrowLeft, Microscope, Phone, Mail, Clock, CheckCircle2, 
    Truck, Package, Search, Calendar, User, Eye, ArrowRight,
    MessageSquare, ExternalLink, Filter, X, CheckSquare, History,
    // Fix: Added missing AtSign and FlaskConical imports
    AtSign, FlaskConical
} from 'lucide-react';
import { useAlert } from './AlertSystem';

interface LabDetailsViewProps {
    lab: Laboratory;
    opticalRxs: OpticalRx[];
    onBack: () => void;
    onUpdateRx: (rx: OpticalRx) => void;
}

type TabType = 'PENDING' | 'READY' | 'DELIVERED' | 'ALL';

const LabDetailsView: React.FC<LabDetailsViewProps> = ({ lab, opticalRxs, onBack, onUpdateRx }) => {
    const { showAlert } = useAlert();
    const [activeTab, setActiveTab] = useState<TabType>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');

    const labRxs = useMemo(() => {
        return opticalRxs.filter(rx => rx.laboratoryId === lab.id);
    }, [opticalRxs, lab.id]);

    const metrics = useMemo(() => {
        return {
            inProduction: labRxs.filter(rx => ['LAB_ENVIADO', 'LAB_PRODUCAO'].includes(rx.labStatus || '')).length,
            ready: labRxs.filter(rx => rx.labStatus === 'LAB_PRONTO').length,
            delivered: labRxs.filter(rx => ['LAB_RECEBIDO', 'ENTREGUE_CLIENTE'].includes(rx.labStatus || '')).length,
            total: labRxs.length
        };
    }, [labRxs]);

    const filteredRxs = useMemo(() => {
        return labRxs.filter(rx => {
            const matchesSearch = (rx.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (rx.rxNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            if (activeTab === 'PENDING') return ['LAB_PENDENTE', 'LAB_ENVIADO', 'LAB_PRODUCAO'].includes(rx.labStatus || '');
            if (activeTab === 'READY') return rx.labStatus === 'LAB_PRONTO';
            if (activeTab === 'DELIVERED') return ['LAB_RECEBIDO', 'ENTREGUE_CLIENTE'].includes(rx.labStatus || '');
            return true;
        }).sort((a, b) => new Date(b.rxDate).getTime() - new Date(a.rxDate).getTime());
    }, [labRxs, activeTab, searchTerm]);

    const handleUpdateStatus = (rx: OpticalRx, status: OpticalDeliveryStatus) => {
        onUpdateRx({ ...rx, labStatus: status });
        showAlert(`Status do pedido #${rx.rxNumber} atualizado!`, "success");
    };

    const getLabStatusInfo = (status?: OpticalDeliveryStatus) => {
        switch (status) {
            case 'LAB_PRONTO': return { label: 'Pronto', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
            case 'LAB_PRODUCAO': return { label: 'Em Produção', color: 'bg-indigo-100 text-indigo-700', icon: Microscope };
            case 'LAB_ENVIADO': return { label: 'Enviado ao Lab', color: 'bg-blue-100 text-blue-700', icon: Truck };
            case 'LAB_RECEBIDO': return { label: 'Recebido na Loja', color: 'bg-slate-100 text-slate-600', icon: Package };
            case 'ENTREGUE_CLIENTE': return { label: 'Entregue ao Cliente', color: 'bg-slate-900 text-white', icon: User };
            default: return { label: 'Aguardando', color: 'bg-amber-100 text-amber-700', icon: Clock };
        }
    };

    const handleContactLab = () => {
        if (lab.preferredCommunication === 'WHATSAPP' && lab.phone) {
            window.open(`https://wa.me/${lab.phone.replace(/\D/g, '')}`, '_blank');
        } else if (lab.preferredCommunication === 'EMAIL' && lab.email) {
            window.location.href = `mailto:${lab.email}`;
        } else {
            showAlert("Canal de comunicação manual.", "info");
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* Header com Dados do Lab */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-100 pb-10">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="p-4 hover:bg-white rounded-2xl border border-gray-200 text-gray-400 hover:text-indigo-600 transition-all shadow-sm group">
                        <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shadow-2xl relative overflow-hidden">
                            <Microscope className="w-10 h-10 relative z-10" />
                            <div className="absolute inset-0 bg-black/10"></div>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{lab.name}</h1>
                            <div className="flex flex-wrap items-center gap-4 mt-2">
                                {lab.phone && <span className="flex items-center gap-1.5 text-sm text-gray-400 font-bold uppercase tracking-widest"><Phone className="w-4 h-4 text-emerald-500" /> {lab.phone}</span>}
                                {lab.email && <span className="flex items-center gap-1.5 text-sm text-gray-400 font-bold uppercase tracking-widest"><Mail className="w-4 h-4 text-blue-500" /> {lab.email}</span>}
                            </div>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={handleContactLab}
                    className="px-8 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-3 shadow-xl shadow-indigo-100/50"
                >
                    {/* Fix: Added missing AtSign import used below */}
                    {lab.preferredCommunication === 'WHATSAPP' ? <MessageSquare className="w-5 h-5" /> : <AtSign className="w-5 h-5" />}
                    Contatar Laboratório
                </button>
            </div>

            {/* Grid de KPIs do Lab */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Em Produção</p>
                        <Clock className="w-6 h-6 text-indigo-500 group-hover:animate-spin" />
                    </div>
                    <h3 className="text-4xl font-black text-gray-900 mt-4">{metrics.inProduction}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Receitas enviadas</p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-all">
                    <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pronto Retirada</p>
                        <CheckSquare className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 className="text-4xl font-black text-gray-900 mt-4">{metrics.ready}</h3>
                    <p className="text-[10px] text-emerald-600 font-black uppercase mt-2 animate-pulse">Aguardando Logística</p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-slate-200 transition-all">
                    <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entregues / Mês</p>
                        <Truck className="w-6 h-6 text-slate-400" />
                    </div>
                    <h3 className="text-4xl font-black text-gray-900 mt-4">{metrics.delivered}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Ciclo de entrega concluído</p>
                </div>

                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                    {/* Fix: Added missing FlaskConical import used below */}
                    <div className="absolute -right-4 -top-4 opacity-10"><FlaskConical className="w-24 h-24" /></div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Volume Histórico</p>
                    <h3 className="text-4xl font-black">{metrics.total}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-4">Receitas processadas</p>
                </div>
            </div>

            {/* Listagem de Ordens */}
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row justify-between items-center gap-6 bg-slate-50/30">
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'PENDING', label: 'Em Produção', count: metrics.inProduction },
                            { id: 'READY', label: 'Prontos / Retirar', count: metrics.ready },
                            { id: 'DELIVERED', label: 'Histórico Entregas', count: metrics.delivered },
                            { id: 'ALL', label: 'Tudo', count: metrics.total }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as TabType)}
                                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                            >
                                {t.label}
                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>{t.count}</span>
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full lg:w-80">
                        <Search className="w-4 h-4 text-gray-300 absolute left-4 top-4" />
                        <input 
                            type="text" 
                            placeholder="Buscar paciente ou #RX..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {filteredRxs.length === 0 ? (
                        <div className="py-24 text-center">
                            <Package className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma receita nesta categoria para este lab.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredRxs.map(rx => {
                                const statusInfo = getLabStatusInfo(rx.labStatus);
                                const StatusIcon = statusInfo.icon;
                                
                                return (
                                    <div key={rx.id} className="flex flex-col md:flex-row items-center justify-between p-6 bg-white border border-slate-100 rounded-[2rem] hover:shadow-xl hover:border-indigo-100 transition-all group">
                                        <div className="flex flex-col md:flex-row items-center gap-8 flex-1">
                                            <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 relative group-hover:scale-105 transition-transform">
                                                <Eye className="w-8 h-8 text-indigo-600" />
                                                <div className="absolute -top-2 -right-2 bg-slate-900 text-white text-[8px] font-black px-2 py-1 rounded-lg">#{rx.rxNumber}</div>
                                            </div>

                                            <div className="flex-1 text-center md:text-left">
                                                <h4 className="font-black text-gray-800 text-lg uppercase tracking-tight">{rx.contactName}</h4>
                                                <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 mt-2 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(rx.rxDate).toLocaleDateString()}</span>
                                                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Dr. {rx.professionalName || 'Não inf.'}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center md:items-end px-10 border-x border-slate-50">
                                                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${statusInfo.color}`}>
                                                    <StatusIcon className="w-3.5 h-3.5" /> {statusInfo.label}
                                                </div>
                                                <p className="text-[9px] text-gray-300 font-bold uppercase mt-2">Longe: {rx.sphereOdLonge} / {rx.sphereOeLonge}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-4 md:mt-0 md:pl-8">
                                            {rx.labStatus === 'LAB_PRONTO' && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(rx, 'LAB_RECEBIDO')}
                                                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                                                >
                                                    Confirmar Recebimento
                                                </button>
                                            )}
                                            {['LAB_ENVIADO', 'LAB_PRODUCAO'].includes(rx.labStatus || '') && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(rx, 'LAB_PRONTO')}
                                                    className="px-6 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                                                >
                                                    Marcar como Pronto
                                                </button>
                                            )}
                                            <button className="p-3 text-slate-300 hover:text-indigo-600 transition-colors">
                                                <ArrowRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LabDetailsView;
