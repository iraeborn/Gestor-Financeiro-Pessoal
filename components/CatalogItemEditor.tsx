
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ServiceItem, Branch, VariationAttribute, ProductSKU, OSItem, InventoryEvent } from '../types';
import { 
    ArrowLeft, Save, Box, Tag, ImageIcon, UploadCloud, Loader2, 
    Settings, ShieldCheck, Zap, DollarSign, Store, Info, Trash2, Plus,
    ChevronDown, X, Layers, Hash, Sparkles, Package, Wrench, ClipboardList,
    AlertCircle, CheckCircle2, ShoppingCart, RefreshCw, History, ArrowRightLeft,
    TrendingUp, TrendingDown, Clock, User
} from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface CatalogItemEditorProps {
    initialData?: ServiceItem | null;
    branches: Branch[];
    serviceItems: ServiceItem[];
    onSave: (item: ServiceItem) => void;
    onCancel: () => void;
}

const CatalogItemEditor: React.FC<CatalogItemEditorProps> = ({ 
    initialData, branches, serviceItems, onSave, onCancel 
}) => {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<Partial<ServiceItem>>({
        type: 'PRODUCT',
        defaultPrice: 0,
        costPrice: 0,
        categories: [],
        brand: '',
        unit: 'un',
        branchId: branches[0]?.id || '',
        stockQuantity: 0,
        warrantyEnabled: false,
        warrantyDays: 0,
        isFreeAllowed: false,
        autoGenerateOS: false,
        isComposite: false,
        items: [],
        variationAttributes: [],
        skus: [],
        description: ''
    });

    const [categoryInput, setCategoryInput] = useState('');
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const categoryMenuRef = useRef<HTMLDivElement>(null);

    // Estados para o novo fluxo de estoque por eventos
    const [inventoryHistory, setInventoryHistory] = useState<InventoryEvent[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [movementData, setMovementData] = useState({
        type: 'ADJUSTMENT_ADD' as any,
        quantity: 0,
        branchId: branches[0]?.id || '',
        notes: '',
        costUnitPrice: 0
    });

    useEffect(() => {
        if (initialData) {
            setFormData({ 
                ...initialData,
                variationAttributes: initialData.variationAttributes || [],
                skus: initialData.skus || [],
                items: initialData.items || [],
                description: initialData.description || '',
                categories: initialData.categories || (initialData.category ? [initialData.category] : [])
            });
            loadInventoryHistory(initialData.id);
        }
    }, [initialData]);

    const loadInventoryHistory = async (itemId: string) => {
        setIsLoadingHistory(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/catalog/inventory/history/${itemId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setInventoryHistory(data);
            }
        } catch (e) {
            console.error("Erro ao carregar histórico de estoque", e);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleRecordMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (movementData.quantity <= 0) return showAlert("A quantidade deve ser maior que zero.", "warning");
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/catalog/inventory/event', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    serviceItemId: initialData!.id,
                    ...movementData
                })
            });

            if (res.ok) {
                showAlert("Movimentação registrada!", "success");
                setIsMovementModalOpen(false);
                setMovementData({ type: 'ADJUSTMENT_ADD', quantity: 0, branchId: branches[0]?.id || '', notes: '', costUnitPrice: 0 });
                // Atualiza o saldo localmente para feedback imediato
                const multiplier = ['ADJUSTMENT_REMOVE', 'SALE', 'TRANSFER_OUT'].includes(movementData.type) ? -1 : 1;
                setFormData(prev => ({ ...prev, stockQuantity: (prev.stockQuantity || 0) + (movementData.quantity * multiplier) }));
                loadInventoryHistory(initialData!.id);
            } else {
                const err = await res.json();
                showAlert(err.error || "Erro ao registrar movimento.", "error");
            }
        } catch (e) {
            showAlert("Erro de conexão.", "error");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setIsUploading(true);
        try {
            const token = localStorage.getItem('token');
            const uploadData = new FormData();
            uploadData.append('files', e.target.files[0]);
            const res = await fetch('/api/upload', {
                method: 'POST', 
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }, 
                body: uploadData
            });
            if (!res.ok) throw new Error("Falha no upload");
            const { urls } = await res.json();
            setFormData(prev => ({ ...prev, imageUrl: urls[0] }));
            showAlert("Imagem enviada!", "success");
        } catch (err) { 
            showAlert("Erro ao subir imagem.", "error"); 
        } finally { 
            setIsUploading(false); 
        }
    };

    const addCategory = (cat: string) => {
        const trimmed = cat.trim();
        if (!trimmed) return;
        const current = formData.categories || [];
        if (current.includes(trimmed)) return;
        setFormData({ ...formData, categories: [...current, trimmed] });
        setCategoryInput('');
        setShowCategoryMenu(false);
    };

    const removeCategory = (cat: string) => {
        setFormData({ 
            ...formData, 
            categories: (formData.categories || []).filter(c => c !== cat) 
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return showAlert("O nome é obrigatório", "warning");
        onSave({ 
            ...formData, 
            id: formData.id || crypto.randomUUID(),
            moduleTag: formData.moduleTag || 'GENERAL'
        } as ServiceItem);
    };

    const getEventColor = (type: string) => {
        if (['PURCHASE', 'ADJUSTMENT_ADD', 'TRANSFER_IN', 'RETURN'].includes(type)) return 'text-emerald-600 bg-emerald-50';
        return 'text-rose-600 bg-rose-50';
    };

    const getEventLabel = (type: string) => {
        const map: any = {
            'PURCHASE': 'Compra',
            'SALE': 'Venda',
            'TRANSFER_IN': 'Entrada Transf.',
            'TRANSFER_OUT': 'Saída Transf.',
            'ADJUSTMENT_ADD': 'Ajuste (+)',
            'ADJUSTMENT_REMOVE': 'Ajuste (-)',
            'RETURN': 'Devolução'
        };
        return map[type] || type;
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                            {initialData ? 'Configurar Item' : 'Novo Item do Catálogo'}
                        </h1>
                        <p className="text-gray-500 font-medium">{formData.name || 'Defina as características do produto ou serviço'}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">Descartar</button>
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Salvar Item
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {/* Foto e Preços (Mantido para contexto) */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-4">
                        <label className="block text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Foto de Exibição</label>
                        <div onClick={() => fileInputRef.current?.click()} className={`aspect-square rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group ${formData.imageUrl ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-400 bg-gray-50'}`}>
                            {formData.imageUrl ? (
                                <>
                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-indigo-600/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><UploadCloud className="w-10 h-10 text-white" /></div>
                                </>
                            ) : (
                                <>
                                    {isUploading ? <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /> : <ImageIcon className="w-10 h-10 text-gray-200" />}
                                    <span className="text-[10px] font-black uppercase text-gray-400 mt-4">Upload</span>
                                </>
                            )}
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                        </div>
                    </div>

                    {/* MONITOR DE ESTOQUE (EVENT-DRIVEN UI) */}
                    {formData.type === 'PRODUCT' && (
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl space-y-6 overflow-hidden relative">
                            <div className="absolute -right-4 -top-4 opacity-5 rotate-12"><Package className="w-32 h-32" /></div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em]">Saldo Consolidado</label>
                                    <span className="bg-indigo-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Auditado</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-5xl font-black">{formData.stockQuantity}</h2>
                                    <span className="text-indigo-400 font-bold uppercase text-xs">{formData.unit}</span>
                                </div>
                                <p className="text-[9px] text-slate-500 font-bold uppercase mt-2">Atualizado via eventos logísticos</p>
                            </div>

                            {initialData && (
                                <div className="space-y-3 relative z-10">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsMovementModalOpen(true)}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50"
                                    >
                                        <Plus className="w-4 h-4" /> Registrar Movimentação
                                    </button>
                                </div>
                            )}

                            {!initialData && (
                                <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                                    <p className="text-[10px] font-bold text-indigo-300 leading-relaxed uppercase">
                                        <Info className="w-3.5 h-3.5 inline mr-1 mb-0.5" /> O saldo inicial poderá ser definido apenas no momento da criação. Ajustes futuros deverão ser feitos via histórico.
                                    </p>
                                    <input 
                                        type="number" 
                                        placeholder="Saldo Inicial"
                                        className="w-full mt-3 bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-black text-white focus:bg-white/10 outline-none"
                                        value={formData.stockQuantity || ''}
                                        onChange={e => setFormData({...formData, stockQuantity: Number(e.target.value)})}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 space-y-8">
                    {/* Histórico de Movimentações */}
                    {initialData && formData.type === 'PRODUCT' && (
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-6">
                            <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 text-slate-600 rounded-xl"><History className="w-5 h-5"/></div>
                                    <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Trilha de Auditoria de Estoque</h3>
                                </div>
                                <button type="button" onClick={() => loadInventoryHistory(initialData.id)} className="text-indigo-600"><RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} /></button>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 scrollbar-thin">
                                {isLoadingHistory ? (
                                    <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-300 mx-auto" /></div>
                                ) : inventoryHistory.length === 0 ? (
                                    <div className="py-12 text-center text-gray-300 text-sm font-bold uppercase tracking-widest opacity-50">Sem histórico registrado.</div>
                                ) : inventoryHistory.map(event => (
                                    <div key={event.id} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl group hover:bg-white hover:border-indigo-100 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${getEventColor(event.type)}`}>
                                                {getEventLabel(event.type)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-700 leading-none">{event.notes || 'Sem observações'}</p>
                                                <div className="flex items-center gap-2 mt-1.5 text-[9px] font-bold text-gray-400 uppercase">
                                                    <Clock className="w-3 h-3"/> {new Date(event.date).toLocaleDateString()}
                                                    <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                                    {/* Fix: User icon component from lucide-react and camelCase property name */}
                                                    <User className="w-3 h-3" /> {event.userName || 'Sistema'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-black ${['SALE', 'TRANSFER_OUT', 'ADJUSTMENT_REMOVE'].includes(event.type) ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {['SALE', 'TRANSFER_OUT', 'ADJUSTMENT_REMOVE'].includes(event.type) ? '-' : '+'}{event.quantity}
                                            </p>
                                            {/* Fix: camelCase property name to match updated interface */}
                                            <p className="text-[9px] text-gray-300 font-bold uppercase">{event.branchName || 'Sede'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dados Básicos (Mantido) */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome Completo</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Tipo</label>
                                <div className="flex bg-gray-100 p-1 rounded-2xl">
                                    <button type="button" onClick={() => setFormData({...formData, type: 'PRODUCT'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.type === 'PRODUCT' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Produto</button>
                                    <button type="button" onClick={() => setFormData({...formData, type: 'SERVICE'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.type === 'SERVICE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Serviço</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Marca</label>
                                <input className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL DE REGISTRO DE MOVIMENTAÇÃO */}
            {isMovementModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                                <ArrowRightLeft className="w-6 h-6 text-indigo-600" /> Registrar Movimento
                            </h2>
                            <button onClick={() => setIsMovementModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <form onSubmit={handleRecordMovement} className="space-y-6">
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'ADJUSTMENT_ADD', label: 'Entrada (+)', icon: TrendingUp, color: 'text-emerald-600 border-emerald-100 bg-emerald-50' },
                                    { id: 'ADJUSTMENT_REMOVE', label: 'Saída (-)', icon: TrendingDown, color: 'text-rose-600 border-rose-100 bg-rose-50' },
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setMovementData({...movementData, type: opt.id})}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${movementData.type === opt.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                    >
                                        <opt.icon className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase">{opt.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Quantidade</label>
                                    <input 
                                        type="number" 
                                        required
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={movementData.quantity || ''} 
                                        onChange={e => setMovementData({...movementData, quantity: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Custo Unitário (R$)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={movementData.costUnitPrice || ''} 
                                        onChange={e => setMovementData({...movementData, costUnitPrice: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Local / Unidade</label>
                                <select 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none"
                                    value={movementData.branchId}
                                    onChange={e => setMovementData({...movementData, branchId: e.target.value})}
                                    required
                                >
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Motivo / Observação</label>
                                <textarea 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none min-h-[80px]" 
                                    value={movementData.notes}
                                    onChange={e => setMovementData({...movementData, notes: e.target.value})}
                                    placeholder="Ex: Perda por validade, Inventário periódico..."
                                />
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center justify-center gap-3">
                                Confirmar Movimentação
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CatalogItemEditor;
