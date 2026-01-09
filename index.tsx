
import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: Using named import for App as the module does not have a default export
import { App } from './App';
import { AlertProvider } from './components/AlertSystem';
import { localDb } from './services/localDb';

// Registro do Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Inicializa o banco local antes de montar a aplicação
const initApp = async () => {
    try {
        await localDb.init();
        console.log("✅ [DATABASE] LocalDB Inicializado");
        
        const root = ReactDOM.createRoot(rootElement);
        root.render(
          <React.StrictMode>
            <AlertProvider>
              <App />
            </AlertProvider>
          </React.StrictMode>
        );
    } catch (e) {
        console.error("❌ [FATAL] Erro ao inicializar LocalDB:", e);
        // Fallback simples caso o IndexedDB falhe totalmente
        const root = ReactDOM.createRoot(rootElement);
        root.render(<div className="p-20 text-center font-black text-rose-600">Erro fatal ao carregar banco de dados local. Por favor, recarregue a página.</div>);
    }
};

initApp();
