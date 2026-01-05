
import React, { useState, useEffect, useRef } from 'react';
import { 
  User, AppState, ViewMode, Transaction, Account, 
  Contact, Category, OpticalRx, Branch, Member
} from './types';
import { refreshUser, loadInitialData, api, updateSettings, getFamilyMembers } from './services/storageService';
import { localDb } from './services/localDb';
import { syncService } from './services/syncService';
import { useAlert } from './components/AlertSystem';
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
import AccessView from './components/AccessView';
import SalespeopleView from './components/SalespeopleView';
import SettingsView from './components/SettingsView';
import OpticalModule from './components/OpticalModule';
import OpticalRxEditor from './components/OpticalRxEditor';
import LabsView from './components/LabsView';
import ServicesView from './components/ServicesView';
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
    const [editingRx, setEditingRx] = useState<OpticalRx | null>(null);

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
            case 'FIN_TRANSACTIONS': return <TransactionsView {...commonProps} transactions={state.transactions} accounts={state.accounts} contacts={state.contacts} categories={state.categories} branches={state.branches} onAdd={commonProps.onAddTransaction} onDelete={commonProps.onDeleteTransaction} onEdit={commonProps.onAddTransaction} onToggleStatus={commonProps.onUpdateStatus} />;
            case 'FIN_ACCOUNTS': return <AccountsView accounts={state.accounts} onSaveAccount={(a) => api.saveAccount(a).then(refreshData)} onDeleteAccount={(id) => api.deleteAccount(id).then(refreshData)} />;
            case 'SYS_CHAT': return <ChatView currentUser={currentUser} socket={socket} />;
            case 'OPTICAL_RX': return <OpticalModule opticalRxs={state.opticalRxs} contacts={state.contacts} laboratories={state.laboratories} onAddRx={() => { setEditingRx(null); setCurrentView('OPTICAL_RX_EDITOR'); }} onEditRx={(rx) => { setEditingRx(rx); setCurrentView('OPTICAL_RX_EDITOR'); }} onDeleteRx={(id) => api.deleteOpticalRx(id).then(refreshData)} onUpdateRx={(rx) => api.saveOpticalRx(rx).then(refreshData)} />;
            case 'OPTICAL_RX_EDITOR': return <OpticalRxEditor contacts={state.contacts} laboratories={state.laboratories} branches={state.branches} initialData={editingRx} onSave={(rx) => api.saveOpticalRx(rx).then(() => { refreshData(); setCurrentView('OPTICAL_RX'); })} onCancel={() => setCurrentView('OPTICAL_RX')} />;
            case 'OPTICAL_LABS_MGMT': return <LabsView laboratories={state.laboratories} onSaveLaboratory={(l) => api.saveLaboratory(l).then(refreshData)} onDeleteLaboratory={(id) => api.deleteLaboratory(id).then(refreshData)} />;
            case 'SYS_SALESPEOPLE': return <SalespeopleView salespeople={state.salespeople} branches={state.branches} members={members} onSaveSalesperson={(s) => api.saveLocallyAndQueue('salespeople', s).then(refreshData)} onDeleteSalesperson={(id) => api.deleteLocallyAndQueue('salespeople', id).then(refreshData)} />;
            case 'SYS_SETTINGS': return <SettingsView user={currentUser} pjData={{ companyProfile: state.companyProfile, branches: state.branches, costCenters: [], departments: [], projects: [] }} onUpdateSettings={(s) => updateSettings(s).then(() => checkAuth())} onOpenCollab={() => {}} onSavePJEntity={(t, d) => api.savePJEntity(t, d).then(refreshData)} onDeletePJEntity={(t, id) => api.deletePJEntity(t, id).then(refreshData)} />;
            case 'SYS_HELP': return <HelpCenter />;
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
