
import React, { useState, useEffect, useMemo } from 'react';
import { ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, TransactionType, TransactionStatus, ServiceItem } from '../types';
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Package, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';

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
    
    // Generic form state
    const [formData, setFormData] = useState<any>({}); 

    // --- Pricing Logic for Sales ---
    const [taxPercent, setTaxPercent] = useState<number>(0);

    const pricing = useMemo(() => {
        if (currentView !== 'SRV_SALES' && currentView !== 'SRV_PURCHASES') return null;
        
        const gross = Number(formData.grossAmount) || 0;
        const disc = Number(formData.discountAmount) || 0;
        // Se for venda, subtraímos impostos do líquido. Se for compra, impostos geralmente somam ou são neutros (aqui tratamos como custo adicional se houver).
        const taxes = (gross - disc) * (taxPercent / 100);
        const net = gross - disc - (currentView === 'SRV_SALES' ? taxes : 0);

        // Encontrar item do catálogo se houver para margem
        const catalogItem = serviceItems.find(i => i.id === formData.catalogItemId);
        const cost = catalogItem?.costPrice || 0;
        const profit = net - cost;
        const margin = cost > 0 ? (profit / cost) * 100 : 100;

        return { gross, disc, taxes, net, cost, profit, margin };
    }, [formData.grossAmount, formData.discountAmount, taxPercent, formData.catalogItemId, currentView, serviceItems]);

    // Sincroniza o valor final (net) com o campo 'amount' que é o valor oficial salvo
    useEffect(() => {
        if (pricing && (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES')) {
            setFormData((prev: any) => ({ ...prev, amount: pricing.net }));
        }
    }, [pricing?.net, currentView]);

    // --- Helpers ---
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

    const getTitle = () => {
        switch(currentView) {
            case 'SRV_OS': return { title: 'Ordens de Serviço', icon: Wrench, label: 'OS' };
            case 'SRV_SALES': return { title: 'Vendas e Orçamentos', icon: ShoppingBag, label: 'Venda' };
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
        setTaxPercent(0);
        if (currentView === 'SRV_CATALOG') {
            if (item) setFormData({ ...item });
            else setFormData({ type: catalogTab === 'PRODUCT' ? 'PRODUCT' : 'SERVICE', defaultPrice: '', costPrice: '', brand: '' });
        } else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            if (item) {
                setFormData({ 
                    ...item, 
                    grossAmount: item.grossAmount || item.amount, 
                    discountAmount: item.discountAmount || 0, 
                    taxAmount: item.taxAmount || 0 
                });
                const base = (item.grossAmount || item.amount) - (item.discountAmount || 0);
                if (base > 0) setTaxPercent(Math.round(((item.taxAmount || 0) / base) * 100));
            } else {
                setFormData({ status: 'DRAFT', date: new Date().toISOString().split('T')[0], grossAmount: 0, discountAmount: 0, taxAmount: 0 });
            }
        } else {
            setFormData(item || {});
        }
        setIsModalOpen(true);
    };

    const handleSelectItem = (itemId: string) => {
        const item = serviceItems.find(i => i.id === itemId);
        if (item) {
            setFormData((prev: any) => ({
                ...prev,
                catalogItemId: item.id,
                description: item.name,
                grossAmount: item.defaultPrice
            }));
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
            onSaveOrder({ 
                ...formData, ...common, type, 
                amount: pricing?.net || 0, 
                grossAmount: pricing?.gross || 0,
                discountAmount: pricing?.disc || 0,
                taxAmount: pricing?.taxes || 0,
                date: formData.date || new Date().toISOString().split('T')[0], 
                status: formData.status || 'DRAFT' 
            });
        } else if (currentView === 'SRV_CONTRACTS') {
            onSaveContract({ ...formData, ...common, value: Number(formData.value) || 0, startDate: formData.startDate || new Date().toISOString().split('T')[0], status: formData.status || 'ACTIVE' });
        } else if (currentView === 'SRV_NF') {
            onSaveInvoice({ ...formData, ...common, amount: Number(formData.amount) || 0, issueDate: formData.issueDate || new Date().toISOString().split('T')[0], status: formData.status || 'ISSUED', type: formData.type || 'ISS' });
        } else if (currentView === 'SRV_CATALOG' && onSaveCatalogItem) {
            onSaveCatalogItem({ ...formData, id, defaultPrice: Number(formData.defaultPrice) || 0, costPrice: Number(formData.costPrice) || 0, type: formData.type || 'SERVICE' });
        }
        setIsModalOpen(false);
        setFormData({});
    };

    const handleDelete = async (id: string) => {
        if (await showConfirm({ title: 'Excluir Item', message: 'Tem certeza que deseja excluir este registro?', variant: 'danger' })) {
            if (currentView === 'SRV_OS') onDeleteOS(id);
            else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') onDeleteOrder(id);
            else if (currentView === 'SRV_CONTRACTS') onDeleteContract(id);
            else if (currentView === 'SRV_NF') onDeleteInvoice(id);
            else if (currentView === 'SRV_CATALOG' && onDeleteCatalogItem) onDeleteCatalogItem(id);
        }
    };

    const handleGenerateTransaction = async (item: any) => {
        if (await showConfirm({ title: 'Gerar Financeiro', message: 'Deseja criar um lançamento financeiro (Conta a Receber/Pagar) para este item?', confirmText: 'Sim, Gerar' })) {
            let trans: any = {
                description: item.description || item.title || 'Venda/Compra',
                amount: item.amount,
                date: new Date().toISOString().split('T')[0],
                status: TransactionStatus.PENDING,
                type: item.type === 'PURCHASE' ? TransactionType.EXPENSE : TransactionType.INCOME,
                category: item.type === 'PURCHASE' ? 'Fornecedores' : 'Vendas/Serviços',
                contactId: item.contactId,
                isRecurring: false,
                accountId: '' // Usuario escolhe na tela de transação se necessário ou aqui assume padrão
            };
            onAddTransaction(trans);
            // Atualiza status do pedido para confirmado/vendido
            if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') onSaveOrder({ ...item, status: 'CONFIRMED' });
            else if (currentView === 'SRV_OS') onSaveOS({ ...item, status: 'DONE' });
            showAlert("Lançamento financeiro gerado com sucesso!", "success");
        }
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'DRAFT': return 'bg-amber-100 text-amber-700';
            case 'APPROVED': return 'bg-blue-100 text-blue-700';
            case 'CONFIRMED': return 'bg-emerald-100 text-emerald-700';
            case 'DONE': return 'bg-emerald-100 text-emerald-700';
            case 'CANCELED': return 'bg-rose-100 text-rose-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusLabel = (status: string) => {
        const map: any = { 'DRAFT': 'Orçamento', 'APPROVED': 'Aprovado', 'CONFIRMED': 'Vendido', 'DONE': 'Concluído', 'CANCELED': 'Cancelado', 'OPEN': 'Aberto' };
        return map[status] || status;
    };

    const renderContent = () => {
        let items: any[] = [];
        if (currentView === 'SRV_OS') items = serviceOrders;
        else if (currentView === 'SRV_SALES') items = commercialOrders.filter(o => o.type === 'SALE');
        else if (currentView === 'SRV_PURCHASES') items = commercialOrders.filter(o => o.type === 'PURCHASE');
        else if (currentView === 'SRV_CONTRACTS') items = contracts;
        else if (currentView === 'SRV_NF') items = invoices;
        else if (currentView === 'SRV_CATALOG') items = serviceItems.filter(i => catalogTab === 'ALL' || i.type === catalogTab);

        const filtered = items.filter(i => 
            (i.title || i.description || i.name || i.code || i.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (i.contactName || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filtered.length === 0) return (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                <Box className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-800">Nenhum registro encontrado</h3>
                <p className="text-gray-500 max-w-xs mx-auto">Tente ajustar sua busca ou adicione um novo item para começar.</p>
            </div>
        );

        if (currentView === 'SRV_CATALOG') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group overflow-hidden">
                            <div className={`h-1.5 w-full ${item.type === 'PRODUCT' ? 'bg-amber-400' : 'bg-indigo-500'}`}></div>
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`p-2 rounded-xl shrink-0 ${item.type === 'PRODUCT' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {item.type === 'PRODUCT' ? <Box className="w-5 h-5"/> : <Wrench className="w-5 h-5"/>}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(item)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Wrench className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1 line-clamp-1">{item.name}</h3>
                                <p className="text-xs text-gray-500 mb-4 line-clamp-2 min-h-[2.5em]">{item.description || 'Sem descrição'}</p>
                                <div className="mt-auto pt-4 border-t border-dashed border-gray-100">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Preço Venda</p>
                                    <p className="text-xl font-extrabold text-gray-900">{formatCurrency(item.defaultPrice)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => (
                    <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-gray-800 truncate">{item.title || item.description || `Item #${item.id.substring(0,4)}`}</span>
                                <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/> {item.contactName || 'Sem contato'}</span>
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(item.status)}`}>
                                {getStatusLabel(item.status)}
                            </span>
                        </div>
                        
                        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Valor Bruto</span>
                                <span className="text-gray-700">{formatCurrency(item.grossAmount || item.amount)}</span>
                            </div>
                            {(item.discountAmount > 0) && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-rose-500">Desconto (-)</span>
                                    <span className="text-rose-600">-{formatCurrency(item.discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1">
                                <span className="text-gray-800">Líquido</span>
                                <span className={currentView === 'SRV_PURCHASES' ? 'text-rose-600' : 'text-emerald-600'}>{formatCurrency(item.amount)}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xs text-gray-400">
                             <span>{formatDate(item.date || item.startDate || item.issueDate)}</span>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600 transition-colors"><Wrench className="w-4 h-4"/></button>
                                {(item.status === 'DRAFT' || item.status === 'APPROVED' || item.status === 'OPEN') && (
                                    <button onClick={() => handleGenerateTransaction(item)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Gerar Lançamento Financeiro">
                                        <DollarSign className="w-4 h-4"/>
                                    </button>
                                )}
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <header.icon className="w-6 h-6 text-indigo-600" /> {header.title}
                </h1>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                    </div>
                    <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                        <Plus className="w-4 h-4" /> Novo {header.label}
                    </button>
                </div>
            </div>

            {currentView === 'SRV_CATALOG' && (
                <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">
                    {['ALL', 'PRODUCT', 'SERVICE'].map(t => (
                        <button key={t} onClick={() => setCatalogTab(t as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>{t === 'ALL' ? 'Todos' : t === 'PRODUCT' ? 'Produtos' : 'Serviços'}</button>
                    ))}
                </div>
            )}

            {renderContent()}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[95vh] overflow-y-auto animate-scale-up">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2"><Calculator className="w-6 h-6 text-indigo-600"/> {formData.id ? 'Editar ' : 'Novo '} {header.label}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-6">
                            
                            {(currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Coluna Dados */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item do Catálogo (Opcional)</label>
                                            <select className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.catalogItemId || ''} onChange={e => handleSelectItem(e.target.value)}>
                                                <option value="">Manual / Digitação livre</option>
                                                {serviceItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição / Título</label>
                                            <input type="text" placeholder="Ex: Venda de Notebook, Consultoria Técnica..." className="w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente / Fornecedor</label>
                                            <select className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.contactId || ''} onChange={e => setFormData({...formData, contactId: e.target.value})} required>
                                                <option value="">Selecione um contato...</option>
                                                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                                                <input type="date" className="w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} required />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                                <select className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.status || 'DRAFT'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                    <option value="DRAFT">Orçamento</option>
                                                    <option value="APPROVED">Aprovado pelo Cliente</option>
                                                    <option value="CONFIRMED">Vendido (Faturado)</option>
                                                    <option value="CANCELED">Cancelado</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Coluna Financeira (Calculadora) */}
                                    <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex flex-col justify-between shadow-inner">
                                        <div className="space-y-4">
                                            <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b border-gray-200 pb-2"><ReceiptText className="w-4 h-4 text-indigo-500"/> Simulador de Preço</h3>
                                            
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Valor Bruto</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-bold">R$</span>
                                                    <input type="number" step="0.01" className="w-full pl-9 border border-gray-200 rounded-xl p-2 font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.grossAmount || ''} onChange={e => setFormData({...formData, grossAmount: e.target.value})} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Desconto (R$)</label>
                                                    <input type="number" step="0.01" className="w-full border border-gray-200 rounded-xl p-2 text-sm text-rose-600 font-bold focus:ring-2 focus:ring-rose-500 outline-none" value={formData.discountAmount || ''} onChange={e => setFormData({...formData, discountAmount: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Impostos (%)</label>
                                                    <input type="number" className="w-full border border-gray-200 rounded-xl p-2 text-sm text-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))} />
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-200 space-y-2">
                                                <div className="flex justify-between text-xs text-gray-500 font-medium">
                                                    <span>Impostos Estimados</span>
                                                    <span>{formatCurrency(pricing?.taxes || 0)}</span>
                                                </div>
                                                <div className="flex justify-between text-xl font-extrabold text-indigo-700">
                                                    <span>Valor Líquido</span>
                                                    <span>{formatCurrency(pricing?.net || 0)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Painel de Margem */}
                                        {pricing && pricing.cost > 0 && (
                                            <div className={`mt-6 p-4 rounded-2xl border transition-colors ${pricing.margin > 30 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Lucro Estimado</span>
                                                    <span className={`text-xs font-extrabold ${pricing.margin > 30 ? 'text-emerald-700' : 'text-amber-700'}`}>{Math.round(pricing.margin)}%</span>
                                                </div>
                                                <p className="font-extrabold text-gray-800 text-lg">{formatCurrency(pricing.profit)}</p>
                                                <p className="text-[9px] text-gray-400 mt-1 italic">Custo base do catálogo: {formatCurrency(pricing.cost)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {currentView === 'SRV_CATALOG' && (
                                <div className="space-y-4">
                                     <div className="flex bg-gray-100 p-1 rounded-xl mb-4 border border-gray-200">
                                        <button type="button" onClick={() => setFormData((prev: any) => ({...prev, type: 'SERVICE'}))} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${formData.type !== 'PRODUCT' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500'}`}>Serviço</button>
                                        <button type="button" onClick={() => setFormData((prev: any) => ({...prev, type: 'PRODUCT'}))} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${formData.type === 'PRODUCT' ? 'bg-white shadow-md text-amber-600' : 'text-gray-500'}`}>Produto</button>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Nome do Item</label>
                                        <input type="text" placeholder="Ex: Mouse Sem Fio, Consultoria VIP..." className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Preço de Venda</label>
                                            <input type="number" step="0.01" placeholder="0,00" className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.defaultPrice || ''} onChange={e => setFormData({...formData, defaultPrice: e.target.value})} required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Custo Unitário</label>
                                            <input type="number" step="0.01" placeholder="0,00" className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.costPrice || ''} onChange={e => setFormData({...formData, costPrice: e.target.value})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Descrição</label>
                                        <textarea placeholder="Detalhes técnicos ou descrição do serviço..." className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                                    </div>
                                </div>
                            )}

                            {currentView === 'SRV_OS' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Título da OS</label>
                                        <input type="text" placeholder="Ex: Manutenção Servidor, Pintura Escritório..." className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Valor Total</label>
                                            <input type="number" step="0.01" placeholder="0,00" className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.totalAmount || ''} onChange={e => setFormData({...formData, totalAmount: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                                            <select className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.status || 'OPEN'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                <option value="OPEN">Aberta</option>
                                                <option value="IN_PROGRESS">Em Andamento</option>
                                                <option value="DONE">Concluída</option>
                                                <option value="CANCELED">Cancelada</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Cliente Solicitante</label>
                                        <select className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.contactId || ''} onChange={e => setFormData({...formData, contactId: e.target.value})} required>
                                            <option value="">Selecione o Cliente...</option>
                                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-bold transition-all">Cancelar</button>
                                <button type="submit" className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all">Salvar {header.label}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesView;
