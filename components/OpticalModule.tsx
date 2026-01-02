
import React, { useState } from 'react';
import { OpticalRx, Contact, CommercialOrder, ServiceOrder, ViewMode, ServiceItem } from '../types';
import { Eye, Plus, Search, Glasses, Monitor, User, Calendar, Clipboard, ArrowRight, Trash2, Pencil, CheckCircle2, Package, Tag, Layers, Stethoscope } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import OpticalRxModal from './OpticalRxModal';

interface OpticalModuleProps {
    activeView: 'OPTICAL_RX' | 'OPTICAL_SALES' | 'OPTICAL_LAB';
    opticalRxs: OpticalRx[];
    contacts: Contact[];
    commercialOrders: CommercialOrder[];
    serviceOrders: ServiceOrder[];
    serviceItems: ServiceItem[];
    onSaveRx: (rx: OpticalRx) => void;
    onDeleteRx: (id: string) => void;
    onSaveSale: (sale: CommercialOrder) => void;
    onDeleteSale: (id: string) => void;
    onSaveOS: (os: ServiceOrder) => void;
    onDeleteOS: (id: string) => void;
}

const OpticalModule: React.FC<OpticalModuleProps> = ({ 
    activeView, opticalRxs, contacts, commercialOrders, serviceOrders, serviceItems,
    onSaveRx, onDeleteRx, onSaveSale, onDeleteSale, onSaveOS, onDeleteOS
}) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [searchTerm, setSearchTerm] = useState('');
    const [isRxModalOpen, setRxModalOpen] = useState(false);
    const [editingRx, setEditingRx] = useState<OpticalRx | null>(null);

    const filteredRxs = opticalRxs.filter(rx => 
        (rx.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rx.professionalName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSales = commercialOrders.filter(o => 
        o.moduleTag === 'optical' && 
        (o.description.toLowerCase().includes(searchTerm.toLowerCase()) || (o.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredOS = serviceOrders.filter(os => 
        os.moduleTag === 'optical' &&
        (os.title.toLowerCase().includes(searchTerm.toLowerCase()) || (os.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleOpenRxModal = (rx?: OpticalRx) => {
        setEditingRx(rx || null);
        setRxModalOpen(true);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
                            {activeView === 'OPTICAL_RX' ? <Eye className="w-6 h-6"/> : activeView === 'OPTICAL_SALES' ? <Glasses className="w-6 h-6"/> : <Monitor className="w-6 h-6"/>}
                        </div>
                        {activeView === 'OPTICAL_RX' ? 'Receitas Óticas' : activeView === 'OPTICAL_SALES' ? 'Venda Guiada' : 'Laboratório'}
                    </h1>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                    </div>
                    {activeView === 'OPTICAL_RX' && (
                        <button onClick={() => handleOpenRxModal()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95 whitespace-nowrap">
                            <Plus className="w-4 h-4" /> Nova Receita
                        </button>
                    )}
                </div>
            </div>

            {/* View: RECEITAS */}
            {activeView === 'OPTICAL_RX' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRxs.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-gray-400">Nenhuma receita encontrada.</div>
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
                            <button onClick={() => showAlert("Em breve: Fluxo de Venda direto", "info")} className="w-full mt-6 py-2.5 bg-gray-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">Iniciar Venda com esta RX</button>
                        </div>
                    ))}
                </div>
            )}

            {/* View: VENDA GUIADA */}
            {activeView === 'OPTICAL_SALES' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Cliente / Descrição</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSales.map(sale => (
                                <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-gray-400">{new Date(sale.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800">{sale.contactName || '---'}</span>
                                            <span className="text-xs text-gray-500">{sale.description}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-indigo-50 text-indigo-700`}>{sale.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-gray-900">{formatCurrency(sale.amount)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                                            <button onClick={() => onDeleteSale(sale.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">Nenhuma venda de ótica registrada.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* View: LABORATÓRIO */}
            {activeView === 'OPTICAL_LAB' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOS.map(os => (
                        <div key={os.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all">
                             <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">OS #{os.number || os.id.substring(0,4)}</span>
                                    <h3 className="font-bold text-gray-900">{os.title}</h3>
                                </div>
                                <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-amber-100 text-amber-700">{os.status}</span>
                            </div>
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-2 text-xs text-gray-600"><User className="w-4 h-4 text-gray-400" /> {os.contactName}</div>
                                <div className="flex items-center gap-2 text-xs text-gray-600"><Calendar className="w-4 h-4 text-gray-400" /> Entrega: {os.endDate ? new Date(os.endDate).toLocaleDateString() : 'Não definido'}</div>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                <span className="text-sm font-black text-gray-900">{formatCurrency(os.totalAmount)}</span>
                                <div className="flex gap-2">
                                    <button className="p-2 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100"><CheckCircle2 className="w-4 h-4"/></button>
                                    <button className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
