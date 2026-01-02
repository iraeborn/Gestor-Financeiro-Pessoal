
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ServiceOrder, CommercialOrder, Contract, Invoice, Contact, ViewMode, 
    TransactionType, TransactionStatus, ServiceItem, OSItem, Category, 
    Account, CompanyProfile, TaxRegime, OSStatus, OSType, OSOrigin, 
    OSPriority, KanbanItem, KanbanColumnConfig, Member, AppSettings, OpticalRx 
} from '../types';
// Fix: Added missing 'Glasses' icon import
import { Wrench, ShoppingBag, FileSignature, FileText, Plus, Search, Trash2, CheckCircle, Clock, X, DollarSign, Calendar, Filter, Box, Tag, Percent, BarChart, AlertTriangle, ArrowRight, TrendingUp, ScanBarcode, Loader2, Globe, Image as ImageIcon, Calculator, ReceiptText, UserCircle, User, Package, Zap, Info, UserCheck, Timer, Layers, ListChecks, RefreshCw, Share2, Send, MessageSquare, FileUp, Download, Monitor, FileSearch, Link2, LayoutGrid, LayoutList, Trello, UserCog, Pencil, Eye, Glasses } from 'lucide-react';
import { useConfirm, useAlert } from './AlertSystem';
import ApprovalModal from './ApprovalModal';
import { api, getFamilyMembers } from '../services/storageService';
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

const SALE_KANBAN_COLUMNS: KanbanColumnConfig[] = [
    { id: 'DRAFT', label: 'Rascunho', color: 'bg-slate-400', borderColor: 'border-slate-200' },
    { id: 'APPROVED', label: 'Aprovado', color: 'bg-blue-400', borderColor: 'border-blue-200' },
    { id: 'ON_HOLD', label: 'Em Espera', color: 'bg-amber-400', borderColor: 'border-amber-200' },
    { id: 'CONFIRMED', label: 'Confirmado / Pago', color: 'bg-emerald-500', borderColor: 'border-emerald-200' },
    { id: 'REJECTED', label: 'Recusado', color: 'bg-rose-400', borderColor: 'border-rose-200' }
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
    opticalRxs?: OpticalRx[];
    settings?: AppSettings;
    
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
    currentView, serviceOrders, commercialOrders, contracts, invoices, contacts, accounts, companyProfile, serviceItems = [], opticalRxs = [], settings,
    onSaveOS, onDeleteOS, onSaveOrder, onDeleteOrder, onSaveContract, onDeleteContract, onSaveInvoice, onDeleteInvoice, onAddTransaction, onSaveCatalogItem, onDeleteCatalogItem, onApproveOrder
}) => {
    const isCatalog = currentView === 'SRV_CATALOG';
    const isOS = currentView === 'SRV_OS' || currentView === 'OPTICAL_LAB';
    const isSales = currentView === 'SRV_SALES' || currentView === 'OPTICAL_SALES';
    const isNF = currentView === 'SRV_NF';
    const isOpticalContext = currentView === 'OPTICAL_SALES' || currentView === 'OPTICAL_LAB';
    const isOpticalModuleActive = settings?.activeModules?.optical === true;

    const { showConfirm } = useConfirm();
    const { showAlert } = useAlert();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [catalogTab, setCatalogTab] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
    const [viewType, setViewType] = useState<'GRID' | 'LIST' | 'KANBAN'>((isOS || isSales) ? 'KANBAN' : 'GRID');
    const [compositionFilter, setCompositionFilter] = useState<'ALL' | 'SIMPLE' | 'COMPOSITE'>('ALL');
    const [formData, setFormData] = useState<any>({}); 
    const [taxPercent, setTaxPercent] = useState<number>(0);
    const [sharing, setSharing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [modalImporting, setModalImporting] = useState(false);
    const [teamMembers, setTeamMembers] = useState<Member[]>([]);

    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [selectedOrderForApproval, setSelectedOrderForApproval] = useState<CommercialOrder | null>(null);

    const [contactSearch, setContactSearch] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const contactDropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadTeam();
        const handleClickOutside = (event: MouseEvent) => {
            if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadTeam = async () => {
        try {
            const list = await getFamilyMembers();
            setTeamMembers(list || []);
        } catch (e) {
            console.error("Erro ao carregar equipe", e);
        }
    };

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
        if (isSales || currentView === 'SRV_PURCHASES') {
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
    }, [formData.items, formData.discountAmount, formData.defaultPrice, formData.totalAmount, formData.amount, formData.value, formData.costPrice, formData.defaultDuration, formData.isComposite, formData.status, taxPercent, currentView, isCatalog, isOS, isNF, serviceItems, isSales]);

    const formatCurrency = (val: number | undefined | null) => {
        const amount = typeof val === 'number' ? val : 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    };

    const handleOSStatusUpdate = async (itemId: string, newStatus: string) => {
        const os = serviceOrders.find(o => o.id === itemId);
        if (!os) return;
        onSaveOS({ ...os, status: newStatus as OSStatus });
        showAlert(`OS #${os.id.substring(0,6)} movida para ${newStatus}`, "info");
    };

    const handleSaleStatusUpdate = async (itemId: string, newStatus: string) => {
        const order = commercialOrders.find(o => o.id === itemId);
        if (!order) return;
        onSaveOrder({ ...order, status: newStatus as any });
        showAlert(`Pedido #${order.id.substring(0,6)} movido para ${newStatus}`, "info");
    };

    const getTitle = () => {
        if (isOpticalContext) {
            return currentView === 'OPTICAL_SALES' 
                ? { title: 'Venda de Óculos', icon: Glasses, label: 'Venda' }
                : { title: 'Lab (Montagem)', icon: Monitor, label: 'OS' };
        }
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
            else setFormData({ status: 'ABERTA', type: isOpticalContext ? 'MONTAGEM_OTICA' : 'MANUTENCAO', origin: isOpticalContext ? 'VENDA_OTICA' : 'MANUAL', priority: 'MEDIA', openedAt: new Date().toISOString(), items: [], moduleTag: isOpticalContext ? 'optical' : undefined });
        } else if (isCatalog) {
            if (item) setFormData({ ...item, items: Array.isArray(item.items) ? item.items : [], defaultDuration: item.defaultDuration || 0, isComposite: item.isComposite || false });
            else setFormData({ type: catalogTab === 'PRODUCT' ? 'PRODUCT' : 'SERVICE', isComposite: false, defaultPrice: 0, costPrice: 0, brand: '', defaultDuration: 0, unit: 'UN', items: [] });
        } else if (isSales || currentView === 'SRV_PURCHASES') {
            if (item) setFormData({ ...item, grossAmount: item.grossAmount || item.amount, discountAmount: item.discountAmount || 0, taxAmount: item.taxAmount || 0, items: item.items || [] });
            else setFormData({ status: 'DRAFT', date: new Date().toISOString().split('T')[0], grossAmount: 0, discountAmount: 0, taxAmount: 0, items: [], moduleTag: isOpticalContext ? 'optical' : undefined });
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
        
        const assignedMember = teamMembers.find(m => m.id === formData.assigneeId);
        const assigneeName = assignedMember?.name || formData.assigneeName;

        const common = { id, contactId: finalContactId, contactName: contactSearch, assigneeId: formData.assigneeId, assigneeName, moduleTag: formData.moduleTag || (isOpticalContext ? 'optical' : undefined) };
        
        if (isOS) {
            onSaveOS({ ...formData, ...common, totalAmount: pricing.net, items: pricing.resolvedList }, newContactObj);
        } else if (isSales || currentView === 'SRV_PURCHASES') {
            const type = (currentView === 'SRV_SALES' || currentView === 'OPTICAL_SALES') ? 'SALE' : 'PURCHASE';
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
            case 'DRAFT': return 'bg-slate-100 text-slate-600';
            case 'APPROVED': return 'bg-blue-100 text-blue-700';
            case 'CONFIRMED': return 'bg-emerald-100 text-emerald-700';
            case 'REJECTED': return 'bg-rose-100 text-rose-700';
            case 'ON_HOLD': return 'bg-amber-100 text-amber-700';
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
        else if (currentView === 'SRV_SALES' || currentView === 'OPTICAL_SALES') rawItems = commercialOrders.filter(o => o.type === 'SALE');
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

        const filtered = rawItems.filter(i => {
            if (isOpticalContext && i.moduleTag !== 'optical') return false;
            if (!isOpticalContext && i.moduleTag === 'optical' && (currentView === 'SRV_SALES' || currentView === 'SRV_OS')) return false;

            const text = (i.title || i.description || i.name || i.code || i.brand || i.number || '').toLowerCase();
            const contact = (i.contactName || '').toLowerCase();
            const term = searchTerm.toLowerCase();
            return text.includes(term) || contact.includes(term);
        });
        
        if (filtered.length === 0) return <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm mx-auto max-w-4xl"><Box className="w-16 h-16 text-gray-200 mx-auto mb-4" /><h3 className="text-lg font-bold text-gray-800">Nenhum registro encontrado</h3><p className="text-gray-500 max-w-sm mx-auto">Tente ajustar sua busca ou adicione um novo item.</p></div>;
        
        if (isOS && viewType === 'KANBAN') {
            const kanbanItems: KanbanItem[] = filtered.map(os => ({
                id: os.id, title: os.title, subtitle: os.contactName || 'Sem cliente',
                status: os.status, priority: os.priority, amount: os.totalAmount,
                date: os.openedAt, tags: [os.type, os.origin], assigneeName: os.assigneeName, raw: os
            }));
            return <div className="w-full h-full overflow-hidden"><KanbanBoard items={kanbanItems} columns={OS_KANBAN_COLUMNS} onItemClick={handleOpenModal} onStatusChange={handleOSStatusUpdate} /></div>;
        }

        if (isSales && viewType === 'KANBAN') {
            const kanbanItems: KanbanItem[] = filtered.map(o => ({
                id: o.id, title: o.description, subtitle: o.contactName || 'Sem cliente',
                status: o.status, amount: o.amount, date: o.date, tags: [o.type],
                assigneeName: o.assigneeName, raw: o
            }));
            return <div className="w-full h-full overflow-hidden"><KanbanBoard items={kanbanItems} columns={SALE_KANBAN_COLUMNS} onItemClick={handleOpenModal} onStatusChange={handleSaleStatusUpdate} /></div>;
        }

        if ((isOS || isSales) && viewType === 'GRID') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.map(item => {
                        const isOrder = 'amount' in item;
                        const title = isOrder ? item.description : item.title;
                        const number = isOrder ? item.id.substring(0,6) : (item.number || item.id.substring(0,4));
                        const val = isOrder ? item.amount : item.totalAmount;
                        
                        return (
                            <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{isOrder ? 'Venda' : 'OS'} #{number}</span>
                                            <h3 className="font-bold text-gray-800 leading-tight line-clamp-2">{title}</h3>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getOSStatusColor(item.status)}`}>{item.status}</span>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-gray-600"><User className="w-3 h-3 text-gray-400" /><span className="font-medium truncate">{item.contactName || 'Consumidor'}</span></div>
                                        {item.assigneeName && <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-bold bg-emerald-50 w-fit px-2 py-0.5 rounded uppercase tracking-tighter"><UserCog className="w-2.5 h-2.5" />{item.assigneeName}</div>}
                                        {!isOrder && <div className="flex items-center justify-between text-[10px] uppercase font-bold"><div className="flex items-center gap-1 text-gray-400"><Zap className={`w-3 h-3 ${getOSPriorityColor(item.priority)}`} /> Prioridade: <span className={getOSPriorityColor(item.priority)}>{item.priority}</span></div></div>}
                                        {item.rxId && <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 w-fit px-2 py-0.5 rounded uppercase"><Eye className="w-3 h-3"/> Com Receita Ótica</div>}
                                    </div>
                                </div>
                                <div className="px-5 py-4 border-t border-gray-50 flex justify-between items-center bg-gray-50/30">
                                    <div className="text-sm font-black text-gray-900">{formatCurrency(val)}</div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleOpenModal(item)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><Pencil className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteRecord(isOrder ? (item.type === 'SALE' ? 'SALE' : 'PURCHASE') : 'OS', item.id, title)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(item => {
                    const isDraft = item.status === 'DRAFT';
                    const isSale = isSales;
                    const itemTitle = item.description || item.title || item.name;
                    return (
                        <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group flex flex-col h-full">
                             <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col overflow-hidden">
                                    <div className="flex items-center gap-2"><span className="font-bold text-gray-800 truncate">{itemTitle}</span>{item.isComposite && <span title="Item Composto / Kit"><Layers className="w-3 h-3 text-indigo-500" /></span>}</div>
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {item.contactName || (isCatalog ? 'Item de Catálogo' : 'Venda')}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getOSStatusColor(item.status)}`}>{item.status}</span>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-4">
                                {item.assigneeName && <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit uppercase">Resp: {item.assigneeName}</div>}
                                {item.rxId && <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit uppercase flex items-center gap-1"><Eye className="w-3 h-3"/> Com RX</div>}
                            </div>

                            <div className="flex justify-between items-center text-sm font-black text-gray-900 mt-auto pt-3 border-t border-gray-50">
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
    const modalLabel = isSales ? (isRecordDraft ? 'Orçamento' : 'Venda') : header.label;

    return (
        <div className="space-y-6 animate-fade-in pb-10 w-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-1 shrink-0">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><header.icon className="w-6 h-6 text-indigo-600" /> {header.title}</h1>
                <div className="flex gap-2 w-full md:w-auto">
                    {isNF && (
                        <>
                            <input type="file" ref={fileInputRef} onChange={handleImportXml} accept=".xml" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-emerald-100 transition-all">{importing ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileUp className="w-4 h-4" />}Importar XML</button>
                        </>
                    )}
                    <div className="relative flex-1 md:w-64"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" /></div>
                    <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"><Plus className="w-4 h-4" /> Novo {header.label}</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 px-1 shrink-0">
                <div className="flex gap-3">
                    {isCatalog && <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">{[{id:'ALL',label:'Categorias'},{id:'PRODUCT',label:'Produtos'},{id:'SERVICE',label:'Serviços'}].map(t=>(<button key={t.id} onClick={()=>setCatalogTab(t.id as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${catalogTab===t.id?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}>{t.label}</button>))}</div>}
                    {(isOS || isSales) && (
                        <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit border border-gray-100 shadow-sm">
                            <button onClick={()=>setViewType('KANBAN')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewType==='KANBAN'?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}><Trello className="w-3.5 h-3.5" /> Kanban</button>
                            <button onClick={()=>setViewType('GRID')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewType==='GRID'?'bg-white text-indigo-600 shadow-sm':'text-gray-500'}`}><LayoutGrid className="w-3.5 h-3.5" /> Cards</button>
                        </div>
                    )}
                </div>
                {isCatalog && <div className="flex bg-indigo-50/50 p-1 rounded-xl w-fit border border-indigo-100 shadow-sm">{[{id:'ALL',label:'Todos',icon:ListChecks},{id:'SIMPLE',label:'Simples',icon:Box},{id:'COMPOSITE',label:'Compostos',icon:Layers}].map(t=>(<button key={t.id} onClick={()=>setCompositionFilter(t.id as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${compositionFilter===t.id?'bg-white text-indigo-600 shadow-sm':'text-indigo-400'}`}><t.icon className="w-3.5 h-3.5"/> {t.label}</button>))}</div>}
            </div>

            <div className="flex-1 overflow-hidden">{renderGridContent()}</div>
            
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl p-8 max-h-[95vh] overflow-y-auto animate-scale-up border border-slate-100">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2"><Calculator className="w-6 h-6 text-indigo-600"/> {formData.id ? 'Editar ' : 'Novo '} {modalLabel}</h2>
                            <div className="flex gap-2">
                                {isSales && isRecordDraft && formData.id && (
                                    <div className="flex bg-gray-100 p-1 rounded-xl mr-4">
                                        <button type="button" disabled={sharing} onClick={() => handleShare('WHATSAPP')} className="p-2 hover:bg-white rounded-lg text-emerald-600 flex items-center gap-2 text-xs font-bold transition-all disabled:opacity-50"><MessageSquare className="w-4 h-4"/> WhatsApp</button>
                                        <button type="button" disabled={sharing} onClick={() => handleShare('EMAIL')} className="p-2 hover:bg-white rounded-lg text-indigo-600 flex items-center gap-2 text-xs font-bold transition-all disabled:opacity-50">{sharing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} E-mail</button>
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
                                    
                                    {/* Campos Ótica Personalizados (Validação baseada no módulo ativo) */}
                                    {isOpticalModuleActive && (isSales || isOS) && (
                                        <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-4 animate-fade-in">
                                            <div className="flex items-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-widest mb-2">
                                                <Glasses className="w-4 h-4" /> Configurações de Ótica
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-indigo-400 mb-1 ml-1">Vincular Receita (RX)</label>
                                                    <select 
                                                        value={formData.rxId || ''} 
                                                        onChange={e => setFormData({...formData, rxId: e.target.value})}
                                                        className="w-full bg-white border border-indigo-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    >
                                                        <option value="">Nenhuma receita selecionada</option>
                                                        {opticalRxs.filter(rx => !formData.contactId || rx.contactId === formData.contactId).map(rx => (
                                                            <option key={rx.id} value={rx.id}>{rx.contactName} - {new Date(rx.rxDate).toLocaleDateString()}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {isOS && (
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-indigo-400 mb-1 ml-1">Tipo de Montagem</label>
                                                        <select 
                                                            value={formData.type || 'MONTAGEM_OTICA'} 
                                                            onChange={e => setFormData({...formData, type: e.target.value})}
                                                            className="w-full bg-white border border-indigo-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        >
                                                            <option value="MONTAGEM_OTICA">Montagem Completa</option>
                                                            <option value="REPARO">Reparo / Ajuste</option>
                                                            <option value="MANUTENCAO">Manutenção</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-1"><label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Título do Registro</label><input type="text" placeholder={isCatalog ? "Ex: Motor Trifásico 5HP..." : "Ex: Manutenção Elétrica..."} className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={formData.title || formData.description || formData.name || ''} onChange={e => setFormData({...formData, title: e.target.value, description: e.target.value, name: e.target.value})} required /></div>
                                        {!isCatalog && (
                                            <>
                                                <div className="relative" ref={contactDropdownRef}><label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Pessoa / Empresa</label><div className="relative"><User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" /><input type="text" value={contactSearch} onFocus={() => setShowContactDropdown(true)} onChange={(e) => {setContactSearch(e.target.value); setShowContactDropdown(true);}} className="w-full pl-9 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold bg-white" placeholder="Buscar ou criar..." /></div>{showContactDropdown && (<div className="absolute z-50 w-full bg-white border border-slate-100 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto p-1.5 animate-fade-in border-t-4 border-t-indigo-500">{contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (<button key={c.id} type="button" onClick={() => {setContactSearch(c.name); setFormData({...formData, contactId: c.id}); setShowContactDropdown(false);}} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-lg text-sm font-bold text-slate-600 transition-colors flex items-center justify-between">{c.name}</button>))}{contactSearch && !contacts.some(c => c.name.toLowerCase() === contactSearch.toLowerCase()) && (<button type="button" onClick={() => setShowContactDropdown(false)} className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black flex items-center gap-2 mt-1"><Plus className="w-3 h-3" /> Criar novo: "{contactSearch}"</button>)}</div>)}</div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Responsável da Equipe</label>
                                                    <div className="relative">
                                                        <UserCog className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                                                        <select value={formData.assigneeId || ''} onChange={e => setFormData({...formData, assigneeId: e.target.value})} className="w-full pl-9 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold bg-white appearance-none cursor-pointer"><option value="">Nenhum / Não atribuído</option>{teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className={`space-y-4 transition-opacity ${isCatalog && !formData.isComposite ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}><div className="flex justify-between items-center"><h3 className="font-black text-gray-700 flex items-center gap-2 uppercase tracking-widest text-xs"><Package className="w-4 h-4 text-indigo-500"/> Detalhamento Técnico / Composição</h3><div className="flex gap-2"><select className="border border-gray-200 rounded-lg p-1.5 text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => { if(e.target.value) handleAddOSItem(e.target.value); e.target.value = ''; }}><option value="">+ Catálogo</option>{serviceItems.filter(i => i.id !== formData.id).map(i => <option key={i.id} value={i.id}>{i.name} ({formatCurrency(i.defaultPrice)})</option>)}</select><button type="button" onClick={() => handleAddOSItem()} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-black transition-colors">+ Manual</button></div></div><div className="bg-slate-50 rounded-xl border border-gray-200 overflow-hidden shadow-inner overflow-x-auto"><table className="w-full text-left border-collapse min-w-[800px]"><thead className="bg-slate-100 text-[9px] uppercase font-black text-slate-500 border-b border-gray-200"><tr><th className="px-4 py-3">Serviço/Peça</th><th className="px-4 py-3 w-16 text-center">Qtd</th><th className="px-4 py-3 w-28 text-center">Vlr Unit</th>{isOS && (<><th className="px-4 py-3 w-32 text-center">Técnico</th><th className="px-4 py-3 w-20 text-center">Estimado (min)</th><th className="px-4 py-3 w-20 text-center">Real (min)</th><th className="px-4 py-3 w-12 text-center">Fat?</th></>)}<th className="px-4 py-3 w-28 text-right">Subtotal</th><th className="px-4 py-3 w-10"></th></tr></thead><tbody className="divide-y divide-gray-200">{pricing.resolvedList.map((item: any) => (<tr key={item.id} className="bg-white hover:bg-indigo-50/10 transition-colors"><td className="px-4 py-3"><div className="flex flex-col gap-1"><div className="flex items-center gap-1.5"><input type="text" value={item.code} onChange={e => handleUpdateOSItem(item.id, 'code', e.target.value)} className={`w-full bg-transparent border-none focus:ring-0 text-[10px] font-black placeholder-indigo-200 ${item.isFromCatalog ? 'text-indigo-600' : 'text-indigo-400'}`} placeholder="Código"/>{item.isFromCatalog && <span title="Vínculo automático com o catálogo" className="text-indigo-500"><RefreshCw className="w-2.5 h-2.5 animate-spin-slow" /></span>}</div><input type="text" value={item.description} onChange={e => handleUpdateOSItem(item.id, 'description', e.target.value)} className={`w-full bg-transparent border-none focus:ring-0 text-xs font-bold ${item.isFromCatalog ? 'text-gray-900' : 'text-gray-500'}`} placeholder="Descrição do item..."/></div></td><td className="px-2 py-3"><input type="number" value={item.quantity} onChange={e => handleUpdateOSItem(item.id, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-center" min="1"/></td><td className="px-2 py-3"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleUpdateOSItem(item.id, 'unitPrice', Number(e.target.value))} className={`w-full bg-transparent border-none focus:ring-0 text-xs font-black text-center ${item.isFromCatalog ? 'text-indigo-700' : ''}`}/></td>{isOS && (<><td className="px-2 py-3 text-center"><input type="text" value={item.technician} onChange={e => handleUpdateOSItem(item.id, 'technician', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center" placeholder="Responsável..."/></td><td className="px-2 py-3 text-center"><input type="number" value={item.estimatedDuration} onChange={e => handleUpdateOSItem(item.id, 'estimatedDuration', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center" /></td><td className="px-2 py-3 text-center"><input type="number" value={item.realDuration} onChange={e => handleUpdateOSItem(item.id, 'realDuration', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-black text-indigo-600 text-center" /></td><td className="px-2 py-3 text-center"><input type="checkbox" checked={item.isBillable} onChange={e => handleUpdateOSItem(item.id, 'isBillable', e.target.checked)} className="w-4 h-4 rounded text-indigo-600"/></td></>)}<td className={`px-2 py-3 text-xs font-black text-right ${item.isFromCatalog ? 'text-indigo-800' : 'text-gray-900'}`}>{formatCurrency(item.totalPrice)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button></td></tr>))}{pricing.resolvedList.length === 0 && (<tr><td colSpan={isOS ? 10 : 5} className="px-4 py-12 text-center text-gray-400 text-xs italic">Clique em catálogo ou manual para adicionar itens.</td></tr>)}</tbody></table></div></div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-gray-200 space-y-6">
                                    {(isSales || currentView === 'SRV_PURCHASES') && (<div className="space-y-4"><div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Desconto Aplicado (R$)</label><div className="relative"><Percent className="w-4 h-4 text-gray-400 absolute left-3 top-3" /><input type="number" step="0.01" className="w-full pl-9 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold bg-white" value={formData.discountAmount || ''} onChange={e => setFormData({...formData, discountAmount: e.target.value})} placeholder="0,00"/></div></div><div className="p-4 bg-white rounded-xl border border-gray-100 text-xs space-y-2 shadow-sm"><div className="flex justify-between items-center text-gray-500 font-medium"><span>Subtotal Bruto</span><span>{formatCurrency(pricing.gross)}</span></div><div className="flex justify-between items-center text-rose-500 font-black"><span className="flex items-center gap-1"><Tag className="w-3 h-3"/> Desconto</span><span>- {formatCurrency(pricing.disc)}</span></div></div></div>)}
                                    {!isCatalog && (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Situação Atual</label>
                                            <select className={`w-full rounded-xl p-3 text-sm font-black border-2 transition-all appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${getOSStatusColor(formData.status || 'ABERTA')}`} value={formData.status || 'ABERTA'} onChange={e => setFormData({...formData, status: e.target.value})}>{isOS ? OS_KANBAN_COLUMNS.map(col => (<option key={col.id} value={col.id}>{col.label}</option>)) : isSales ? SALE_KANBAN_COLUMNS.map(col => (<option key={col.id} value={col.id}>{col.label}</option>)) : (<><option value="DRAFT">Orçamento / Rascunho</option><option value="APPROVED">Aprovada</option><option value="CONFIRMED">Confirmada / Paga</option><option value="ON_HOLD">Em Espera</option><option value="REJECTED">Recusada</option><option value="CANCELADA">Cancelada</option><option value="ISSUED">Emitida</option></>)}</select>
                                            <p className="text-[9px] text-gray-400 mt-2 font-bold uppercase text-center">Status sincronizado com o Kanban ágil</p>
                                        </div>
                                    )}
                                    <div className="pt-4 border-t border-gray-200"><div className="flex justify-between items-center mb-1"><span className="text-[10px] font-black text-gray-400 uppercase">{isCatalog ? 'Valor Final' : (isSales && isRecordDraft ? 'Valor Orçado' : 'Valor Líquido')}</span>{(isOS || isCatalog) && <span title="Somatório automático de todos os itens técnicos."><Info className="w-3 h-3 text-gray-300" /></span>}</div><p className="text-3xl font-black text-gray-900">{formatCurrency(pricing.net)}</p></div>
                                    <div className="space-y-3"><button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Salvar Alterações</button><button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-700">Descartar</button></div>
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
