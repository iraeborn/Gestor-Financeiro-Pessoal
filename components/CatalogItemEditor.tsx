
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ServiceItem, Branch, VariationAttribute, ProductSKU } from '../types';
import { 
    ArrowLeft, Save, Box, Tag, ImageIcon, UploadCloud, Loader2, 
    Settings, ShieldCheck, Zap, DollarSign, Store, Info, Trash2, Plus,
    ChevronDown, X, Layers, Hash, Sparkles
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
        brand: '',
        branchId: branches[0]?.id || '',
        stockQuantity: 0,
        warrantyEnabled: false,
        warrantyDays: 0,
        isFreeAllowed: false,
        autoGenerateOS: false,
        variationAttributes: [],
        skus: []
    });

    useEffect(() => {
        if (initialData) {
            setFormData({ 
                ...initialData,
                variationAttributes: initialData.variationAttributes || [],
                skus: initialData.skus || []
            });
        }
    }, [initialData]);

    const existingCategories = useMemo(() => {
        return Array.from(new Set(serviceItems.map(i => i.category).filter(Boolean))).sort();
    }, [serviceItems]);

    const existingBrands = useMemo(() => {
        return Array.from(new Set(serviceItems.map(i => i.brand).filter(Boolean))).sort();
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

    const handleAddAttribute = () => {
        setFormData(prev => ({
            ...prev,
            variationAttributes: [...(prev.variationAttributes || []), { name: '', values: [] }]
        }));
    };

    const handleUpdateAttribute = (idx: number, field: keyof VariationAttribute, value: any) => {
        const attrs = [...(formData.variationAttributes || [])];
        attrs[idx] = { ...attrs[idx], [field]: value };
        setFormData(prev => ({ ...prev, variationAttributes: attrs }));
    };

    const handleAddValueToAttr = (idx: number, val: string) => {
        if (!val.trim()) return;
        const attrs = [...(formData.variationAttributes || [])];
        if (attrs[idx].values.includes(val.trim())) return;
        attrs[idx].values = [...attrs[idx].values, val.trim()];
        setFormData(prev => ({ ...prev, variationAttributes: attrs }));
    };

    const generateSKUs = () => {
        const attrs = formData.variationAttributes || [];
        if (attrs.length === 0 || attrs.some(a => a.values.length === 0)) {
            showAlert("Defina atributos e valores primeiro.", "warning");
            return;
        }

        // Algoritmo de Produto Cartesiano
        const combine = (list: any[], n = 0): any[] => {
            if (n === list.length) return [{}];
            const res: any[] = [];
            const prev = combine(list, n + 1);
            const attr = list[n];
            attr.values.forEach((v: string) => {
                prev.forEach(p => {
                    res.push({ [attr.name]: v, ...p });
                });
            });
            return res;
        };

        const combinations = combine(attrs);
        const newSkus: ProductSKU[] = combinations.map((combo, i) => ({
            id: crypto.randomUUID(),
            sku: `${formData.code || 'SKU'}-${i + 1}`,
            attributes: combo,
            price: formData.defaultPrice,
            costPrice: formData.costPrice,
            stockQuantity: 0
        }));

        setFormData(prev => ({ ...prev, skus: newSkus }));
        showAlert(`${newSkus.length} variações geradas!`, "success");
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
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 shadow-sm transition-all text-gray-400 hover:text-indigo-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                            {initialData ? 'Editar Item' : 'Novo Item'}
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
                    {/* Upload de Imagem */}
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
                    </div>

                    {/* Preços */}
                    <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">Preço Base (R$)</label>
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
                            <label className="block text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">Custo de Aquisição (R$)</label>
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
                    {/* Dados Básicos */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-10 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Nome do Item</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    value={formData.name || ''} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    required 
                                    placeholder="Ex: Armação de Grau" 
                                />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Marca</label>
                                <div className="relative">
                                    <Tag className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <input 
                                        list="brand-list" 
                                        className="w-full pl-11 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={formData.brand || ''} 
                                        onChange={e => setFormData({...formData, brand: e.target.value})} 
                                        placeholder="Busca ou Nova Marca..." 
                                    />
                                    <datalist id="brand-list">{existingBrands.map(b => <option key={b} value={b} />)}</datalist>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Categoria</label>
                                <div className="relative">
                                    <Layers className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
                                    <input 
                                        list="cat-list" 
                                        className="w-full pl-11 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={formData.category || ''} 
                                        onChange={e => setFormData({...formData, category: e.target.value})} 
                                        placeholder="Categoria..." 
                                    />
                                    <datalist id="cat-list">{existingCategories.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gestão de Variações */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-10 space-y-8 animate-slide-in-bottom">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                            <div className="flex items-center gap-3">
                                <Sparkles className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Variações & SKUs</h3>
                            </div>
                            <button 
                                type="button" 
                                onClick={handleAddAttribute}
                                className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all"
                            >
                                + Atributo
                            </button>
                        </div>

                        <div className="space-y-6">
                            {(formData.variationAttributes || []).map((attr, aIdx) => (
                                <div key={aIdx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 relative group">
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData(prev => ({...prev, variationAttributes: prev.variationAttributes?.filter((_, i) => i !== aIdx)}))}
                                        className="absolute top-4 right-4 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Nome do Atributo</label>
                                            <input 
                                                type="text" 
                                                placeholder="Ex: Cor, Tamanho..." 
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={attr.name}
                                                onChange={e => handleUpdateAttribute(aIdx, 'name', e.target.value)}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Valores Possíveis (Enter para add)</label>
                                            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-white border border-gray-200 rounded-xl">
                                                {attr.values.map((v, vIdx) => (
                                                    <span key={vIdx} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1">
                                                        {v}
                                                        <button type="button" onClick={() => {
                                                            const newVals = attr.values.filter((_, i) => i !== vIdx);
                                                            handleUpdateAttribute(aIdx, 'values', newVals);
                                                        }}><X className="w-3 h-3"/></button>
                                                    </span>
                                                ))}
                                                <input 
                                                    type="text" 
                                                    className="flex-1 min-w-[60px] outline-none text-xs font-bold" 
                                                    onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddValueToAttr(aIdx, e.currentTarget.value); e.currentTarget.value = ''; }}}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {(formData.variationAttributes?.length || 0) > 0 && (
                                <button 
                                    type="button" 
                                    onClick={generateSKUs}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl"
                                >
                                    Gerar / Atualizar Tabela de SKUs
                                </button>
                            )}

                            {/* Tabela de SKUs */}
                            {(formData.skus?.length || 0) > 0 && (
                                <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-inner mt-4 overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">
                                            <tr>
                                                <th className="p-4">Variação</th>
                                                <th className="p-4">Código SKU</th>
                                                <th className="p-4">Preço (R$)</th>
                                                <th className="p-4">Estoque</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {formData.skus?.map((sku, sIdx) => (
                                                <tr key={sku.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(sku.attributes).map(([k, v]) => (
                                                                <span key={k} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">{k}: {v}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="text" 
                                                            className="w-full bg-transparent border-none p-0 text-xs font-bold focus:ring-0" 
                                                            value={sku.sku} 
                                                            onChange={e => {
                                                                const s = [...formData.skus!];
                                                                s[sIdx].sku = e.target.value;
                                                                setFormData({...formData, skus: s});
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="number" 
                                                            className="w-20 bg-transparent border-none p-0 text-xs font-black text-indigo-600 focus:ring-0 text-right" 
                                                            value={sku.price} 
                                                            onChange={e => {
                                                                const s = [...formData.skus!];
                                                                s[sIdx].price = parseFloat(e.target.value);
                                                                setFormData({...formData, skus: s});
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="number" 
                                                            className="w-16 bg-transparent border-none p-0 text-xs font-black text-gray-700 focus:ring-0 text-center" 
                                                            value={sku.stockQuantity} 
                                                            onChange={e => {
                                                                const s = [...formData.skus!];
                                                                s[sIdx].stockQuantity = parseInt(e.target.value);
                                                                setFormData({...formData, skus: s});
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CatalogItemEditor;
