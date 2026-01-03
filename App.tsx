
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User, AppState, ViewMode, Transaction, Account, 
  Contact, Category, AppSettings, EntityType, 
  SubscriptionPlan, CompanyProfile,
  ServiceClient, ServiceItem, ServiceAppointment, ServiceOrder, CommercialOrder, Contract, Invoice,
  AppNotification, OpticalRx, FinancialGoal, Branch
} from './types';
import { refreshUser, loadInitialData, api, updateSettings } from './services/storageService';
import { localDb } from './services/localDb';
import { syncService } from './services/syncService';
import { useAlert, useConfirm } from './components/AlertSystem';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

// UI Components Imports
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionsView from './components/TransactionsView';
import CalendarView from './components/CalendarView';
import AccountsView from './components/AccountsView';
import CreditCardsView from './components/CreditCardsView';
import GoalsView from './components/GoalsView';
import Reports from './components/Reports';
import SmartAdvisor from './components/SmartAdvisor';
import DiagnosticView from './components/DiagnosticView';
import CategoriesView from './components/CategoriesView';
import ContactsView from './components/ContactsView';
import AccessView from './components/AccessView';
import LogsView from './components/LogsView';
import SettingsView from './components/SettingsView';
import OpticalModule from './components/OpticalModule';
import ServiceModule from './components/ServiceModule';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import LoadingOverlay from './components/LoadingOverlay';
import PublicOrderView from './components/PublicOrderView';
import { HelpProvider } from './components/GuidedHelp';

const App: React.FC = () => {
  const { showAlert } = useAlert();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');
  
  // View States
  const [currentView, setCurrentView] = useState<ViewMode>('FIN_DASHBOARD');
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth Navigation States
  const [showAuth, setShowAuth] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [initialEntityType, setInitialEntityType] = useState<EntityType>(EntityType.PERSONAL);
  const [initialPlan, setInitialPlan] = useState<SubscriptionPlan>(SubscriptionPlan.MONTHLY);

  const publicToken = new URLSearchParams(window.location.search).get('orderToken');

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        setAuthChecked(true);
        setLoading(false);
        return;
    }
    try {
        const { user } = await refreshUser();
        setCurrentUser(user);
        const data = await loadInitialData();
        setState(data);
    } catch (e) {
        localStorage.removeItem('token');
        setCurrentUser(null);
    } finally {
        setAuthChecked(true);
        setLoading(false);
    }
  };

  useEffect(() => {
    const initApp = async () => {
        await localDb.init();
        
        window.addEventListener('online', () => syncService.triggerSync());
        window.addEventListener('offline', () => setSyncStatus('offline'));
        
        syncService.onStatusChange(status => setSyncStatus(status));

        if (!publicToken) {
            await checkAuth();
        } else {
            setAuthChecked(true);
            setLoading(false);
        }
    };
    initApp();
  }, [publicToken]);

  const handleUpdateStatus = async (t: Transaction) => {
    const newStatus = t.status === 'PAID' ? 'PENDING' : 'PAID';
    await api.saveTransaction({ ...t, status: newStatus as any });
    const data = await loadInitialData();
    setState(data);
  };

  const handleLoginSuccess = async (user: User) => {
      setCurrentUser(user);
      setShowAuth(false);
      const data = await loadInitialData();
      setState(data);
  };

  const renderContent = () => {
    if (!state || !currentUser) return null;

    const commonProps = {
        state,
        settings: currentUser.settings,
        currentUser,
        onAddTransaction: (t: any) => api.saveTransaction(t).then(() => loadInitialData().then(setState)),
        onDeleteTransaction: (id: string) => api.deleteTransaction(id).then(() => loadInitialData().then(setState)),
        onEditTransaction: (t: any) => api.saveTransaction(t).then(() => loadInitialData().then(setState)),
        onUpdateStatus: handleUpdateStatus,
        onChangeView: setCurrentView
    };

    switch (currentView) {
      case 'FIN_DASHBOARD': return <Dashboard {...commonProps} />;
      case 'FIN_TRANSACTIONS': return <TransactionsView {...commonProps} transactions={state.transactions} accounts={state.accounts} contacts={state.contacts} categories={state.categories} onAdd={commonProps.onAddTransaction} onDelete={commonProps.onDeleteTransaction} onEdit={commonProps.onEditTransaction} onToggleStatus={handleUpdateStatus} />;
      case 'FIN_ACCOUNTS': return <AccountsView accounts={state.accounts} onSaveAccount={(a) => api.saveAccount(a).then(() => loadInitialData().then(setState))} onDeleteAccount={(id) => api.deleteAccount(id).then(() => loadInitialData().then(setState))} />;
      case 'FIN_ADVISOR': return <SmartAdvisor data={state} />;
      case 'DIAG_HUB': return <DiagnosticView state={state} />;
      case 'FIN_CARDS': return <CreditCardsView accounts={state.accounts} transactions={state.transactions} contacts={state.contacts} categories={state.categories} onSaveAccount={(a) => api.saveAccount(a).then(() => loadInitialData().then(setState))} onDeleteAccount={(id) => api.deleteAccount(id).then(() => loadInitialData().then(setState))} onAddTransaction={commonProps.onAddTransaction} />;
      case 'FIN_GOALS': return <GoalsView goals={state.goals} accounts={state.accounts} transactions={state.transactions} onSaveGoal={(g) => api.saveGoal(g).then(() => loadInitialData().then(setState))} onDeleteGoal={(id) => api.deleteGoal(id).then(() => loadInitialData().then(setState))} onAddTransaction={commonProps.onAddTransaction} />;
      case 'FIN_REPORTS': return <Reports transactions={state.transactions} />;
      case 'FIN_CATEGORIES': return <CategoriesView categories={state.categories} onSaveCategory={(c) => api.saveCategory(c).then(() => loadInitialData().then(setState))} onDeleteCategory={(id) => api.deleteCategory(id).then(() => loadInitialData().then(setState))} />;
      case 'FIN_CONTACTS': return <ContactsView contacts={state.contacts} onAddContact={() => {}} onEditContact={() => {}} onDeleteContact={(id) => api.deleteContact(id).then(() => loadInitialData().then(setState))} />;
      case 'SYS_SETTINGS': return <SettingsView user={currentUser} pjData={{ companyProfile: state.companyProfile, branches: state.branches, costCenters: state.costCenters, departments: state.departments, projects: state.projects }} onUpdateSettings={(s) => updateSettings(s).then(() => checkAuth())} onOpenCollab={() => {}} onSavePJEntity={(t, d) => api.savePJEntity(t, d).then(() => loadInitialData().then(setState))} onDeletePJEntity={(t, id) => api.deletePJEntity(t, id).then(() => loadInitialData().then(setState))} />;
      case 'SYS_ACCESS': return <AccessView currentUser={currentUser} />;
      case 'SYS_LOGS': return <LogsView currentUser={currentUser} />;
      case 'OPTICAL_RX': return <OpticalModule opticalRxs={state.opticalRxs} contacts={state.contacts} onAddRx={() => {}} onEditRx={() => {}} onDeleteRx={(id) => api.deleteOpticalRx(id).then(() => loadInitialData().then(setState))} />;
      case 'ODONTO_AGENDA': return <ServiceModule moduleTitle="Odontologia" clientLabel="Paciente" serviceLabel="Procedimento" transactionCategory="Odonto" activeSection="CALENDAR" clients={state.serviceClients} services={state.serviceItems} appointments={state.serviceAppointments} contacts={state.contacts} accounts={state.accounts} onSaveClient={(c) => api.saveServiceClient(c).then(() => loadInitialData().then(setState))} onDeleteClient={(id) => api.deleteServiceClient(id).then(() => loadInitialData().then(setState))} onSaveService={(s) => api.saveCatalogItem(s).then(() => loadInitialData().then(setState))} onDeleteService={(id) => api.deleteCatalogItem(id).then(() => loadInitialData().then(setState))} onSaveAppointment={(a) => api.saveAppointment(a).then(() => loadInitialData().then(setState))} onDeleteAppointment={(id) => api.deleteAppointment(id).then(() => loadInitialData().then(setState))} onAddTransaction={commonProps.onAddTransaction} />;
      default: return <Dashboard {...commonProps} />;
    }
  };

  if (!authChecked) return <LoadingOverlay isVisible={true} />;
  
  if (publicToken) return <PublicOrderView token={publicToken} />;
  
  if (!currentUser) {
      if (showAuth) {
          return (
              <div className="relative">
                  <button 
                    onClick={() => setShowAuth(false)}
                    className="fixed top-6 left-6 z-50 bg-white p-2 rounded-full shadow-lg border border-gray-100 text-gray-400 hover:text-indigo-600 transition-all"
                  >
                      <ArrowLeft className="w-6 h-6" />
                  </button>
                  <Auth 
                    onLoginSuccess={handleLoginSuccess} 
                    initialMode={authInitialMode}
                    initialEntityType={initialEntityType}
                    initialPlan={initialPlan}
                  />
              </div>
          );
      }
      return (
        <LandingPage 
            onGetStarted={(type, plan) => {
                setInitialEntityType(type);
                setInitialPlan(plan);
                setAuthInitialMode('REGISTER');
                setShowAuth(true);
            }} 
            onLogin={() => {
                setAuthInitialMode('LOGIN');
                setShowAuth(true);
            }} 
        />
      );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-inter text-gray-900 overflow-hidden">
      <HelpProvider currentView={currentView} onChangeView={setCurrentView}>
        <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView} 
            currentUser={currentUser} 
            onUserUpdate={setCurrentUser} 
            isMobileOpen={isMobileMenuOpen}
            setIsMobileOpen={setIsMobileMenuOpen}
        />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            <div className={`text-[10px] font-black uppercase tracking-widest px-4 py-1 flex items-center justify-center gap-2 transition-all ${
                syncStatus === 'offline' ? 'bg-rose-500 text-white' : 
                syncStatus === 'syncing' ? 'bg-indigo-600 text-white' : 
                'bg-emerald-500 text-white'
            }`}>
                {syncStatus === 'offline' && <><WifiOff className="w-3 h-3" /> Modo Offline Ativo</>}
                {syncStatus === 'syncing' && <><RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando Dados...</>}
                {syncStatus === 'online' && <><Wifi className="w-3 h-3" /> Sistema Sincronizado</>}
            </div>

            <div className="flex-1 overflow-y-auto relative scroll-smooth">
                <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
                    {renderContent()}
                </div>
            </div>
        </main>
      </HelpProvider>
    </div>
  );
};

const ArrowLeft = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);

export default App;
