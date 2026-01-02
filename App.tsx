
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  User, AppState, ViewMode, Transaction, Account, 
  Contact, Category, AppSettings, EntityType, 
  SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project,
  ServiceClient, ServiceItem, ServiceAppointment, ServiceOrder, CommercialOrder, Contract, Invoice,
  TransactionStatus, TransactionType, OSItem, AppNotification, OpticalRx
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

const App: React.FC = () => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  
  const socketRef = useRef<Socket | null>(null);
  const urlParams = new URLSearchParams(window.location.search);
  const publicToken = urlParams.get('orderToken');

  const [data, setData] = useState<AppState>({
    accounts: [], transactions: [], goals: [], contacts: [], categories: [],
    branches: [], costCenters: [], departments: [], projects: [],
    serviceClients: [], serviceItems: [], serviceAppointments: [],
    serviceOrders: [], commercialOrders: [], contracts: [], invoices: [],
    opticalRxs: []
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

  useEffect(() => { if (!publicToken) checkAuth(); }, []);

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

  const renderContent = () => {
    switch (currentView) {
      case 'FIN_DASHBOARD':
        return <Dashboard state={data} settings={effectiveSettings} onAddTransaction={async (t) => { await api.saveTransaction({...t, id: crypto.randomUUID()} as Transaction); await loadData(true); }} onDeleteTransaction={async (id) => { await api.deleteTransaction(id); await loadData(true); }} onEditTransaction={async (t) => { await api.saveTransaction(t); await loadData(true); }} onUpdateStatus={async (t) => { await api.saveTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID}); await loadData(true); }} onChangeView={setCurrentView} />;
      
      case 'OPTICAL_RX':
      case 'OPTICAL_SALES':
      case 'OPTICAL_LAB':
        return <OpticalModule 
          activeView={currentView as any} 
          opticalRxs={data.opticalRxs || []} 
          contacts={data.contacts} 
          commercialOrders={data.commercialOrders} 
          serviceOrders={data.serviceOrders} 
          serviceItems={data.serviceItems}
          onSaveRx={async (rx) => { await api.saveOpticalRx(rx); await loadData(true); }}
          onDeleteRx={async (id) => { await api.deleteOpticalRx(id); await loadData(true); }}
          onSaveSale={async (s) => { await api.saveOrder({...s, moduleTag: 'optical'}); await loadData(true); }}
          onDeleteSale={async (id) => { await api.deleteOrder(id); await loadData(true); }}
          onSaveOS={async (os) => { await api.saveOS({...os, moduleTag: 'optical'}); await loadData(true); }}
          onDeleteOS={async (id) => { await api.deleteOS(id); await loadData(true); }}
        />;

      case 'SRV_OS':
      case 'SRV_SALES':
      case 'SRV_CATALOG':
      case 'SRV_CLIENTS':
        return <ServicesView currentView={currentView} serviceOrders={data.serviceOrders} commercialOrders={data.commercialOrders} contracts={data.contracts} invoices={data.invoices} contacts={data.contacts} accounts={data.accounts} serviceItems={data.serviceItems} onSaveOS={async (os) => { await api.saveOS(os); await loadData(true); }} onDeleteOS={async (id) => { await api.deleteOS(id); await loadData(true); }} onSaveOrder={async (o) => { await api.saveOrder(o); await loadData(true); }} onDeleteOrder={async (id) => { await api.deleteOrder(id); await loadData(true); }} onSaveContract={async (c) => { await api.saveContract(c); await loadData(true); }} onDeleteContract={async (id) => { await api.deleteContract(id); await loadData(true); }} onSaveInvoice={async (i) => { await api.saveInvoice(i); await loadData(true); }} onDeleteInvoice={async (id) => { await api.deleteInvoice(id); await loadData(true); }} onAddTransaction={async (t) => { await api.saveTransaction(t); await loadData(true); }} onSaveCatalogItem={async (i) => { await api.saveCatalogItem(i); await loadData(true); }} onDeleteCatalogItem={async (id) => { await api.deleteCatalogItem(id); await loadData(true); }} />;

      default:
        return <Dashboard state={data} settings={effectiveSettings} onAddTransaction={async (t) => { await api.saveTransaction({...t, id: crypto.randomUUID()} as Transaction); await loadData(true); }} onDeleteTransaction={async (id) => { await api.deleteTransaction(id); await loadData(true); }} onEditTransaction={async (t) => { await api.saveTransaction(t); await loadData(true); }} onUpdateStatus={async (t) => { await api.saveTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID}); await loadData(true); }} onChangeView={setCurrentView} />;
    }
  };

  if (!currentUser && !authChecked) return null;
  if (!currentUser) return <Auth onLoginSuccess={() => checkAuth()} />;

  return (
    <div className="flex h-screen bg-gray-50 font-inter text-gray-900">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} currentUser={currentUser} onUserUpdate={setCurrentUser} notificationCount={notifications.length} />
      <main className="flex-1 overflow-y-auto relative">
        <div className="p-8 w-full">{renderContent()}</div>
      </main>
      <CollaborationModal isOpen={isCollabModalOpen} onClose={() => setIsCollabModalOpen(false)} currentUser={currentUser} onUserUpdate={setCurrentUser} />
    </div>
  );
};

export default App;
