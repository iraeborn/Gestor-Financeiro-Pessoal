
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, TransactionType, TransactionStatus, ServiceItem, OSItem, Category, Account, CompanyProfile, TaxRegime, OSStatus, OSType, OSOrigin, OSPriority, KanbanItem, KanbanColumnConfig } from '../types';
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText, UserCircle, User, Package, Zap, Info, UserCheck, Timer, Layers, ListChecks, RefreshCw, Share2, Send, MessageSquare, FileUp, Download, Monitor, FileSearch, Link2, LayoutGrid, LayoutList, Trello } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import ApprovalModal from './ApprovalModal';
import { api } from '../services/storageService';
import KanbanBoard from './KanbanBoard';

const SERVICE_UNITS = [
    { id: 'UN', label: 'Unidade (UN)' },
    { id: 'HR', label: 'Hora (HR)' },
    { id: 'MIN', label: 'Minuto (MIN)' },
    { id: 'DIA', label: 'Dia (DIA)' },
    { id: 'MT', label: 'Metro (MT)' },
    { id: 'KG', label: 'Quilo (KG)' },
    { id: 'SERV', label: 'Serviço (SERV)' },
];

const OS_KANBAN_COLUMNS: KanbanColumnConfig[] = [
    { id: 'ABERTA', label: 'Backlog', color: 'bg-amber-400', borderColor: 'border-amber-200' },
    { id: 'APROVADA', label: 'Aprovado', color: 'bg-blue-400', borderColor: 'border-blue-200' },
    { id: 'AGENDADA', label: 'Agendado', color: 'bg-indigo-400', borderColor: 'border-indigo-200' },
    { id: 'EM_EXECUCAO', label: 'Em Execução', color: 'bg-emerald-500', borderColor: 'border-emerald-200' },
    { id: 'PAUSADA', label: 'Pausado', color: 'bg-rose-400', borderColor: 'border-rose-200' },
    { id: 'FINALIZADA', label: 'Finalizado', color: 'bg-slate-400', borderColor: 'border-slate-200' }
];

interface ServicesViewProps {
    currentView: ViewMode;
    serviceOrders: ServiceOrder[];
    commercialOrders: CommercialOrder[];
    contracts: Contract[];
    invoices: Invoice[];
    contacts: Contact[];
    accounts: Account[];
    companyProfile?: CompanyProfile | null;
    serviceItems?: ServiceItem[];
    
    onSaveOS: (os: ServiceOrder, newContact?: Contact) => void;
    onDeleteOS: (id: string) => void;
    onSaveOrder: (o: CommercialOrder, newContact?: Contact) => void;
    onDeleteOrder: (id: string) => void;
    onApproveOrder?: (order: CommercialOrder, approvalData: any) => void;
    onSaveContract: (c: Contract, newContact?: Contact) => void;
    onDeleteContract: (id: string) => void;
    onSaveInvoice: (i: Invoice, newContact?: Contact) => void;
    onDeleteInvoice: (id: string) => void;
    onAddTransaction: (t: any) => void;
    onSaveCatalogItem?: (i: ServiceItem) => void;
    onDeleteCatalogItem?: (id: string) => void;
}

const ServicesView: React.FC<ServicesViewProps> = ({ 
    currentView, serviceOrders, commercialOrders, contracts, invoices, contacts, accounts, companyProfile, serviceItems = [],
    onSaveOS, onDeleteOS, onSaveOrder, onDeleteOrder, onSaveContract, onDeleteContract, onSaveInvoice, onDeleteInvoice, onAddTransaction, onSaveCatalogItem, onDeleteCatalogItem, onApproveOrder
}) => {
    const isCatalog = currentView === 'SRV_CATALOG';
    const isOS = currentView === 'SRV_OS';
    const isSales = currentView === 'SRV_SALES';
    const isNF = currentView === 'SRV_NF';

    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [catalogTab, setCatalogTab] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
    const [viewType, setViewType] = useState<'GRID' | 'LIST' | 'KANBAN'>(isOS ? 'KANBAN' : 'GRID');
    const [compositionFilter, setCompositionFilter] = useState<'ALL' | 'SIMPLE' | 'COMPOSITE'>('ALL');
    const [formData, setFormData] = useState<any>({}); 
    const [taxPercent, setTaxPercent] = useState<number>(0);
    const [sharing, setSharing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [modalImporting, setModalImporting] = useState(false);

    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [selectedOrderForApproval, setSelectedOrderForApproval] = useState<CommercialOrder | null>(null);

    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getResolvedPrice = (item: any): number => {
        if (!item) return 0;
        if (!item.status) {
            if (!item.isComposite) return Number(item.defaultPrice ?? 0);
            const subItems = item.items || [];
            return subItems.reduce((sum: number, sub: any) => {
                let subUnitPrice = Number(sub.unitPrice || 0);
                if (sub.serviceItemId) {
                    const latestSub = serviceItems.find(si => si.id === sub.serviceItemId);
                    subUnitPrice = getResolvedPrice(latestSub);
                }
                const qty = Number(sub.quantity) || 1;
                return sum + (sub.isBillable !== false ? (subUnitPrice * qty) : 0);
            }, 0);
        }
        return Number(item.totalAmount || item.amount || item.value || 0);
    };

    const resolveItems = (items: any[], recordStatus?: string) => {
        if (!Array.isArray(items)) return [];
        return items.map(item => {
            if (item.serviceItemId) {
                const latest = serviceItems.find(si => si.id === item.serviceItemId);
                if (latest) {
                    const qty = Number(item.quantity) || 1;
                    const hasSavedPrice = item.unitPrice !== undefined && item.unitPrice !== null;
                    const unitPriceToUse = hasSavedPrice ? Number(item.unitPrice) : getResolvedPrice(latest);
                    const costPriceToUse = (item.costPrice !== undefined && item.costPrice !== null) ? Number(item.costPrice) : (latest.costPrice || 0);

                    return { ...item, code: item.code || latest.code, description: item.description || latest.name, unitPrice: unitPriceToUse, totalPrice: unitPriceToUse * qty, costPrice: costPriceToUse, estimatedDuration: (latest.defaultDuration || 0) * qty, isFromCatalog: true };
                }
            }
            const qty = Number(item.quantity) || 1;
            const up = Number(item.unitPrice) || 0;
            return { ...item, unitPrice: up, totalPrice: up * qty, isFromCatalog: false };
        });
    };

    const pricing = useMemo(() => {
        const items = (formData.items || []) as any[];
        const resolvedList = resolveItems(items, formData.status);
        const itemsSum = resolvedList.reduce((sum, item) => sum + (item.isBillable !== false ? (Number(item.totalPrice) || 0) : 0), 0);
        const costSum = resolvedList.reduce((sum, item) => sum + (Number(item.costPrice || 0) * Number(item.quantity || 1)), 0);
        const durationSum = resolvedList.reduce((sum, item) => sum + (Number(item.estimatedDuration || 0)), 0);
        const disc = Number(formData.discountAmount) || 0;
        
        let netValue = 0;
        if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            netValue = itemsSum - disc;
        } else if (isCatalog) {
            netValue = formData.isComposite ? itemsSum : (Number(formData.defaultPrice) || 0);
        } else if (isOS) {
            netValue = items.length > 0 ? itemsSum : (Number(formData.totalAmount) || 0);
        } else if (isNF) {
            netValue = itemsSum > 0 ? itemsSum : (Number(formData.amount || 0));
        } else {
            netValue = items.length > 0 ? itemsSum : (Number(formData.amount || formData.value || 0));
        }

        const taxes = netValue * (taxPercent / 100);
        return { gross: itemsSum, disc, taxes, net: netValue, cost: isCatalog && !formData.isComposite ? (Number(formData.costPrice) || 0) : costSum, duration: isCatalog && !formData.isComposite ? (Number(formData.defaultDuration) || 0) : durationSum, resolvedList };
    }, [formData.items, formData.discountAmount, formData.defaultPrice, formData.totalAmount, formData.amount, formData.value, formData.costPrice, formData.defaultDuration, formData.isComposite, formData.status, taxPercent, currentView, isCatalog, isOS, isNF, serviceItems]);

    const formatCurrency = (val: number | undefined | null) => {
        const amount = typeof val === 'number' ? val : 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    };

    const handleOSStatusUpdate = async (itemId: string, newStatus: string) => {
        const os = serviceOrders.find(o => o.id === itemId);
        if (!os) return;
        
        // Atualiza localmente e persiste
        onSaveOS({ ...os, status: newStatus as OSStatus });
        showAlert(`OS #${os.id.substring(0,6)} movida para ${newStatus}`, "info");
    };

    const getTitle = () => {
        switch(currentView) {
            case 'SRV_OS': return { title: 'Ordens de Serviço', icon: Wrench, label: 'OS' };
            case 'SRV_SALES': return { title: 'Vendas e Orçamentos', icon: ShoppingBag, label: 'Orçamento' };
            case 'SRV_PURCHASES': return { title: 'Compras', icon: ShoppingBag, label: 'Compra' };
            case 'SRV_CONTRACTS': return { title: 'Contratos', icon: FileSignature, label: 'Contrato' };
            case 'SRV_NF': return { title: 'Notas Fiscais', icon: FileText, label: 'Nota' };
            case 'SRV_CATALOG': return { title: 'Catálogo de Itens', icon: Package, label: 'Item' };
            default: return { title: 'Serviços', icon: Wrench, label: 'Item' };
        }
    };

    const header = getTitle();

    const handleShare = async (channel: 'WHATSAPP' | 'EMAIL') => {
        if (!formData.id) { showAlert("Salve o orçamento antes de compartilhar.", "warning"); return; }
        const contact = contacts.find(c => c.id === formData.contactId);
        setSharing(true);
        try {
            const data = await api.shareOrder(formData.id, channel);
            if (channel === 'WHATSAPP') {
                const text = `Olá! Segue link para visualizar seu orçamento: ${data.url}`;
                const phone = contact?.phone?.replace(/\D/g, '') || '';
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
            } else {
                showAlert("Link enviado por e-mail com sucesso!", "success");
            }
        } catch (e: any) {
            showAlert(e.message || "Erro ao compartilhar orçamento.", "error");
        } finally {
            setSharing(false);
        }
    };

    const handleImportXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const data = await api.importInvoiceXml(file);
            handleOpenModal(data);
            showAlert("Dados do XML extraídos!", "success");
        } catch (e: any) {
            showAlert(e.message || "Erro ao ler arquivo XML.", "error");
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUpdateInvoiceViaXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setModalImporting(true);
        try {
            const data = await api.importInvoiceXml(file);
            setFormData((prev: any) => ({
                ...prev,
                number: data.number,
                series: data.series,
                amount: data.amount,
                issue_date: data.issueDate,
                issueDate: data.issueDate,
                description: data.description || prev.description,
                items: data.items || prev.items || [],
                status: data.status
            }));
            
            if (data.contactName) setContactSearch(data.contactName);
            showAlert("Dados da Nota Fiscal atualizados via XML!", "success");
        } catch (e: any) {
            showAlert(e.message || "Erro ao ler arquivo XML.", "error");
        } finally {
            setModalImporting(false);
            if (modalFileInputRef.current) modalFileInputRef.current.value = '';
        }
    };

    const handleOpenModal = (item?: any) => {
        if (item) {
            if (item.contactId) {
                const c = contacts.find(c => c.id === item.contactId);
                setContactSearch(c ? c.name : '');
            } else if (item.contactName) setContactSearch(item.contactName);
            else setContactSearch('');
        } else setContactSearch('');

        if (isOS) {
            if (item) setFormData({ ...item, totalAmount: item.totalAmount || 0, items: Array.isArray(item.items) ? item.items : [] });
            else setFormData({ status: 'ABERTA', type: 'MANUTENCAO', origin: 'MANUAL', priority: 'MEDIA', openedAt: new Date().toISOString(), items: [] });
        } else if (isCatalog) {
            if (item) setFormData({ ...item, items: Array.isArray(item.items) ? item.items : [], defaultDuration: item.defaultDuration || 0, isComposite: item.isComposite || false });
            else setFormData({ type: catalogTab === 'PRODUCT' ? 'PRODUCT' : 'SERVICE', isComposite: false, defaultPrice: 0, costPrice: 0, brand: '', defaultDuration: 0, unit: 'UN', items: [] });
        } else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            if (item) setFormData({ ...item, grossAmount: item.grossAmount || item.amount, discountAmount: item.discountAmount || 0, taxAmount: item.taxAmount || 0, items: item.items || [] });
            else setFormData({ status: 'DRAFT', date: new Date().toISOString().split('T')[0], grossAmount: 0, discountAmount: 0, taxAmount: 0, items: [] });
        } else setFormData(item || {});
        setIsModalOpen(true);
    };

    const handleAddOSItem = (catalogItemId?: string) => {
        const catalogItem = serviceItems.find(i => i.id === catalogItemId);
        const resolvedPrice = catalogItem ? getResolvedPrice(catalogItem) : 0;
        const newItem: OSItem = { id: crypto.randomUUID(), serviceItemId: catalogItem?.id, code: catalogItem?.code || '', description: catalogItem?.name || '', quantity: 1, unitPrice: resolvedPrice, totalPrice: resolvedPrice, estimatedDuration: catalogItem?.defaultDuration || 0, isBillable: true };
        (newItem as any).costPrice = catalogItem?.costPrice || 0;
        setFormData((prev: any) => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const handleUpdateOSItem = (itemId: string, field: keyof OSItem, value: any) => {
        const updatedItems = (formData.items || []).map((item: OSItem) => {
            if (item.id === itemId) {
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unitPrice') updated.totalPrice = Number(updated.quantity) * Number(updated.unitPrice);
                return updated;
            }
            return item;
        });
        setFormData((prev: any) => ({ ...prev, items: updatedItems }));
    };

    const handleRemoveItem = (itemId: string) => setFormData((prev: any) => ({ ...prev, items: (prev.items || []).filter((i: any) => i.id !== itemId) }));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        let finalContactId = formData.contactId;
        let newContactObj: Contact | undefined;
        if (contactSearch && !isCatalog) {
            const existing = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
            if (existing) finalContactId = existing.id;
            else {
                const newId = crypto.randomUUID();
                newContactObj = { id: newId, name: contactSearch, type: 'PF' };
                finalContactId = newId;
            }
        }
        const id = formData.id || crypto.randomUUID();
        const common = { id, contactId: finalContactId, contactName: contactSearch };
        
        if (isOS) {
            onSaveOS({ ...formData, ...common, totalAmount: pricing.net, items: pricing.resolvedList }, newContactObj);
        } else if (currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') {
            const type = currentView === 'SRV_SALES' ? 'SALE' : 'PURCHASE';
            onSaveOrder({ ...formData, ...common, type, amount: pricing.net, grossAmount: pricing.gross, discountAmount: pricing.disc, taxAmount: pricing.taxes, items: pricing.resolvedList, date: formData.date || new Date().toISOString().split('T')[0], status: formData.status || 'DRAFT' }, newContactObj);
        } else if (currentView === 'SRV_CONTRACTS') {
            onSaveContract({ ...formData, ...common, value: Number(formData.value) || 0, startDate: formData.startDate || new Date().toISOString().split('T')[0], status: formData.status || 'ACTIVE' }, newContactObj);
        } else if (currentView === 'SRV_NF') {
            onSaveInvoice({ ...formData, ...common, amount: Number(formData.amount || pricing.net), issue_date: formData.issue_date || formData.issueDate || new Date().toISOString().split('T')[0], status: formData.status || 'ISSUED', type: formData.type || 'ISS', description: formData.description, items: pricing.resolvedList, orderId: formData.orderId, serviceOrderId: formData.serviceOrderId }, newContactObj);
        } else if (isCatalog && onSaveCatalogItem) {
            onSaveCatalogItem({ ...formData, id, defaultPrice: pricing.net, costPrice: pricing.cost, type: formData.type || 'SERVICE', defaultDuration: pricing.duration, isComposite: formData.isComposite || false, items: formData.items || [] });
        }
        
        setIsModalOpen(false);
        setFormData({});
    };

    const handleConfirmApproval = (approvalData: any) => {
        if (selectedOrderForApproval && onApproveOrder) {
            onApproveOrder(selectedOrderForApproval, approvalData);
        }
        setIsApprovalOpen(false);
        setSelectedOrderForApproval(null);
    };

    const handleDeleteRecord = async (type: string, id: string, title?: string) => {
        const confirm = await showConfirm({
            title: "Excluir Registro",
            message: `Tem certeza que deseja remover "${title || 'este registro'}"? Esta operação não pode ser desfeita.`,
            variant: "danger",
            confirmText: "Sim, Excluir"
        });

        if (confirm) {
            if (type === 'OS') onDeleteOS(id);
            else if (type === 'SALE' || type === 'PURCHASE') onDeleteOrder(id);
            else if (type === 'CONTRACT') onDeleteContract(id);
            else if (type === 'INVOICE') onDeleteInvoice(id);
            else if (type === 'CATALOG' && onDeleteCatalogItem) onDeleteCatalogItem(id);
        }
    };

    const getOSStatusColor = (status: string) => {
        switch(status) {
            case 'ABERTA': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'APROVADA': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'AGENDADA': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'EM_EXECUCAO': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'PAUSADA': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'FINALIZADA': return 'bg-slate-200 text-slate-700 border-slate-300';
            case 'DRAFT': return 'bg-amber-100 text-amber-700';
            case 'APPROVED': return 'bg-blue-100 text-blue-700';
            case 'CONFIRMED': return 'bg-emerald-100 text-emerald-700';
            case 'REJECTED': return 'bg-rose-100 text-rose-700';
            case 'ON_HOLD': return 'bg-slate-200 text-slate-700';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getOSPriorityColor = (p: OSPriority) => {
        switch(p) {
            case 'BAIXA': return 'text-emerald-500';
            case 'MEDIA': return 'text-blue-500';
            case 'ALTA': return 'text-orange-500';
            case 'URGENTE': return 'text-rose-600 font-black';
            default: return 'text-gray-400';
        }
    };

    const renderGridContent = () => {
        let rawItems: any[] = [];
        if (isOS) rawItems = serviceOrders;
        else if (currentView === 'SRV_SALES') rawItems = commercialOrders.filter(o => o.type === 'SALE');
        else if (currentView === 'SRV_PURCHASES') rawItems = commercialOrders.filter(o => o.type === 'PURCHASE');
        else if (currentView === 'SRV_CONTRACTS') rawItems = contracts;
        else if (currentView === 'SRV_NF') rawItems = invoices;
        else if (isCatalog) {
            rawItems = serviceItems.filter(i => {
                const typeMatch = catalogTab === 'ALL' || i.type === catalogTab;
                const compositeMatch = compositionFilter === 'ALL' || (compositionFilter === 'COMPOSITE' ? i.isComposite : !i.isComposite);
                return typeMatch && compositeMatch;
            });
        }

        const filtered = rawItems.filter(i => (i.title || i.description || i.name || i.code || i.brand || i.number || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()));
        
        if (filtered.length === 0) return <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm mx-auto max-w-4xl"><Box className="w-16 h-16 text-gray-200 mx-auto mb-4" /><h3 className="text-lg font-bold text-gray-800">Nenhum registro encontrado</h3><p className="text-gray-500 max-w-sm mx-auto">Tente ajustar sua busca ou adicione um novo item.</p></div>;
        
        if (isOS && viewType === 'KANBAN') {
            const kanbanItems: KanbanItem[] = filtered.map(os => ({
                id: os.id,
                title: os.title,
                subtitle: os.contactName || 'Sem cliente',
                status: os.status,
                priority: os.priority,
                amount: os.totalAmount,
                date: os.openedAt,
                tags: [os.type, os.origin],
                raw: os
            }));
            return (
                <div className="w-full h-full overflow-hidden">
                    <KanbanBoard items={kanbanItems} columns={OS_KANBAN_COLUMNS} onItemClick={handleOpenModal} onStatusChange={handleOSStatusUpdate} />
                </div>
            );
        }

        if (isOS && viewType === 'GRID') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(os => (
                        <div key={os.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">OS #{os.number || os.id.substring(0,4)}</span>
                                        <h3 className="font-bold text-gray-800 leading-tight">{os.title}</h3>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getOSStatusColor(os.status)}`}>{os.status}</span>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-xs text-gray-600"><User className="w-3 h-3 text-gray-400" /><span className="font-medium truncate">{os.contactName || 'Consumidor'}</span></div>
                                    <div className="flex items-center justify-between text-[10px] uppercase font-bold">
                                        <div className="flex items-center gap-1 text-gray-400"><Zap className={`w-3 h-3 ${getOSPriorityColor(os.priority)}`} /> Prioridade: <span className={getOSPriorityColor(os.priority)}>{os.priority}</span></div>
                                        <div className="text-gray-400">Origem: {os.origin}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                    <div className="text-sm font-black text-gray-900">{formatCurrency(getResolvedPrice(os))}</div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(os)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg"><Wrench className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteRecord('OS', os.id, os.title)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        if (isNF) {
            return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Número/Série</th>
                                <th className="px-6 py-4">Pessoa/Empresa</th>
                                <th className="px-6 py-4">Vínculos</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(nf => {
                                const linkedOrder = commercialOrders.find(o => o.id === nf.orderId);
                                const linkedOS = serviceOrders.find(o => o.id === nf.serviceOrderId);
                                return (
                                    <tr key={nf.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4 text-gray-500">{new Date(nf.issue_date || nf.issueDate).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-6 py-4 font-black text-gray-800">
                                            {nf.number || '---'} 
                                            {nf.series && <span className="text-gray-400 font-normal ml-1">/{nf.series}</span>}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-600">
                                            <div className="flex flex-col">
                                                <span className="truncate max-w-[150px] font-bold text-gray-800">{nf.contactName || '---'}</span>
                                                {nf.description && <span className="text-[10px] text-gray-400 truncate max-w-[150px] italic">{nf.description}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {linkedOrder && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 border border-blue-100"><ShoppingBag className="w-2.5 h-2.5" /> Venda #{linkedOrder.id.substring(0,4)}</span>}
                                                {linkedOS && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 border border-amber-100"><Wrench className="w-2.5 h-2.5" /> OS #{linkedOS.number || linkedOS.id.substring(0,4)}</span>}
                                                {!linkedOrder && !linkedOS && <span className="text-[9px] text-gray-300 font-bold uppercase">Nenhum</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black">{nf.type}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-gray-900">{formatCurrency(nf.amount)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${getOSStatusColor(nf.status)}`}>{nf.status === 'ISSUED' ? 'Emitida' : nf.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {nf.fileUrl && <a href={nf.fileUrl} target="_blank" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Download className="w-4 h-4"/></a>}
                                                <button onClick={() => handleOpenModal(nf)} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Wrench className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteRecord('INVOICE', nf.id, `NF ${nf.number}`)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                        </tbody>
                    </table>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => {
                    const isDraft = item.status === 'DRAFT';
                    const isSale = currentView === 'SRV_SALES';
                    const itemTitle = item.description || item.title || item.name;
                    return (
                        <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                             <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col overflow-hidden">
                                    <div className="flex items-center gap-2"><span className="font-bold text-gray-800 truncate">{itemTitle}</span>{item.isComposite && <span title="Item Composto / Kit"><Layers className="w-3 h-3 text-indigo-500" /></span>}</div>
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {item.contactName || (isCatalog ? 'Item de Catálogo' : 'Venda')}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getOSStatusColor(item.status)}`}>{item.status}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm font-black text-gray-900 mt-2">
                                 <span>{formatCurrency(getResolvedPrice(item))}</span>
                                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isSale && isDraft && <button onClick={() => { setSelectedOrderForApproval(item); setIsApprovalOpen(true); }} className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg"><CheckCircle className="w-4 h-4"/></button>}
                                    <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600"><Wrench className="w-4 h-4"/></button>
                                    <button onClick={() => handleDeleteRecord(isCatalog ? 'CATALOG' : (isSale ? 'SALE' : (currentView === 'SRV_PURCHASES' ? 'PURCHASE' : 'CONTRACT')), item.id, itemTitle)} className="p-1.5 text-gray-400 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                                 </div>
                            </div>
                        </div>
                    )})}
            </div>
        );
    };

    const isRecordDraft = formData.status === 'DRAFT';
    const modalLabel = currentView === 'SRV_SALES' ? (isRecordDraft ? 'Orçamento' : 'Venda') : header.label;

    return (
        <div className="space-y-6 animate-fade-in pb-10 w-full">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-1">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><header.icon className="w-6 h-6 text-indigo-600" /> {header.title}</h1>
                <div className="flex gap-2 w-full md:w-auto">
                    {isNF && (
                        <>
                            <input type="file" ref={fileInputRef} onChange={handleImportXml} accept=".xml" className="hidden" />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importing}
                                className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-emerald-100 transition-all"
                            >
                                {importing ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileUp className="w-4 h-4" />}
                                Importar XML
                            </button>
                        </>
                    )}
                    <div className="relative flex-1 md:w-64"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" /></div>
                    <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"><Plus className="w-4 h-4" /> Novo {header.label}</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 px-1">
                <div className="flex gap-3">
                    {isCatalog && (
                        <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">{[{id:'ALL',label:'Categorias'},{id:'PRODUCT',label:'Produtos'},{id:'SERVICE',label:'Serviços'}].map(t=>(<button key={t.id} onClick={()=>setCatalogTab(t.id as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab===t.id?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}>{t.label}</button>))}</div>
                    )}
                    {isOS && (
                        <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">
                            <button onClick={()=>setViewType('KANBAN')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewType==='KANBAN'?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}><Trello className="w-3.5 h-3.5" /> Kanban</button>
                            <button onClick={()=>setViewType('GRID')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewType==='GRID'?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}><LayoutGrid className="w-3.5 h-3.5" /> Cards</button>
                        </div>
                    )}
                </div>

                {isCatalog && (
                    <div className="flex bg-indigo-50/50 p-1 rounded-xl w-fit border border-indigo-100 shadow-sm">{[{id:'ALL',label:'Todos',icon:ListChecks},{id:'SIMPLE',label:'Simples',icon:Box},{id:'COMPOSITE',label:'Compostos',icon:Layers}].map(t=>(<button key={t.id} onClick={()=>setCompositionFilter(t.id as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${compositionFilter===t.id?'bg-white text-indigo-600 shadow-sm':'text-indigo-400'}`}><t.icon className="w-3.5 h-3.5"/> {t.label}</button>))}</div>
                )}
            </div>

            <div className="w-full">
                {renderGridContent()}
            </div>
            
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl p-8 max-h-[95vh] overflow-y-auto animate-scale-up">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2"><Calculator className="w-6 h-6 text-indigo-600"/> {formData.id ? 'Editar ' : 'Novo '} {modalLabel}</h2>
                            <div className="flex gap-2">
                                {isSales && isRecordDraft && formData.id && (
                                    <div className="flex bg-gray-100 p-1 rounded-xl mr-4">
                                        <button type="button" disabled={sharing} onClick={() => handleShare('WHATSAPP')} className="p-2 hover:bg-white rounded-lg text-emerald-600 flex items-center gap-2 text-xs font-bold transition-all disabled:opacity-50"><MessageSquare className="w-4 h-4"/> WhatsApp</button>
                                        <button type="button" disabled={sharing} onClick={() => handleShare('EMAIL')} className="p-2 hover:bg-white rounded-lg text-indigo-600 flex items-center gap-2 text-xs font-bold transition-all disabled:opacity-50">
                                            {sharing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} E-mail
                                        </button>
                                    </div>
                                )}
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
                            </div>
                        </div>
                        <form onSubmit={handleSave} className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                <div className="lg:col-span-3 space-y-6">
                                    {isCatalog && (
                                        <div className="flex bg-indigo-50 p-1.5 rounded-2xl border border-indigo-100/50 w-fit">
                                            <button type="button" onClick={() => setFormData({...formData, isComposite: false, items: []})} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${!formData.isComposite ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-indigo-400'}`}><Box className="w-4 h-4" /> Item Simples</button>
                                            <button type="button" onClick={() => setFormData({...formData, isComposite: true})} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${formData.isComposite ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-indigo-400'}`}><Layers className="w-4 h-4" /> Item Composto / Kit</button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className={isCatalog ? "md:col-span-2" : "md:col-span-1"}><label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Título do Registro</label><input type="text" placeholder={isCatalog ? "Ex: Motor Trifásico 5HP..." : "Ex: Manutenção Elétrica Prédio..."} className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.title || formData.description || formData.name || ''} onChange={e => setFormData({...formData, title: e.target.value, description: e.target.value, name: e.target.value})} required /></div>
                                        {!isCatalog && (
                                            <div className="relative" ref={contactDropdownRef}><label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Pessoa / Empresa</label><div className="relative"><User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" /><input type="text" value={contactSearch} onFocus={() => setShowContactDropdown(true)} onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}} className="w-full pl-9 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold bg-white" placeholder="Buscar ou criar..." /></div>{showContactDropdown && (<div className="absolute z-50 w-full bg-white border border-slate-100 rounded-2xl shadow-xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in border-t-4 border-t-indigo-500">{contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (<button key={c.id} type="button" onClick={() => {setContactSearch(c.name); setFormData({...formData, contactId: c.id}); setShowContactDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-colors flex items-center justify-between">{c.name}</button>))}{contactSearch && !contacts.some(c => c.name.toLowerCase() === contactSearch.toLowerCase()) && (<button type="button" onClick={() => setShowContactDropdown(false)} className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-2 mt-1"><Plus className="w-3 h-3" /> Criar novo: "{contactSearch}"</button>)}</div>)}</div>
                                        )}
                                    </div>

                                    {isCatalog && !formData.isComposite && (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 animate-fade-in">
                                            <div className="md:col-span-1">
                                                <label className="block text-[10px] font-black uppercase text-indigo-400 mb-1 ml-1">Preço Venda (R$)</label>
                                                <div className="relative">
                                                    <DollarSign className="w-4 h-4 text-indigo-300 absolute left-3 top-2.5" />
                                                    <input type="number" step="0.01" className="w-full pl-9 rounded-xl border border-indigo-100 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-black text-indigo-700" value={formData.defaultPrice || 0} onChange={e => setFormData({...formData, defaultPrice: Number(e.target.value)})} />
                                                </div>
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Preço Custo (R$)</label>
                                                <div className="relative">
                                                    <Tag className="w-4 h-4 text-gray-300 absolute left-3 top-2.5" />
                                                    <input type="number" step="0.01" className="w-full pl-9 rounded-xl border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.costPrice || 0} onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})} />
                                                </div>
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Unidade</label>
                                                <div className="relative">
                                                    <Box className="w-4 h-4 text-gray-300 absolute left-3 top-2.5" />
                                                    <select className="w-full pl-9 rounded-xl border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none bg-white" value={formData.unit || 'UN'} onChange={e => setFormData({...formData, unit: e.target.value})}>
                                                        {SERVICE_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Duração (min)</label>
                                                <div className="relative">
                                                    <Timer className="w-4 h-4 text-gray-300 absolute left-3 top-2.5" />
                                                    <input type="number" className="w-full pl-9 rounded-xl border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.defaultDuration || 0} onChange={e => setFormData({...formData, defaultDuration: Number(e.target.value)})} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {isNF && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Número da Nota</label><input type="text" className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.number || ''} onChange={e => setFormData({...formData, number: e.target.value})} /></div>
                                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Série</label><input type="text" className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.series || ''} onChange={e => setFormData({...formData, series: e.target.value})} /></div>
                                                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Data de Emissão</label><input type="date" className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.issue_date || formData.issueDate || ''} onChange={e => setFormData({...formData, issueDate: e.target.value})} /></div>
                                                <div className="md:col-span-3"><label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Serviços Prestados / Itens</label><textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold min-h-[100px]" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ex: Manutenção de computadores, consultoria..." /></div>
                                                
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Venda Associada</label>
                                                    <div className="relative">
                                                        <ShoppingBag className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-3" />
                                                        <select value={formData.orderId || ''} onChange={e => setFormData({...formData, orderId: e.target.value})} className="w-full border border-gray-200 rounded-xl pl-7 pr-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none bg-white">
                                                            <option value="">Sem Venda</option>
                                                            {commercialOrders.filter(o => o.type === 'SALE').map(o => <option key={o.id} value={o.id}>Venda: {o.description} (#{o.id.substring(0,4)})</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">OS Associada</label>
                                                    <div className="relative">
                                                        <Wrench className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-3" />
                                                        <select value={formData.serviceOrderId || ''} onChange={e => setFormData({...formData, serviceOrderId: e.target.value})} className="w-full border border-gray-200 rounded-xl pl-7 pr-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none bg-white">
                                                            <option value="">Sem OS</option>
                                                            {serviceOrders.map(o => <option key={o.id} value={o.id}>OS #{o.number || o.id.substring(0,4)}: {o.title}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                                                        <FileSearch className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-emerald-800 uppercase tracking-widest leading-none mb-1">Preencher via XML</p>
                                                        <p className="text-[10px] text-emerald-600 font-bold uppercase opacity-70">O sistema extrai os dados automaticamente</p>
                                                    </div>
                                                </div>
                                                <input type="file" ref={modalFileInputRef} onChange={handleUpdateInvoiceViaXml} accept=".xml" className="hidden" />
                                                <button 
                                                    type="button" 
                                                    disabled={modalImporting}
                                                    onClick={() => modalFileInputRef.current?.click()}
                                                    className="bg-white text-emerald-700 px-5 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all border border-emerald-100 shadow-sm whitespace-nowrap"
                                                >
                                                    {modalImporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileUp className="w-4 h-4" />}
                                                    Importar XML da Nota
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`space-y-4 transition-opacity ${isCatalog && !formData.isComposite ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}><div className="flex justify-between items-center"><h3 className="font-black text-gray-700 flex items-center gap-2 uppercase tracking-widest text-xs"><Package className="w-4 h-4 text-indigo-500"/> Detalhamento Técnico / Composição</h3><div className="flex gap-2"><select className="border border-gray-200 rounded-lg p-1.5 text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => { if(e.target.value) handleAddOSItem(e.target.value); e.target.value = ''; }}><option value="">+ Catálogo</option>{serviceItems.filter(i => i.id !== formData.id).map(i => <option key={i.id} value={i.id}>{i.name} ({formatCurrency(i.defaultPrice)})</option>)}</select><button type="button" onClick={() => handleAddOSItem()} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-black transition-colors">+ Manual</button></div></div><div className="bg-slate-50 rounded-2xl border border-gray-200 overflow-hidden shadow-inner overflow-x-auto"><table className="w-full text-left border-collapse min-w-[800px]"><thead className="bg-slate-100 text-[9px] uppercase font-black text-slate-500 border-b border-gray-200"><tr><th className="px-4 py-3">Serviço/Peça</th><th className="px-4 py-3 w-16 text-center">Qtd</th><th className="px-4 py-3 w-28 text-center">Vlr Unit</th>{isOS && (<><th className="px-4 py-3 w-32 text-center">Técnico</th><th className="px-4 py-3 w-20 text-center">Estimado (min)</th><th className="px-4 py-3 w-20 text-center">Real (min)</th><th className="px-4 py-3 w-12 text-center">Fat?</th></>)}<th className="px-4 py-3 w-28 text-right">Subtotal</th><th className="px-4 py-3 w-10"></th></tr></thead><tbody className="divide-y divide-gray-200">{pricing.resolvedList.map((item: any) => (<tr key={item.id} className="bg-white hover:bg-indigo-50/10 transition-colors"><td className="px-4 py-3"><div className="flex flex-col gap-1"><div className="flex items-center gap-1.5"><input type="text" value={item.code} onChange={e => handleUpdateOSItem(item.id, 'code', e.target.value)} className={`w-full bg-transparent border-none focus:ring-0 text-[10px] font-black placeholder-indigo-200 ${item.isFromCatalog ? 'text-indigo-600' : 'text-indigo-400'}`} placeholder="Código"/>{item.isFromCatalog && <span title="Vínculo automático com o catálogo" className="text-indigo-500"><RefreshCw className="w-2.5 h-2.5 animate-spin-slow" /></span>}</div><input type="text" value={item.description} onChange={e => handleUpdateOSItem(item.id, 'description', e.target.value)} className={`w-full bg-transparent border-none focus:ring-0 text-xs font-bold ${item.isFromCatalog ? 'text-gray-900' : 'text-gray-500'}`} placeholder="Descrição do item..."/></div></td><td className="px-2 py-3"><input type="number" value={item.quantity} onChange={e => handleUpdateOSItem(item.id, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-center" min="1"/></td><td className="px-2 py-3"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleUpdateOSItem(item.id, 'unitPrice', Number(e.target.value))} className={`w-full bg-transparent border-none focus:ring-0 text-xs font-black text-center ${item.isFromCatalog ? 'text-indigo-700' : ''}`}/></td>{isOS && (<><td className="px-2 py-3 text-center"><input type="text" value={item.technician} onChange={e => handleUpdateOSItem(item.id, 'technician', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center" placeholder="Responsável..."/></td><td className="px-2 py-3 text-center"><input type="number" value={item.estimatedDuration} onChange={e => handleUpdateOSItem(item.id, 'estimatedDuration', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center" /></td><td className="px-2 py-3 text-center"><input type="number" value={item.realDuration} onChange={e => handleUpdateOSItem(item.id, 'realDuration', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-black text-indigo-600 text-center" /></td><td className="px-2 py-3 text-center"><input type="checkbox" checked={item.isBillable} onChange={e => handleUpdateOSItem(item.id, 'isBillable', e.target.checked)} className="w-4 h-4 rounded text-indigo-600"/></td></>)}<td className={`px-2 py-3 text-xs font-black text-right ${item.isFromCatalog ? 'text-indigo-800' : 'text-gray-900'}`}>{formatCurrency(item.totalPrice)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button></td></tr>))}{pricing.resolvedList.length === 0 && (<tr><td colSpan={isOS ? 10 : 5} className="px-4 py-12 text-center text-gray-400 text-xs italic">Clique em catálogo ou manual para adicionar itens.</td></tr>)}</tbody></table></div></div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-gray-200 space-y-6">
                                    {(currentView === 'SRV_SALES' || currentView === 'SRV_PURCHASES') && (<div className="space-y-4"><div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Desconto Aplicado (R$)</label><div className="relative"><Percent className="w-4 h-4 text-gray-400 absolute left-3 top-3" /><input type="number" step="0.01" className="w-full pl-9 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold bg-white" value={formData.discountAmount || ''} onChange={e => setFormData({...formData, discountAmount: e.target.value})} placeholder="0,00"/></div></div><div className="p-4 bg-white rounded-2xl border border-gray-100 text-xs space-y-2 shadow-sm"><div className="flex justify-between items-center text-gray-500 font-medium"><span>Subtotal Bruto</span><span>{formatCurrency(pricing.gross)}</span></div><div className="flex justify-between items-center text-rose-500 font-black"><span className="flex items-center gap-1"><Tag className="w-3 h-3"/> Desconto</span><span>- {formatCurrency(pricing.disc)}</span></div></div></div>)}
                                    {!isCatalog && (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Situação Atual</label>
                                            <select 
                                                className={`w-full rounded-xl p-3 text-sm font-black border-2 transition-all appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${getOSStatusColor(formData.status || 'ABERTA')}`} 
                                                value={formData.status || 'ABERTA'} 
                                                onChange={e => setFormData({...formData, status: e.target.value})}
                                            >
                                                {isOS ? (
                                                    OS_KANBAN_COLUMNS.map(col => (
                                                        <option key={col.id} value={col.id}>{col.label}</option>
                                                    ))
                                                ) : (
                                                    <>
                                                        <option value="DRAFT">Orçamento / Rascunho</option>
                                                        <option value="APPROVED">Aprovada</option>
                                                        <option value="CONFIRMED">Confirmada / Paga</option>
                                                        <option value="ON_HOLD">Em Espera</option>
                                                        <option value="REJECTED">Recusada</option>
                                                        <option value="CANCELADA">Cancelada</option>
                                                        <option value="ISSUED">Emitida</option>
                                                    </>
                                                )}
                                            </select>
                                            <p className="text-[9px] text-gray-400 mt-2 font-bold uppercase text-center">Status sincronizado com o Kanban ágil</p>
                                        </div>
                                    )}
                                    <div className="pt-4 border-t border-gray-200"><div className="flex justify-between items-center mb-1"><span className="text-[10px] font-black text-gray-400 uppercase">{isCatalog ? 'Valor Final' : (currentView === 'SRV_SALES' && isRecordDraft ? 'Valor Orçado' : 'Valor Líquido')}</span>{(isOS || isCatalog) && <span title="Somatório automático de todos os itens técnicos."><Info className="w-3 h-3 text-gray-300" /></span>}</div><p className="text-3xl font-black text-gray-900">{formatCurrency(pricing.net)}</p></div>
                                    <div className="space-y-3"><button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Salvar Alterações</button><button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-700">Descartar</button></div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <ApprovalModal isOpen={isApprovalOpen} onClose={() => setIsApprovalOpen(false)} order={selectedOrderForApproval} accounts={accounts} onConfirm={handleConfirmApproval} />
        </div>
    );
};

export default ServicesView;
