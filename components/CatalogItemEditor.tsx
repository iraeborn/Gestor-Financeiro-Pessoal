import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ServiceItem, Branch, VariationAttribute, ProductSKU, OSItem, InventoryEvent } from '../types';
import { 
    ArrowLeft, Save, Box, Tag, ImageIcon, UploadCloud, Loader2, 
    Settings, ShieldCheck, Zap, DollarSign, Store, Info, Trash2, Plus,
    ChevronDown, X, Layers, Hash, Sparkles, Package, Wrench, ClipboardList,
    AlertCircle, CheckCircle2, ShoppingCart, RefreshCw, History, ArrowRightLeft,
    TrendingUp, TrendingDown, Clock, User, Percent, ListChecks, Grid3X3
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
        description: '',
        moduleTag: 'GENERAL'
    });

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
        } catch (e) { console.error(e); }
        finally { setIsLoadingHistory(false); }
    };

    const handleRecordMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        const qty = Number(movementData.quantity);
        if (qty <= 0) return showAlert("Quantidade inválida.", "warning");
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/catalog/inventory/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ serviceItemId: initialData!.id, ...movementData })
            });
            if (res.ok) {
                showAlert("Movimentação registrada!", "success");
                setIsMovementModalOpen(false);
                
                // CRÍTICO: Atualiza o saldo local (Saldo em Prateleira) imediatamente
                const mult = ['ADJUSTMENT_REMOVE', 'SALE', 'TRANSFER_OUT'].includes(movementData.type) ? -1 : 1;
                const newStock = (Number(formData.stockQuantity) || 0) + (qty * mult);
                
                setFormData(prev => ({ ...prev, stockQuantity: newStock }));
                
                // Limpa o form de movimento e recarrega histórico
                setMovementData({ type: 'ADJUSTMENT_ADD', quantity: 0, branchId: branches[0]?.id || '', notes: '', costUnitPrice: 0 });
                loadInventoryHistory(initialData!.id);
            } else {
                const err = await res.json();
                showAlert(err.error || "Erro ao ajustar estoque.", "error");
            }
        } catch (e) { showAlert("Erro de conexão.", "error"); }
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
                headers: { 'Authorization': `Bearer ${token}` }, 
                body: uploadData
            });
            const { urls } = await res.json();
            setFormData(prev => ({ ...prev, imageUrl: urls[0] }));
        } catch (err) { showAlert("Erro no upload.", "error"); }
        finally { setIsUploading(false); }
    };

    const handleAddCompositeItem = (itemId: string) => {
        const item = serviceItems.find(i => i.id === itemId);
        if (!item) return;
        const newItem: OSItem = {
            id: crypto.randomUUID(),
            serviceItemId: item.id,
            description: item.name,
            quantity: 1,
            unitPrice: item.defaultPrice,
            totalPrice: item.defaultPrice
        };
        setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const handleUpdateCompositeItem = (id: string, qty: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items?.map(i => i.id === id ? { ...i, quantity: qty, totalPrice: qty * i.unitPrice } : i)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return showAlert("Nome obrigatório", "warning");
        onSave({ 
            ...formData, 
            id: formData.id || crypto.randomUUID()
        } as ServiceItem);
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-32">
            {/* Header Estratégico */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 border-b border-gray-100 pb-8">
                <div className="flex items-center gap-6">
                    <button onClick={onCancel} className="p-3 hover:bg-white rounded-2xl border border-gray-200 shadow-sm text-gray-400 hover:text-indigo-600 transition-all">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{initialData ? 'Gestão de Item' : 'Novo Item no Catálogo'}</h1>
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${formData.type === 'PRODUCT' ? 'bg-indigo-600 text-white' : 'bg-amber-50 text-white'}`}>
                                {formData.type === 'PRODUCT' ? 'Produto' : 'Serviço'}
                            </span>
                        </div>
                        <p className="text-slate-500 font-medium mt-1">Definição técnica, comercial e logística.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Descartar</button>
                    <button onClick={handleSubmit} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Salvar Alterações
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                
                {/* Coluna Lateral: Identidade e Estoque */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                        <label className="block text-[10px] font-black uppercase text-gray-400 ml-1 tracking-[0.2em]">Mídia Principal</label>
                        <div onClick={() => fileInputRef.current?.click()} className={`aspect-square rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group ${formData.imageUrl ? 'border-indigo-500' : 'border-slate-200 hover:border-indigo-400 bg-slate-50'}`}>
                            {formData.imageUrl ? (
                                <>
                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-indigo-600/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><UploadCloud className="w-10 h-10 text-white" /></div>
                                </>
                            ) : (
                                <>
                                    {isUploading ? <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /> : <ImageIcon className="w-10 h-10 text-slate-200" />}
                                    <span className="text-[10px] font-black uppercase text-slate-400 mt-4 tracking-widest">Upload Foto</span>
                                </>
                            )}
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                        </div>
                    </div>

                    {formData.type === 'PRODUCT' && (
                        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl space-y-8 overflow-hidden relative">
                            <div className="absolute -right-4 -top-4 opacity-5 rotate-12"><Package className="w-32 h-32" /></div>
                            
                            <div className="relative z-10">
                                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-2">Saldo em Prateleira</p>
                                <div className="flex items-baseline gap-3">
                                    <h2 className="text-6xl font-black">{formData.stockQuantity}</h2>
                                    <span className="text-indigo-400 font-bold uppercase text-sm">{formData.unit}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-4 flex items-center gap-2">
                                    <ShieldCheck className="w-3 h-3"/> Trilha de auditoria ativa
                                </p>
                            </div>

                            {initialData ? (
                                <button 
                                    type="button" 
                                    onClick={() => setIsMovementModalOpen(true)}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/40"
                                >
                                    <ArrowRightLeft className="w-4 h-4" /> Ajustar Estoque
                                </button>
                            ) : (
                                <div className="space-y-3 pt-4 border-t border-white/10">
                                    <label className="text-[10px] font-black uppercase text-indigo-300">Saldo Inicial de Cadastro</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-white/10 border-none rounded-xl p-4 text-sm font-black outline-none focus:bg-white/20"
                                        value={formData.stockQuantity || ''}
                                        onChange={e => setFormData({...formData, stockQuantity: Number(e.target.value)})}
                                        placeholder="0"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Coluna Principal: Configurações Comerciais e Técnicas */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Dados Básicos */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-10">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <Info className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Informações Mestres</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nome do Item</label>
                                <input type="text" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Código de Referência / SKU</label>
                                <div className="relative">
                                    <Hash className="absolute left-4 top-4 w-4 h-4 text-slate-300" />
                                    <input type="text" className="w-full pl-11 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="EX: MOD-001" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marca / Fabricante</label>
                                <input type="text" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* Preços e Custos */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-10">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Comercial & Financeiro</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Preço de Venda</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-4 text-sm font-black text-emerald-600">R$</span>
                                    <input type="number" step="0.01" className="w-full pl-11 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.defaultPrice || ''} onChange={e => setFormData({...formData, defaultPrice: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Preço de Custo</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-4 text-sm font-black text-rose-500">R$</span>
                                    <input type="number" step="0.01" className="w-full pl-11 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-rose-500" value={formData.costPrice || ''} onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-center">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Margem Bruta</p>
                                <h4 className={`text-xl font-black ${formData.defaultPrice! > formData.costPrice! ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {formData.defaultPrice && formData.costPrice ? `${(((formData.defaultPrice - formData.costPrice) / formData.defaultPrice) * 100).toFixed(1)}%` : '0%'}
                                </h4>
                            </div>
                        </div>
                    </div>

                    {/* Módulo de Composição (Kits) */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                            <div className="flex items-center gap-3">
                                <Layers className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Composição / Combo</h3>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={formData.isComposite} onChange={e => setFormData({...formData, isComposite: e.target.checked})} />
                                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        
                        {formData.isComposite && (
                            <div className="space-y-4 animate-fade-in">
                                <select 
                                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold outline-none"
                                    onChange={e => { if(e.target.value) handleAddCompositeItem(e.target.value); e.target.value = ''; }}
                                >
                                    <option value="">+ Adicionar Item à Composição</option>
                                    {serviceItems.filter(i => i.id !== formData.id).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <div className="space-y-2">
                                    {formData.items?.map(sub => (
                                        <div key={sub.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="text-sm font-bold text-slate-700">{sub.description}</span>
                                            <div className="flex items-center gap-4">
                                                <input type="number" className="w-16 bg-white rounded-lg p-2 text-xs font-black text-center" value={sub.quantity} onChange={e => handleUpdateCompositeItem(sub.id, Number(e.target.value))} />
                                                <button onClick={() => setFormData({...formData, items: formData.items?.filter(i => i.id !== sub.id)})} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Módulo de Variações (Grade/SKUs) */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-6">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <Grid3X3 className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Grade & Variações</h3>
                        </div>
                        <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                            <Sparkles className="w-10 h-10 text-indigo-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold text-sm uppercase tracking-tight">Módulo de SKUs por Atributos</p>
                            <button type="button" className="mt-4 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline">Habilitar Grade Avançada</button>
                        </div>
                    </div>

                    {/* Regras de Operação */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-10">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <ListChecks className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Regras de Operação</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <label className="flex items-center gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 cursor-pointer group hover:bg-white hover:border-indigo-100 transition-all">
                                <input type="checkbox" checked={formData.warrantyEnabled} onChange={e => setFormData({...formData, warrantyEnabled: e.target.checked})} className="w-6 h-6 rounded-lg text-indigo-600" />
                                <div>
                                    <span className="block font-black uppercase text-[10px] tracking-widest text-slate-400 group-hover:text-indigo-600">Possui Garantia</span>
                                    {formData.warrantyEnabled && <input type="number" className="mt-2 w-24 bg-white rounded-lg p-2 text-xs font-black" value={formData.warrantyDays} onChange={e => setFormData({...formData, warrantyDays: Number(e.target.value)})} placeholder="Dias" />}
                                </div>
                            </label>
                            <label className="flex items-center gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 cursor-pointer group hover:bg-white hover:border-indigo-100 transition-all">
                                <input type="checkbox" checked={formData.autoGenerateOS} onChange={e => setFormData({...formData, autoGenerateOS: e.target.checked})} className="w-6 h-6 rounded-lg text-indigo-600" />
                                <div>
                                    <span className="block font-black uppercase text-[10px] tracking-widest text-slate-400 group-hover:text-indigo-600">Gerar O.S. Automática</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Ao vender este item</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Histórico Logístico (Apenas se já existir) */}
                    {initialData && formData.type === 'PRODUCT' && (
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 space-y-8">
                            <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                                <div className="flex items-center gap-3">
                                    <History className="w-5 h-5 text-indigo-600" />
                                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Movimentações Recentes</h3>
                                </div>
                                <button type="button" onClick={() => loadInventoryHistory(initialData.id)}><RefreshCw className={`w-4 h-4 text-indigo-400 ${isLoadingHistory ? 'animate-spin' : ''}`} /></button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                {inventoryHistory.map(event => (
                                    <div key={event.id} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-white hover:border-indigo-100 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter ${['PURCHASE', 'ADJUSTMENT_ADD', 'TRANSFER_IN'].includes(event.type) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {event.type}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-700 leading-none">{event.notes || 'Registro imutável'}</p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">{new Date(event.date).toLocaleDateString()} • {event.userName || 'Sistema'}</p>
                                            </div>
                                        </div>
                                        <p className={`text-sm font-black ${['SALE', 'TRANSFER_OUT', 'ADJUSTMENT_REMOVE'].includes(event.type) ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            {['SALE', 'TRANSFER_OUT', 'ADJUSTMENT_REMOVE'].includes(event.type) ? '-' : '+'}{event.quantity}
                                        </p>
                                    </div>
                                ))}
                                {inventoryHistory.length === 0 && <p className="text-center py-10 text-gray-300 italic text-sm">Sem histórico registrado.</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Movimentação de Estoque */}
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
                                    { id: 'ADJUSTMENT_ADD', label: 'Entrada (+)', icon: TrendingUp },
                                    { id: 'ADJUSTMENT_REMOVE', label: 'Saída (-)', icon: TrendingDown },
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
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Quantidade</label><input type="number" required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500" value={movementData.quantity || ''} onChange={e => setMovementData({...movementData, quantity: parseFloat(e.target.value) || 0})} /></div>
                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Custo Médio</label><input type="number" step="0.01" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500" value={movementData.costUnitPrice || ''} onChange={e => setMovementData({...movementData, costUnitPrice: parseFloat(e.target.value) || 0})} /></div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Local / Unidade</label>
                                <select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold" value={movementData.branchId} onChange={e => setMovementData({...movementData, branchId: e.target.value})}>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Motivo do Ajuste</label>
                                {/* Fix: Use movementData instead of formData to fix the TypeScript error */}
                                <textarea className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold min-h-[80px]" value={movementData.notes} onChange={e => setMovementData({...movementData, notes: e.target.value})} placeholder="Ex: NF-e #123, Perda técnica..." />
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl">Confirmar Registro</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CatalogItemEditor;