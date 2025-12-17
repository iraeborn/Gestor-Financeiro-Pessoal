
import React, { useState, useEffect } from 'react';
import { ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, TransactionType, TransactionStatus, ServiceItem } from '../types';
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Package, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import QRCodeScanner from './QRCodeScanner';

interface ServicesViewProps {
    currentView: ViewMode;
    serviceOrders: ServiceOrder[];
    commercialOrders: CommercialOrder[];
    contracts: Contract[];
    invoices: Invoice[];
    contacts: Contact[];
    serviceItems?: ServiceItem[]; // Catalog Items
    
    // CRUD Handlers
    onSaveOS: (os: ServiceOrder) => void;
    onDeleteOS: (id: string) => void;
    onSaveOrder: (o: CommercialOrder) => void;
    onDeleteOrder: (id: string) => void;
    onSaveContract: (c: Contract) => void;
    onDeleteContract: (id: string) => void;
    onSaveInvoice: (i: Invoice) => void;
    onDeleteInvoice: (id: string) => void;
    onSaveCatalogItem?: (i: ServiceItem) => void;
    onDeleteCatalogItem?: (id: string) => void;
    
    // Integration
    onAddTransaction: (t: any) => void; // Shortcut to create financial record
}

const ServicesView: React.FC<ServicesViewProps> = ({ 
    currentView, serviceOrders, commercialOrders, contracts, invoices, contacts, serviceItems = [],
    onSaveOS, onDeleteOS, onSaveOrder, onDeleteOrder, onSaveContract, onDeleteContract, onSaveInvoice, onDeleteInvoice, onAddTransaction, onSaveCatalogItem, onDeleteCatalogItem
}) => {
    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Catalog specific state
    const [catalogTab, setCatalogTab] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
    const [showScanner, setShowScanner] = useState(false);
    const [loadingProductInfo, setLoadingProductInfo] = useState(false);
    const [productSource, setProductSource] = useState<string>('');
    
    // Generic form state maps to the active entity
    const [formData, setFormData] = useState<any>({}); 

    // --- Helpers ---
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

    const getTitle = () => {
        switch(currentView) {
            case 'SRV_OS': return { title: 'Ordens de Serviço', icon: Wrench, label: 'OS' };
            case 'SRV_SALES': return { title: 'Vendas', icon: ShoppingBag, label: 'Venda' };
            case 'SRV_PURCHASES': return { title: 'Compras', icon: ShoppingBag, label: 'Compra' };
            case 'SRV_CONTRACTS': return { title: 'Contratos', icon: FileSignature, label: 'Contrato' };
            case 'SRV_NF': return { title: 'Notas Fiscais', icon: FileText, label: 'Nota' };
            case 'SRV_CATALOG': return { title: 'Catálogo de Itens', icon: Package, label: 'Item' };
            default: return { title: 'Serviços', icon: Wrench, label: 'Item' };
        }
    };

    const header = getTitle();

    // --- Actions ---
    const handleOpenModal = (item?: any) => {
        setProductSource('');
        if (currentView === 'SRV_CATALOG') {
            if (item) {
                // Modo Edição
                setFormData({ ...item });
            } else {
                // Modo Criação
                setFormData({ 
                    type: catalogTab === 'PRODUCT' ? 'PRODUCT' : 'SERVICE',
                    defaultPrice: '',
                    costPrice: ''
                });
            }
        } else {
            setFormData(item || {});
        }
        setIsModalOpen(true);
    };

    const handleBarcodeScanned = async (code: string) => {
        setShowScanner(false);
        setFormData(prev => ({ ...prev, code }));
        setProductSource('');
        
        if (code.length > 7) {
            setLoadingProductInfo(true);
            try {
                // 1. Check Local Catalog
                const existing = serviceItems.find(i => i.code === code);
                if (existing) {
                    const confirm = await showConfirm({ 
                        title: 'Produto Existente', 
                        message: `O produto "${existing.name}" já está no catálogo. Deseja carregar os dados?`,
                        confirmText: 'Carregar'
                    });
                    if (confirm) {
                        setFormData({ ...existing });
                        setProductSource('Catálogo Local');
                    }
                    setLoadingProductInfo(false);
                    return;
                } 

                // 2. Check Open Food Facts (API Pública rápida)
                try {
                    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
                    const data = await res.json();
                    if (data.status === 1 && data.product) {
                        setFormData(prev => ({ 
                            ...prev, 
                            name: data.product.product_name || prev.name,
                            unit: 'UN',
                            description: data.product.brands ? `Marca: ${data.product.brands}` : ''
                        }));
                        setProductSource('Open Food Facts');
                        setLoadingProductInfo(false);
                        return;
                    }
                } catch (e) { console.warn("OFF Lookup failed", e); }

                // 3. Check Produto.xyz (Substituindo GS1/Gemini)
                try {
                    // Tentativa de busca na API Produto.xyz
                    const res = await fetch(`https://api.produto.xyz/v1/products/${code}`);
                    
                    if (res.ok) {
                        const data = await res.json();
                        if (data && (data.name || data.description)) {
                            setFormData(prev => ({
                                ...prev,
                                name: data.name || data.description || prev.name,
                                description: data.description || '',
                                unit: data.unit || 'UN',
                                // Se a API retornar preço médio, podemos usar
                                defaultPrice: data.average_price || prev.defaultPrice
                            }));
                            setProductSource('Produto.xyz');
                            showAlert("Produto encontrado no Produto.xyz!", "success");
                            setLoadingProductInfo(false);
                            return;
                        }
                    }
                } catch (e) {
                    console.warn("Produto.xyz Lookup failed", e);
                }

                showAlert("Produto não identificado automaticamente.", "info");

            } catch (e) {
                console.log("Erro ao buscar info do produto", e);
                showAlert("Não foi possível buscar informações automáticas.", "error");
            } finally {
                setLoadingProductInfo(false);
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const id = formData.id || crypto.randomUUID();
        const common = { id, contactId: formData.contactId };

        if (currentView === 'SRV_OS') {
            onSaveOS({ ...formData, ...common, totalAmount: Number(formData.totalAmount) || 0, status: formData.status || 'OPEN' });
        } else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            const type = currentView === 'SRV_SALES' ? 'SALE' : 'PURCHASE';
            onSaveOrder({ ...formData, ...common, type, amount: Number(formData.amount) || 0, date: formData.date || new Date().toISOString(), status: formData.status || 'DRAFT' });
        } else if (currentView === 'SRV_CONTRACTS') {
            onSaveContract({ ...formData, ...common, value: Number(formData.value) || 0, startDate: formData.startDate || new Date().toISOString(), status: formData.status || 'ACTIVE' });
        } else if (currentView === 'SRV_NF') {
            onSaveInvoice({ ...formData, ...common, amount: Number(formData.amount) || 0, issueDate: formData.issueDate || new Date().toISOString(), status: formData.status || 'ISSUED', type: formData.type || 'ISS' });
        } else if (currentView === 'SRV_CATALOG' && onSaveCatalogItem) {
            onSaveCatalogItem({ 
                ...formData, 
                id, 
                defaultPrice: Number(formData.defaultPrice) || 0, 
                costPrice: Number(formData.costPrice) || 0,
                type: formData.type || 'SERVICE'
            });
        }
        setIsModalOpen(false);
        setFormData({});
    };

    const handleDelete = async (id: string) => {
        const confirm = await showConfirm({ title: 'Excluir Item', message: 'Tem certeza?', variant: 'danger' });
        if (!confirm) return;
        
        if (currentView === 'SRV_OS') onDeleteOS(id);
        else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') onDeleteOrder(id);
        else if (currentView === 'SRV_CONTRACTS') onDeleteContract(id);
        else if (currentView === 'SRV_NF') onDeleteInvoice(id);
        else if (currentView === 'SRV_CATALOG' && onDeleteCatalogItem) onDeleteCatalogItem(id);
    };

    const handleGenerateTransaction = async (item: any) => {
        const confirm = await showConfirm({ title: 'Gerar Financeiro', message: 'Criar lançamento financeiro para este item?', confirmText: 'Sim, Gerar' });
        if (!confirm) return;

        let trans: any = {
            description: '',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            status: TransactionStatus.PENDING,
            type: TransactionType.INCOME,
            category: 'Vendas/Serviços',
            contactId: item.contactId,
            isRecurring: false
        };

        if (currentView === 'SRV_OS') {
            trans.description = `OS #${item.number || ''} - ${item.title}`;
            trans.amount = item.totalAmount;
            trans.type = TransactionType.INCOME;
            onSaveOS({ ...item, status: 'DONE' }); // Auto-close OS
        } else if (currentView === 'SRV_SALES') {
            trans.description = `Venda: ${item.description}`;
            trans.amount = item.amount;
            trans.type = TransactionType.INCOME;
            onSaveOrder({ ...item, status: 'CONFIRMED', transactionId: 'PENDING' }); 
        } else if (currentView === 'SRV_PURCHASES') {
            trans.description = `Compra: ${item.description}`;
            trans.amount = item.amount;
            trans.type = TransactionType.EXPENSE;
            trans.category = 'Fornecedores';
            onSaveOrder({ ...item, status: 'CONFIRMED', transactionId: 'PENDING' });
        }

        onAddTransaction(trans);
    };

    // --- Filter & Render ---
    const renderContent = () => {
        let items: any[] = [];
        if (currentView === 'SRV_OS') items = serviceOrders;
        else if (currentView === 'SRV_SALES') items = commercialOrders.filter(o => o.type === 'SALE');
        else if (currentView === 'SRV_PURCHASES') items = commercialOrders.filter(o => o.type === 'PURCHASE');
        else if (currentView === 'SRV_CONTRACTS') items = contracts;
        else if (currentView === 'SRV_NF') items = invoices;
        else if (currentView === 'SRV_CATALOG') {
            items = serviceItems.filter(i => {
                if (catalogTab === 'ALL') return true;
                return i.type === catalogTab;
            });
        }

        const filtered = items.filter(i => 
            (i.title || i.description || i.number || i.name || i.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (i.contactName || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filtered.length === 0) return <div className="text-center py-10 text-gray-400">Nenhum registro encontrado.</div>;

        // CATALOG SPECIAL RENDER
        if (currentView === 'SRV_CATALOG') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.map(item => {
                        // Calculate Markup Margin: (Price - Cost) / Cost
                        const profit = item.defaultPrice - (item.costPrice || 0);
                        const margin = item.costPrice && item.costPrice > 0 
                            ? (profit / item.costPrice) * 100 
                            : (item.defaultPrice > 0 ? 100 : 0);
                            
                        const isProduct = item.type === 'PRODUCT';
                        
                        return (
                            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group overflow-hidden">
                                {/* Header */}
                                <div className={`h-1.5 w-full ${isProduct ? 'bg-amber-400' : 'bg-indigo-500'}`}></div>
                                
                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`p-2 rounded-xl shrink-0 ${isProduct ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {isProduct ? <Box className="w-5 h-5"/> : <Wrench className="w-5 h-5"/>}
                                        </div>
                                        {/* Actions */}
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleOpenModal(item)} 
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Wrench className="w-4 h-4"/>
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.id)} 
                                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1 line-clamp-1" title={item.name}>{item.name}</h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {item.code && (
                                                <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                                    SKU: {item.code}
                                                </span>
                                            )}
                                            {item.unit && (
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                    {item.unit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {item.description ? (
                                        <p className="text-xs text-gray-500 mb-4 line-clamp-2 min-h-[2.5em]">{item.description}</p>
                                    ) : (
                                        <div className="min-h-[2.5em]"></div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-dashed border-gray-100">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Preço de Venda</p>
                                                <p className="text-xl font-extrabold text-gray-900">{formatCurrency(item.defaultPrice)}</p>
                                            </div>
                                            
                                            {/* Profit Badge */}
                                            {item.defaultPrice > 0 && (
                                                <div className="text-right">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Margem</p>
                                                    <div className={`flex items-center justify-end gap-1 px-2 py-1 rounded-lg text-xs font-bold ${margin >= 50 ? 'bg-emerald-50 text-emerald-600' : margin >= 20 ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        {margin >= 50 ? <TrendingUp className="w-3 h-3"/> : <Percent className="w-3 h-3"/>}
                                                        {Math.round(margin)}%
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {item.costPrice > 0 && (
                                            <div className="mt-2 flex justify-between items-center bg-gray-50 p-2 rounded-lg text-xs">
                                                <span className="text-gray-500">Custo: <strong>{formatCurrency(item.costPrice)}</strong></span>
                                                <span className="text-emerald-600 font-medium">Lucro: +{formatCurrency(profit)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-800">{item.title || item.description || `NF ${item.number}`}</span>
                                <span className="text-xs text-gray-500">{item.contactName || 'Sem contato'}</span>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${item.status === 'DONE' || item.status === 'CONFIRMED' || item.status === 'ACTIVE' || item.status === 'ISSUED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                {item.status}
                            </span>
                        </div>
                        
                        <div className="flex justify-between items-end mt-4">
                            <div>
                                <span className="block text-xs text-gray-400">Valor</span>
                                <span className={`font-bold ${currentView === 'SRV_PURCHASES' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(item.totalAmount || item.amount || item.value || 0)}
                                </span>
                            </div>
                            <span className="text-xs text-gray-400">{formatDate(item.date || item.startDate || item.issueDate)}</span>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                            <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600"><Wrench className="w-4 h-4"/></button>
                            {(currentView === 'SRV_OS' || currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') && item.status !== 'DONE' && item.status !== 'CONFIRMED' && (
                                <button onClick={() => handleGenerateTransaction(item)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100" title="Gerar Financeiro">
                                    <DollarSign className="w-4 h-4"/>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <header.icon className="w-6 h-6 text-indigo-600" />
                        {header.title}
                    </h1>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-indigo-700">
                        <Plus className="w-4 h-4" /> Novo
                    </button>
                </div>
            </div>

            {/* Catalog Specific Tabs */}
            {currentView === 'SRV_CATALOG' && (
                <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                    <button 
                        onClick={() => setCatalogTab('ALL')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Todos
                    </button>
                    <button 
                        onClick={() => setCatalogTab('PRODUCT')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab === 'PRODUCT' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Produtos
                    </button>
                    <button 
                        onClick={() => setCatalogTab('SERVICE')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab === 'SERVICE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Serviços
                    </button>
                </div>
            )}

            {renderContent()}

            {/* UNIVERSAL MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-scale-up">
                        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                            <h2 className="text-lg font-bold text-gray-800">
                                {formData.id ? 'Editar ' : 'Novo '} {header.label}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            
                            {/* CATALOG MODAL */}
                            {currentView === 'SRV_CATALOG' && (
                                <>
                                    <div className="flex bg-gray-100 p-1 rounded-lg mb-2">
                                        <button type="button" onClick={() => setFormData({...formData, type: 'SERVICE'})} className={`flex-1 py-2 text-xs font-bold rounded transition-all ${formData.type !== 'PRODUCT' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Serviço</button>
                                        <button type="button" onClick={() => setFormData({...formData, type: 'PRODUCT'})} className={`flex-1 py-2 text-xs font-bold rounded transition-all ${formData.type === 'PRODUCT' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>Produto</button>
                                    </div>
                                    
                                    <div className="relative">
                                        <input type="text" placeholder="Nome do Item" className="w-full border rounded-lg p-2 pr-8 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                                        {loadingProductInfo && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-indigo-500 animate-spin" />}
                                    </div>
                                    
                                    {productSource && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded w-fit">
                                            <Globe className="w-3 h-3" />
                                            Dados preenchidos via: {productSource}
                                        </div>
                                    )}

                                    <div className="flex gap-2 items-center">
                                        <div className="relative flex-1">
                                            <input type="text" placeholder="Código / SKU (EAN)" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                                        </div>
                                        {/* Scan Button - Only for Products */}
                                        {formData.type === 'PRODUCT' && (
                                            <button 
                                                type="button"
                                                onClick={() => setShowScanner(true)}
                                                className="bg-gray-800 text-white p-2 rounded-lg hover:bg-black transition-colors"
                                                title="Ler Código de Barras"
                                            >
                                                <ScanBarcode className="w-5 h-5" />
                                            </button>
                                        )}
                                        <input type="text" placeholder="Unidade" className="w-20 border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.unit || ''} onChange={e => setFormData({...formData, unit: e.target.value})} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-bold ml-1 uppercase">Preço Venda</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-2 text-gray-400 text-xs">R$</span>
                                                <input type="number" step="0.01" className="w-full border rounded-lg pl-6 p-2 text-sm font-bold text-gray-800 outline-none focus:border-indigo-500" value={formData.defaultPrice} onChange={e => setFormData({...formData, defaultPrice: e.target.value})} required />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-bold ml-1 uppercase">Preço Custo</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-2 text-gray-400 text-xs">R$</span>
                                                <input type="number" step="0.01" className="w-full border rounded-lg pl-6 p-2 text-sm text-gray-600 outline-none focus:border-indigo-500" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>
                                    <textarea placeholder="Descrição detalhada para propostas..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                                </>
                            )}

                            {/* OTHER MODALS (Keep existing logic) */}
                            {currentView === 'SRV_OS' && (
                                <>
                                    <input type="text" placeholder="Título da OS" className="w-full border rounded-lg p-2" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} required />
                                    <textarea placeholder="Descrição detalhada" className="w-full border rounded-lg p-2" rows={3} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="number" placeholder="Valor Total" className="border rounded-lg p-2" value={formData.totalAmount || ''} onChange={e => setFormData({...formData, totalAmount: e.target.value})} />
                                        <select className="border rounded-lg p-2 bg-white" value={formData.status || 'OPEN'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                            <option value="OPEN">Aberta</option>
                                            <option value="IN_PROGRESS">Em Andamento</option>
                                            <option value="DONE">Concluída</option>
                                            <option value="CANCELED">Cancelada</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="date" className="border rounded-lg p-2" value={formData.startDate || ''} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                                        <input type="date" className="border rounded-lg p-2" value={formData.endDate || ''} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                                    </div>
                                </>
                            )}

                            {(currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') && (
                                <>
                                    <input type="text" placeholder="Descrição do Pedido" className="w-full border rounded-lg p-2" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} required />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="number" placeholder="Valor" className="border rounded-lg p-2" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                                        <input type="date" className="border rounded-lg p-2" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} required />
                                    </div>
                                    <select className="w-full border rounded-lg p-2 bg-white" value={formData.status || 'DRAFT'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                        <option value="DRAFT">Rascunho / Orçamento</option>
                                        <option value="CONFIRMED">Confirmado</option>
                                        <option value="CANCELED">Cancelado</option>
                                    </select>
                                </>
                            )}

                            {currentView === 'SRV_CONTRACTS' && (
                                <>
                                    <input type="text" placeholder="Título do Contrato" className="w-full border rounded-lg p-2" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} required />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="number" placeholder="Valor Mensal/Total" className="border rounded-lg p-2" value={formData.value || ''} onChange={e => setFormData({...formData, value: e.target.value})} required />
                                        <input type="number" placeholder="Dia Vencimento" className="border rounded-lg p-2" value={formData.billingDay || ''} onChange={e => setFormData({...formData, billingDay: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs">Início</label><input type="date" className="w-full border rounded-lg p-2" value={formData.startDate || ''} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
                                        <div><label className="text-xs">Fim</label><input type="date" className="w-full border rounded-lg p-2" value={formData.endDate || ''} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
                                    </div>
                                </>
                            )}

                            {currentView === 'SRV_NF' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="text" placeholder="Número" className="border rounded-lg p-2" value={formData.number || ''} onChange={e => setFormData({...formData, number: e.target.value})} />
                                        <input type="text" placeholder="Série" className="border rounded-lg p-2" value={formData.series || ''} onChange={e => setFormData({...formData, series: e.target.value})} />
                                    </div>
                                    <select className="w-full border rounded-lg p-2 bg-white" value={formData.type || 'ISS'} onChange={e => setFormData({...formData, type: e.target.value})}>
                                        <option value="ISS">Serviço (NFS-e)</option>
                                        <option value="ICMS">Produto (NF-e)</option>
                                    </select>
                                    <input type="number" placeholder="Valor da Nota" className="w-full border rounded-lg p-2" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                                    <input type="date" className="w-full border rounded-lg p-2" value={formData.issueDate || ''} onChange={e => setFormData({...formData, issueDate: e.target.value})} required />
                                    <input type="text" placeholder="Link do PDF/XML" className="w-full border rounded-lg p-2" value={formData.fileUrl || ''} onChange={e => setFormData({...formData, fileUrl: e.target.value})} />
                                </>
                            )}

                            {/* Common Contact Selector (Not needed for Catalog) */}
                            {currentView !== 'SRV_CATALOG' && (
                                <select className="w-full border rounded-lg p-2 bg-white" value={formData.contactId || ''} onChange={e => setFormData({...formData, contactId: e.target.value})} required>
                                    <option value="">Selecione o Cliente/Contato</option>
                                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Barcode Scanner Modal */}
            {showScanner && (
                <QRCodeScanner 
                    mode="BARCODE"
                    onScanSuccess={handleBarcodeScanned}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
};

export default ServicesView;
