
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
import { Wifi, WifiOff, RefreshCw, ArrowLeft, Menu as MenuIcon } from 'lucide-react';

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
import ContactEditor from './components/ContactEditor';
import AccessView from './components/AccessView';
import LogsView from './components/LogsView';
import SettingsView from './components/SettingsView';
import OpticalModule from './components/OpticalModule';
import OpticalRxEditor from './components/OpticalRxEditor';
import ServiceModule from './components/ServiceModule';
import ServicesView from './components/ServicesView';
import ServiceOrderEditor from './components/ServiceOrderEditor';
import SaleEditor from './components/SaleEditor';
import BranchesView from './components/BranchesView';
import BranchScheduleView from './components/BranchScheduleView';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import LoadingOverlay from './components/LoadingOverlay';
import PublicOrderView from './components/PublicOrderView';
import { HelpProvider } from './components/GuidedHelp';

const App: React.FC = () => {
  const { showAlert } = useAlert();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');
  
  // View States
  const [currentView, setCurrentView] = useState<ViewMode>('FIN_DASHBOARD');
  const [state, setState] = useState<AppState | null>(null);

  // Selection States for Editors
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedOS, setSelectedOS] = useState<ServiceOrder | null>(null);
  const [selectedSale, setSelectedSale] = useState<CommercialOrder | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedRx, setSelectedRx] = useState<OpticalRx | null>(null);

  // Auth Navigation States
  const [showAuth, setShowAuth] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [initialEntityType, setInitialEntityType] = useState<EntityType>(EntityType.PERSONAL);
  const [initialPlan, setInitialPlan] = useState<SubscriptionPlan>(SubscriptionPlan.MONTHLY);

  const publicToken = new URLSearchParams(window.location.search).get('orderToken');

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        // Se não há token, garantimos que o estado global esteja nulo para evitar vazamentos visuais
        setState(null);
        setCurrentUser(null);
        setAuthChecked(true);
        setDataLoaded(true);
        return;
    }
    try {
        const { user } = await refreshUser();
        setCurrentUser(user);
        const data = await loadInitialData();
        setState(data);
    } catch (e) {
        console.error("Auth check failed:", e);
        localStorage.removeItem('token');
        setCurrentUser(null);
        setState(null);
    } finally {
        setAuthChecked(true);
        setDataLoaded(true);
    }
  };

  useEffect(() => {
    const initApp = async () => {
        try {
            await localDb.init();
        } catch (e) {
            console.error("IndexedDB failed to initialize:", e);
        }
        
        window.addEventListener('online', () => {
            setSyncStatus('online');
            syncService.triggerSync();
        });
        window.addEventListener('offline', () => setSyncStatus('offline'));
        
        syncService.onStatusChange(status => setSyncStatus(status));

        if (!publicToken) {
            await checkAuth();
        } else {
            setAuthChecked(true);
            setDataLoaded(true);
        }
    };
    initApp();
  }, [publicToken]);

  const refreshData = async () => {
      const data = await loadInitialData();
      setState(data);
  };

  const handleUpdateStatus = async (t: Transaction) => {
    const newStatus = t.status === 'PAID' ? 'PENDING' : 'PAID';
    await api.saveTransaction({ ...t, status: newStatus as any });
    await refreshData();
  };

  const handleLoginSuccess = async (user: User) => {
      setDataLoaded(false);
      // Nuke preventivo do estado ao entrar com novo usuário
      setState(null); 
      setCurrentUser(user);
      setShowAuth(false);
      try {
          const data = await loadInitialData();
          setState(data);
      } finally {
          setDataLoaded(true);
      }
  };

  // CAMADA DE ISOLAMENTO DE DADOS (Multi-tenant)
  // Filtra rigorosamente todos os registros pelo familyId ativo do usuário logado
  const safeState = useMemo(() => {
    if (!state || !currentUser) return null;
    
    const activeFamilyId = currentUser.familyId || (currentUser as any).family_id;
    if (!activeFamilyId) return null; 
    
    const filterByFamily = (items: any[]) => {
        if (!Array.isArray(items)) return [];
        return items.filter(item => {
            const itemFamilyId = item.familyId || item.family_id;
            // SEGURANÇA CRÍTICA: Somente itens que dão "match" exato com a família da sessão são processados.
            return itemFamilyId === activeFamilyId;
        });
    };

    return {
        accounts: filterByFamily(state.accounts || []),
        transactions: filterByFamily(state.transactions || []),
        contacts: filterByFamily(state.contacts || []),
        categories: filterByFamily(state.categories || []),
        branches: filterByFamily(state.branches || []),
        costCenters: filterByFamily(state.costCenters || []),
        departments: filterByFamily(state.departments || []),
        projects: filterByFamily(state.projects || []),
        serviceClients: filterByFamily(state.serviceClients || []),
        serviceItems: filterByFamily(state.serviceItems || []),
        serviceAppointments: filterByFamily(state.serviceAppointments || []),
        serviceOrders: filterByFamily(state.serviceOrders || []),
        commercialOrders: filterByFamily(state.commercialOrders || []),
        contracts: filterByFamily(state.contracts || []),
        invoices: filterByFamily(state.invoices || []),
        opticalRxs: filterByFamily(state.opticalRxs || []),
        goals: filterByFamily(state.goals || []),
        companyProfile: state.companyProfile && (state.companyProfile.familyId === activeFamilyId || (state.companyProfile as any).family_id === activeFamilyId) 
            ? state.companyProfile 
            : null
    };
  }, [state, currentUser]);

  const renderContent = () => {
    if (!dataLoaded || !safeState || !currentUser) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-gray-400 font-medium uppercase text-[10px] tracking-widest">Validando integridade do tenant...</p>
            </div>
        );
    }

    const commonProps = {
        state: safeState as AppState,
        settings: currentUser.settings,
        currentUser,
        onAddTransaction: (t: any) => api.saveTransaction(t).then(refreshData),
        onDeleteTransaction: (id: string) => api.deleteTransaction(id).then(refreshData),
        onEditTransaction: (t: any) => api.saveTransaction(t).then(refreshData),
        onUpdateStatus: handleUpdateStatus,
        onChangeView: setCurrentView
    };

    switch (currentView) {
      case 'FIN_DASHBOARD': return <Dashboard {...commonProps} />;
      case 'FIN_TRANSACTIONS': return <TransactionsView {...commonProps} transactions={safeState.transactions} accounts={safeState.accounts} contacts={safeState.contacts} categories={safeState.categories} branches={safeState.branches} costCenters={safeState.costCenters} departments={safeState.departments} projects={safeState.projects} onAdd={commonProps.onAddTransaction} onDelete={commonProps.onDeleteTransaction} onEdit={commonProps.onAddTransaction} onToggleStatus={handleUpdateStatus} />;
      case 'FIN_ACCOUNTS': return <AccountsView accounts={safeState.accounts} onSaveAccount={(a) => api.saveAccount(a).then(refreshData)} onDeleteAccount={(id) => api.deleteAccount(id).then(refreshData)} />;
      case 'FIN_CARDS': return <CreditCardsView accounts={safeState.accounts} transactions={safeState.transactions} contacts={safeState.contacts} categories={safeState.categories} onSaveAccount={(a) => api.saveAccount(a).then(refreshData)} onDeleteAccount={(id) => api.deleteAccount(id).then(refreshData)} onAddTransaction={commonProps.onAddTransaction} />;
      case 'FIN_GOALS': return <GoalsView goals={safeState.goals} accounts={safeState.accounts} transactions={safeState.transactions} onSaveGoal={(g) => api.saveGoal(g).then(refreshData)} onDeleteGoal={(id) => api.deleteGoal(id).then(refreshData)} onAddTransaction={commonProps.onAddTransaction} />;
      case 'FIN_REPORTS': return <Reports transactions={safeState.transactions} />;
      
      case 'FIN_ADVISOR': return <SmartAdvisor data={safeState as any} />;
      case 'DIAG_HUB': return <DiagnosticView state={safeState as any} />;
      
      case 'SRV_OS':
      case 'SRV_SALES':
      case 'SRV_CATALOG':
      case 'SRV_PURCHASES':
      case 'SRV_CONTRACTS':
      case 'SRV_NF':
      case 'OPTICAL_LAB':
      case 'OPTICAL_SALES':
          return (
              <ServicesView 
                {...commonProps}
                currentView={currentView}
                serviceOrders={safeState.serviceOrders}
                commercialOrders={safeState.commercialOrders}
                contracts={safeState.contracts}
                invoices={safeState.invoices}
                contacts={safeState.contacts}
                accounts={safeState.accounts}
                serviceItems={safeState.serviceItems}
                opticalRxs={safeState.opticalRxs}
                onAddOS={() => { setSelectedOS(null); setCurrentView('SRV_OS_EDITOR'); }}
                onEditOS={(os) => { setSelectedOS(os); setCurrentView('SRV_OS_EDITOR'); }}
                onAddSale={() => { setSelectedSale(null); setCurrentView('SRV_SALE_EDITOR'); }}
                onEditSale={(sale) => { setSelectedSale(sale); setCurrentView('SRV_SALE_EDITOR'); }}
                onSaveOS={(os) => api.saveOS(os).then(refreshData)}
                onDeleteOS={(id) => api.deleteOS(id).then(refreshData)}
                onSaveOrder={(o) => api.saveOrder(o).then(refreshData)}
                onDeleteOrder={(id) => api.deleteOrder(id).then(refreshData)}
                onSaveContract={(c) => api.savePJEntity('contract', c).then(refreshData)}
                onDeleteContract={(id) => api.deletePJEntity('contract', id).then(refreshData)}
                onSaveInvoice={(i) => api.savePJEntity('invoice', i).then(refreshData)}
                onDeleteInvoice={(id) => api.deletePJEntity('invoice', id).then(refreshData)}
                onSaveCatalogItem={(i) => api.saveCatalogItem(i).then(refreshData)}
                onDeleteCatalogItem={(id) => api.deleteCatalogItem(id).then(refreshData)}
              />
          );

      case 'SRV_OS_EDITOR': 
        return <ServiceOrderEditor 
                    initialData={selectedOS} 
                    contacts={safeState.contacts} 
                    serviceItems={safeState.serviceItems} 
                    opticalRxs={safeState.opticalRxs} 
                    branches={safeState.branches}
                    settings={currentUser.settings}
                    onSave={(os) => api.saveOS(os).then(() => { refreshData(); setCurrentView('SRV_OS'); })}
                    onCancel={() => setCurrentView('SRV_OS')} 
                />;
      
      case 'SRV_SALE_EDITOR':
        return <SaleEditor 
                    initialData={selectedSale} 
                    contacts={safeState.contacts} 
                    serviceItems={safeState.serviceItems} 
                    opticalRxs={safeState.opticalRxs} 
                    branches={safeState.branches}
                    settings={currentUser.settings}
                    onSave={(sale) => api.saveOrder(sale).then(() => { refreshData(); setCurrentView('SRV_SALES'); })}
                    onCancel={() => setCurrentView('SRV_SALES')} 
                />;

      case 'SYS_BRANCHES':
          return (
              <BranchesView 
                  branches={safeState.branches} 
                  onSaveBranch={(b) => api.savePJEntity('branch', b).then(refreshData)} 
                  onDeleteBranch={(id) => api.deletePJEntity('branch', id).then(refreshData)}
                  onManageSchedule={(b) => { setSelectedBranch(b); setCurrentView('SRV_BRANCH_SCHEDULE'); }}
              />
          );
      
      case 'SRV_BRANCH_SCHEDULE':
          if (!selectedBranch) { setCurrentView('SYS_BRANCHES'); return null; }
          return (
              <BranchScheduleView 
                  branch={selectedBranch}
                  appointments={safeState.serviceAppointments}
                  clients={safeState.serviceClients}
                  onSaveAppointment={(a) => api.saveAppointment(a).then(refreshData)}
                  onDeleteAppointment={(id) => api.deleteAppointment(id).then(refreshData)}
                  onBack={() => setCurrentView('SYS_BRANCHES')}
              />
          );

      case 'OPTICAL_RX': 
        return <OpticalModule 
                    opticalRxs={safeState.opticalRxs} 
                    contacts={safeState.contacts} 
                    onAddRx={() => { setSelectedRx(null); setCurrentView('OPTICAL_RX_EDITOR'); }}
                    onEditRx={(rx) => { setSelectedRx(rx); setCurrentView('OPTICAL_RX_EDITOR'); }}
                    onDeleteRx={(id) => api.deleteOpticalRx(id).then(refreshData)} 
                />;
      case 'OPTICAL_RX_EDITOR':
        return <OpticalRxEditor 
                    initialData={selectedRx} 
                    contacts={safeState.contacts} 
                    branches={safeState.branches}
                    onSave={(rx) => api.saveOpticalRx(rx).then(() => { refreshData(); setCurrentView('OPTICAL_RX'); })}
                    onCancel={() => setCurrentView('OPTICAL_RX')} 
                />;

      case 'ODONTO_AGENDA': return <ServiceModule moduleTitle="Odontologia" clientLabel="Paciente" serviceLabel="Procedimento" transactionCategory="Odonto" activeSection="CALENDAR" clients={safeState.serviceClients} services={safeState.serviceItems} appointments={safeState.serviceAppointments} contacts={safeState.contacts} accounts={safeState.accounts} onSaveClient={(c) => api.saveServiceClient(c).then(refreshData)} onDeleteClient={(id) => api.deleteServiceClient(id).then(refreshData)} onSaveService={(s) => api.saveCatalogItem(s).then(refreshData)} onDeleteService={(id) => api.deleteCatalogItem(id).then(refreshData)} onSaveAppointment={(a) => api.saveAppointment(a).then(refreshData)} onDeleteAppointment={(id) => api.deleteAppointment(id).then(refreshData)} onAddTransaction={commonProps.onAddTransaction} />;
      case 'ODONTO_PATIENTS': return <ServiceModule moduleTitle="Odontologia" clientLabel="Paciente" serviceLabel="Procedimento" transactionCategory="Odonto" activeSection="CLIENTS" clients={safeState.serviceClients} services={safeState.serviceItems} appointments={safeState.serviceAppointments} contacts={safeState.contacts} accounts={safeState.accounts} onSaveClient={(c) => api.saveServiceClient(c).then(refreshData)} onDeleteClient={(id) => api.deleteServiceClient(id).then(refreshData)} onSaveService={(s) => api.saveCatalogItem(s).then(refreshData)} onDeleteService={(id) => api.deleteCatalogItem(id).then(refreshData)} onSaveAppointment={(a) => api.saveAppointment(a).then(refreshData)} onDeleteAppointment={(id) => api.deleteAppointment(id).then(refreshData)} onAddTransaction={commonProps.onAddTransaction} />;
      
      case 'FIN_CATEGORIES': return <CategoriesView categories={safeState.categories} onSaveCategory={(c) => api.saveCategory(c).then(refreshData)} onDeleteCategory={(id) => api.deleteCategory(id).then(refreshData)} />;
      case 'FIN_CONTACTS': return <ContactsView contacts={safeState.contacts} onAddContact={() => { setSelectedContact(null); setCurrentView('FIN_CONTACT_EDITOR'); }} onEditContact={(c) => { setSelectedContact(c); setCurrentView('FIN_CONTACT_EDITOR'); }} onDeleteContact={(id) => api.deleteContact(id).then(refreshData)} />;
      case 'FIN_CONTACT_EDITOR': return <ContactEditor initialData={selectedContact} settings={currentUser.settings} onSave={(c) => api.saveContact(c).then(() => { refreshData(); setCurrentView('FIN_CONTACTS'); })} onCancel={() => setCurrentView('FIN_CONTACTS')} />;
      case 'SYS_SETTINGS': return <SettingsView user={currentUser} pjData={{ companyProfile: safeState.companyProfile, branches: safeState.branches, costCenters: safeState.costCenters, departments: safeState.departments, projects: safeState.projects }} onUpdateSettings={(s) => updateSettings(s).then(() => checkAuth())} onOpenCollab={() => {}} onSavePJEntity={(t, d) => api.savePJEntity(t, d).then(refreshData)} onDeletePJEntity={(t, id) => api.deletePJEntity(t, id).then(refreshData)} />;
      case 'SYS_ACCESS': return <AccessView currentUser={currentUser} />;
      case 'SYS_LOGS': return <LogsView currentUser={currentUser} />;
      
      default: return <Dashboard {...commonProps} state={safeState as any} />;
    }
  };

  if (!authChecked) return <LoadingOverlay isVisible={true} message="Protegendo sistema..." />;
  
  if (publicToken) return <PublicOrderView token={publicToken} />;
  
  if (!currentUser) {
      if (showAuth) {
          return (
              <div className="relative min-h-screen bg-gray-50">
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
            <div className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-40">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg">F</div>
                    <span className="font-black text-sm text-gray-800 tracking-tighter">FinManager</span>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg"
                >
                    <MenuIcon className="w-6 h-6" />
                </button>
            </div>

            <div className={`text-[10px] font-black uppercase tracking-widest px-4 py-1 flex items-center justify-center gap-2 transition-all ${
                syncStatus === 'offline' ? 'bg-rose-500 text-white' : 
                syncStatus === 'syncing' ? 'bg-indigo-600 text-white' : 
                'bg-emerald-500 text-white'
            }`}>
                {syncStatus === 'offline' && <><WifiOff className="w-3 h-3" /> Modo Offline Ativo</>}
                {syncStatus === 'syncing' && <><RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando Dados...</>}
                {syncStatus === 'online' && <><Wifi className="w-3 h-3" /> Sistema Protegido</>}
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

export default App;
