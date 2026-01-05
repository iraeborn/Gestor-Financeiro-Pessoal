
import React, { useState } from 'react';
import { OpticalRx, Contact, Laboratory, OpticalDeliveryStatus } from '../types';
import { Eye, Plus, Search, Trash2, Pencil, User, Calendar, Microscope, Send, Mail, Printer, CheckCircle, Clock, Package, AlertCircle } from 'lucide-react';
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
}

const OpticalModule: React.FC<OpticalModuleProps> = ({ 
    opticalRxs, contacts, laboratories, onAddRx, onEditRx, onDeleteRx, onUpdateRx
}) => {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRxs = opticalRxs.filter(rx => 
        (rx.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rx.professionalName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status?: OpticalDeliveryStatus) => {
        switch (status) {
            case 'LAB_PENDENTE': return 'bg-amber-100 text-amber-700';
            case 'LAB_ENVIADO': return 'bg-blue-100 text-blue-700';
            case 'LAB_PRODUCAO': return 'bg-purple-100 text-purple-700';
            case 'LAB_PRONTO': return 'bg-emerald-100 text-emerald-700';
            case 'LAB_RECEBIDO': return 'bg-teal-100 text-teal-700';
            case 'ENTREGUE_CLIENTE': return 'bg-slate-200 text-slate-700 line-through';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    const getStatusLabel = (status?: OpticalDeliveryStatus) => {
        switch (status) {
            case 'LAB_PENDENTE': return 'Pendente Lab';
            case 'LAB_ENVIADO': return 'Enviado Lab';
            case 'LAB_PRODUCAO': return 'Em Produção';
            case 'LAB_PRONTO': return 'Pronto no Lab';
            case 'LAB_RECEBIDO': return 'Na Loja (Recebido)';
            case 'ENTREGUE_CLIENTE': return 'Entregue Cliente';
            default: return 'Rascunho';
        }
    };

    const handlePrintRx = (rx: OpticalRx) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        const content = `
            <html>
            <head>
                <title>Receita Ótica - ${rx.contactName}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; }
                    .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                    .info { margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    .grid { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    .grid th, .grid td { border: 1px solid #ccc; padding: 10px; text-align: center; }
                    .grid th { background: #f0f0f0; }
                    .obs { border: 1px solid #ccc; padding: 15px; min-height: 100px; }
                    .footer { margin-top: 50px; text-align: center; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">RECEITA ÓTICA</div>
                    <div>Data: ${new Date(rx.rxDate).toLocaleDateString()}</div>
                </div>
                <div class="info">
                    <div><strong>Paciente:</strong> ${rx.contactName}</div>
                    <div><strong>Profissional:</strong> ${rx.professionalName || '---'}</div>
                </div>
                
                <h3>Longe</h3>
                <table class="grid">
                    <tr><th>Olho</th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>DNP</th><th>Altura</th></tr>
                    <tr><td>OD</td><td>${rx.sphereOdLonge || ''}</td><td>${rx.cylOdLonge || ''}</td><td>${rx.axisOdLonge || ''}</td><td>${rx.dnpOd || ''}</td><td>${rx.heightOd || ''}</td></tr>
                    <tr><td>OE</td><td>${rx.sphereOeLonge || ''}</td><td>${rx.cylOeLonge || ''}</td><td>${rx.axisOeLonge || ''}</td><td>${rx.dnpOe || ''}</td><td>${rx.heightOe || ''}</td></tr>
                </table>

                ${(rx.addition || rx.sphereOdPerto) ? `
                <h3>Perto / Adição</h3>
                <table class="grid">
                    <tr><th>Adição</th><th>Esférico (Perto)</th></tr>
                    <tr><td>${rx.addition || ''}</td><td>OD: ${rx.sphereOdPerto || ''} | OE: ${rx.sphereOePerto || ''}</td></tr>
                </table>` : ''}

                <div class="obs">
                    <strong>Observações / Laboratório:</strong><br/>
                    ${rx.observations || ''}
                </div>

                <div class="footer">
                    Impresso em ${new Date().toLocaleString()}
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
    };

    const handleSendWhatsApp = (rx: OpticalRx, lab: Laboratory) => {
        if (!lab.phone) { showAlert("Laboratório sem telefone cadastrado.", "warning"); return; }
        const text = `*PEDIDO DE LENTES - ${rx.contactName}*\n\n` +
            `*LONGE:*\n` +
            `OD: Esf ${rx.sphereOdLonge || 0} | Cil ${rx.cylOdLonge || 0} | Eixo ${rx.axisOdLonge || 0} | DNP ${rx.dnpOd}\n` +
            `OE: Esf ${rx.sphereOeLonge || 0} | Cil ${rx.cylOeLonge || 0} | Eixo ${rx.axisOeLonge || 0} | DNP ${rx.dnpOe}\n\n` +
            (rx.addition ? `*ADIÇÃO:* ${rx.addition}\n` : '') +
            `*OBS:* ${rx.observations || 'Nenhuma'}\n\n` +
            `Data Pedido: ${new Date().toLocaleDateString()}`;
        
        window.open(`https://wa.me/${lab.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
        onUpdateRx({ ...rx, labStatus: 'LAB_ENVIADO', labSentDate: new Date().toISOString() });
    };

    const handleSendEmail = (rx: OpticalRx, lab: Laboratory) => {
        if (!lab.email) { showAlert("Laboratório sem e-mail cadastrado.", "warning"); return; }
        const subject = `PEDIDO DE LENTES - ${rx.contactName}`;
        const body = `Favor confeccionar as seguintes lentes:\n\nPACIENTE: ${rx.contactName}\n\n` +
            `OD: Esf ${rx.sphereOdLonge || 0} / Cil ${rx.cylOdLonge || 0} / Eixo ${rx.axisOdLonge || 0}\n` +
            `OE: Esf ${rx.sphereOeLonge || 0} / Cil ${rx.cylOeLonge || 0} / Eixo ${rx.axisOeLonge || 0}\n` +
            `ADIÇÃO: ${rx.addition || ''}\n\n` +
            `OBS: ${rx.observations || ''}`;
        
        window.open(`mailto:${lab.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        onUpdateRx({ ...rx, labStatus: 'LAB_ENVIADO', labSentDate: new Date().toISOString() });
    };

    const handleAssignLab = async (rx: OpticalRx, labId: string) => {
        onUpdateRx({ ...rx, laboratoryId: labId, labStatus: 'LAB_PENDENTE' });
        showAlert("Laboratório vinculado.", "success");
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
                    <p className="text-gray-500 mt-1">Gestão de prescrições e envio para laboratório.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input type="text" placeholder="Buscar receita..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                    </div>
                    <button id="btn-new-rx" onClick={onAddRx} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95 whitespace-nowrap">
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
                ) : filteredRxs.map(rx => {
                    const linkedLab = laboratories.find(l => l.id === rx.laboratoryId);
                    return (
                    <div key={rx.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-lg transition-all group flex flex-col md:flex-row gap-6">
                        {/* Info Básica */}
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-lg">
                                        {rx.contactName?.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg">{rx.contactName}</h3>
                                        <div className="flex items-center gap-2 text-gray-400 text-xs font-medium">
                                            <Calendar className="w-3 h-3"/> {new Date(rx.rxDate).toLocaleDateString()}
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <span>Validade: {rx.expirationDate ? new Date(rx.expirationDate).toLocaleDateString() : '---'}</span>
                                        </div>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(rx.labStatus)}`}>
                                    {getStatusLabel(rx.labStatus)}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase">Olho Direito (OD)</p>
                                    <p className="text-sm font-bold text-gray-700">{rx.sphereOdLonge || '0.00'} ESF | {rx.cylOdLonge || '0.00'} CIL</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase">Olho Esquerdo (OE)</p>
                                    <p className="text-sm font-bold text-gray-700">{rx.sphereOeLonge || '0.00'} ESF | {rx.cylOeLonge || '0.00'} CIL</p>
                                </div>
                            </div>
                        </div>

                        {/* Gestão de Laboratório */}
                        <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-100 md:pl-6 pt-4 md:pt-0 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                                        <Microscope className="w-3 h-3"/> Laboratório
                                    </span>
                                    {linkedLab && (
                                        <button 
                                            onClick={() => onUpdateRx({...rx, laboratoryId: undefined, labStatus: undefined})}
                                            className="text-[9px] text-rose-400 hover:underline"
                                        >
                                            Desvincular
                                        </button>
                                    )}
                                </div>
                                
                                <select 
                                    className="w-full bg-white border border-gray-200 rounded-xl p-2 text-xs font-bold outline-none mb-3"
                                    value={rx.laboratoryId || ''}
                                    onChange={(e) => handleAssignLab(rx, e.target.value)}
                                >
                                    <option value="">Selecione o Laboratório...</option>
                                    {laboratories.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
                                </select>

                                {linkedLab && (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSendWhatsApp(rx, linkedLab)} title="Enviar WhatsApp" className="flex-1 bg-emerald-50 text-emerald-600 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"><Send className="w-3 h-3"/> Zap</button>
                                        <button onClick={() => handleSendEmail(rx, linkedLab)} title="Enviar E-mail" className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"><Mail className="w-3 h-3"/> Email</button>
                                        
                                        <select 
                                            className="flex-[2] bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold outline-none border-none text-center cursor-pointer"
                                            value={rx.labStatus || 'LAB_PENDENTE'}
                                            onChange={(e) => onUpdateRx({...rx, labStatus: e.target.value as OpticalDeliveryStatus})}
                                        >
                                            <option value="LAB_PENDENTE">Pendente</option>
                                            <option value="LAB_ENVIADO">Enviado</option>
                                            <option value="LAB_PRODUCAO">Em Produção</option>
                                            <option value="LAB_PRONTO">Pronto</option>
                                            <option value="LAB_RECEBIDO">Recebido (Loja)</option>
                                            <option value="ENTREGUE_CLIENTE">Entregue (Cliente)</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-50">
                                <button onClick={() => handlePrintRx(rx)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg text-xs font-bold flex items-center gap-1"><Printer className="w-4 h-4"/> Imprimir</button>
                                <button onClick={() => onEditRx(rx)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button>
                                <button onClick={() => onDeleteRx(rx.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    </div>
                )})}
            </div>
        </div>
    );
};

export default OpticalModule;
