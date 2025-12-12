
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionsView from './components/TransactionsView';
import Reports from './components/Reports';
import SmartAdvisor from './components/SmartAdvisor';
import CalendarView from './components/CalendarView';
import SettingsView from './components/SettingsView';
import ContactsView from './components/ContactsView';
import CreditCardsView from './components/CreditCardsView';
import LogsView from './components/LogsView';
import Auth from './components/Auth';
import CollaborationModal from './components/CollaborationModal';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import ServiceModule from './components/ServiceModule';
import { loadInitialData, api, logout } from './services/storageService';
import { AppState, ViewMode, Transaction, TransactionType, TransactionStatus, Account, User, AppSettings, Contact, Category, UserRole, EntityType, SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project, ServiceClient, ServiceItem, ServiceAppointment } from './types';
import { Menu, Loader2 } from 'lucide-react';

const App: React.FC = () => {
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
  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modal States
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);

  // Constants
  const ODONTO_TAG = 'ODONTO';

  // Initial Load
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token || !userStr) {
        setIsLoading(false);
        return; 
      }

      const user = JSON.parse(userStr);
      setCurrentUser(user);
      
      if (user.role === UserRole.ADMIN) {
          setIsLoading(false);
          return;
      }

      setIsLoading(true);
      try {
        const data = await loadInitialData();
        setState(data);
      } catch (error) {
        console.error("Failed to load initial data or session expired:", error);
        logout();
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    setShowAuth(false);
    
    if (user.role === UserRole.ADMIN) {
        return;
    }

    setIsLoading(true);
    try {
        const data = await loadInitialData();
        setState(data);
    } catch (e) {
        console.error(e);
    }
    setIsLoading(false);
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
    }
  };

  // --- Transactions Logic ---

  const handleAddTransaction = async (newTransaction: Omit<Transaction, 'id'>, newContact?: Contact, newCategory?: Category) => {
    try {
        const transaction: Transaction = {
          ...newTransaction,
          id: crypto.randomUUID(),
        };

        if (newContact) {
            await api.saveContact(newContact);
            setState(prev => ({ ...prev, contacts: [...prev.contacts, newContact] }));
        }

        if (newCategory) {
            await api.saveCategory(newCategory);
            setState(prev => ({ ...prev, categories: [...prev.categories, newCategory] }));
        }

        await api.saveTransaction(transaction);

        setState(prevState => {
          let updatedAccounts = [...prevState.accounts];
          
          if (transaction.status === TransactionStatus.PAID) {
            updatedAccounts = updatedAccounts.map(acc => {
              if (acc.id === transaction.accountId) {
                let newBalance = acc.balance;
                if (transaction.type === TransactionType.INCOME) newBalance += transaction.amount;
                else newBalance -= transaction.amount;
                api.saveAccount({ ...acc, balance: newBalance }); 
                return { ...acc, balance: newBalance };
              }
              if (transaction.type === TransactionType.TRANSFER && transaction.destinationAccountId && acc.id === transaction.destinationAccountId) {
                 const newBalance = acc.balance + transaction.amount;
                 api.saveAccount({ ...acc, balance: newBalance });
                 return { ...acc, balance: newBalance };
              }
              return acc;
            });
          }

          return {
            ...prevState,
            accounts: updatedAccounts,
            transactions: [transaction, ...prevState.transactions]
          };
        });
    } catch (e: any) {
        alert("Erro ao salvar transação: " + e.message);
        console.error(e);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
        const target = state.transactions.find(t => t.id === id);
        if (!target) return;

        await api.deleteTransaction(id);

        setState(prevState => {
          let updatedAccounts = [...prevState.accounts];
          if (target.status === TransactionStatus.PAID) {
            updatedAccounts = updatedAccounts.map(acc => {
              if (acc.id === target.accountId) {
                 let newBalance = acc.balance;
                 if (target.type === TransactionType.INCOME) newBalance -= target.amount;
                 else newBalance += target.amount;
                 api.saveAccount({ ...acc, balance: newBalance });
                 return { ...acc, balance: newBalance };
              }
              if (target.type === TransactionType.TRANSFER && target.destinationAccountId && acc.id === target.destinationAccountId) {
                  const newBalance = acc.balance - target.amount;
                  api.saveAccount({ ...acc, balance: newBalance });
                  return { ...acc, balance: newBalance };
              }
              return acc;
            });
          }

          return {
            ...prevState,
            accounts: updatedAccounts,
            transactions: prevState.transactions.filter(t => t.id !== id)
          };
        });
    } catch (e: any) {
        alert("Erro ao excluir transação: " + e.message);
    }
  };

  const handleEditTransaction = async (updatedT: Transaction, newContact?: Contact, newCategory?: Category) => {
    try {
        const oldT = state.transactions.find(t => t.id === updatedT.id);
        if (!oldT) return;

        if (newContact) {
            await api.saveContact(newContact);
            setState(prev => ({ ...prev, contacts: [...prev.contacts, newContact] }));
        }

        if (newCategory) {
            await api.saveCategory(newCategory);
            setState(prev => ({ ...prev, categories: [...prev.categories, newCategory] }));
        }

        await api.saveTransaction(updatedT);

        setState(prevState => {
            let updatedAccounts = [...prevState.accounts];

            if (oldT.status === TransactionStatus.PAID) {
                updatedAccounts = updatedAccounts.map(acc => {
                    if (acc.id === oldT.accountId) {
                        let revBalance = acc.balance;
                        if (oldT.type === TransactionType.INCOME) revBalance -= oldT.amount;
                        else revBalance += oldT.amount;
                        return { ...acc, balance: revBalance };
                    }
                    if (oldT.type === TransactionType.TRANSFER && oldT.destinationAccountId && acc.id === oldT.destinationAccountId) {
                        return { ...acc, balance: acc.balance - oldT.amount };
                    }
                    return acc;
                });
            }

            if (updatedT.status === TransactionStatus.PAID) {
                 updatedAccounts = updatedAccounts.map(acc => {
                    if (acc.id === updatedT.accountId) {
                        let newBalance = acc.balance;
                        if (updatedT.type === TransactionType.INCOME) newBalance += updatedT.amount;
                        else newBalance -= updatedT.amount;
                        return { ...acc, balance: newBalance };
                    }
                    if (updatedT.type === TransactionType.TRANSFER && updatedT.destinationAccountId && acc.id === updatedT.destinationAccountId) {
                        return { ...acc, balance: acc.balance + updatedT.amount };
                    }
                    return acc;
                });
            }
            
            updatedAccounts.forEach(acc => {
                const original = prevState.accounts.find(a => a.id === acc.id);
                if (original && original.balance !== acc.balance) {
                    api.saveAccount(acc);
                }
            });

            return {
                ...prevState,
                accounts: updatedAccounts,
                transactions: prevState.transactions.map(t => t.id === updatedT.id ? updatedT : t)
            };
        });
    } catch (e: any) {
        alert("Erro ao editar transação: " + e.message);
    }
  };

  const handleUpdateStatus = (t: Transaction) => {
    const newStatus = t.status === TransactionStatus.PAID 
        ? TransactionStatus.PENDING 
        : TransactionStatus.PAID;

    const updatedT = { ...t, status: newStatus };
    handleEditTransaction(updatedT);
  };

  // --- Accounts Logic ---

  const handleSaveAccount = async (account: Account) => {
    try {
        await api.saveAccount(account);
        setState(prevState => {
          const exists = prevState.accounts.find(a => a.id === account.id);
          if (exists) {
            return {
              ...prevState,
              accounts: prevState.accounts.map(a => a.id === account.id ? account : a)
            };
          } else {
            return {
              ...prevState,
              accounts: [...prevState.accounts, account]
            };
          }
        });
    } catch (e: any) {
        alert("Erro ao salvar conta: " + e.message);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
        await api.deleteAccount(id);
        setState(prevState => ({
          ...prevState,
          accounts: prevState.accounts.filter(a => a.id !== id)
        }));
    } catch (e: any) {
        alert("Erro ao excluir conta: " + e.message);
    }
  };

  // --- Contacts Logic ---
  const handleSaveContact = async (contact: Contact) => {
      try {
          await api.saveContact(contact);
          setState(prevState => {
              const exists = prevState.contacts.find(c => c.id === contact.id);
              if (exists) {
                  return { ...prevState, contacts: prevState.contacts.map(c => c.id === contact.id ? contact : c) };
              }
              return { ...prevState, contacts: [...prevState.contacts, contact].sort((a,b) => a.name.localeCompare(b.name)) };
          });
      } catch (e: any) {
          alert("Erro ao salvar contato: " + e.message);
      }
  };

  const handleDeleteContact = async (id: string) => {
      try {
          await api.deleteContact(id);
          setState(prevState => ({ ...prevState, contacts: prevState.contacts.filter(c => c.id !== id) }));
      } catch (e: any) {
          alert("Erro ao excluir contato: " + e.message);
      }
  };

  // --- Categories Logic ---
  const handleSaveCategory = async (category: Category) => {
      try {
          await api.saveCategory(category);
          setState(prev => {
              const exists = prev.categories.find(c => c.id === category.id);
              if (exists) {
                  return { ...prev, categories: prev.categories.map(c => c.id === category.id ? category : c) }
              }
              return { ...prev, categories: [...prev.categories, category].sort((a,b) => a.name.localeCompare(b.name)) }
          });
      } catch (e: any) {
          alert("Erro ao salvar categoria: " + e.message);
      }
  };

  const handleDeleteCategory = async (id: string) => {
      try {
          await api.deleteCategory(id);
          setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
      } catch (e: any) {
          alert("Erro ao excluir categoria: " + e.message);
      }
  };

  // --- PJ Entities Logic ---
  const handleSavePJEntity = async (type: 'company' | 'branch' | 'costCenter' | 'department' | 'project', data: any) => {
      try {
          if (type === 'company') {
              await api.saveCompanyProfile(data);
              setState(prev => ({ ...prev, companyProfile: data }));
          } else if (type === 'branch') {
              await api.saveBranch(data);
              setState(prev => {
                  const exists = prev.branches.find(i => i.id === data.id);
                  return { ...prev, branches: exists ? prev.branches.map(i => i.id === data.id ? data : i) : [...prev.branches, data] };
              });
          } else if (type === 'costCenter') {
              await api.saveCostCenter(data);
              setState(prev => {
                  const exists = prev.costCenters.find(i => i.id === data.id);
                  return { ...prev, costCenters: exists ? prev.costCenters.map(i => i.id === data.id ? data : i) : [...prev.costCenters, data] };
              });
          } else if (type === 'department') {
              await api.saveDepartment(data);
              setState(prev => {
                  const exists = prev.departments.find(i => i.id === data.id);
                  return { ...prev, departments: exists ? prev.departments.map(i => i.id === data.id ? data : i) : [...prev.departments, data] };
              });
          } else if (type === 'project') {
              await api.saveProject(data);
              setState(prev => {
                  const exists = prev.projects.find(i => i.id === data.id);
                  return { ...prev, projects: exists ? prev.projects.map(i => i.id === data.id ? data : i) : [...prev.projects, data] };
              });
          }
      } catch (e: any) {
          alert(`Erro ao salvar ${type}: ` + e.message);
      }
  };

  const handleDeletePJEntity = async (type: 'branch' | 'costCenter' | 'department' | 'project', id: string) => {
      if(!confirm("Deseja confirmar a exclusão deste item corporativo?")) return;
      try {
          if (type === 'branch') {
              await api.deleteBranch(id);
              setState(prev => ({ ...prev, branches: prev.branches.filter(i => i.id !== id) }));
          } else if (type === 'costCenter') {
              await api.deleteCostCenter(id);
              setState(prev => ({ ...prev, costCenters: prev.costCenters.filter(i => i.id !== id) }));
          } else if (type === 'department') {
              await api.deleteDepartment(id);
              setState(prev => ({ ...prev, departments: prev.departments.filter(i => i.id !== id) }));
          } else if (type === 'project') {
              await api.deleteProject(id);
              setState(prev => ({ ...prev, projects: prev.projects.filter(i => i.id !== id) }));
          }
      } catch (e: any) {
          alert(`Erro ao excluir ${type}: ` + e.message);
      }
  };

  // --- GENERIC MODULE HANDLERS ---
  const handleSaveServiceClient = async (c: ServiceClient) => {
      try {
          await api.saveServiceClient(c);
          setState(prev => {
              const exists = prev.serviceClients?.find(sc => sc.id === c.id);
              const contact = prev.contacts.find(co => co.id === c.contactId);
              const cWithContact = { ...c, contactName: contact?.name };
              
              if(exists) {
                  return { ...prev, serviceClients: prev.serviceClients?.map(sc => sc.id === c.id ? cWithContact : sc) };
              }
              return { ...prev, serviceClients: [...(prev.serviceClients || []), cWithContact] };
          });
      } catch(e) { alert("Erro ao salvar cliente"); }
  };
  const handleDeleteServiceClient = async (id: string) => {
      if(!confirm("Excluir cliente?")) return;
      await api.deleteServiceClient(id);
      setState(prev => ({ ...prev, serviceClients: prev.serviceClients?.filter(c => c.id !== id) }));
  };
  const handleSaveServiceItem = async (s: ServiceItem) => {
      try {
          await api.saveServiceItem(s);
          setState(prev => {
              const exists = prev.serviceItems?.find(si => si.id === s.id);
              if(exists) return { ...prev, serviceItems: prev.serviceItems?.map(si => si.id === s.id ? s : si) };
              return { ...prev, serviceItems: [...(prev.serviceItems || []), s] };
          });
      } catch(e) { alert("Erro ao salvar serviço"); }
  };
  const handleDeleteServiceItem = async (id: string) => {
      if(!confirm("Excluir serviço?")) return;
      await api.deleteServiceItem(id);
      setState(prev => ({ ...prev, serviceItems: prev.serviceItems?.filter(s => s.id !== id) }));
  };
  const handleSaveServiceAppointment = async (a: ServiceAppointment) => {
      try {
          await api.saveServiceAppointment(a);
          setState(prev => {
              const exists = prev.serviceAppointments?.find(sa => sa.id === a.id);
              // Resolve names locally
              const client = prev.serviceClients?.find(c => c.id === a.clientId);
              const service = prev.serviceItems?.find(s => s.id === a.serviceId);
              const resolvedA = { ...a, clientName: client?.contactName, serviceName: service?.name };

              if(exists) return { ...prev, serviceAppointments: prev.serviceAppointments?.map(sa => sa.id === a.id ? resolvedA : sa) };
              return { ...prev, serviceAppointments: [...(prev.serviceAppointments || []), resolvedA] };
          });
      } catch(e) { alert("Erro ao salvar agendamento"); }
  };
  const handleDeleteServiceAppointment = async (id: string) => {
      if(!confirm("Excluir agendamento?")) return;
      await api.deleteServiceAppointment(id);
      setState(prev => ({ ...prev, serviceAppointments: prev.serviceAppointments?.filter(a => a.id !== id) }));
  };

  // --- VIEW RENDERING ---

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
                  <p className="text-gray-500 font-medium">Carregando seus dados...</p>
              </div>
          </div>
      );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return (
          <Dashboard 
            state={state}
            settings={currentUser.settings}
            userEntity={currentUser.entityType} 
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={(id) => {
                if (window.confirm("Confirmar exclusão da transação?")) handleDeleteTransaction(id);
            }}
            onEditTransaction={handleEditTransaction}
            onUpdateStatus={handleUpdateStatus}
            onSaveAccount={handleSaveAccount}
            onDeleteAccount={(id) => {
                if (window.confirm("Confirmar exclusão da conta?")) handleDeleteAccount(id);
            }}
            onChangeView={setCurrentView}
          />
        );
      case 'TRANSACTIONS':
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
      case 'CALENDAR':
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
      case 'CONTACTS':
        return (
            <ContactsView 
                contacts={state.contacts}
                onAddContact={handleSaveContact}
                onEditContact={handleSaveContact}
                onDeleteContact={handleDeleteContact}
            />
        );
      case 'CARDS':
        return (
            <CreditCardsView 
                accounts={state.accounts}
                contacts={state.contacts}
                categories={state.categories}
                transactions={state.transactions}
                onSaveAccount={handleSaveAccount}
                onDeleteAccount={(id) => {
                    if (window.confirm("Confirmar exclusão do cartão?")) handleDeleteAccount(id);
                }}
                onAddTransaction={handleAddTransaction}
            />
        );
      case 'REPORTS':
        return <Reports transactions={state.transactions} />;
      case 'ADVISOR':
        return <SmartAdvisor data={state} />;
      case 'LOGS':
        return <LogsView />;
      case 'ODONTO':
        // Filtra dados do estado global para passar apenas os do módulo ODONTO
        const odontoClients = state.serviceClients?.filter(c => c.moduleTag === ODONTO_TAG) || [];
        const odontoServices = state.serviceItems?.filter(s => s.moduleTag === ODONTO_TAG) || [];
        const odontoAppointments = state.serviceAppointments?.filter(a => a.moduleTag === ODONTO_TAG) || [];

        return (
            <ServiceModule 
                moduleTitle="Módulo Odonto"
                clientLabel="Paciente"
                serviceLabel="Procedimento"
                transactionCategory="Serviços Odontológicos"
                
                clients={odontoClients}
                services={odontoServices}
                appointments={odontoAppointments}
                contacts={state.contacts}
                
                // Injeta a tag ODONTO ao salvar
                onSaveClient={(c) => handleSaveServiceClient({ ...c, moduleTag: ODONTO_TAG })}
                onDeleteClient={handleDeleteServiceClient}
                onSaveService={(s) => handleSaveServiceItem({ ...s, moduleTag: ODONTO_TAG })}
                onDeleteService={handleDeleteServiceItem}
                onSaveAppointment={(a) => handleSaveServiceAppointment({ ...a, moduleTag: ODONTO_TAG })}
                onDeleteAppointment={handleDeleteServiceAppointment}
                
                onAddTransaction={handleAddTransaction}
            />
        );
      case 'SETTINGS':
        return (
            <SettingsView 
                user={currentUser} 
                categories={state.categories}
                pjData={{
                    companyProfile: state.companyProfile,
                    branches: state.branches,
                    costCenters: state.costCenters,
                    departments: state.departments,
                    projects: state.projects
                }}
                onUpdateSettings={handleUpdateSettings}
                onOpenCollab={() => setIsCollabModalOpen(true)}
                onSaveCategory={handleSaveCategory}
                onDeleteCategory={handleDeleteCategory}
                onSavePJEntity={handleSavePJEntity}
                onDeletePJEntity={handleDeletePJEntity}
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
            />
          </div>
        </div>
      )}

      <div className="hidden md:flex w-64 h-screen fixed left-0 top-0 z-30">
        <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView}
            currentUser={currentUser} 
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
