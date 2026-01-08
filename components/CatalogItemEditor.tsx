
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ServiceItem, Branch, OSItem } from '../types';
import { 
    ArrowLeft, Save, Box, Tag, ImageIcon, UploadCloud, Loader2, 
    Settings, ShieldCheck, Zap, DollarSign, Store, Info, Trash2, Plus
} from 'lucide-react';
import { useAlert } from './AlertSystem';

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
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<Partial<ServiceItem>>({
        type: 'PRODUCT',
        defaultPrice: 0,
        costPrice: 0,
        category: '',
        branchId: branches[0]?.id || '',
        stockQuantity: 0,
        warrantyEnabled: false,
        warrantyDays: 0,
        isFreeAllowed: false,
        autoGenerateOS: false
    });

    useEffect(() => {
        if (initialData) {
            setFormData({ ...initialData });
        }
    }, [initialData]);

    const existingCategories = useMemo(() => {
        return Array.from(new Set(serviceItems.map(i => i.category).filter(Boolean))).sort();
    }, [serviceItems]);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return showAlert("O nome é obrigatório", "warning");
        
        onSave({ 
            ...formData, 
            id: formData.id || crypto.randomUUID() 
        } as ServiceItem);
    };

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                            {initialData ? 'Editar Item do Catálogo' : 'Novo Item do Catálogo'}
                        </h1>
                        <p className="text-gray-500 font-medium">{formData.name || 'Defina os detalhes técnicos do produto ou serviço'}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-6 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">Descartar</button>
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Salvar Item
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {/* Upload de Imagem Grande */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-4">
                        <label className="block text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Foto de Exibição</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()} 
                            className={`aspect-square rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group ${formData.imageUrl ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-400 bg-gray-50'}`}
                        >
                            {formData.imageUrl ? (
                                <>
                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-indigo-600/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <UploadCloud className="w-10 h-10 text-white" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {isUploading ? <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /> : <ImageIcon className="w-10 h-10 text-gray-200" />}
                                    <span className="text-[10px] font-black uppercase text-gray-400 mt-4">Clique para Upload</span>
                                </>
                            )}
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                        </div>
                        <p className="text-[9px] text-gray-400 text-center uppercase font-bold px-4">Formatos suportados: JPG, PNG. Máximo 2MB.</p>
                    </div>

                    {/* Preços rápidos */}
                    <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">Preço de Venda (R$)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-4 w-5 h-5 text-indigo-400" />
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className="w-full pl-12 py-4 bg-white/10 border-none rounded-2xl text-2xl font-black text-white outline-none focus:ring-2 focus:ring-indigo-500" 
                                    value={formData.defaultPrice} 
                                    onChange={e => setFormData({...formData, defaultPrice: parseFloat(e.target.value) || 0})} 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">Custo Base (R$)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-4 w-5 h-5 text-rose-400" />
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className="w-full pl-12 py-4 bg-white/10 border-none rounded-2xl text-2xl font-black text-white outline-none focus:ring-2 focus:ring-rose-500" 
                                    value={formData.costPrice} 
                                    onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    {/* Dados Principais */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-10 space-y-8">
                        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                            <Box className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Informações Básicas</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome do Item / Referência</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    value={formData.name || ''} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    required 
                                    placeholder="Ex: Armação Ray-Ban Aviador Black" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Categoria</label>
                                <div className="relative">
                                    <Tag className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <input 
                                        list="cat-list" 
                                        className="w-full pl-11 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" 
                                        value={formData.category || ''} 
                                        onChange={e => setFormData({...formData, category: e.target.value})} 
                                        placeholder="Busca ou Nova..." 
                                    />
                                    <datalist id="cat-list">{existingCategories.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Tipo de Item</label>
                                <select 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none appearance-none" 
                                    value={formData.type} 
                                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                                >
                                    <option value="PRODUCT">📦 Produto em Estoque</option>
                                    <option value="SERVICE">🛠️ Serviço / Mão de Obra</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Descrição Detalhada</label>
                            <textarea 
                                className="w-full bg-gray-50 border-none rounded-[2rem] p-6 text-sm font-medium min-h-[120px] outline-none shadow-inner" 
                                value={formData.description || ''} 
                                onChange={e => setFormData({...formData, description: e.target.value})} 
                                placeholder="Descreva especificações técnicas, materiais ou detalhes do serviço..."
                            />
                        </div>
                    </div>

                    {/* Bloco Condicional: Estoque */}
                    {formData.type === 'PRODUCT' && (
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-10 space-y-8 animate-slide-in-bottom">
                            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                                <Store className="w-5 h-5 text-emerald-600" />
                                <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Gestão de Estoque & Garantia</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-indigo-600 mb-2 ml-1">Saldo Inicial (Quantidade)</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-lg font-black text-indigo-700 outline-none" 
                                        value={formData.stockQuantity} 
                                        onChange={e => setFormData({...formData, stockQuantity: Number(e.target.value)})} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-indigo-600 mb-2 ml-1">Unidade / Filial Padrão</label>
                                    <select 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" 
                                        value={formData.branchId || ''} 
                                        onChange={e => setFormData({...formData, branchId: e.target.value})}
                                    >
                                        <option value="">Selecione...</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-white rounded-xl text-amber-600 shadow-sm">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-black text-amber-800 uppercase tracking-widest">Política de Garantia</span>
                                            <p className="text-[10px] text-amber-600 font-bold uppercase mt-0.5">Vincular tempo de cobertura ao item</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={formData.warrantyEnabled} 
                                            onChange={e => setFormData({...formData, warrantyEnabled: e.target.checked})} 
                                        />
                                        <div className="w-12 h-6 bg-amber-200/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                                    </label>
                                </div>
                                {formData.warrantyEnabled && (
                                    <div className="mt-6 pt-4 border-t border-amber-100 flex items-center gap-4 animate-fade-in">
                                        <span className="text-[10px] font-black text-amber-700 uppercase">Tempo de Garantia (Dias):</span>
                                        <input 
                                            type="number" 
                                            className="w-24 bg-white rounded-xl p-2 text-sm font-black text-center border border-amber-200 outline-none" 
                                            value={formData.warrantyDays} 
                                            onChange={e => setFormData({...formData, warrantyDays: Number(e.target.value)})} 
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Bloco Condicional: Automação de Serviço */}
                    {formData.type === 'SERVICE' && (
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-10 space-y-8 animate-slide-in-bottom">
                            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                                <Zap className="w-5 h-5 text-sky-600" />
                                <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Regras de Operação</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <label className="flex items-start gap-4 p-6 bg-sky-50 rounded-3xl border border-sky-100 cursor-pointer hover:bg-sky-100 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.isFreeAllowed} 
                                        onChange={e => setFormData({...formData, isFreeAllowed: e.target.checked})} 
                                        className="w-6 h-6 text-sky-600 rounded-lg mt-1" 
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-sky-800 uppercase tracking-tight">Cortesia Habilitada</span>
                                        <span className="text-[10px] text-sky-600 font-bold uppercase mt-1 leading-tight">Este serviço pode ser lançado com valor zero em orçamentos.</span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-4 p-6 bg-indigo-50 rounded-3xl border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.autoGenerateOS} 
                                        onChange={e => setFormData({...formData, autoGenerateOS: e.target.checked})} 
                                        className="w-6 h-6 text-indigo-600 rounded-lg mt-1" 
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-indigo-800 uppercase tracking-tight">Geração de O.S. Automática</span>
                                        <span className="text-[10px] text-indigo-600 font-bold uppercase mt-1 leading-tight">Ao faturar uma venda com este item, uma O.S. será aberta automaticamente.</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default CatalogItemEditor;
