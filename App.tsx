import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  User, AppState, ViewMode, Transaction, Account, 
  Contact, Category, AppSettings, EntityType, 
  SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project,
  ServiceClient, ServiceItem, ServiceAppointment, ServiceOrder, CommercialOrder, Contract, Invoice,
  TransactionStatus, TransactionType, OSItem, AppNotification, OpticalRx, FinancialGoal
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
import OpticalModule from './components/OpticalModule';
import ServicesView from './components/ServicesView';
import PublicOrderView from './components/PublicOrderView';
import NotificationPanel from './components/NotificationPanel';
import LoadingOverlay from './components/LoadingOverlay';
import { HelpProvider } from './components/GuidedHelp';

const App: React.FC = () => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  
  const socketRef = useRef<Socket | null>(null);
  const urlParams = new URLSearchParams(window.location.search);
  const publicToken = urlParams.get('orderToken');
  const viewFromUrl = urlParams.get('view') as ViewMode;

  const [data, setData] = useState<AppState>({
    accounts: [], transactions: [], goals: [], contacts: [], categories: [],
    branches: [], costCenters: [], departments: [], projects: [],
    serviceClients: [], serviceItems: [], serviceAppointments: [],
    serviceOrders: [], commercialOrders: [], contracts: [], invoices: [],
    opticalRxs: []
  });
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<ViewMode>(viewFromUrl || 'FIN_DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Sincroniza a View com a URL sem recarregar
  useEffect(() => {
    if (!publicToken) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', currentView);
      window.history.pushState({}, '', url);
    }
  }, [currentView, publicToken]);

  const effectiveSettings = useMemo(() => {
    if (!currentUser) return undefined;
    const familyId = currentUser.familyId || (currentUser as any).family_id;
    const ws = currentUser.workspaces?.find(w => w.id === familyId);
    return ws?.ownerSettings || currentUser.settings;
  }, [currentUser]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const initialData = await loadInitialData();
      if (initialData) setData(initialData);
      return initialData;
    } catch (e) {
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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

  useEffect(() => { if (!publicToken) checkAuth(); }, []);

  useEffect(() => {
    if (currentUser && !publicToken) {
        // Fix: Pass empty string as URI and cast options to any to resolve ambiguous overload resolution in socket.io-client
        const socket = io({ transports: ['websocket', 'polling'] } as any) as any;
        socketRef.current = socket;
        
        const familyId = currentUser.familyId || (currentUser as any).family_id;
        socket.on('connect', () => {
            socket.emit('join_family', familyId);
        });

        socket.on('DATA_UPDATED', async (payload: any) => {
            if (['settings', 'membership', 'user'].includes(payload.entity)) {
                try {
                    const updatedUser = await refreshUser();
                    setCurrentUser(updatedUser);
                    showAlert("Configurações de acesso atualizadas pelo administrador.", "info");
                } catch (e) { console.error("Erro ao atualizar dados do usuário via socket", e); }
            } else {
                loadData(true);
            }
        });

        return () => { socket.disconnect(); };
    }
  }, [currentUser?.id, currentUser?.familyId]);

  const renderContent = () => {
    const handleSaveTransaction = async (t: Transaction | Omit<Transaction, 'id'>) => {
        await api.saveTransaction(t as Transaction);
        await loadData(true);
    };
    const handleDeleteTransaction = async (id: string) => {
        await api.deleteTransaction(id);
        await loadData(true);
    };

    switch (currentView) {
      case 'FIN_DASHBOARD':
        return <Dashboard 
          state={data} 
          settings={effectiveSettings} 
          currentUser={currentUser || undefined}
          onAddTransaction={handleSaveTransaction} 
          onDeleteTransaction={handleDeleteTransaction} 
          onEditTransaction={handleSaveTransaction} 
          onUpdateStatus={handleSaveTransaction} 
          onChangeView={setCurrentView} 
        />;
      
      case 'FIN_TRANSACTIONS':
        return <TransactionsView transactions={data.transactions} accounts={data.accounts} contacts={data.contacts} categories={data.categories} settings={effectiveSettings} userEntity={currentUser?.entityType} onDelete={handleDeleteTransaction} onEdit={handleSaveTransaction} onToggleStatus={handleSaveTransaction} onAdd={handleSaveTransaction} />;

      case 'FIN_CALENDAR':
        return <CalendarView transactions={data.transactions} accounts={data.accounts} contacts={data.contacts} categories={data.categories} onAdd={handleSaveTransaction} onEdit={handleSaveTransaction} />;

      case 'FIN_ACCOUNTS':
        return <AccountsView accounts={data.accounts} onSaveAccount={async (a) => { await api.saveAccount(a); loadData(true); }} onDeleteAccount={async (id) => { await api.deleteAccount(id); loadData(true); }} />;

      case 'FIN_CARDS':
        return <CreditCardsView accounts={data.accounts} transactions={data.transactions} contacts={data.contacts} categories={data.categories} onSaveAccount={async (a) => { await api.saveAccount(a); loadData(true); }} onDeleteAccount={async (id) => { await api.deleteAccount(id); loadData(true); }} onAddTransaction={handleSaveTransaction} />;

      case 'FIN_GOALS':
        return <GoalsView goals={data.goals} accounts={data.accounts} transactions={data.transactions} onSaveGoal={async (g) => { await api.saveGoal(g); loadData(true); }} onDeleteGoal={async (id) => { await api.deleteGoal(id); loadData(true); }} onAddTransaction={handleSaveTransaction} />;

      case 'FIN_REPORTS':
        return <Reports transactions={data.transactions} />;

      case 'FIN_ADVISOR':
        return <SmartAdvisor data={data} />;

      case 'FIN_CATEGORIES':
        return <CategoriesView categories={data.categories} onSaveCategory={async (c) => { await api.saveCategory(c); loadData(true); }} onDeleteCategory={async (id) => { await api.deleteCategory(id); loadData(true); }} />;

      case 'FIN_CONTACTS':
      case 'SRV_CLIENTS':
      case 'SYS_CONTACTS':
        return <ContactsView contacts={data.contacts} onAddContact={async (c) => { await api.saveContact(c); loadData(true); }} onEditContact={async (c) => { await api.saveContact(c); loadData(true); }} onDeleteContact={async (id) => { await api.deleteContact(id); loadData(true); }} />;

      case 'OPTICAL_RX':
        return <OpticalModule 
          opticalRxs={data.opticalRxs || []} 
          contacts={data.contacts} 
          onSaveRx={async (rx) => { await api.saveOpticalRx(rx); await loadData(true); }}
          onDeleteRx={async (id) => { await api.deleteOpticalRx(id); await loadData(true); }}
        />;

      case 'SRV_OS':
      case 'SRV_SALES':
      case 'SRV_PURCHASES':
      case 'SRV_CATALOG':
      case 'SRV_CONTRACTS':
      case 'SRV_NF':
      case 'OPTICAL_SALES':
      case 'OPTICAL_LAB':
        return <ServicesView 
          currentView={currentView} 
          serviceOrders={data.serviceOrders} 
          commercialOrders={data.commercialOrders} 
          contracts={data.contracts} 
          invoices={data.invoices} 
          contacts={data.contacts} 
          accounts={data.accounts} 
          serviceItems={data.serviceItems}
          opticalRxs={data.opticalRxs}
          settings={effectiveSettings}
          onSaveOS={async (os) => { await api.saveOS(os); await loadData(true); }} 
          onDeleteOS={async (id) => { await api.deleteOS(id); await loadData(true); }} 
          onSaveOrder={async (o) => { await api.saveOrder(o); await loadData(true); }} 
          onDeleteOrder={async (id) => { await api.deleteOrder(id); await loadData(true); }} 
          onSaveContract={async (c) => { await api.saveContract(c); await loadData(true); }} 
          onDeleteContract={async (id) => { await api.deleteContract(id); await loadData(true); }} 
          onSaveInvoice={async (i) => { await api.saveInvoice(i); await loadData(true); }} 
          onDeleteInvoice={async (id) => { await api.deleteInvoice(id); await loadData(true); }} 
          onAddTransaction={handleSaveTransaction} 
          onSaveCatalogItem={async (i) => { await api.saveCatalogItem(i); await loadData(true); }} 
          onDeleteCatalogItem={async (id) => { await api.deleteCatalogItem(id); await loadData(true); }} 
        />;

      case 'ODONTO_AGENDA':
      case 'ODONTO_PATIENTS':
      case 'ODONTO_PROCEDURES':
        return <ServiceModule 
            moduleTitle="Odontologia" 
            clientLabel="Paciente" 
            serviceLabel="Procedimento" 
            transactionCategory="Serviços Odontológicos"
            activeSection={currentView === 'ODONTO_AGENDA' ? 'CALENDAR' : currentView === 'ODONTO_PATIENTS' ? 'CLIENTS' : 'SERVICES'}
            clients={data.serviceClients}
            services={data.serviceItems.filter(i => i.moduleTag === 'odonto')}
            appointments={data.serviceAppointments}
            contacts={data.contacts}
            accounts={data.accounts}
            onSaveClient={async (c) => { await api.saveServiceClient(c); loadData(true); }}
            onDeleteClient={async (id) => { await api.deleteServiceClient(id); loadData(true); }}
            onSaveService={async (s) => { await api.saveCatalogItem({...s, moduleTag: 'odonto'}); loadData(true); }}
            onDeleteService={async (id) => { await api.deleteCatalogItem(id); loadData(true); }}
            onSaveAppointment={async (a) => { await api.saveAppointment(a); loadData(true); }}
            onDeleteAppointment={async (id) => { await api.deleteAppointment(id); loadData(true); }}
            onAddTransaction={handleSaveTransaction}
        />;

      case 'DIAG_HUB':
      case 'DIAG_HEALTH':
      case 'DIAG_RISK':
      case 'DIAG_INVEST':
        return <DiagnosticView state={data} />;

      case 'SYS_ACCESS':
        return <AccessView currentUser={currentUser!} />;

      case 'SYS_LOGS':
        return <LogsView />;

      case 'SYS_SETTINGS':
        return <SettingsView 
            user={currentUser!} 
            pjData={{
                companyProfile: data.companyProfile,
                branches: data.branches,
                costCenters: data.costCenters,
                departments: data.departments,
                projects: data.projects
            }}
            onUpdateSettings={async (s) => { await updateSettings(s); checkAuth(); }}
            onOpenCollab={() => setIsCollabModalOpen(true)}
            onSavePJEntity={async (type, payload) => {
                await api.savePJEntity(type, payload);
                loadData(true);
            }}
            onDeletePJEntity={async (type, id) => {
                await api.deletePJEntity(type, id);
                loadData(true);
            }}
        />;

      default:
        return <Dashboard state={data} settings={effectiveSettings} onAddTransaction={handleSaveTransaction} onDeleteTransaction={handleDeleteTransaction} onEditTransaction={handleSaveTransaction} onUpdateStatus={handleSaveTransaction} onChangeView={setCurrentView} />;
    }
  };

  if (!currentUser && !authChecked) return null;
  if (!currentUser) return <Auth onLoginSuccess={() => checkAuth()} />;
  if (publicToken) return <PublicOrderView token={publicToken} />;

  return (
    <div className="flex h-screen bg-gray-50 font-inter text-gray-900">
      <HelpProvider currentView={currentView} onChangeView={setCurrentView}>
        <Sidebar currentView={currentView} onChangeView={setCurrentView} currentUser={currentUser} onUserUpdate={setCurrentUser} notificationCount={notifications.length} />
        <main className="flex-1 overflow-y-auto relative">
            <div className="p-8 w-full">{renderContent()}</div>
        </main>
        <CollaborationModal isOpen={isCollabModalOpen} onClose={() => setIsCollabModalOpen(false)} currentUser={currentUser} onUserUpdate={setCurrentUser} />
        <LoadingOverlay isVisible={loading} />
      </HelpProvider>
    </div>
  );
};

export default App;