
import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, AuthResponse, AppState, ViewMode, Transaction, Account, 
  Contact, Category, FinancialGoal, AppSettings, EntityType, 
  SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project,
  ServiceClient, ServiceItem, ServiceAppointment, ServiceOrder, CommercialOrder, Contract, Invoice,
  TransactionStatus, TransactionType, OSItem
} from './types';
import { refreshUser, loadInitialData, api, updateSettings } from './services/storageService';
import { useAlert, useConfirm } from './components/AlertSystem';
import { Menu } from 'lucide-react';
import { io } from 'socket.io-client';

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
import AccessView from './components/AccessView';
import LogsView from './components/LogsView';
import SettingsView from './components/SettingsView';
import AdminDashboard from './components/AdminDashboard';
import Sidebar from './components/Sidebar';
import CollaborationModal from './components/CollaborationModal';
import ServiceModule from './components/ServiceModule';
import ServicesView from './components/ServicesView';
import PublicOrderView from './components/PublicOrderView';

const App: React.FC = () => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [landingInitType, setLandingInitType] = useState<EntityType>(EntityType.PERSONAL);
  const [landingInitPlan, setLandingInitPlan] = useState<SubscriptionPlan>(SubscriptionPlan.MONTHLY);

  // PUBLIC VIEW DETECTION
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

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const initialData = await loadInitialData();
      setData(initialData);
      console.log("[DATA] State synchronized successfully.");
    } catch (e) {
      showAlert("Erro ao carregar dados.", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => { if (!publicToken) checkAuth(); }, []);

  useEffect(() => {
    if (currentUser?.familyId) {
      const socket = io(); // Conecta automaticamente ao host de origem
      
      socket.on('connect', () => { 
        console.log("[SOCKET] Connected to realtime server. ID:", socket.id);
        socket.emit('join_family', currentUser.familyId); 
      });

      socket.on('DATA_UPDATED', (payload) => { 
        console.log("[SOCKET] Update signal received:", payload);
        // Recarrega se veio de um ator externo ou outro membro da equipe
        if (payload.actorId !== currentUser.id) { 
          console.log("[SOCKET] Forcing reactive reload...");
          loadData(true); 
        } 
      });

      socket.on('disconnect', () => {
        console.warn("[SOCKET] Disconnected from server.");
      });

      return () => { socket.disconnect(); };
    }
  }, [currentUser?.familyId, currentUser?.id, loadData]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const user = await refreshUser();
        setCurrentUser(user);
        setShowLanding(false);
        await loadData();
      } catch (e) {
        localStorage.removeItem('token');
      }
    }
    setAuthChecked(true);
  };

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    setShowLanding(false);
    await loadData();
  };

  const handleAddTransaction = async (t: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => {
    try {
      if (newContact) await api.saveContact(newContact);
      if (newCategory) await api.saveCategory(newCategory);
      const newT = { ...t, id: crypto.randomUUID(), contactId: newContact ? newContact.id : t.contactId, category: newCategory ? newCategory.name : t.category };
      await api.saveTransaction(newT);
      await loadData();
      showAlert("Lançamento salvo!");
    } catch (e) { showAlert("Erro ao salvar transação.", "error"); }
  };

  const handleEditTransaction = async (t: Transaction, newContact?: Contact, newCategory?: Category) => {
    try {
      if (newContact) await api.saveContact(newContact);
      if (newCategory) await api.saveCategory(newCategory);
      const updatedT = { ...t, contactId: newContact ? newContact.id : t.contactId, category: newCategory ? newCategory.name : t.category };
      await api.saveTransaction(updatedT);
      await loadData();
      showAlert("Transação atualizada.");
    } catch (e) { showAlert("Erro ao atualizar.", "error"); }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await api.deleteTransaction(id);
      await loadData();
      showAlert("Transação excluída.");
    } catch (e) { showAlert("Erro ao excluir.", "error"); }
  };

  const handleUpdateAttachments = async (t: Transaction, urls: string[]) => {
      try {
          setLoading(true);
          const wasPaid = t.status === TransactionStatus.PAID;
          const isNowPaid = urls.length > (t.receiptUrls?.length || 0);
          const updatedT = { ...t, receiptUrls: urls, status: isNowPaid ? TransactionStatus.PAID : t.status };
          await api.saveTransaction(updatedT);
          await loadData(true);
          if (!wasPaid && isNowPaid) { showAlert("Comprovante anexado e transação quitada!", "success"); } else { showAlert("Anexos atualizados.", "success"); }
      } catch (e) { showAlert("Erro ao atualizar anexos.", "error"); } finally { setLoading(false); }
  };

  const handleApproveOrder = async (order: CommercialOrder, approvalData: any) => {
      try {
          setLoading(true);
          let transactionId = undefined;
          const orderRef = order.id.substring(0, 8).toUpperCase();

          if (approvalData.generateTransaction) {
              transactionId = crypto.randomUUID();
              const trans: Transaction = {
                  id: transactionId,
                  description: `Venda: ${order.description} (Ref: #${orderRef})`,
                  amount: order.amount,
                  type: TransactionType.INCOME,
                  category: 'Vendas e Serviços',
                  date: new Date().toISOString().split('T')[0],
                  status: TransactionStatus.PENDING,
                  accountId: approvalData.accountId,
                  contactId: order.contactId,
                  isRecurring: false
              };
              await api.saveTransaction(trans);
          }

          if (approvalData.generateInvoice) {
              const inv: Invoice = {
                  id: crypto.randomUUID(),
                  amount: order.amount,
                  issue_date: new Date().toISOString().split('T')[0],
                  status: 'ISSUED',
                  type: approvalData.invoiceType,
                  contactId: order.contactId,
                  number: Math.floor(Math.random() * 10000).toString(),
                  series: '1'
              };
              await api.saveInvoice(inv);
          }

          const updatedOrder = { ...order, status: 'CONFIRMED' as any, transactionId: transactionId || order.transactionId };
          await api.saveCommercialOrder(updatedOrder);

          await loadData(true);
          setLoading(false);

          const confirmOS = await showConfirm({
              title: "Venda Aprovada!",
              message: "Deseja criar uma Ordem de Serviço (OS) para este registro agora?",
              confirmText: "Sim, criar OS",
              cancelText: "Não, apenas aprovar"
          });

          if (confirmOS) {
              let totalEstimatedMinutes = 0;
              
              const osItems: OSItem[] = (order.items || []).map(item => {
                  const catalogItem = data.serviceItems.find(si => si.id === item.serviceItemId);
                  const duration = (catalogItem?.defaultDuration || 0) * item.quantity;
                  totalEstimatedMinutes += duration;

                  return {
                    id: crypto.randomUUID(),
                    serviceItemId: item.serviceItemId,
                    code: catalogItem?.code || '',
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    estimatedDuration: duration,
                    isBillable: true
                  };
              });

              const startDate = new Date();
              const endDate = new Date(startDate.getTime() + totalEstimatedMinutes * 60000);

              const newOS: ServiceOrder = {
                  id: crypto.randomUUID(),
                  title: order.description,
                  description: `OS gerada automaticamente a partir da venda #${orderRef}.`,
                  contactId: order.contactId,
                  contactName: order.contactName,
                  type: 'MANUTENCAO',
                  origin: 'VENDA',
                  priority: 'MEDIA',
                  status: 'ABERTA',
                  openedAt: new Date().toISOString(),
                  startDate: startDate.toISOString().split('T')[0],
                  endDate: endDate.toISOString().split('T')[0],
                  items: osItems,
                  totalAmount: order.amount
              };
              
              await api.saveServiceOrder(newOS);
              await loadData(true);
              showAlert("Venda aprovada e OS criada com sucesso!", "success");
          } else {
              showAlert("Venda aprovada!", "success");
          }
      } catch (e) {
          console.error(e);
          showAlert("Erro no processo de aprovação.", "error");
          setLoading(false);
      }
  };

  const wrapSave = async (fn: any, item: any, msg: string, newContact?: Contact) => {
      try { if (newContact) await api.saveContact(newContact); await fn(item); await loadData(); showAlert(msg, "success"); } catch(e) { showAlert("Erro ao salvar.", "error"); }
  };
  
  const wrapDel = async (fn: any, id: string, msg: string) => {
      try { await fn(id); await loadData(); showAlert(msg, "success"); } catch(e) { showAlert("Erro ao excluir.", "error"); }
  };

  // IF PUBLIC TOKEN PRESENT, ONLY SHOW PUBLIC VIEW
  if (publicToken) return <PublicOrderView token={publicToken} />;

  if (!authChecked) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Carregando...</div>;
  if (!currentUser) {
    if (showLanding) return <LandingPage onLogin={() => setShowLanding(false)} onGetStarted={(type, plan) => { setLandingInitType(type); setLandingInitPlan(plan); setShowLanding(false); }} />;
    return <Auth onLoginSuccess={handleLoginSuccess} initialMode={showLanding ? 'LOGIN' : 'REGISTER'} initialEntityType={landingInitType} initialPlan={landingInitPlan} />;
  }
  if (currentUser.role === 'ADMIN' && currentUser.email?.includes('admin')) return <AdminDashboard />;

  const renderContent = () => {
    if (loading && !data.accounts.length) return <div className="p-8 text-center text-gray-400 animate-pulse">Sincronizando dados...</div>;
    switch (currentView) {
      case 'FIN_DASHBOARD':
        return <Dashboard state={data} settings={currentUser.settings} userEntity={currentUser.entityType} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onEditTransaction={handleEditTransaction} onUpdateStatus={(t) => handleEditTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})} onChangeView={setCurrentView} onUpdateAttachments={handleUpdateAttachments} />;
      case 'FIN_TRANSACTIONS':
        return <TransactionsView transactions={data.transactions} accounts={data.accounts} contacts={data.contacts} categories={data.categories} settings={currentUser.settings} userEntity={currentUser.entityType} pjData={{branches: data.branches, costCenters: data.costCenters, departments: data.departments, projects: data.projects}} onDelete={handleDeleteTransaction} onEdit={handleEditTransaction} onToggleStatus={(t) => handleEditTransaction({...t, status: t.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID})} onAdd={handleAddTransaction} onUpdateAttachments={handleUpdateAttachments} />;
      case 'FIN_CALENDAR':
        return <CalendarView transactions={data.transactions} accounts={data.accounts} contacts={data.contacts} categories={data.categories} onAdd={handleAddTransaction} onEdit={handleEditTransaction} />;
      case 'FIN_ACCOUNTS':
        return <AccountsView accounts={data.accounts} onSaveAccount={async (a) => wrapSave(api.saveAccount, a, "Conta salva")} onDeleteAccount={async (id) => wrapDel(api.deleteAccount, id, "Conta excluída")} />;
      case 'FIN_CARDS':
        return <CreditCardsView accounts={data.accounts} transactions={data.transactions} contacts={data.contacts} categories={data.categories} onSaveAccount={async (a) => wrapSave(api.saveAccount, a, "Cartão salva")} onDeleteAccount={async (id) => wrapDel(api.deleteAccount, id, "Conta excluída")} onAddTransaction={handleAddTransaction} />;
      case 'FIN_GOALS':
        return <GoalsView goals={data.goals} accounts={data.accounts} onSaveGoal={async (g) => wrapSave(api.saveGoal, g, "Meta salva")} onDeleteGoal={async (id) => wrapDel(api.deleteGoal, id, "Meta excluída")} onAddTransaction={handleAddTransaction} />;
      case 'FIN_REPORTS':
        return <Reports transactions={data.transactions} />;
      case 'FIN_CATEGORIES':
        return <CategoriesView categories={data.categories} onSaveCategory={async (c) => wrapSave(api.saveCategory, c, "Categoria salva")} onDeleteCategory={async (id) => wrapDel(api.deleteCategory, id, "Categoria excluída")} />;
      case 'FIN_CONTACTS':
      case 'SYS_CONTACTS':
      case 'SRV_CLIENTS':
        return <ContactsView contacts={data.contacts} serviceClients={data.serviceClients} title={currentView === 'SRV_CLIENTS' ? "Clientes de Serviços" : "Pessoas & Empresas"} onAddContact={async (c) => wrapSave(api.saveContact, c, "Contato salvo")} onEditContact={async (c) => wrapSave(api.saveContact, c, "Contato atualizado")} onDeleteContact={async (id) => wrapDel(api.deleteContact, id, "Contato excluído")} />;
      case 'FIN_ADVISOR':
        return <SmartAdvisor data={data} />;
      case 'SYS_SETTINGS':
        return <SettingsView user={currentUser} pjData={{companyProfile: data.companyProfile, branches: data.branches, costCenters: data.costCenters, departments: data.departments, projects: data.projects}} onUpdateSettings={async (s) => { await updateSettings(s); setCurrentUser({...currentUser, settings: s}); showAlert("Configurações salvas", "success"); }} onOpenCollab={() => setIsCollabModalOpen(true)} onSavePJEntity={async (type, d) => { if(type==='company') await api.saveCompanyProfile(d); if(type==='branch') await api.saveBranch(d); if(type==='costCenter') await api.saveCostCenter(d); if(type==='department') await api.saveDepartment(d); if(type==='project') await api.saveProject(d); await loadData(); showAlert("Item salvo", "success"); }} onDeletePJEntity={async (type, id) => { if(type==='branch') await api.deleteBranch(id); if(type==='costCenter') await api.deleteCostCenter(id); if(type==='department') await api.deleteDepartment(id); if(type==='project') await api.deleteProject(id); await loadData(); showAlert("Item excluído", "success"); }} />;
      case 'SYS_ACCESS':
        return <AccessView currentUser={currentUser} />;
      case 'SYS_LOGS':
        return <LogsView />;
      case 'ODONTO_AGENDA':
      case 'ODONTO_PATIENTS':
      case 'ODONTO_PROCEDURES':
        return <ServiceModule moduleTitle="Odontologia" clientLabel="Paciente" serviceLabel="Procedimento" transactionCategory="Serviços Odontológicos" activeSection={currentView === 'ODONTO_AGENDA' ? 'CALENDAR' : currentView === 'ODONTO_PATIENTS' ? 'CLIENTS' : 'SERVICES'} clients={data.serviceClients.filter(c => c.moduleTag === 'ODONTO' || c.moduleTag === 'GENERAL')} services={data.serviceItems.filter(s => s.moduleTag === 'ODONTO' || s.moduleTag === 'GENERAL')} appointments={data.serviceAppointments.filter(a => a.moduleTag === 'ODONTO' || a.moduleTag === 'GENERAL')} contacts={data.contacts} onSaveClient={async (c) => wrapSave(api.saveServiceClient, { ...c, moduleTag: 'ODONTO' }, "Paciente salvo")} onDeleteClient={async (id) => wrapDel(api.deleteServiceClient, id, "Paciente excluído")} onSaveService={async (s) => wrapSave(api.saveServiceItem, { ...s, moduleTag: 'ODONTO' }, "Procedimento salvo")} onDeleteService={async (id) => wrapDel(api.deleteServiceItem, id, "Procedimento excluído")} onSaveAppointment={async (a) => wrapSave(api.saveServiceAppointment, { ...a, moduleTag: 'ODONTO' }, "Agendamento salvo")} onDeleteAppointment={async (id) => wrapDel(api.deleteServiceAppointment, id, "Agendamento excluído")} onAddTransaction={handleAddTransaction} />;
      case 'SRV_OS':
      case 'SRV_SALES':
      case 'SRV_PURCHASES':
      case 'SRV_CONTRACTS':
      case 'SRV_NF':
      case 'SRV_CATALOG':
        return <ServicesView currentView={currentView} serviceOrders={data.serviceOrders} commercialOrders={data.commercialOrders} contracts={data.contracts} invoices={data.invoices} contacts={data.contacts} accounts={data.accounts} companyProfile={data.companyProfile} serviceItems={data.serviceItems || []} onSaveOS={async (d, nc) => wrapSave(api.saveServiceOrder, d, "OS salva", nc)} onDeleteOS={async (id) => wrapDel(api.deleteServiceOrder, id, "OS excluída")} onSaveOrder={async (d, nc) => wrapSave(api.saveCommercialOrder, d, "Pedido salvo", nc)} onDeleteOrder={async (id) => wrapDel(api.deleteCommercialOrder, id, "Pedido excluído")} onApproveOrder={handleApproveOrder} onSaveContract={async (d, nc) => wrapSave(api.saveContract, d, "Contrato salva", nc)} onDeleteContract={async (id) => wrapDel(api.deleteContract, id, "Contrato excluído")} onSaveInvoice={async (d, nc) => wrapSave(api.saveInvoice, d, "Nota salva", nc)} onDeleteInvoice={async (id) => wrapDel(api.deleteInvoice, id, "Nota excluída")} onAddTransaction={handleAddTransaction} onSaveCatalogItem={async (d) => wrapSave(api.saveServiceItem, { ...d, moduleTag: 'GENERAL' }, "Item salvo")} onDeleteCatalogItem={async (id) => wrapDel(api.deleteServiceItem, id, "Item excluído")} />;
      default:
        return <div className="p-8 text-center text-gray-400">Página em construção ou não encontrada.</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-inter text-gray-900">
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-800/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 h-full bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <Sidebar currentView={currentView} onChangeView={(view) => { setCurrentView(view); setIsMobileMenuOpen(false); }} currentUser={currentUser} onUserUpdate={setCurrentUser} onOpenCollab={() => setIsCollabModalOpen(true)} />
          </div>
        </div>
      )}
      <div className="hidden md:flex w-64 h-screen fixed left-0 top-0 z-30">
        <Sidebar currentView={currentView} onChangeView={setCurrentView} currentUser={currentUser} onUserUpdate={setCurrentUser} onOpenCollab={() => setIsCollabModalOpen(true)} />
      </div>
      <main className="flex-1 md:ml-64 h-screen overflow-y-auto">
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-100 sticky top-0 z-20">
            <div className="flex items-center gap-2"><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">F</div><span className="font-bold text-gray-800">FinManager</span></div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"><Menu className="w-6 h-6" /></button>
        </div>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{renderContent()}</div>
      </main>
      <CollaborationModal isOpen={isCollabModalOpen} onClose={() => setIsCollabModalOpen(false)} currentUser={currentUser} onUserUpdate={setCurrentUser} />
    </div>
  );
};

export default App;
