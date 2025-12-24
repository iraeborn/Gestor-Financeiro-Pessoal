
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, AppState, ViewMode, Transaction, Account, 
  Contact, Category, AppSettings, EntityType, 
  SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project,
  ServiceClient, ServiceItem, ServiceAppointment, ServiceOrder, CommercialOrder, Contract, Invoice,
  TransactionStatus, TransactionType, OSItem, AppNotification
} from './types';
import { refreshUser, loadInitialData, api, updateSettings } from './services/storageService';
import { useAlert, useConfirm } from './components/AlertSystem';
import { Menu } from 'lucide-react';
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
import AdminDashboard from './components/AdminDashboard';
import Sidebar from './components/Sidebar';
import CollaborationModal from './components/CollaborationModal';
import ServiceModule from './components/ServiceModule';
import ServicesView from './components/ServicesView';
import PublicOrderView from './components/PublicOrderView';
import ApprovalModal from './components/ApprovalModal';
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
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [remoteApprovalOrder, setRemoteApprovalOrder] = useState<CommercialOrder | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const initialData = await loadInitialData();
      if (initialData) {
          setData({
              accounts: initialData.accounts || [],
              transactions: initialData.transactions || [],
              goals: initialData.goals || [],
              contacts: initialData.contacts || [],
              categories: initialData.categories || [],
              branches: initialData.branches || [],
              costCenters: initialData.costCenters || [],
              departments: initialData.departments || [],
              projects: initialData.projects || [],
              serviceClients: initialData.serviceClients || [],
              serviceItems: initialData.serviceItems || [],
              serviceAppointments: initialData.serviceAppointments || [],
              serviceOrders: initialData.serviceOrders || [],
              commercialOrders: initialData.commercialOrders || [],
              contracts: initialData.contracts || [],
              invoices: initialData.invoices || [],
              companyProfile: initialData.companyProfile || null
          });
      }
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
    if (currentUser?.familyId) {
      if (socketRef.current) socketRef.current.disconnect();
      const socket = io({ 
        transports: ['websocket', 'polling'], 
        withCredentials: true, 
        reconnection: true, 
        reconnectionAttempts: 20 
      } as any) as any;
      socketRef.current = socket;
      socket.on('connect', () => { socket.emit('join_family', currentUser.familyId); });
      socket.on('DATA_UPDATED', async () => { await loadData(true); });
      return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }
  }, [currentUser?.familyId, loadData]);

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
  if (!authChecked) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 font-medium">Sincronizando ambiente...</div>;
  if (!currentUser) {
    if (showLanding) return <LandingPage onLogin={() => setShowLanding(false)} onGetStarted={(type, plan) => { setLandingInitType(type); setLandingInitPlan(plan); setShowLanding(false); }} />;
    return <Auth onLoginSuccess={handleLoginSuccess} initialMode={showLanding ? 'LOGIN' : 'REGISTER'} initialEntityType={landingInitType} initialPlan={landingInitPlan} />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'FIN_DASHBOARD':
        return <Dashboard state={data} settings={currentUser.settings} userEntity={currentUser.entityType} onAddTransaction={handleAddTransaction} onDeleteTransaction={async (id) => { await api.deleteTransaction(id); await loadData(true); }} onEditTransaction={handleEditTransaction} onUpdateStatus={(t) => handleEditTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})} onChangeView={setCurrentView} />;
      case 'FIN_TRANSACTIONS':
        return <TransactionsView transactions={data.transactions} accounts={data.accounts} contacts={data.contacts} categories={data.categories} settings={currentUser.settings} userEntity={currentUser.entityType} onDelete={async (id) => { await api.deleteTransaction(id); await loadData(true); }} onEdit={handleEditTransaction} onToggleStatus={(t) => handleEditTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})} onAdd={handleAddTransaction} />;
      case 'FIN_GOALS':
        return <GoalsView goals={data.goals} accounts={data.accounts} transactions={data.transactions} onSaveGoal={async (g) => { await api.saveGoal(g); await loadData(true); }} onDeleteGoal={async (id) => { await api.deleteGoal(id); await loadData(true); }} onAddTransaction={handleAddTransaction} />;
      case 'FIN_ACCOUNTS':
        return <AccountsView accounts={data.accounts} onSaveAccount={async (a) => { await api.saveAccount(a); await loadData(true); }} onDeleteAccount={async (id) => { await api.deleteAccount(id); await loadData(true); }} />;
      case 'FIN_CARDS':
        return <CreditCardsView accounts={data.accounts} transactions={data.transactions} contacts={data.contacts} categories={data.categories} onSaveAccount={async (a) => { await api.saveAccount(a); await loadData(true); }} onDeleteAccount={async (id) => { await api.deleteAccount(id); await loadData(true); }} onAddTransaction={handleAddTransaction} />;
      case 'SYS_SETTINGS':
        return <SettingsView user={currentUser} pjData={{companyProfile: data.companyProfile, branches: data.branches, costCenters: data.costCenters, departments: data.departments, projects: data.projects}} onUpdateSettings={async (s) => { await updateSettings(s); setCurrentUser({...currentUser, settings: s}); }} onOpenCollab={() => setIsCollabModalOpen(true)} onSavePJEntity={async (type, d) => { if(type==='company') await api.saveCompanyProfile(d); if(type==='branch') await api.saveBranch(d); await loadData(true); }} onDeletePJEntity={async (type, id) => { if(type==='branch') await api.deleteBranch(id); await loadData(true); }} />;
      default:
        return <Dashboard state={data} settings={currentUser.settings} userEntity={currentUser.entityType} onAddTransaction={handleAddTransaction} onDeleteTransaction={async (id) => { await api.deleteTransaction(id); await loadData(true); }} onEditTransaction={handleEditTransaction} onUpdateStatus={(t) => handleEditTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})} onChangeView={setCurrentView} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-inter text-gray-900">
      <LoadingOverlay isVisible={loading} />
      <div className="hidden md:flex w-64 h-screen fixed left-0 top-0 z-30">
        <Sidebar currentView={currentView} onChangeView={setCurrentView} currentUser={currentUser} onUserUpdate={setCurrentUser} onOpenCollab={() => setIsCollabModalOpen(true)} onOpenNotifications={() => setIsNotifPanelOpen(true)} />
      </div>
      <main className="flex-1 md:ml-64 h-screen overflow-y-auto relative">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{renderContent()}</div>
      </main>
      <CollaborationModal isOpen={isCollabModalOpen} onClose={() => setIsCollabModalOpen(false)} currentUser={currentUser} onUserUpdate={setCurrentUser} />
    </div>
  );
};

export default App;
