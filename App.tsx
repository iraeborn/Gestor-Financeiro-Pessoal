import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { loadState, saveState } from './services/storageService';
import { AppState, ViewMode, Transaction, TransactionType, TransactionStatus, Account } from './types';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadState());
  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // --- Transactions Logic ---

  const handleAddTransaction = (newTransaction: Omit<Transaction, 'id'>) => {
    const transaction: Transaction = {
      ...newTransaction,
      id: crypto.randomUUID(),
    };

    setState(prevState => {
      // If paid/received immediately, update account balance
      let updatedAccounts = [...prevState.accounts];
      if (transaction.status === TransactionStatus.PAID) {
        updatedAccounts = updatedAccounts.map(acc => {
          if (acc.id === transaction.accountId) {
            return {
              ...acc,
              balance: transaction.type === TransactionType.INCOME 
                ? acc.balance + transaction.amount 
                : acc.balance - transaction.amount
            };
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

  const handleDeleteTransaction = (id: string) => {
    setState(prevState => {
      const target = prevState.transactions.find(t => t.id === id);
      if (!target) return prevState;

      // Revert balance if it was paid
      let updatedAccounts = [...prevState.accounts];
      if (target.status === TransactionStatus.PAID) {
        updatedAccounts = updatedAccounts.map(acc => {
          if (acc.id === target.accountId) {
            return {
              ...acc,
              balance: target.type === TransactionType.INCOME 
                ? acc.balance - target.amount // Remove income
                : acc.balance + target.amount // Refund expense
            };
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

  const handleEditTransaction = (updatedT: Transaction) => {
    setState(prevState => {
        const oldT = prevState.transactions.find(t => t.id === updatedT.id);
        if (!oldT) return prevState;

        let updatedAccounts = [...prevState.accounts];

        // This logic is simplified. Correct accounting requires:
        // 1. Revert Old Effect (if PAID)
        if (oldT.status === TransactionStatus.PAID) {
            updatedAccounts = updatedAccounts.map(acc => {
                if (acc.id === oldT.accountId) {
                    return {
                        ...acc,
                        balance: oldT.type === TransactionType.INCOME 
                            ? acc.balance - oldT.amount 
                            : acc.balance + oldT.amount
                    };
                }
                return acc;
            });
        }

        // 2. Apply New Effect (if PAID)
        if (updatedT.status === TransactionStatus.PAID) {
             updatedAccounts = updatedAccounts.map(acc => {
                if (acc.id === updatedT.accountId) {
                    return {
                        ...acc,
                        balance: updatedT.type === TransactionType.INCOME 
                            ? acc.balance + updatedT.amount 
                            : acc.balance - updatedT.amount
                    };
                }
                return acc;
            });
        }

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

  const handleSaveAccount = (account: Account) => {
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

  const handleDeleteAccount = (id: string) => {
    // Note: In a real app, we should check for associated transactions before deleting.
    // For this personal manager, we will just delete the account.
    if (!window.confirm("Tem certeza? As transações ligadas a esta conta permanecerão, mas o saldo será perdido.")) {
      return;
    }
    setState(prevState => ({
      ...prevState,
      accounts: prevState.accounts.filter(a => a.id !== id)
    }));
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
        <Dashboard 
          state={state}
          onAddTransaction={handleAddTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onEditTransaction={handleEditTransaction}
          onUpdateStatus={handleUpdateStatus}
          onSaveAccount={handleSaveAccount}
          onDeleteAccount={handleDeleteAccount}
          currentView={currentView}
        />
      </main>
    </div>
  );
};

export default App;