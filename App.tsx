
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionsView from './components/TransactionsView';
import Reports from './components/Reports';
import SmartAdvisor from './components/SmartAdvisor';
import CalendarView from './components/CalendarView';
import SettingsView from './components/SettingsView';
import ContactsView from './components/ContactsView';
import CreditCardsView from './components/CreditCardsView';
import AccountsView from './components/AccountsView';
import LogsView from './components/LogsView';
import Auth from './components/Auth';
import CollaborationModal from './components/CollaborationModal';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import ServiceModule from './components/ServiceModule';
import AccessView from './components/AccessView';
import CategoriesView from './components/CategoriesView'; 
import GoalsView from './components/GoalsView';
import { loadInitialData, api, logout, refreshUser } from './services/storageService';
import { AppState, ViewMode, Transaction, TransactionStatus, Account, User, AppSettings, Contact, Category, UserRole, EntityType, SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project, ServiceClient, ServiceItem, ServiceAppointment, FinancialGoal, TransactionType } from './types';
import { Menu, Loader2 } from 'lucide-react';
import { useAlert, useConfirm } from './components/AlertSystem';

const App: React.FC = () => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();

  // Auth & Routing States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [registerEntityType, setRegisterEntityType] = useState<EntityType>(EntityType.PERSONAL);
  const [registerPlan, setRegisterPlan] = useState<SubscriptionPlan>(SubscriptionPlan.MONTHLY);

  // App Data States
  const [state, setState] = useState<AppState>({ 
      accounts: [], transactions: [], goals: [], contacts: [], categories: [],
      branches: [], costCenters: [], departments: [], projects: [],
      serviceClients: [], serviceItems: [], serviceAppointments: [] 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewMode>('FIN_DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modal States
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);

  // Constants
  const ODONTO_TAG = 'ODONTO';

  // --- CORE DATA SYNCHRONIZATION ---
  
  // Função central para recarregar dados do servidor (Single Source of Truth)
  const refreshData = useCallback(async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
          const data = await loadInitialData();
          setState(data);
      } catch (error) {
          console.error("Sync error:", error);
      } finally {
          if (!silent) setIsLoading(false);
      }
  }, []);

  // Initial Load & Polling Setup
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token || !userStr) {
        setIsLoading(false);
        return; 
      }

      try {
          // 1. Refresh User Session
          const freshUser = await refreshUser();
          setCurrentUser(freshUser);
          
          if (freshUser.role === UserRole.ADMIN) {
              setIsLoading(false);
              return;
          }

          // 2. Load Initial Data
          await refreshData();

      } catch (e) {
          console.error("Session refresh failed:", e);
          const localUser = JSON.parse(userStr);
          if ((e as Error).message.includes('401') || (e as Error).message.includes('403')) {
              logout();
              setCurrentUser(null);
              setIsLoading(false);
              return;
          }
          setCurrentUser(localUser);
          // Tenta carregar dados mesmo com erro de sessão (modo offline/fallback)
          refreshData();
      }
    };
    init();

    // Setup Polling (Sync every 10 seconds to keep multi-users updated)
    const intervalId = setInterval(() => {
        if (localStorage.getItem('token')) {
            refreshData(true); // Silent refresh
        }
    }, 10000);

    // Refresh on Window Focus (User comes back to tab)
    const handleFocus = () => {
        if (localStorage.getItem('token')) {
            refreshData(true);
        }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
        clearInterval(intervalId);
        window.removeEventListener('focus', handleFocus);
    };
  }, [refreshData]);

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    setShowAuth(false);
    if (user.role === UserRole.ADMIN) return;
    await refreshData();
  };

  const handleGetStarted = (type: EntityType, plan: SubscriptionPlan) => {
      setRegisterEntityType(type);
      setRegisterPlan(plan);
      setAuthMode('REGISTER');
      setShowAuth(true);
  };

  const handleUpdateSettings = (settings: AppSettings) => {
    if (currentUser) {
        setCurrentUser({ ...currentUser, settings });
        showAlert("Configurações salvas com sucesso!", "success");
    }
  };

  // --- CRUD HANDLERS (UPDATED TO USE SERVER REFRESH) ---
  // Instead of manually calculating state (which creates race conditions),
  // we await the server operation and then refresh the full state.

  const handleAddTransaction = async (newTransaction: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => {
    try {
        const transaction: Transaction = { ...newTransaction, id: crypto.randomUUID() };

        // Parallel requests optimization
        const promises = [];
        if (newContact) promises.push(api.saveContact(newContact));
        if (newCategory) promises.push(api.saveCategory(newCategory));
        promises.push(api.saveTransaction(transaction));

        await Promise.all(promises);
        
        await refreshData(true); // Reload data from server to update balances/lists
        showAlert("Transação salva com sucesso!", "success");
    } catch (e: any) {
        showAlert("Erro ao salvar transação: " + e.message, "error");
        console.error(e);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const confirm = await showConfirm({
        title: "Excluir Transação",
        message: "Tem certeza que deseja excluir esta transação? O saldo será recalculado automaticamente.",
        variant: "danger",
        confirmText: "Sim, Excluir"
    });

    if (!confirm) return;

    try {
        await api.deleteTransaction(id);
        await refreshData(true);
        showAlert("Transação excluída.", "success");
    } catch (e: any) {
        showAlert("Erro ao excluir transação: " + e.message, "error");
    }
  };

  const handleEditTransaction = async (updatedT: Transaction, newContact?: Contact, newCategory?: Category) => {
    try {
        const promises = [];
        if (newContact) promises.push(api.saveContact(newContact));
        if (newCategory) promises.push(api.saveCategory(newCategory));
        promises.push(api.saveTransaction(updatedT));

        await Promise.all(promises);
        await refreshData(true);
        showAlert("Transação atualizada.", "success");
    } catch (e: any) {
        showAlert("Erro ao editar transação: " + e.message, "error");
    }
  };

  const handleUpdateStatus = async (t: Transaction) => {
    const newStatus = t.status === TransactionStatus.PAID 
        ? TransactionStatus.PENDING 
        : TransactionStatus.PAID;

    const updatedT = { ...t, status: newStatus };
    // Reuse handleEdit logic
    await handleEditTransaction(updatedT);
  };

  const handleSaveAccount = async (account: Account) => {
    try {
        await api.saveAccount(account);
        await refreshData(true);
        showAlert("Conta salva com sucesso.", "success");
    } catch (e: any) {
        showAlert("Erro ao salvar conta: " + e.message, "error");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
        await api.deleteAccount(id);
        await refreshData(true);
        showAlert("Conta excluída.", "success");
    } catch (e: any) {
        showAlert("Erro ao excluir conta: " + e.message, "error");
    }
  };

  const handleSaveContact = async (contact: Contact) => {
      try {
          await api.saveContact(contact);
          await refreshData(true);
          showAlert("Contato salvo.", "success");
      } catch (e: any) {
          showAlert("Erro ao salvar contato: " + e.message, "error");
      }
  };

  const handleDeleteContact = async (id: string) => {
      const confirm = await showConfirm({
          title: "Excluir Contato",
          message: "Excluir contato? O histórico de transações não será perdido.",
          variant: "danger"
      });
      if(!confirm) return;

      try {
          await api.deleteContact(id);
          await refreshData(true);
          showAlert("Contato excluído.", "success");
      } catch (e: any) {
          showAlert("Erro ao excluir contato: " + e.message, "error");
      }
  };

  const handleSaveCategory = async (category: Category) => {
      try {
          await api.saveCategory(category);
          await refreshData(true);
          showAlert("Categoria salva.", "success");
      } catch (e: any) {
          showAlert("Erro ao salvar categoria: " + e.message, "error");
      }
  };

  const handleDeleteCategory = async (id: string) => {
      const confirm = await showConfirm({
          title: "Excluir Categoria",
          message: "Tem certeza que deseja excluir esta categoria?",
          variant: "danger"
      });
      if(!confirm) return;

      try {
          await api.deleteCategory(id);
          await refreshData(true);
          showAlert("Categoria excluída.", "success");
      } catch (e: any) {
          showAlert("Erro ao excluir categoria: " + e.message, "error");
      }
  };

  const handleSaveGoal = async (goal: FinancialGoal) => {
      try {
          await api.saveGoal(goal);
          await refreshData(true);
      } catch(e: any) { showAlert("Erro ao salvar meta", "error"); }
  };

  const handleDeleteGoal = async (id: string) => {
      try {
          await api.deleteGoal(id);
          await refreshData(true);
      } catch(e: any) { showAlert("Erro ao excluir meta", "error"); }
  };

  const handleSavePJEntity = async (type: 'company' | 'branch' | 'costCenter' | 'department' | 'project', data: any) => {
      try {
          if (type === 'company') await api.saveCompanyProfile(data);
          else if (type === 'branch') await api.saveBranch(data);
          else if (type === 'costCenter') await api.saveCostCenter(data);
          else if (type === 'department') await api.saveDepartment(data);
          else if (type === 'project') await api.saveProject(data);
          
          await refreshData(true);
          showAlert("Dados salvos com sucesso.", "success");
      } catch (e: any) {
          showAlert(`Erro ao salvar ${type}: ` + e.message, "error");
      }
  };

  const handleDeletePJEntity = async (type: 'branch' | 'costCenter' | 'department' | 'project', id: string) => {
      const confirm = await showConfirm({
          title: "Excluir Item Corporativo",
          message: "Deseja confirmar a exclusão deste item corporativo?",
          variant: "danger"
      });
      if(!confirm) return;

      try {
          if (type === 'branch') await api.deleteBranch(id);
          else if (type === 'costCenter') await api.deleteCostCenter(id);
          else if (type === 'department') await api.deleteDepartment(id);
          else if (type === 'project') await api.deleteProject(id);
          
          await refreshData(true);
          showAlert("Item excluído.", "success");
      } catch (e: any) {
          showAlert(`Erro ao excluir ${type}: ` + e.message, "error");
      }
  };

  // --- GENERIC MODULE HANDLERS ---
  const handleSaveServiceClient = async (c: Partial<ServiceClient>) => {
      try {
          let finalContactId = c.contactId;
          const contactName = c.contactName;

          if (!finalContactId && contactName) {
              const newContactId = crypto.randomUUID();
              const newContact: Contact = { 
                  id: newContactId, 
                  name: contactName,
                  email: c.contactEmail,
                  phone: c.contactPhone
              };
              await api.saveContact(newContact);
              finalContactId = newContactId;
          }

          if (!finalContactId) throw new Error("Nome do contato é obrigatório.");

          const clientToSave: ServiceClient = {
              id: c.id!,
              contactId: finalContactId,
              notes: c.notes,
              birthDate: c.birthDate,
              moduleTag: ODONTO_TAG,
              insurance: c.insurance,
              allergies: c.allergies,
              medications: c.medications
          };

          await api.saveServiceClient(clientToSave);
          await refreshData(true);
          showAlert("Cliente salvo com sucesso.", "success");
      } catch(e: any) { showAlert("Erro ao salvar cliente: " + e.message, "error"); }
  };
  
  const handleDeleteServiceClient = async (id: string) => {
      const confirm = await showConfirm({
          title: "Excluir Cliente",
          message: "Deseja excluir este cliente?",
          variant: "danger"
      });
      if(!confirm) return;
      await api.deleteServiceClient(id);
      await refreshData(true);
      showAlert("Cliente excluído.", "success");
  };
  
  const handleSaveServiceItem = async (s: ServiceItem) => {
      try {
          await api.saveServiceItem(s);
          await refreshData(true);
          showAlert("Serviço salvo.", "success");
      } catch(e) { showAlert("Erro ao salvar serviço", "error"); }
  };
  
  const handleDeleteServiceItem = async (id: string) => {
      const confirm = await showConfirm({
          title: "Excluir Serviço",
          message: "Deseja excluir este serviço?",
          variant: "danger"
      });
      if(!confirm) return;
      await api.deleteServiceItem(id);
      await refreshData(true);
      showAlert("Serviço excluído.", "success");
  };
  
  const handleSaveServiceAppointment = async (a: ServiceAppointment) => {
      try {
          await api.saveServiceAppointment(a);
          await refreshData(true);
          showAlert("Agendamento salvo.", "success");
      } catch(e) { showAlert("Erro ao salvar agendamento", "error"); }
  };
  
  const handleDeleteServiceAppointment = async (id: string) => {
      const confirm = await showConfirm({
          title: "Excluir Agendamento",
          message: "Deseja excluir este agendamento?",
          variant: "danger"
      });
      if(!confirm) return;
      await api.deleteServiceAppointment(id);
      await refreshData(true);
      showAlert("Agendamento excluído.", "success");
  };

  // --- RENDER ---

  if (!currentUser) {
      if (showAuth) {
          return (
            <Auth 
                onLoginSuccess={handleLoginSuccess} 
                initialMode={authMode} 
                initialEntityType={registerEntityType}
                initialPlan={registerPlan}
            />
          );
      }
      return <LandingPage onGetStarted={handleGetStarted} onLogin={() => { setAuthMode('LOGIN'); setShowAuth(true); }} />;
  }

  if (currentUser.role === UserRole.ADMIN) {
      return <AdminDashboard />;
  }

  if (isLoading) {
      return (
          <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  <p className="text-gray-500 font-medium">Sincronizando dados...</p>
              </div>
          </div>
      );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'FIN_DASHBOARD':
        return (
          <Dashboard 
            state={state}
            settings={currentUser.settings}
            userEntity={currentUser.entityType} 
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleEditTransaction}
            onUpdateStatus={handleUpdateStatus}
            onChangeView={setCurrentView}
          />
        );
      case 'FIN_TRANSACTIONS':
        return (
          <TransactionsView 
            transactions={state.transactions} 
            accounts={state.accounts}
            contacts={state.contacts}
            categories={state.categories}
            settings={currentUser.settings}
            userEntity={currentUser.entityType}
            pjData={{
                branches: state.branches,
                costCenters: state.costCenters,
                departments: state.departments,
                projects: state.projects
            }}
            onDelete={handleDeleteTransaction}
            onEdit={handleEditTransaction}
            onToggleStatus={handleUpdateStatus}
            onAdd={handleAddTransaction}
          />
        );
      case 'FIN_CALENDAR':
        return (
          <CalendarView 
            transactions={state.transactions}
            accounts={state.accounts}
            contacts={state.contacts}
            categories={state.categories}
            onAdd={handleAddTransaction}
            onEdit={handleEditTransaction}
          />
        );
      case 'FIN_ACCOUNTS':
        return (
            <AccountsView 
                accounts={state.accounts}
                onSaveAccount={handleSaveAccount}
                onDeleteAccount={handleDeleteAccount}
            />
        );
      case 'FIN_GOALS':
        return (
            <GoalsView 
                goals={state.goals}
                accounts={state.accounts}
                onSaveGoal={handleSaveGoal}
                onDeleteGoal={handleDeleteGoal}
                onAddTransaction={handleAddTransaction}
            />
        );
      case 'FIN_CARDS':
        return (
            <CreditCardsView 
                accounts={state.accounts}
                contacts={state.contacts}
                categories={state.categories}
                transactions={state.transactions}
                onSaveAccount={handleSaveAccount}
                onDeleteAccount={handleDeleteAccount}
                onAddTransaction={handleAddTransaction}
            />
        );
      case 'FIN_REPORTS':
        return <Reports transactions={state.transactions} />;
      case 'FIN_ADVISOR':
        return <SmartAdvisor data={state} />;
      case 'FIN_CATEGORIES':
        return (
            <CategoriesView 
                categories={state.categories}
                onSaveCategory={handleSaveCategory}
                onDeleteCategory={handleDeleteCategory}
            />
        );
      case 'FIN_CONTACTS':
        return (
            <ContactsView 
                contacts={state.contacts}
                serviceClients={state.serviceClients}
                onAddContact={handleSaveContact}
                onEditContact={handleSaveContact}
                onDeleteContact={handleDeleteContact}
            />
        );
      
      // --- SYSTEM/MANAGEMENT MODULE ---
      case 'SYS_CONTACTS':
        return (
            <ContactsView 
                contacts={state.contacts}
                serviceClients={state.serviceClients}
                onAddContact={handleSaveContact}
                onEditContact={handleSaveContact}
                onDeleteContact={handleDeleteContact}
            />
        );
      case 'SYS_LOGS':
        return <LogsView />;
      case 'SYS_SETTINGS':
        return (
            <SettingsView 
                user={currentUser} 
                pjData={{
                    companyProfile: state.companyProfile,
                    branches: state.branches,
                    costCenters: state.costCenters,
                    departments: state.departments,
                    projects: state.projects
                }}
                onUpdateSettings={handleUpdateSettings}
                onOpenCollab={() => setIsCollabModalOpen(true)}
                onSavePJEntity={handleSavePJEntity}
                onDeletePJEntity={handleDeletePJEntity}
            />
        );
      case 'SYS_ACCESS':
        return <AccessView currentUser={currentUser} />;

      // --- ODONTO MODULE ---
      case 'ODONTO_AGENDA':
      case 'ODONTO_PATIENTS':
      case 'ODONTO_PROCEDURES':
        const odontoClients = state.serviceClients?.filter(c => c.moduleTag === ODONTO_TAG) || [];
        const odontoServices = state.serviceItems?.filter(s => s.moduleTag === ODONTO_TAG) || [];
        const odontoAppointments = state.serviceAppointments?.filter(a => a.moduleTag === ODONTO_TAG) || [];

        let section: 'CALENDAR' | 'CLIENTS' | 'SERVICES' = 'CALENDAR';
        if (currentView === 'ODONTO_PATIENTS') section = 'CLIENTS';
        if (currentView === 'ODONTO_PROCEDURES') section = 'SERVICES';

        return (
            <ServiceModule 
                moduleTitle="Módulo Odonto"
                clientLabel="Paciente"
                serviceLabel="Procedimento"
                transactionCategory="Serviços Odontológicos"
                
                activeSection={section}

                clients={odontoClients}
                services={odontoServices}
                appointments={odontoAppointments}
                contacts={state.contacts}
                
                onSaveClient={handleSaveServiceClient}
                onDeleteClient={handleDeleteServiceClient}
                onSaveService={(s) => handleSaveServiceItem({ ...s, moduleTag: ODONTO_TAG })}
                onDeleteService={handleDeleteServiceItem}
                onSaveAppointment={(a) => handleSaveServiceAppointment({ ...a, moduleTag: ODONTO_TAG })}
                onDeleteAppointment={handleDeleteServiceAppointment}
                
                onAddTransaction={handleAddTransaction}
            />
        );

      default:
        return <div>Página não encontrada</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-40">
        <span className="font-bold text-xl text-gray-800">FinManager</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-800/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 h-full bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <Sidebar 
                currentView={currentView} 
                onChangeView={(view) => {
                    setCurrentView(view);
                    setIsMobileMenuOpen(false);
                }}
                currentUser={currentUser}
                onUserUpdate={setCurrentUser}
            />
          </div>
        </div>
      )}

      <div className="hidden md:flex w-64 h-screen fixed left-0 top-0 z-30">
        <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView}
            currentUser={currentUser}
            onUserUpdate={setCurrentUser}
        />
      </div>

      <main className="md:ml-64 p-4 md:p-8 max-w-7xl mx-auto">
        {renderContent()}
      </main>

      <CollaborationModal 
        isOpen={isCollabModalOpen}
        onClose={() => setIsCollabModalOpen(false)}
        currentUser={currentUser}
        onUserUpdate={setCurrentUser}
      />
    </div>
  );
};

export default App;
