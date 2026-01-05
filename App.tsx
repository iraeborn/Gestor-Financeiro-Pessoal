
import React, { useState, useEffect, useRef } from 'react';
import { 
  User, AppState, ViewMode, Transaction, Account, 
  Contact, Category, OpticalRx, Branch, Member, ServiceOrder, CommercialOrder
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
    currentUser, state, dataLoaded, syncStatus, currentView, setCurrentView, 
    isMobileMenuOpen, setIsMobileOpen, refreshData, checkAuth, members, socket 
}) => {
    const { isTrackerVisible, setIsTrackerVisible } = useHelp();
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    
    // States for Editing/Navigation
    const [editingRx, setEditingRx] = useState<OpticalRx | null>(null);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [editingOS, setEditingOS] = useState<ServiceOrder | null>(null);
    const [editingSale, setEditingSale] = useState<CommercialOrder | null>(null);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);

    // Lógica para Links de Convite (URL params)
    useEffect(() => {
        const checkJoinLink = async () => {
            if (!currentUser) return;
            
            const params = new URLSearchParams(window.location.search);
            const joinCode = params.get('joinCode');
            
            if (joinCode) {
                // Limpa a URL para não processar de novo em reloads
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);

                const confirm = await showConfirm({
                    title: "Novo Convite de Equipe",
                    message: "Você recebeu um convite para entrar em uma nova organização. Deseja aceitar agora? Você mudará seu ambiente de trabalho.",
                    confirmText: "Sim, Entrar na Equipe"
                });

                if (confirm) {
                    try {
                        await joinFamily(joinCode);
                        showAlert("Bem-vindo à nova equipe! Recarregando dados...", "success");
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (e: any) {
                        showAlert(e.message || "Erro ao processar convite via link.", "error");
                    }
                }
            }
        };

        checkJoinLink();
    }, [currentUser]);

    const renderContent = () => {
        if (!dataLoaded || !state || !currentUser) return <LoadingOverlay isVisible={true} />;
        const commonProps = {
            state, settings: currentUser.settings, currentUser,
            onAddTransaction: (t: any) => api.saveTransaction(t).then(refreshData),
            onDeleteTransaction: (id: string) => api.deleteTransaction(id).then(refreshData),
            onEditTransaction: (t: any) => api.saveTransaction(t).then(refreshData),
            onUpdateStatus: (t: any) => api.saveTransaction({...t, status: t.status === 'PAID' ? 'PENDING' : 'PAID'}).then(refreshData),
            onChangeView: setCurrentView
        };
        switch (currentView) {
            case 'FIN_DASHBOARD': return <Dashboard {...commonProps} />;
            case 'FIN_TRANSACTIONS': return <TransactionsView {...commonProps} transactions={state.transactions} accounts={state.accounts} contacts={state.contacts} categories={state.categories} branches={state.branches} costCenters={state.costCenters} departments={state.departments} projects={state.projects} onAdd={commonProps.onAddTransaction} onDelete={commonProps.onDeleteTransaction} onEdit={commonProps.onAddTransaction} onToggleStatus={commonProps.onUpdateStatus} />;
            case 'FIN_ACCOUNTS': return <AccountsView accounts={state.accounts} onSaveAccount={(a) => api.saveAccount(a).then(refreshData)} onDeleteAccount={(id) => api.deleteAccount(id).then(refreshData)} />;
            case 'FIN_CARDS': return <CreditCardsView accounts={state.accounts} transactions={state.transactions} contacts={state.contacts} categories={state.categories} onSaveAccount={(a) => api.saveAccount(a).then(refreshData)} onDeleteAccount={(id) => api.deleteAccount(id).then(refreshData)} onAddTransaction={commonProps.onAddTransaction} />;
            case 'FIN_GOALS': return <GoalsView goals={state.goals} accounts={state.accounts} transactions={state.transactions} onSaveGoal={(g) => api.saveGoal(g).then(refreshData)} onDeleteGoal={(id) => api.deleteGoal(id).then(refreshData)} onAddTransaction={commonProps.onAddTransaction} />;
            case 'FIN_REPORTS': return <Reports transactions={state.transactions} />;
            case 'FIN_ADVISOR': return <SmartAdvisor data={state} />;
            case 'DIAG_HUB': return <DiagnosticView state={state} />;
            
            case 'FIN_CONTACTS': return <ContactsView contacts={state.contacts} onAddContact={() => { setEditingContact(null); setCurrentView('FIN_CONTACT_EDITOR'); }} onEditContact={(c) => { setEditingContact(c); setCurrentView('FIN_CONTACT_EDITOR'); }} onDeleteContact={(id) => api.deleteContact(id).then(refreshData)} />;
            case 'FIN_CONTACT_EDITOR': return <ContactEditor initialData={editingContact} settings={currentUser.settings} onSave={(c) => api.saveContact(c).then(() => { refreshData(); setCurrentView('FIN_CONTACTS'); })} onCancel={() => setCurrentView('FIN_CONTACTS')} />;
            
            case 'SYS_CHAT': return <ChatView currentUser={currentUser} socket={socket} />;
            case 'SYS_ACCESS': return <AccessView currentUser={currentUser} />;
            case 'SYS_LOGS': return <LogsView currentUser={currentUser} />;
            
            case 'SYS_BRANCHES': return <BranchesView branches={state.branches} onSaveBranch={(b) => api.savePJEntity('branch', b).then(refreshData)} onDeleteBranch={(id) => api.deletePJEntity('branch', id).then(refreshData)} onManageSchedule={(b) => { setEditingBranch(b); setCurrentView('SRV_BRANCH_SCHEDULE'); }} onManageSalesSchedule={(b) => { setEditingBranch(b); setCurrentView('SYS_SALES_SCHEDULE'); }} />;
            case 'SRV_BRANCH_SCHEDULE': return editingBranch ? <BranchScheduleView branch={editingBranch} appointments={state.serviceAppointments} clients={state.serviceClients} onSaveAppointment={(a) => api.saveAppointment(a).then(refreshData)} onDeleteAppointment={(id) => api.deleteAppointment(id).then(refreshData)} onBack={() => setCurrentView('SYS_BRANCHES')} /> : <Dashboard {...commonProps} />;
            case 'SYS_SALES_SCHEDULE': return editingBranch ? <SalespersonScheduleView branch={editingBranch} schedules={state.salespersonSchedules} salespeople={state.salespeople} onSaveSchedule={(s) => api.saveSalespersonSchedule(s).then(refreshData)} onDeleteSchedule={(id) => api.deleteSalespersonSchedule(id).then(refreshData)} onBack={() => setCurrentView('SYS_BRANCHES')} /> : <Dashboard {...commonProps} />;
            
            case 'OPTICAL_RX': return <OpticalModule opticalRxs={state.opticalRxs} contacts={state.contacts} laboratories={state.laboratories} onAddRx={() => { setEditingRx(null); setCurrentView('OPTICAL_RX_EDITOR'); }} onEditRx={(rx) => { setEditingRx(rx); setCurrentView('OPTICAL_RX_EDITOR'); }} onDeleteRx={(id) => api.deleteOpticalRx(id).then(refreshData)} onUpdateRx={(rx) => api.saveOpticalRx(rx).then(refreshData)} />;
            case 'OPTICAL_RX_EDITOR': return <OpticalRxEditor contacts={state.contacts} laboratories={state.laboratories} branches={state.branches} initialData={editingRx} onSave={(rx) => api.saveOpticalRx(rx).then(() => { refreshData(); setCurrentView('OPTICAL_RX'); })} onCancel={() => setCurrentView('OPTICAL_RX')} />;
            case 'OPTICAL_LABS_MGMT': return <LabsView laboratories={state.laboratories} onSaveLaboratory={(l) => api.saveLaboratory(l).then(refreshData)} onDeleteLaboratory={(id) => api.deleteLaboratory(id).then(refreshData)} />;
            
            case 'SYS_SALESPEOPLE': return <SalespeopleView salespeople={state.salespeople} branches={state.branches} members={members} onSaveSalesperson={(s) => api.saveLocallyAndQueue('salespeople', s).then(refreshData)} onDeleteSalesperson={(id) => api.deleteLocallyAndQueue('salespeople', id).then(refreshData)} />;
            case 'SYS_SETTINGS': return <SettingsView user={currentUser} pjData={{ companyProfile: state.companyProfile, branches: state.branches, costCenters: state.costCenters, departments: state.departments, projects: state.projects }} onUpdateSettings={(s) => updateSettings(s).then(() => checkAuth())} onOpenCollab={() => {}} onSavePJEntity={(t, d) => api.savePJEntity(t, d).then(refreshData)} onDeletePJEntity={(t, id) => api.deletePJEntity(t, id).then(refreshData)} />;
            case 'SYS_HELP': return <HelpCenter />;

            // --- SERVIÇOS, OS e VENDAS ---
            case 'OPTICAL_LAB':
            case 'SRV_OS':
                return <ServicesView 
                    currentView={currentView}
                    serviceOrders={state.serviceOrders}
                    commercialOrders={state.commercialOrders}
                    contracts={state.contracts}
                    invoices={state.invoices}
                    contacts={state.contacts}
                    accounts={state.accounts}
                    serviceItems={state.serviceItems}
                    opticalRxs={state.opticalRxs}
                    settings={currentUser.settings}
                    onAddOS={() => { setEditingOS(null); setCurrentView('SRV_OS_EDITOR'); }}
                    onEditOS={(os) => { setEditingOS(os); setCurrentView('SRV_OS_EDITOR'); }}
                    onSaveOS={(os) => api.saveOS(os).then(refreshData)}
                    onDeleteOS={(id) => api.deleteOS(id).then(refreshData)}
                    onAddSale={() => {}} onEditSale={() => {}} onSaveOrder={() => {}} onDeleteOrder={() => {}} 
                    onSaveContract={() => {}} onDeleteContract={() => {}} 
                    onSaveInvoice={() => {}} onDeleteInvoice={() => {}}
                    onAddTransaction={commonProps.onAddTransaction}
                />;

            case 'SRV_OS_EDITOR':
                return <ServiceOrderEditor 
                    initialData={editingOS}
                    contacts={state.contacts}
                    serviceItems={state.serviceItems}
                    opticalRxs={state.opticalRxs}
                    branches={state.branches}
                    settings={currentUser.settings}
                    onSave={(os) => api.saveOS(os).then(() => { refreshData(); setCurrentView(os.moduleTag === 'optical' ? 'OPTICAL_LAB' : 'SRV_OS'); })}
                    onCancel={() => setCurrentView(editingOS?.moduleTag === 'optical' ? 'OPTICAL_LAB' : 'SRV_OS')}
                />;

            case 'OPTICAL_SALES':
            case 'SRV_SALES':
                return <ServicesView 
                    currentView={currentView}
                    serviceOrders={state.serviceOrders}
                    commercialOrders={state.commercialOrders}
                    contracts={state.contracts}
                    invoices={state.invoices}
                    contacts={state.contacts}
                    accounts={state.accounts}
                    serviceItems={state.serviceItems}
                    opticalRxs={state.opticalRxs}
                    settings={currentUser.settings}
                    onAddOS={() => {}} onEditOS={() => {}} onSaveOS={() => {}} onDeleteOS={() => {}}
                    onAddSale={() => { setEditingSale(null); setCurrentView('SRV_SALE_EDITOR'); }}
                    onEditSale={(sale) => { setEditingSale(sale); setCurrentView('SRV_SALE_EDITOR'); }}
                    onSaveOrder={(o) => api.saveOrder(o).then(refreshData)}
                    onDeleteOrder={(id) => api.deleteOrder(id).then(refreshData)}
                    onSaveContract={() => {}} onDeleteContract={() => {}} 
                    onSaveInvoice={() => {}} onDeleteInvoice={() => {}}
                    onAddTransaction={commonProps.onAddTransaction}
                />;

            case 'SRV_SALE_EDITOR':
                return <SaleEditor 
                    initialData={editingSale}
                    contacts={state.contacts}
                    serviceItems={state.serviceItems}
                    opticalRxs={state.opticalRxs}
                    branches={state.branches}
                    settings={currentUser.settings}
                    onSave={(o) => api.saveOrder(o).then(() => { refreshData(); setCurrentView(o.moduleTag === 'optical' ? 'OPTICAL_SALES' : 'SRV_SALES'); })}
                    onCancel={() => setCurrentView(editingSale?.moduleTag === 'optical' ? 'OPTICAL_SALES' : 'SRV_SALES')}
                />;

            case 'SRV_CATALOG':
            case 'SRV_CONTRACTS':
            case 'SRV_NF':
                return <ServicesView 
                    currentView={currentView}
                    serviceOrders={state.serviceOrders}
                    commercialOrders={state.commercialOrders}
                    contracts={state.contracts}
                    invoices={state.invoices}
                    contacts={state.contacts}
                    accounts={state.accounts}
                    serviceItems={state.serviceItems}
                    opticalRxs={state.opticalRxs}
                    settings={currentUser.settings}
                    onAddOS={() => {}} onEditOS={() => {}} onSaveOS={() => {}} onDeleteOS={() => {}}
                    onAddSale={() => {}} onEditSale={() => {}} onSaveOrder={() => {}} onDeleteOrder={() => {}}
                    onSaveContract={(c) => {}} onDeleteContract={(id) => {}} // TODO: Implement API calls
                    onSaveInvoice={(i) => {}} onDeleteInvoice={(id) => {}}
                    onAddTransaction={commonProps.onAddTransaction}
                    onSaveCatalogItem={(i) => api.saveCatalogItem(i).then(refreshData)}
                    onDeleteCatalogItem={(id) => api.deleteCatalogItem(id).then(refreshData)}
                />;

            default: return <Dashboard {...commonProps} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 font-inter text-gray-900 overflow-hidden relative">
            <Sidebar currentView={currentView} onChangeView={setCurrentView} currentUser={currentUser!} onUserUpdate={() => {}} isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileOpen} />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <div className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-40 shrink-0">
                    <button onClick={() => setIsMobileOpen(true)} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"><MenuIcon className="w-6 h-6" /></button>
                    <div className="flex items-center gap-1.5"><div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg text-xs">F</div><span className="font-black text-sm text-gray-800 tracking-tighter">FinManager</span></div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsTrackerVisible(!isTrackerVisible)} className={`p-2 rounded-lg transition-all ${isTrackerVisible ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-600'}`}><HelpCircle className="w-5 h-5"/></button>
                        <button className="p-2 text-gray-400"><Bell className="w-5 h-5"/></button>
                    </div>
                </div>
                
                <div className={`text-[9px] font-black uppercase tracking-widest px-4 py-1 flex items-center justify-center gap-2 transition-all shrink-0 ${syncStatus === 'offline' ? 'bg-rose-50 text-white' : 'bg-emerald-500 text-white'}`}>
                    {syncStatus === 'offline' ? <><WifiOff className="w-3 h-3" /> Offline</> : <><RefreshCw className="w-2.5 h-2.5" /> Sincronizado</>}
                </div>

                <div className="flex-1 overflow-y-auto relative scroll-smooth bg-gray-50">
                    <div className="p-3 md:p-8 max-w-[1600px] mx-auto">
                        {renderContent()}
                    </div>
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
            if (navigator.onLine) await syncService.pullFromServer();
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
            
            // Inicializa Socket após autenticação
            if (!socket) {
                const s = io({ transports: ['websocket', 'polling'] });
                // Passa o userId e familyId para o servidor
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
                currentUser={currentUser} state={state} dataLoaded={dataLoaded} 
                syncStatus={syncStatus} currentView={currentView} setCurrentView={setCurrentView}
                isMobileMenuOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen}
                refreshData={refreshData} checkAuth={checkAuth}
                members={members}
                socket={socket}
            />
        </HelpProvider>
    );
};

export default App;
