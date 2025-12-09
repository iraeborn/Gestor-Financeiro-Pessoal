
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionsView from './components/TransactionsView';
import Reports from './components/Reports';
import SmartAdvisor from './components/SmartAdvisor';
import CalendarView from './components/CalendarView';
import Auth from './components/Auth';
import { loadInitialData, api } from './services/storageService';
import { AppState, ViewMode, Transaction, TransactionType, TransactionStatus, Account, User } from './types';
import { Menu, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({ accounts: [], transactions: [], goals: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Initial Load
  useEffect(() => {
    const init = async () => {
      // Check auth token
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token || !userStr) {
        setIsLoading(false);
        return; // Stay in Auth screen
      }

      setCurrentUser(JSON.parse(userStr));
      
      setIsLoading(true);
      const data = await loadInitialData();
      setState(data);
      setIsLoading(false);
    };
    init();
  }, []);

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    setIsLoading(true);
    const data = await loadInitialData();
    setState(data);
    setIsLoading(false);
  };

  // --- Transactions Logic ---

  const handleAddTransaction = async (newTransaction: Omit<Transaction, 'id'>) => {
    const transaction: Transaction = {
      ...newTransaction,
      id: crypto.randomUUID(),
    };

    // 1. Update Server
    await api.saveTransaction(transaction);

    // 2. Update Local State (Optimistic UI)
    setState(prevState => {
      let updatedAccounts = [...prevState.accounts];
      
      // Update balance if paid
      if (transaction.status === TransactionStatus.PAID) {
        updatedAccounts = updatedAccounts.map(acc => {
          if (acc.id === transaction.accountId) {
            const newBalance = transaction.type === TransactionType.INCOME 
                ? acc.balance + transaction.amount 
                : acc.balance - transaction.amount;
            
            // Sync account balance change to server
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
  };

  const handleDeleteTransaction = async (id: string) => {
    const target = state.transactions.find(t => t.id === id);
    if (!target) return;

    // 1. Update Server
    await api.deleteTransaction(id);

    // 2. Update Local State
    setState(prevState => {
      let updatedAccounts = [...prevState.accounts];
      if (target.status === TransactionStatus.PAID) {
        updatedAccounts = updatedAccounts.map(acc => {
          if (acc.id === target.accountId) {
             const newBalance = target.type === TransactionType.INCOME 
                ? acc.balance - target.amount 
                : acc.balance + target.amount;
             
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
  };

  const handleEditTransaction = async (updatedT: Transaction) => {
    const oldT = state.transactions.find(t => t.id === updatedT.id);
    if (!oldT) return;

    // 1. Update Server
    await api.saveTransaction(updatedT);

    // 2. Update Local State
    setState(prevState => {
        let updatedAccounts = [...prevState.accounts];

        // Revert Old Effect
        if (oldT.status === TransactionStatus.PAID) {
            updatedAccounts = updatedAccounts.map(acc => {
                if (acc.id === oldT.accountId) {
                    const revBalance = oldT.type === TransactionType.INCOME 
                        ? acc.balance - oldT.amount 
                        : acc.balance + oldT.amount;
                    return { ...acc, balance: revBalance };
                }
                return acc;
            });
        }

        // Apply New Effect
        if (updatedT.status === TransactionStatus.PAID) {
             updatedAccounts = updatedAccounts.map(acc => {
                if (acc.id === updatedT.accountId) {
                    const newBalance = updatedT.type === TransactionType.INCOME 
                        ? acc.balance + updatedT.amount 
                        : acc.balance - updatedT.amount;
                    return { ...acc, balance: newBalance };
                }
                return acc;
            });
        }
        
        // Sync modified accounts
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
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm("Tem certeza? O histórico será mantido, mas a conta será removida da lista.")) {
      return;
    }
    await api.deleteAccount(id);
    
    setState(prevState => ({
      ...prevState,
      accounts: prevState.accounts.filter(a => a.id !== id)
    }));
  };

  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
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

  // --- Router Logic ---
  const renderContent = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return (
          <Dashboard 
            state={state}
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
            onAdd={handleAddTransaction}
            onEdit={handleEditTransaction}
          />
        );
      case 'REPORTS':
        return <Reports transactions={state.transactions} />;
      case 'ADVISOR':
        return <SmartAdvisor data={state} />;
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
            <Sidebar currentView={currentView} onChangeView={(view) => {
              setCurrentView(view);
              setIsMobileMenuOpen(false);
            }} />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-8 max-w-7xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
