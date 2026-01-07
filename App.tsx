
import React, { useState, useEffect, useRef } from 'react';
import { 
  User, AppState, ViewMode, Transaction, Account, 
  Contact, Category, OpticalRx, Branch, Member, ServiceOrder, CommercialOrder, OSItem,
  TransactionType, TransactionStatus
} from './types';
import { refreshUser, loadInitialData, api, updateSettings, getFamilyMembers, joinFamily } from './services/storageService';
import { localDb } from './services/localDb';
import { syncService } from './services/syncService';
import { useAlert, useConfirm } from './components/AlertSystem';
import { Wifi, WifiOff, RefreshCw, Menu as MenuIcon, HelpCircle, Bell } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionsView from './components/TransactionsView';
import TransactionEditor from './components/TransactionEditor';
import AccountsView from './components/AccountsView';
import CreditCardsView from './components/CreditCardsView';
import GoalsView from './components/GoalsView';
import Reports from './components/Reports';
import SmartAdvisor from './components/SmartAdvisor';
import DiagnosticView from './components/DiagnosticView';
import ContactsView from './components/ContactsView';
import ContactEditor from './components/ContactEditor';
import AccessView from './components/AccessView';
import LogsView from './components/LogsView';
import SalespeopleView from './components/SalespeopleView';
import SettingsView from './components/SettingsView';
import BranchesView from './components/BranchesView';
import BranchScheduleView from './components/BranchScheduleView';
import SalespersonScheduleView from './components/SalespersonScheduleView';
import OpticalModule from './components/OpticalModule';
import OpticalRxEditor from './components/OpticalRxEditor';
import LabsView from './components/LabsView';
import ServicesView from './components/ServicesView';
import ServiceOrderEditor from './components/ServiceOrderEditor';
import SaleEditor from './components/SaleEditor';
import Auth from './components/Auth';
import LoadingOverlay from './components/LoadingOverlay';
import ChatView from './components/ChatView';
import ChatFloating from './components/ChatFloating';
import HelpCenter from './components/HelpCenter';
import { HelpProvider, useHelp } from './components/GuidedHelp';

const AppContent: React.FC<{
    currentUser: User | null;
    state: AppState | null;
    setState: React.Dispatch<React.SetStateAction<AppState | null>>;
    dataLoaded: boolean;
    syncStatus: string;
    currentView: ViewMode;
    setCurrentView: (v: ViewMode) => void;
    isMobileMenuOpen: boolean;
    setIsMobileOpen: (v: boolean) => void;
    refreshData: () => void;
    checkAuth: () => void;
    members: Member[];
    socket: Socket | null;
}> = ({ 
    currentUser, state, setState, dataLoaded, syncStatus, currentView, setCurrentView, 
    isMobileMenuOpen, setIsMobileOpen, refreshData, checkAuth, members, socket 
}) => {
    const { isTrackerVisible, setIsTrackerVisible } = useHelp();
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    
    const [editingRx, setEditingRx] = useState<OpticalRx | null>(null);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [editingOS, setEditingOS] = useState<ServiceOrder | null>(null);
    const [editingSale, setEditingSale] = useState<CommercialOrder | null>(null);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    useEffect(() => {
        if (!socket || !currentUser) return;
        const handleRemoteUpdate = (payload: any) => {
            if (payload.actorId !== currentUser.id) {
                refreshData();
                if (payload.entity !== 'membership' && payload.entity !== 'settings') {
                    showAlert(`Dados de ${payload.entity} atualizados pela equipe.`, "info");
                }
            }
        };
        socket.on('DATA_UPDATED', handleRemoteUpdate);
        return () => { socket.off('DATA_UPDATED', handleRemoteUpdate); };
    }, [socket, currentUser?.id, refreshData]);

    const handleUpdateTransactionStatus = async (t: Transaction) => {
        const newStatus = t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID;
        const updatedT = { ...t, status: newStatus };
        const actionLabel = newStatus === TransactionStatus.PAID ? "Confirmação de Pagamento" : "Estorno de Lançamento";
        
        try {
            setState(prev => {
                if (!prev) return prev;
                const updatedAccounts = prev.accounts.map(acc => {
                    if (acc.id === t.accountId) {
                        let diff = t.amount;
                        if (t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER) diff *= -1;
                        if (newStatus === TransactionStatus.PENDING) diff *= -1;
                        return { ...acc, balance: acc.balance + diff };
                    }
                    if (t.type === TransactionType.TRANSFER && acc.id === t.destinationAccountId) {
                        let diff = t.amount; 
                        if (newStatus === TransactionStatus.PENDING) diff *= -1;
                        return { ...acc, balance: acc.balance + diff };
                    }
                    return acc;
                });
                return {
                    ...prev,
                    accounts: updatedAccounts,
                    transactions: prev.transactions.map(item => item.id === t.id ? updatedT : item)
                };
            });
            await api.saveTransaction(updatedT);
            showAlert(`${actionLabel} realizado com sucesso!`, "success");
            refreshData();
        } catch (e: any) {
            showAlert("Erro ao atualizar status: " + e.message, "error");
            refreshData();
        }
    };

    const handleAddTransaction = async (t: any, nc?: Contact, ncat?: Category) => {
        const newId = t.id || crypto.randomUUID();
        const newT = { ...t, id: newId };
        setState(prev => {
            if (!prev) return prev;
            let updatedAccounts = prev.accounts;
            if (newT.status === TransactionStatus.PAID) {
                updatedAccounts = prev.accounts.map(acc => {
                    if (acc.id === newT.accountId) {
                        let diff = newT.amount;
                        if (newT.type === TransactionType.EXPENSE || newT.type === TransactionType.TRANSFER) diff *= -1;
                        return { ...acc, balance: acc.balance + diff };
                    }
                    if (newT.type === TransactionType.TRANSFER && acc.id === newT.destinationAccountId) {
                        return { ...acc, balance: acc.balance + newT.amount };
                    }
                    return acc;
                });
            }
            return {
                ...prev,
                accounts: updatedAccounts,
                transactions: [newT, ...prev.transactions]
            };
        });
        await api.saveTransaction(newT, nc, ncat);
        return newT;
    };

    const processOrderFinancials = async (order: CommercialOrder): Promise<CommercialOrder> => {
        const prevOrder = state?.commercialOrders.find(o => o.id === order.id);
        // Detecta se a venda foi confirmada agora
        const isConfirmedNow = order.status === 'CONFIRMED' && (!prevOrder || prevOrder.status !== 'CONFIRMED');

        if (isConfirmedNow && !order.transactionId) {
            const transId = crypto.randomUUID();
            const newT: Transaction = {
                id: transId,
                description: `Receita Venda #${order.id.substring(0,6).toUpperCase()}: ${order.description}`,
                amount: order.amount,
                type: order.type === 'SALE' ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: order.moduleTag === 'optical' ? 'Venda de Óculos' : 'Vendas e Serviços',
                date: order.date,
                status: TransactionStatus.PAID,
                accountId: order.accountId || state?.accounts[0]?.id || '',
                contactId: order.contactId,
                branchId: order.branchId
            };
            order.transactionId = transId;
            // Gera o lançamento e atualiza o saldo localmente
            await handleAddTransaction(newT);
            showAlert("Lançamento financeiro de receita gerado!", "success");
        }
        return order;
    };

    const handleStartSaleFromRx = (rx: OpticalRx) => {
        const lensItem: OSItem = {
            id: crypto.randomUUID(),
            description: `Par de Lentes (RX #${rx.rxNumber || rx.id.substring(0,4)})`,
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            isBillable: true
        };
        setEditingSale({
            id: crypto.randomUUID(),
            type: 'SALE',
            description: `Venda p/ ${rx.contactName} (Via RX)`,
            contactId: rx.contactId,
            contactName: rx.contactName,
            rxId: rx.id,
            branchId: rx.branchId,
            items: [lensItem],
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            status: 'DRAFT',
            moduleTag: 'optical'
        });
        setCurrentView('SRV_SALE_EDITOR');
    };

    const renderContent = () => {
        if (!dataLoaded || !state || !currentUser) return <LoadingOverlay isVisible={true} />;
        
        const commonFinanceProps = {
            state, settings: currentUser.settings, currentUser,
            onAddTransaction: handleAddTransaction,
            onDeleteTransaction: async (id: string) => {
                setState(prev => {
                    if (!prev) return prev;
                    const t = prev.transactions.find(item => item.id === id);
                    let updatedAccounts = prev.accounts;
                    if (t && t.status === TransactionStatus.PAID) {
                        updatedAccounts = prev.accounts.map(acc => {
                            if (acc.id === t.accountId) {
                                let diff = t.amount;
                                if (t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER) diff *= -1;
                                return { ...acc, balance: acc.balance - diff };
                            }
                            if (t.type === TransactionType.TRANSFER && acc.id === t.destinationAccountId) {
                                return { ...acc, balance: acc.balance - t.amount };
                            }
                            return acc;
                        });
                    }
                    return { ...prev, accounts: updatedAccounts, transactions: prev.transactions.filter(item => item.id !== id) };
                });
                await api.deleteTransaction(id);
                refreshData();
            },
            onEditTransaction: async (t: any, nc?: Contact, ncat?: Category) => {
                await api.saveTransaction(t, nc, ncat);
                refreshData();
            },
            onUpdateStatus: handleUpdateTransactionStatus,
            onChangeView: setCurrentView
        };

        const dashboardProps = {
            ...commonFinanceProps,
            onNewTransaction: () => { setEditingTransaction(null); setCurrentView('FIN_TRANSACTION_EDITOR'); },
            onEditTransaction: (t: Transaction) => { setEditingTransaction(t); setCurrentView('FIN_TRANSACTION_EDITOR'); }
        };

        switch (currentView) {
            case 'FIN_DASHBOARD': return <Dashboard {...dashboardProps} />;
            case 'FIN_TRANSACTIONS': return <TransactionsView 
                {...commonFinanceProps} 
                onDelete={commonFinanceProps.onDeleteTransaction}
                onToggleStatus={commonFinanceProps.onUpdateStatus}
                transactions={state.transactions} accounts={state.accounts} contacts={state.contacts} categories={state.categories} 
                branches={state.branches} costCenters={state.costCenters} departments={state.departments} projects={state.projects} 
                onAdd={() => { setEditingTransaction(null); setCurrentView('FIN_TRANSACTION_EDITOR'); }} 
                onEdit={(t) => { setEditingTransaction(t); setCurrentView('FIN_TRANSACTION_EDITOR'); }} 
            />;
            case 'FIN_TRANSACTION_EDITOR': 
                return <TransactionEditor 
                    initialData={editingTransaction} accounts={state.accounts} contacts={state.contacts} categories={state.categories} 
                    branches={state.branches} costCenters={state.costCenters} departments={state.departments} projects={state.projects}
                    userEntity={currentUser.entityType} settings={currentUser.settings}
                    onSave={handleAddTransaction} onCancel={() => setCurrentView('FIN_TRANSACTIONS')} 
                />;
            case 'FIN_ACCOUNTS': return <AccountsView accounts={state.accounts} onSaveAccount={(a) => api.saveAccount(a).then(refreshData)} onDeleteAccount={(id) => api.deleteAccount(id).then(refreshData)} />;
            case 'FIN_CARDS': return <CreditCardsView accounts={state.accounts} transactions={state.transactions} contacts={state.contacts} categories={state.categories} onSaveAccount={(a) => api.saveAccount(a).then(refreshData)} onDeleteAccount={(id) => api.deleteAccount(id).then(refreshData)} onAddTransaction={handleAddTransaction} />;
            case 'FIN_GOALS': return <GoalsView goals={state.goals} accounts={state.accounts} transactions={state.transactions} onSaveGoal={(g) => api.saveGoal(g).then(refreshData)} onDeleteGoal={(id) => api.deleteGoal(id).then(refreshData)} onAddTransaction={handleAddTransaction} />;
            case 'FIN_REPORTS': return <Reports transactions={state.transactions} />;
            case 'FIN_ADVISOR': return <SmartAdvisor data={state} />;
            case 'DIAG_HUB': return <DiagnosticView state={state} />;
            case 'FIN_CONTACTS': return <ContactsView contacts={state.contacts} onAddContact={() => { setEditingContact(null); setCurrentView('FIN_CONTACT_EDITOR'); }} onEditContact={(c) => { setEditingContact(c); setCurrentView('FIN_CONTACT_EDITOR'); }} onDeleteContact={(id) => api.deleteContact(id).then(refreshData)} />;
            case 'FIN_CONTACT_EDITOR': return <ContactEditor initialData={editingContact} settings={currentUser.settings} onSave={(c) => api.saveContact(c).then(() => { refreshData(); setCurrentView('FIN_CONTACTS'); })} onCancel={() => setCurrentView('FIN_CONTACTS')} />;
            case 'SYS_CHAT': return <ChatView currentUser={currentUser} socket={socket} />;
            case 'SYS_ACCESS': return <AccessView currentUser={currentUser} />;
            case 'SYS_LOGS': return <LogsView currentUser={currentUser} />;
            case 'SYS_BRANCHES': return <BranchesView branches={state.branches} onSaveBranch={(b) => api.savePJEntity('branch', b).then(refreshData)} onDeleteBranch={(id) => api.deletePJEntity('branch', id).then(refreshData)} onManageSchedule={(b) => { setEditingBranch(b); setCurrentView('SRV_BRANCH_SCHEDULE'); }} onManageSalesSchedule={(b) => { setEditingBranch(b); setCurrentView('SYS_SALES_SCHEDULE'); }} />;
            case 'SRV_BRANCH_SCHEDULE': return editingBranch ? <BranchScheduleView branch={editingBranch} appointments={state.serviceAppointments} clients={state.serviceClients} onSaveAppointment={(a) => api.saveAppointment(a).then(refreshData)} onDeleteAppointment={(id) => api.deleteAppointment(id).then(refreshData)} onBack={() => setCurrentView('SYS_BRANCHES')} /> : <Dashboard {...dashboardProps} />;
            case 'SYS_SALES_SCHEDULE': return editingBranch ? <SalespersonScheduleView branch={editingBranch} schedules={state.salespersonSchedules} salespeople={state.salespeople} onSaveSchedule={(s) => api.saveSalespersonSchedule(s).then(refreshData)} onDeleteSchedule={(id) => api.deleteSalespersonSchedule(id).then(refreshData)} onBack={() => setCurrentView('SYS_BRANCHES')} /> : <Dashboard {...dashboardProps} />;
            case 'OPTICAL_RX': return <OpticalModule opticalRxs={state.opticalRxs} contacts={state.contacts} laboratories={state.laboratories} onAddRx={() => { setEditingRx(null); setCurrentView('OPTICAL_RX_EDITOR'); }} onEditRx={(rx) => { setEditingRx(rx); setCurrentView('OPTICAL_RX_EDITOR'); }} onDeleteRx={(id) => api.deleteOpticalRx(id).then(refreshData)} onUpdateRx={(rx) => api.saveOpticalRx(rx).then(refreshData)} onStartSaleFromRx={handleStartSaleFromRx} />;
            case 'OPTICAL_RX_EDITOR': return <OpticalRxEditor contacts={state.contacts} laboratories={state.laboratories} branches={state.branches} initialData={editingRx} onSave={(rx) => api.saveOpticalRx(rx).then(() => { refreshData(); setCurrentView('OPTICAL_RX'); })} onCancel={() => setCurrentView('OPTICAL_RX')} />;
            case 'OPTICAL_LABS_MGMT': return <LabsView laboratories={state.laboratories} onSaveLaboratory={(l) => api.saveLaboratory(l).then(refreshData)} onDeleteLaboratory={(id) => api.deleteLaboratory(id).then(refreshData)} />;
            case 'SYS_SALESPEOPLE': return <SalespeopleView salespeople={state.salespeople} branches={state.branches} members={members} onSaveSalesperson={(s) => api.saveLocallyAndQueue('salespeople', s).then(refreshData)} onDeleteSalesperson={(id) => api.deleteLocallyAndQueue('salespeople', id).then(refreshData)} />;
            case 'SYS_SETTINGS': return <SettingsView user={currentUser} pjData={{ companyProfile: state.companyProfile, branches: state.branches, costCenters: state.costCenters, departments: state.departments, projects: state.projects, accounts: state.accounts }} onUpdateSettings={(s) => updateSettings(s).then(() => checkAuth())} onOpenCollab={() => {}} onSavePJEntity={(t, d) => api.savePJEntity(t, d).then(refreshData)} onDeletePJEntity={(t, id) => api.deletePJEntity(t, id).then(refreshData)} />;
            case 'SYS_HELP': return <HelpCenter activeModules={currentUser.settings?.activeModules} />;
            case 'OPTICAL_LAB':
            case 'SRV_OS':
                return <ServicesView 
                    currentView={currentView} serviceOrders={state.serviceOrders} commercialOrders={state.commercialOrders}
                    contracts={state.contracts} invoices={state.invoices} contacts={state.contacts} accounts={state.accounts}
                    serviceItems={state.serviceItems} opticalRxs={state.opticalRxs} settings={currentUser.settings}
                    onAddOS={() => { setEditingOS(null); setCurrentView('SRV_OS_EDITOR'); }}
                    onEditOS={(os) => { setEditingOS(os); setCurrentView('SRV_OS_EDITOR'); }}
                    onSaveOS={async (os) => {
                        setState(prev => prev ? ({ ...prev, serviceOrders: [os, ...prev.serviceOrders.filter(o => o.id !== os.id)] }) : prev);
                        await api.saveOS(os);
                        refreshData();
                    }} 
                    onDeleteOS={async (id) => {
                        setState(prev => prev ? ({ ...prev, serviceOrders: prev.serviceOrders.filter(o => o.id !== id) }) : prev);
                        await api.deleteOS(id);
                        refreshData();
                    }}
                    onAddSale={() => {}} onEditSale={() => {}} onSaveOrder={() => {}} onDeleteOrder={() => {}} 
                    onSaveContract={() => {}} onDeleteContract={() => {}} onSaveInvoice={() => {}} onDeleteInvoice={() => {}}
                    onAddTransaction={handleAddTransaction}
                />;
            case 'SRV_OS_EDITOR':
                return <ServiceOrderEditor 
                    initialData={editingOS} contacts={state.contacts} serviceItems={state.serviceItems} opticalRxs={state.opticalRxs}
                    branches={state.branches} settings={currentUser.settings}
                    onSave={async (os) => {
                        setState(prev => prev ? ({ ...prev, serviceOrders: [os, ...prev.serviceOrders.filter(o => o.id !== os.id)] }) : prev);
                        await api.saveOS(os);
                        refreshData();
                        setCurrentView(os.moduleTag === 'optical' ? 'OPTICAL_LAB' : 'SRV_OS');
                    }}
                    onCancel={() => setCurrentView(editingOS?.moduleTag === 'optical' ? 'OPTICAL_LAB' : 'SRV_OS')}
                />;
            case 'OPTICAL_SALES':
            case 'SRV_SALES':
                return <ServicesView 
                    currentView={currentView} serviceOrders={state.serviceOrders} commercialOrders={state.commercialOrders}
                    contracts={state.contracts} invoices={state.invoices} contacts={state.contacts} accounts={state.accounts}
                    serviceItems={state.serviceItems} opticalRxs={state.opticalRxs} settings={currentUser.settings}
                    onAddOS={() => {}} onEditOS={() => {}} onSaveOS={() => {}} onDeleteOS={() => {}}
                    onAddSale={() => { setEditingSale(null); setCurrentView('SRV_SALE_EDITOR'); }}
                    onEditSale={(sale) => { setEditingSale(sale); setCurrentView('SRV_SALE_EDITOR'); }}
                    onSaveOrder={async (order) => {
                         const processedOrder = await processOrderFinancials(order);
                         setState(prev => prev ? ({ ...prev, commercialOrders: [processedOrder, ...prev.commercialOrders.filter(o => o.id !== processedOrder.id)] }) : prev);
                         await api.saveOrder(processedOrder);
                         refreshData();
                    }} 
                    onDeleteOrder={async (id) => {
                        setState(prev => prev ? ({ ...prev, commercialOrders: prev.commercialOrders.filter(o => o.id !== id) }) : prev);
                        await api.deleteOrder(id);
                        refreshData();
                    }}
                    onSaveContract={() => {}} onDeleteContract={() => {}} onSaveInvoice={() => {}} onDeleteInvoice={() => {}}
                    onAddTransaction={handleAddTransaction}
                />;
            case 'SRV_SALE_EDITOR':
                return <SaleEditor 
                    initialData={editingSale} contacts={state.contacts} serviceItems={state.serviceItems} opticalRxs={state.opticalRxs}
                    branches={state.branches} salespeople={state.salespeople} accounts={state.accounts} currentUser={currentUser} settings={currentUser.settings}
                    onSave={async (order) => {
                        const processedOrder = await processOrderFinancials(order);
                        setState(prev => prev ? ({ ...prev, commercialOrders: [processedOrder, ...prev.commercialOrders.filter(o => o.id !== processedOrder.id)] }) : prev);
                        await api.saveOrder(processedOrder);
                        refreshData();
                        setCurrentView(processedOrder.moduleTag === 'optical' ? 'OPTICAL_SALES' : 'SRV_SALES');
                    }} 
                    onCancel={() => setCurrentView(editingSale?.moduleTag === 'optical' ? 'OPTICAL_SALES' : 'SRV_SALES')}
                />;
            case 'SRV_CATALOG':
                return <ServicesView 
                    currentView={currentView} serviceOrders={state.serviceOrders} commercialOrders={state.commercialOrders}
                    contracts={state.contracts} invoices={state.invoices} contacts={state.contacts} accounts={state.accounts}
                    serviceItems={state.serviceItems} opticalRxs={state.opticalRxs} settings={currentUser.settings}
                    onAddOS={() => {}} onEditOS={() => {}} onSaveOS={() => {}} onDeleteOS={() => {}}
                    onAddSale={() => {}} onEditSale={() => {}} onSaveOrder={() => {}} onDeleteOrder={() => {}}
                    onSaveContract={() => {}} onDeleteContract={() => {}} onSaveInvoice={() => {}} onDeleteInvoice={() => {}}
                    onAddTransaction={handleAddTransaction} onSaveCatalogItem={(i) => api.saveCatalogItem(i).then(refreshData)} onDeleteCatalogItem={(id) => api.deleteCatalogItem(id).then(refreshData)}
                />;
            default: return <Dashboard {...dashboardProps} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 font-inter text-gray-900 overflow-hidden relative">
            <Sidebar currentView={currentView} onChangeView={setCurrentView} currentUser={currentUser!} onUserUpdate={() => {}} isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileOpen} />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <div className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-40 shrink-0">
                    <button onClick={() => setIsMobileOpen(true)} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"><MenuIcon className="w-6 h-6" /></button>
                    <div className="flex items-center gap-1.5"><div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg text-xs">F</div><span className="font-black text-sm text-gray-800 tracking-tighter">FinManager</span></div>
                    <div className="flex items-center gap-1"><button onClick={() => setIsTrackerVisible(!isTrackerVisible)} className={`p-2 rounded-lg transition-all ${isTrackerVisible ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-600'}`}><HelpCircle className="w-5 h-5"/></button></div>
                </div>
                <div className={`text-[9px] font-black uppercase tracking-widest px-4 py-1 flex items-center justify-center gap-2 transition-all shrink-0 ${syncStatus === 'offline' ? 'bg-rose-50 text-white' : 'bg-emerald-500 text-white'}`}>
                    {syncStatus === 'offline' ? <><WifiOff className="w-3 h-3" /> Offline</> : <><RefreshCw className="w-2.5 h-2.5" /> Sincronizado</>}
                </div>
                <div className="flex-1 overflow-y-auto relative scroll-smooth bg-gray-50">
                    <div className="p-3 md:p-8 max-w-[1600px] mx-auto pb-32 md:pb-8">{renderContent()}</div>
                </div>
            </main>
            <ChatFloating currentUser={currentUser!} socket={socket} />
        </div>
    );
};

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');
    const [currentView, setCurrentView] = useState<ViewMode>('FIN_DASHBOARD');
    const [state, setState] = useState<AppState | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);

    const refreshData = async () => {
        try {
            if (navigator.onLine) await syncService.triggerSync();
            const data = await loadInitialData();
            setState(data);
            const memberList = await getFamilyMembers();
            setMembers(memberList);
        } catch (e) { console.error("❌ [APP] Erro refreshData:", e); }
    };

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (!token) { setAuthChecked(true); setDataLoaded(true); return; }
        try {
            const { user } = await refreshUser();
            setCurrentUser(user);
            const data = await loadInitialData();
            setState(data);
            const memberList = await getFamilyMembers();
            setMembers(memberList);
            if (!socket) {
                const s = io({ transports: ['websocket', 'polling'] });
                s.on('connect', () => s.emit('join_family', { familyId: user.familyId, userId: user.id }));
                setSocket(s);
            }
        } catch (e) { localStorage.removeItem('token'); setCurrentUser(null); }
        finally { setAuthChecked(true); setDataLoaded(true); }
    };

    useEffect(() => {
        const init = async () => {
            try { await localDb.init(); } catch (e) {}
            window.addEventListener('online', () => { setSyncStatus('online'); syncService.triggerSync(); });
            window.addEventListener('offline', () => setSyncStatus('offline'));
            await checkAuth();
        };
        init();
        return () => { socket?.disconnect(); };
    }, []);

    if (!authChecked) return <LoadingOverlay isVisible={true} message="Protegendo..." />;
    if (!currentUser) return <Auth onLoginSuccess={(u) => { setCurrentUser(u); checkAuth(); }} />;

    return (
        <HelpProvider currentView={currentView} onChangeView={setCurrentView}>
            <AppContent 
                currentUser={currentUser} state={state} setState={setState} dataLoaded={dataLoaded} 
                syncStatus={syncStatus} currentView={currentView} setCurrentView={setCurrentView}
                isMobileMenuOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen}
                refreshData={refreshData} checkAuth={checkAuth} members={members} socket={socket} 
            />
        </HelpProvider>
    );
};

export default App;
