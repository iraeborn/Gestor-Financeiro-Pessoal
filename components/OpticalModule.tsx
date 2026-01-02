
import React, { useState } from 'react';
import { OpticalRx, Contact } from '../types';
import { Eye, Plus, Search, Trash2, Pencil, User, Calendar } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import OpticalRxModal from './OpticalRxModal';

interface OpticalModuleProps {
    opticalRxs: OpticalRx[];
    contacts: Contact[];
    onSaveRx: (rx: OpticalRx) => void;
    onDeleteRx: (id: string) => void;
}

const OpticalModule: React.FC<OpticalModuleProps> = ({ 
    opticalRxs, contacts, onSaveRx, onDeleteRx
}) => {
    const { showAlert } = useAlert();
    const [searchTerm, setSearchTerm] = useState('');
    const [isRxModalOpen, setRxModalOpen] = useState(false);
    const [editingRx, setEditingRx] = useState<OpticalRx | null>(null);

    const filteredRxs = opticalRxs.filter(rx => 
        (rx.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rx.professionalName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenRxModal = (rx?: OpticalRx) => {
        setEditingRx(rx || null);
        setRxModalOpen(true);
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
                    <p className="text-gray-500 mt-1">Prontuário clínico de prescrições visuais dos pacientes.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input type="text" placeholder="Buscar por paciente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                    </div>
                    <button onClick={() => handleOpenRxModal()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95 whitespace-nowrap">
                        <Plus className="w-4 h-4" /> Nova Receita
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRxs.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="font-bold">Nenhuma receita encontrada.</p>
                    </div>
                ) : filteredRxs.map(rx => (
                    <div key={rx.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                                    {rx.contactName?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">{rx.contactName}</h3>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{new Date(rx.rxDate).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenRxModal(rx)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button>
                                <button onClick={() => onDeleteRx(rx.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-gray-50 pt-4 text-xs">
                            <div>
                                <p className="text-gray-400 font-bold uppercase text-[9px]">OD Longe</p>
                                <p className="font-bold text-gray-700">{rx.sphereOdLonge || '0.00'} ESF | {rx.cylOdLonge || '0.00'} CIL</p>
                            </div>
                            <div>
                                <p className="text-gray-400 font-bold uppercase text-[9px]">OE Longe</p>
                                <p className="font-bold text-gray-700">{rx.sphereOeLonge || '0.00'} ESF | {rx.cylOeLonge || '0.00'} CIL</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Validade: {rx.expirationDate ? new Date(rx.expirationDate).toLocaleDateString() : '---'}</span>
                            <button onClick={() => showAlert("Venda iniciada com sucesso. (Simulação)", "success")} className="text-indigo-600 hover:underline text-[10px] font-black uppercase tracking-widest">Vincular Venda</button>
                        </div>
                    </div>
                ))}
            </div>

            {isRxModalOpen && (
                <OpticalRxModal 
                    isOpen={isRxModalOpen} 
                    onClose={() => setRxModalOpen(false)} 
                    contacts={contacts} 
                    initialData={editingRx} 
                    onSave={(rx) => { onSaveRx(rx); setRxModalOpen(false); }} 
                />
            )}
        </div>
    );
};

export default OpticalModule;
