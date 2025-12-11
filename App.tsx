
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
import Auth from './components/Auth';
import CollaborationModal from './components/CollaborationModal';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import { loadInitialData, api, logout } from './services/storageService';
import { AppState, ViewMode, Transaction, TransactionType, TransactionStatus, Account, User, AppSettings, Contact, Category, UserRole, EntityType, SubscriptionPlan } from './types';
import { Menu, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // Auth & Routing States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [registerEntityType, setRegisterEntityType] = useState<EntityType>(EntityType.PERSONAL);
  const [registerPlan, setRegisterPlan] = useState<SubscriptionPlan>(SubscriptionPlan.MONTHLY);

  // App Data States
  const [state, setState] = useState<AppState>({ accounts: [], transactions: [], goals: [], contacts: [], categories: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modal States
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);

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

        // 0. Handle New Contact Creation
        if (newContact) {
            await api.saveContact(newContact);
            setState(prev => ({
                ...prev,
                contacts: [...prev.contacts, newContact]
            }));
        }

        // 0.1 Handle New Category Creation
        if (newCategory) {
            await api.saveCategory(newCategory);
            setState(prev => ({
                ...prev,
                categories: [...prev.categories, newCategory]
            }));
        }

        // 1. Update Server (Saves Single Record)
        await api.saveTransaction(transaction);

        // 2. Update Local State (Optimistic UI)
        setState(prevState => {
          let updatedAccounts = [...prevState.accounts];
          
          // Update balance if paid
          if (transaction.status === TransactionStatus.PAID) {
            updatedAccounts = updatedAccounts.map(acc => {
              // Handle Origin Account (Debit)
              if (acc.id === transaction.accountId) {
                let newBalance = acc.balance;
                if (transaction.type === TransactionType.INCOME) {
                    newBalance += transaction.amount;
                } else {
                    // EXPENSE or TRANSFER (Source)
                    newBalance -= transaction.amount;
                }
                api.saveAccount({ ...acc, balance: newBalance }); 
                return { ...acc, balance: newBalance };
              }
              
              // Handle Destination Account (Credit for Transfer)
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

        // 1. Update Server
        await api.deleteTransaction(id);

        // 2. Update Local State
        setState(prevState => {
          let updatedAccounts = [...prevState.accounts];
          if (target.status === TransactionStatus.PAID) {
            updatedAccounts = updatedAccounts.map(acc => {
              // Revert Source Account
              if (acc.id === target.accountId) {
                 let newBalance = acc.balance;
                 if (target.type === TransactionType.INCOME) {
                     newBalance -= target.amount;
                 } else {
                     // Revert Expense or Transfer Out -> Add back
                     newBalance += target.amount;
                 }
                 api.saveAccount({ ...acc, balance: newBalance });
                 return { ...acc, balance: newBalance };
              }
              
              // Revert Destination Account (If Transfer)
              if (target.type === TransactionType.TRANSFER && target.destinationAccountId && acc.id === target.destinationAccountId) {
                  // It was credited, so we debit to revert
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

        // 0. Handle New Contact
        if (newContact) {
            await api.saveContact(newContact);
            setState(prev => ({
                ...prev,
                contacts: [...prev.contacts, newContact]
            }));
        }

        // 0.1 Handle New Category
        if (newCategory) {
            await api.saveCategory(newCategory);
            setState(prev => ({
                ...prev,
                categories: [...prev.categories, newCategory]
            }));
        }

        // 1. Update Server
        await api.saveTransaction(updatedT);

        // 2. Update Local State
        setState(prevState => {
            let updatedAccounts = [...prevState.accounts];

            // A. Revert Old Effect (Source & Dest)
            if (oldT.status === TransactionStatus.PAID) {
                updatedAccounts = updatedAccounts.map(acc => {
                    // Source
                    if (acc.id === oldT.accountId) {
                        let revBalance = acc.balance;
                        if (oldT.type === TransactionType.INCOME) revBalance -= oldT.amount;
                        else revBalance += oldT.amount; // Expense/Transfer
                        return { ...acc, balance: revBalance };
                    }
                    // Dest (if Transfer)
                    if (oldT.type === TransactionType.TRANSFER && oldT.destinationAccountId && acc.id === oldT.destinationAccountId) {
                        return { ...acc, balance: acc.balance - oldT.amount };
                    }
                    return acc;
                });
            }

            // B. Apply New Effect (Source & Dest)
            if (updatedT.status === TransactionStatus.PAID) {
                 updatedAccounts = updatedAccounts.map(acc => {
                    // Source
                    if (acc.id === updatedT.accountId) {
                        let newBalance = acc.balance;
                        if (updatedT.type === TransactionType.INCOME) newBalance += updatedT.amount;
                        else newBalance -= updatedT.amount;
                        return { ...acc, balance: newBalance };
                    }
                    // Dest
                    if (updatedT.type === TransactionType.TRANSFER && updatedT.destinationAccountId && acc.id === updatedT.destinationAccountId) {
                        return { ...acc, balance: acc.balance + updatedT.amount };
                    }
                    return acc;
                });
            }
            
            // Sync modified accounts to Backend
            updatedAccounts.forEach(acc => {
                const original = prevState.accounts.find(a => a.id === acc.id);
                // Simple check: if balance changed from what we had in state
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
    if (!window.confirm("Tem certeza? O histórico será mantido, mas a conta será removida da lista.")) {
      return;
    }
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
                  return {
                      ...prevState,
                      contacts: prevState.contacts.map(c => c.id === contact.id ? contact : c)
                  };
              }
              return {
                  ...prevState,
                  contacts: [...prevState.contacts, contact].sort((a,b) => a.name.localeCompare(b.name))
              };
          });
      } catch (e: any) {
          alert("Erro ao salvar contato: " + e.message);
      }
  };

  const handleDeleteContact = async (id: string) => {
      try {
          await api.deleteContact(id);
          setState(prevState => ({
              ...prevState,
              contacts: prevState.contacts.filter(c => c.id !== id)
          }));
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
                  return {
                      ...prev,
                      categories: prev.categories.map(c => c.id === category.id ? category : c)
                  }
              }
              return {
                  ...prev,
                  categories: [...prev.categories, category].sort((a,b) => a.name.localeCompare(b.name))
              }
          });
      } catch (e: any) {
          alert("Erro ao salvar categoria: " + e.message);
      }
  };

  const handleDeleteCategory = async (id: string) => {
      try {
          await api.deleteCategory(id);
          setState(prev => ({
              ...prev,
              categories: prev.categories.filter(c => c.id !== id)
          }));
      } catch (e: any) {
          alert("Erro ao excluir categoria: " + e.message);
      }
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

  // Admin View
  if (currentUser.role === UserRole.ADMIN) {
      return <AdminDashboard />;
  }

  // User App Loading
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

  // --- Standard User Router Logic ---
  const renderContent = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return (
          <Dashboard 
            state={state}
            settings={currentUser.settings}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleEditTransaction}
            onUpdateStatus={handleUpdateStatus}
            onSaveAccount={handleSaveAccount}
            onDeleteAccount={handleDeleteAccount}
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
                onDeleteAccount={handleDeleteAccount}
                onAddTransaction={handleAddTransaction}
            />
        );
      case 'REPORTS':
        return <Reports transactions={state.transactions} />;
      case 'ADVISOR':
        return <SmartAdvisor data={state} />;
      case 'SETTINGS':
        return (
            <SettingsView 
                user={currentUser} 
                categories={state.categories}
                onUpdateSettings={handleUpdateSettings}
                onOpenCollab={() => setIsCollabModalOpen(true)}
                onSaveCategory={handleSaveCategory}
                onDeleteCategory={handleDeleteCategory}
            />
        );
      default:
        return <div>Página não encontrada</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-40">
        <span className="font-bold text-xl text-gray-800">FinManager</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-800/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 h-full bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <Sidebar 
                currentView={currentView} 
                onChangeView={(view) => {
                    setCurrentView(view);
                    setIsMobileMenuOpen(false);
                }} 
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 h-screen fixed left-0 top-0 z-30">
        <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView} 
        />
      </div>

      {/* Main Content */}
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
