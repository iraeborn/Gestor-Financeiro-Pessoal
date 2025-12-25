
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  User, AppState, ViewMode, Transaction, Account, 
  Contact, Category, AppSettings, EntityType, 
  SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project,
  ServiceClient, ServiceItem, ServiceAppointment, ServiceOrder, CommercialOrder, Contract, Invoice,
  TransactionStatus, TransactionType, OSItem, AppNotification
} from './types';
import { refreshUser, loadInitialData, api, updateSettings } from './services/storageService';
import { useAlert, useConfirm } from './components/AlertSystem';
import { Menu, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import TransactionsView from './components/TransactionsView';
import CalendarView from './components/CalendarView';
import AccountsView from './components/AccountsView';
import CreditCardsView from './components/CreditCardsView';
import GoalsView from './components/GoalsView';
import Reports from './components/Reports';
import CategoriesView from './components/CategoriesView';
import ContactsView from './components/ContactsView';
import SmartAdvisor from './components/SmartAdvisor';
import DiagnosticView from './components/DiagnosticView';
import AccessView from './components/AccessView';
import LogsView from './components/LogsView';
import SettingsView from './components/SettingsView';
import Sidebar from './components/Sidebar';
import CollaborationModal from './components/CollaborationModal';
import ServiceModule from './components/ServiceModule';
import ServicesView from './components/ServicesView';
import PublicOrderView from './components/PublicOrderView';
import NotificationPanel from './components/NotificationPanel';
import LoadingOverlay from './components/LoadingOverlay';

const App: React.FC = () => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [landingInitType, setLandingInitType] = useState<EntityType>(EntityType.PERSONAL);
  const [landingInitPlan, setLandingInitPlan] = useState<SubscriptionPlan>(SubscriptionPlan.MONTHLY);
  
  const socketRef = useRef<Socket | null>(null);
  const urlParams = new URLSearchParams(window.location.search);
  const publicToken = urlParams.get('orderToken');

  const [data, setData] = useState<AppState>({
    accounts: [], transactions: [], goals: [], contacts: [], categories: [],
    branches: [], costCenters: [], departments: [], projects: [],
    serviceClients: [], serviceItems: [], serviceAppointments: [],
    serviceOrders: [], commercialOrders: [], contracts: [], invoices: []
  });
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<ViewMode>('FIN_DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const effectiveSettings = useMemo(() => {
    if (!currentUser) return undefined;
    const familyId = currentUser.familyId || (currentUser as any).family_id;
    const ws = currentUser.workspaces?.find(w => w.id === familyId);
    return ws?.ownerSettings || currentUser.settings;
  }, [currentUser]);

  const userPermissions = useMemo(() => {
    if (!currentUser) return [];
    const familyId = currentUser.familyId || (currentUser as any).family_id;
    const ws = currentUser.workspaces?.find(w => w.id === familyId);
    if (currentUser.id === familyId || ws?.role === 'ADMIN') return 'ALL';
    let perms = ws?.permissions || [];
    if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch (e) { perms = []; }
    }
    return Array.isArray(perms) ? perms : [];
  }, [currentUser]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const initialData = await loadInitialData();
      if (initialData) setData(initialData);
      return initialData;
    } catch (e) {
      console.error("Erro na sincronização de dados:", e);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { if (!publicToken) checkAuth(); }, []);

  useEffect(() => {
    const familyId = currentUser?.familyId || (currentUser as any)?.family_id;
    if (familyId) {
      if (socketRef.current) socketRef.current.disconnect();
      const socket = io({ 
        transports: ['websocket', 'polling'], 
        withCredentials: true, 
        reconnection: true, 
        reconnectionAttempts: 20 
      } as any) as any;
      socketRef.current = socket;
      socket.on('connect', () => { socket.emit('join_family', familyId); });
      socket.on('DATA_UPDATED', async () => { await loadData(true); });
      return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }
  }, [currentUser, loadData]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      setLoading(true);
      try {
        const user = await refreshUser();
        setCurrentUser(user);
        setShowLanding(false);
        await loadData(true);
      } catch (e) {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    }
    setAuthChecked(true);
  };

  const handleLoginSuccess = async (user: User) => {
    setLoading(true);
    try {
        setCurrentUser(user);
        setShowLanding(false);
        await loadData(true);
    } finally {
        setLoading(false);
    }
  };

  const handleAddTransaction = async (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => {
    setLoading(true);
    try {
      if (newContact) await api.saveContact(newContact);
      if (newCategory) await api.saveCategory(newCategory);
      const newT = { ...t, id: crypto.randomUUID() };
      await api.saveTransaction(newT as Transaction);
      await loadData(true);
      showAlert("Lançamento salvo!");
    } catch (e) { showAlert("Erro ao salvar.", "error"); }
    finally { setLoading(false); }
  };

  const handleEditTransaction = async (t: Transaction, newContact?: Contact, newCategory?: Category) => {
    setLoading(true);
    try {
      if (newContact) await api.saveContact(newContact);
      if (newCategory) await api.saveCategory(newCategory);
      await api.saveTransaction(t);
      await loadData(true);
      showAlert("Transação atualizada.");
    } catch (e) { showAlert("Erro ao atualizar.", "error"); }
    finally { setLoading(false); }
  };

  if (publicToken) return <PublicOrderView token={publicToken} />;
  if (!authChecked) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 font-medium tracking-tight">Sincronizando ambiente...</div>;
  if (!currentUser) {
    if (showLanding) return <LandingPage onLogin={() => setShowLanding(false)} onGetStarted={(type, plan) => { setLandingInitType(type); setLandingInitPlan(plan); setShowLanding(false); }} />;
    return <Auth onLoginSuccess={handleLoginSuccess} initialMode={showLanding ? 'LOGIN' : 'REGISTER'} initialEntityType={landingInitType} initialPlan={landingInitPlan} />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'FIN_DASHBOARD':
        return <Dashboard state={data} settings={effectiveSettings} userPermissions={userPermissions} userEntity={currentUser.entityType} onAddTransaction={handleAddTransaction} onDeleteTransaction={async (id) => { await api.deleteTransaction(id); await loadData(true); }} onEditTransaction={handleEditTransaction} onUpdateStatus={(t) => handleEditTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})} onChangeView={setCurrentView} />;
      case 'FIN_TRANSACTIONS':
        return <TransactionsView transactions={data.transactions} accounts={data.accounts} contacts={data.contacts} categories={data.categories} settings={effectiveSettings} userEntity={currentUser.entityType} onDelete={async (id) => { await api.deleteTransaction(id); await loadData(true); }} onEdit={handleEditTransaction} onToggleStatus={(t) => handleEditTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})} onAdd={handleAddTransaction} />;
      case 'FIN_CALENDAR':
        return <CalendarView transactions={data.transactions} accounts={data.accounts} contacts={data.contacts} categories={data.categories} onAdd={handleAddTransaction} onEdit={handleEditTransaction} />;
      case 'FIN_ACCOUNTS':
        return <AccountsView accounts={data.accounts} onSaveAccount={async (a) => { await api.saveAccount(a); await loadData(true); }} onDeleteAccount={async (id) => { await api.deleteAccount(id); await loadData(true); }} />;
      case 'FIN_CARDS':
        return <CreditCardsView accounts={data.accounts} transactions={data.transactions} contacts={data.contacts} categories={data.categories} onSaveAccount={async (a) => { await api.saveAccount(a); await loadData(true); }} onDeleteAccount={async (id) => { await api.deleteAccount(id); await loadData(true); }} onAddTransaction={handleAddTransaction} />;
      case 'FIN_GOALS':
        return <GoalsView goals={data.goals} accounts={data.accounts} transactions={data.transactions} onSaveGoal={async (g) => { await api.saveGoal(g); await loadData(true); }} onDeleteGoal={async (id) => { await api.deleteGoal(id); await loadData(true); }} onAddTransaction={handleAddTransaction} />;
      case 'FIN_REPORTS':
        return <Reports transactions={data.transactions} />;
      case 'FIN_CATEGORIES':
        return <CategoriesView categories={data.categories} onSaveCategory={async (c) => { await api.saveCategory(c); await loadData(true); }} onDeleteCategory={async (id) => { await api.deleteCategory(id); await loadData(true); }} />;
      case 'FIN_CONTACTS':
      case 'SYS_CONTACTS':
        return <ContactsView contacts={data.contacts} onAddContact={async (c) => { await api.saveContact(c); await loadData(true); }} onEditContact={async (c) => { await api.saveContact(c); await loadData(true); }} onDeleteContact={async (id) => { await api.deleteContact(id); await loadData(true); }} />;
      
      case 'DIAG_HUB':
        return <DiagnosticView state={data} />;
      case 'FIN_ADVISOR':
        return <SmartAdvisor data={data} />;
      
      // MÓDULO ODONTOLOGIA
      case 'ODONTO_AGENDA':
      case 'ODONTO_PATIENTS':
      case 'ODONTO_PROCEDURES':
        return (
          <ServiceModule 
            moduleTitle="Odontologia"
            clientLabel="Paciente"
            serviceLabel="Procedimento"
            transactionCategory="Serviços Odontológicos"
            activeSection={currentView === 'ODONTO_AGENDA' ? 'CALENDAR' : currentView === 'ODONTO_PATIENTS' ? 'CLIENTS' : 'SERVICES'}
            clients={data.serviceClients.filter(c => c.moduleTag === 'odonto')}
            services={data.serviceItems.filter(s => s.moduleTag === 'odonto')}
            appointments={data.serviceAppointments.filter(a => a.moduleTag === 'odonto')}
            contacts={data.contacts}
            onSaveClient={async (c) => { await api.saveModuleClient({ ...c, moduleTag: 'odonto' }); await loadData(true); }}
            onDeleteClient={async (id) => { await api.deleteModuleClient(id); await loadData(true); }}
            onSaveService={async (s) => { await api.saveModuleService({ ...s, moduleTag: 'odonto' }); await loadData(true); }}
            onDeleteService={async (id) => { await api.deleteModuleService(id); await loadData(true); }}
            onSaveAppointment={async (a) => { await api.saveModuleAppointment({ ...a, moduleTag: 'odonto' }); await loadData(true); }}
            onDeleteAppointment={async (id) => { await api.deleteModuleAppointment(id); await loadData(true); }}
            onAddTransaction={handleAddTransaction}
          />
        );

      case 'SRV_OS':
      case 'SRV_SALES':
      case 'SRV_PURCHASES':
      case 'SRV_CATALOG':
      case 'SRV_CONTRACTS':
      case 'SRV_NF':
      case 'SRV_CLIENTS':
        return <ServicesView 
          currentView={currentView} 
          serviceOrders={data.serviceOrders} 
          commercialOrders={data.commercialOrders} 
          contracts={data.contracts} 
          invoices={data.invoices} 
          contacts={data.contacts} 
          accounts={data.accounts} 
          serviceItems={data.serviceItems} 
          onSaveOS={async (os) => { await api.saveOS(os); await loadData(true); }} 
          onDeleteOS={async (id) => { await api.deleteOS(id); await loadData(true); }} 
          onSaveOrder={async (o) => { await api.saveOrder(o); await loadData(true); }} 
          onDeleteOrder={async (id) => { await api.deleteOrder(id); await loadData(true); }} 
          onSaveContract={async (c) => { await api.saveContract(c); await loadData(true); }} 
          onDeleteContract={async (id) => { await api.deleteContract(id); await loadData(true); }} 
          onSaveInvoice={async (i) => { await api.saveInvoice(i); await loadData(true); }} 
          onDeleteInvoice={async (id) => { await api.deleteInvoice(id); await loadData(true); }} 
          onAddTransaction={handleAddTransaction} 
          onSaveCatalogItem={async (i) => { await api.saveCatalogItem(i); await loadData(true); }}
          onDeleteCatalogItem={async (id) => { await api.deleteCatalogItem(id); await loadData(true); }}
        />;
      
      case 'SYS_ACCESS':
        return <AccessView currentUser={currentUser} />;
      case 'SYS_LOGS':
        return <LogsView />;
      case 'SYS_SETTINGS':
        return <SettingsView user={currentUser} pjData={{companyProfile: data.companyProfile, branches: data.branches, costCenters: data.costCenters, departments: data.departments, projects: data.projects}} onUpdateSettings={async (s) => { await updateSettings(s); setCurrentUser({...currentUser, settings: s}); }} onOpenCollab={() => setIsCollabModalOpen(true)} onSavePJEntity={async (type, d) => { if(type==='company') await api.saveCompanyProfile(d); if(type==='branch') await api.saveBranch(d); await loadData(true); }} onDeletePJEntity={async (type, id) => { if(type==='branch') await api.deleteBranch(id); await loadData(true); }} />;
      
      default:
        return <Dashboard state={data} settings={effectiveSettings} userPermissions={userPermissions} userEntity={currentUser.entityType} onAddTransaction={handleAddTransaction} onDeleteTransaction={async (id) => { await api.deleteTransaction(id); await loadData(true); }} onEditTransaction={handleEditTransaction} onUpdateStatus={(t) => handleEditTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})} onChangeView={setCurrentView} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-inter text-gray-900">
      <LoadingOverlay isVisible={loading} />
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 h-full bg-white shadow-2xl animate-slide-in-left" onClick={e => e.stopPropagation()}>
             <Sidebar currentView={currentView} onChangeView={(v) => { setCurrentView(v); setIsMobileMenuOpen(false); }} currentUser={currentUser} onUserUpdate={setCurrentUser} onOpenCollab={() => setIsCollabModalOpen(true)} onOpenNotifications={() => setIsNotifPanelOpen(true)} />
          </div>
        </div>
      )}
      <div className="hidden md:flex w-64 h-screen fixed left-0 top-0 z-30">
        <Sidebar currentView={currentView} onChangeView={setCurrentView} currentUser={currentUser} onUserUpdate={setCurrentUser} onOpenCollab={() => setIsCollabModalOpen(true)} onOpenNotifications={() => setIsNotifPanelOpen(true)} />
      </div>
      <main className="flex-1 md:ml-64 h-screen overflow-y-auto relative">
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-100 sticky top-0 z-20">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">F</div>
                <span className="font-bold text-gray-800">FinManager</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"><Menu className="w-6 h-6" /></button>
        </div>
        <div className="p-4 md:p-8 w-full">{renderContent()}</div>
      </main>
      <CollaborationModal isOpen={isCollabModalOpen} onClose={() => setIsCollabModalOpen(false)} currentUser={currentUser} onUserUpdate={setCurrentUser} />
      <NotificationPanel isOpen={isNotifPanelOpen} onClose={() => setIsNotifPanelOpen(false)} notifications={notifications} onMarkAsRead={(id) => {}} onAction={() => {}} />
    </div>
  );
};

export default App;
