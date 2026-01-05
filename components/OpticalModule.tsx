
import React, { useState } from 'react';
import { OpticalRx, Contact, Laboratory, OpticalDeliveryStatus } from '../types';
import { Eye, Plus, Search, Trash2, Pencil, User, Calendar, Microscope, Send, Mail, Printer, CheckCircle, Clock, Package, AlertCircle, ShoppingCart } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import { useHelp } from './GuidedHelp';

interface OpticalModuleProps {
    opticalRxs: OpticalRx[];
    contacts: Contact[];
    laboratories: Laboratory[];
    onAddRx: () => void;
    onEditRx: (rx: OpticalRx) => void;
    onDeleteRx: (id: string) => void;
    onUpdateRx: (rx: OpticalRx) => void;
    onStartSaleFromRx: (rx: OpticalRx) => void;
}

const OpticalModule: React.FC<OpticalModuleProps> = ({ 
    opticalRxs, contacts, laboratories, onAddRx, onEditRx, onDeleteRx, onUpdateRx, onStartSaleFromRx
}) => {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRxs = opticalRxs.filter(rx => 
        (rx.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rx.professionalName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'SOLD': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'CANCELLED': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-amber-100 text-amber-700 border-amber-200';
        }
    };

    const getLabStatusColor = (status?: OpticalDeliveryStatus) => {
        switch (status) {
            case 'LAB_PRONTO': return 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 animate-pulse';
            case 'LAB_ENVIADO': return 'bg-blue-50 text-blue-600';
            case 'LAB_PRODUCAO': return 'bg-purple-50 text-purple-600';
            case 'ENTREGUE_CLIENTE': return 'bg-slate-100 text-slate-400';
            default: return 'bg-amber-50 text-amber-600';
        }
    };

    const handleApproveRx = async (rx: OpticalRx) => {
        const confirm = await showConfirm({
            title: "Aprovar Receita",
            message: `Deseja aprovar a receita de ${rx.contactName} e prosseguir para a escolha da armação e venda?`,
            confirmText: "Sim, Aprovar e Vender"
        });

        if (confirm) {
            const updated = { ...rx, status: 'APPROVED' as any };
            onUpdateRx(updated);
            onStartSaleFromRx(updated);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
                            <Eye className="w-6 h-6"/>
                        </div>
                        Receitas Óticas (RX)
                    </h1>
                    <p className="text-gray-500 mt-1">Gestão técnica e conversão em vendas de óculos.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                        <input type="text" placeholder="Buscar receita..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                    </div>
                    <button onClick={onAddRx} className="bg-indigo-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 whitespace-nowrap">
                        <Plus className="w-4 h-4" /> Nova Receita
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredRxs.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="font-bold">Nenhuma receita encontrada.</p>
                    </div>
                ) : filteredRxs.map(rx => (
                    <div key={rx.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 hover:shadow-lg transition-all group flex flex-col lg:flex-row gap-8">
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl">
                                        {rx.contactName?.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-900 text-xl leading-none">{rx.contactName}</h3>
                                        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest mt-2">
                                            <Calendar className="w-3.5 h-3.5"/> {new Date(rx.rxDate).toLocaleDateString()}
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-200"></span>
                                            <span className={`px-2 py-0.5 rounded border text-[10px] font-black ${getStatusColor(rx.status)}`}>{rx.status || 'PENDENTE'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2">
                                    {rx.status !== 'SOLD' && rx.status !== 'APPROVED' && (
                                        <button 
                                            onClick={() => handleApproveRx(rx)}
                                            className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 border border-emerald-100"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Aprovar e Vender
                                        </button>
                                    )}
                                    {rx.status === 'APPROVED' && (
                                        <button 
                                            onClick={() => onStartSaleFromRx(rx)}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg"
                                        >
                                            <ShoppingCart className="w-4 h-4" /> Escolher Armação
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Olho Direito (OD)</p>
                                    <p className="text-sm font-black text-gray-700">{rx.sphereOdLonge || '0.00'} ESF | {rx.cylOdLonge || '0.00'} CIL | {rx.axisOdLonge || '0'}°</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Olho Esquerdo (OE)</p>
                                    <p className="text-sm font-black text-gray-700">{rx.sphereOeLonge || '0.00'} ESF | {rx.cylOeLonge || '0.00'} CIL | {rx.axisOeLonge || '0'}°</p>
                                </div>
                            </div>
                        </div>

                        <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-8 pt-6 lg:pt-0 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                                        <Microscope className="w-4 h-4"/> Status Lab
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${getLabStatusColor(rx.labStatus)}`}>
                                        {rx.labStatus?.replace('LAB_', '') || 'AGUARDANDO'}
                                    </span>
                                </div>
                                
                                {rx.labStatus === 'LAB_PRONTO' && (
                                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl mb-4 flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-emerald-600" />
                                        <p className="text-[10px] font-bold text-emerald-700 uppercase">Lentes prontas para retirada no lab!</p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button onClick={() => onEditRx(rx)} className="flex-1 py-3 bg-slate-50 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center border border-slate-200"><Pencil className="w-4 h-4"/></button>
                                    <button onClick={() => onDeleteRx(rx.id)} className="flex-1 py-3 bg-slate-50 text-rose-500 rounded-xl hover:bg-rose-50 transition-colors flex items-center justify-center border border-slate-200"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OpticalModule;
