
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// --- Types ---
type AlertType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: AlertType;
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

// --- Components ---

const ToastItem: React.FC<{ toast: Toast; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const bgColors = {
    success: 'bg-white border-l-4 border-emerald-500',
    error: 'bg-white border-l-4 border-rose-500',
    info: 'bg-white border-l-4 border-blue-500',
    warning: 'bg-white border-l-4 border-amber-500',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-r-lg shadow-lg min-w-[300px] max-w-md animate-slide-in ${bgColors[toast.type]}`}>
      <div className="mt-0.5 shrink-0">{icons[toast.type]}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{toast.message}</p>
      </div>
      <button onClick={() => onClose(toast.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const ConfirmModal: React.FC<{ 
  isOpen: boolean; 
  options: ConfirmOptions; 
  onConfirm: () => void; 
  onCancel: () => void; 
}> = ({ isOpen, options, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  const isDanger = options.variant === 'danger';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 transition-transform">
        <div className={`px-6 py-4 border-b flex items-center gap-3 ${isDanger ? 'bg-rose-50 border-rose-100' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`p-2 rounded-full ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
            {isDanger ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <h3 className={`text-lg font-bold ${isDanger ? 'text-rose-900' : 'text-gray-900'}`}>{options.title}</h3>
        </div>
        
        <div className="p-6">
          <div className="text-gray-600 text-sm leading-relaxed">{options.message}</div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {options.cancelText || 'Cancelar'}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-xl text-sm font-bold shadow-lg transition-colors ${
              isDanger 
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
            }`}
          >
            {options.confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Provider ---

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
    resolve: null,
  });

  const showAlert = useCallback((message: string, type: AlertType = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    if (confirmState.resolve) confirmState.resolve(true);
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (confirmState.resolve) confirmState.resolve(false);
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onClose={removeToast} />
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        options={confirmState.options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </AlertContext.Provider>
  );
};

// --- Hooks ---

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return { showAlert: context.showAlert };
};

export const useConfirm = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useConfirm must be used within an AlertProvider');
  return { showConfirm: context.showConfirm };
};
