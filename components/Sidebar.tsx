
import React, { useState } from 'react';
import { LayoutDashboard, Receipt, PieChart, BrainCircuit, Wallet, LogOut, CalendarDays, Settings, Users, CreditCard, ScrollText, ChevronDown, Check, Briefcase, User as UserIcon, SmilePlus } from 'lucide-react';
import { ViewMode, User, Workspace } from '../types';
import { logout, switchContext } from '../services/storageService';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onOpenCollab?: () => void; 
  currentUser?: User | null; // Pass current user to access workspaces
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, currentUser }) => {
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const menuItems = [
    { id: 'DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'TRANSACTIONS', label: 'Lançamentos', icon: Receipt },
    { id: 'CALENDAR', label: 'Calendário', icon: CalendarDays },
    { id: 'CARDS', label: 'Meus Cartões', icon: CreditCard },
    { id: 'REPORTS', label: 'Relatórios', icon: PieChart },
    { id: 'CONTACTS', label: 'Contatos', icon: Users },
    { id: 'ADVISOR', label: 'Consultor IA', icon: BrainCircuit },
    { id: 'LOGS', label: 'Auditoria & Logs', icon: ScrollText },
  ];

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const handleSwitchWorkspace = async (ws: Workspace) => {
      if (ws.id === currentUser?.familyId) {
          setIsWorkspaceDropdownOpen(false);
          return;
      }
      
      setSwitching(true);
      try {
          await switchContext(ws.id);
          window.location.reload(); // Reload to refresh all data with new context
      } catch (e) {
          alert("Erro ao trocar de conta.");
          setSwitching(false);
      }
  };

  // Find active workspace name
  const activeWorkspace = currentUser?.workspaces?.find(w => w.id === currentUser.familyId);
  const workspaceName = activeWorkspace ? activeWorkspace.name : (currentUser?.name || 'Minha Conta');
  const isPJ = currentUser?.entityType === 'PJ';
  const showOdonto = isPJ && currentUser?.settings?.activeModules?.odonto;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      
      {/* Workspace Switcher Header */}
      <div className="p-4 border-b border-gray-100">
          <div className="relative">
              <button 
                onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left group"
              >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm ${isPJ ? 'bg-indigo-900' : 'bg-indigo-600'}`}>
                      {isPJ ? <Briefcase className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <p className="text-xs text-gray-500 font-medium truncate uppercase tracking-wider">{isPJ ? 'Empresa' : 'Pessoal'}</p>
                      <p className="font-bold text-gray-800 truncate text-sm">{workspaceName}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              </button>

              {/* Dropdown */}
              {isWorkspaceDropdownOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                      <div className="py-1">
                          <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">Trocar Conta</p>
                          {currentUser?.workspaces?.map(ws => (
                              <button
                                key={ws.id}
                                onClick={() => handleSwitchWorkspace(ws)}
                                disabled={switching}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group transition-colors"
                              >
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${ws.entityType === 'PJ' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                          {ws.entityType === 'PJ' ? 'PJ' : 'PF'}
                                      </div>
                                      <div>
                                          <p className="text-sm font-semibold text-gray-800">{ws.name}</p>
                                          <p className="text-xs text-gray-500 capitalize">{ws.role === 'ADMIN' ? 'Administrador' : 'Membro'}</p>
                                      </div>
                                  </div>
                                  {ws.id === currentUser.familyId && <Check className="w-4 h-4 text-indigo-600" />}
                              </button>
                          ))}
                      </div>
                      <div className="border-t border-gray-100 bg-gray-50 p-2">
                          <button 
                            onClick={() => onChangeView('SETTINGS')} // Redirect to settings to invite/join
                            className="w-full py-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 text-center"
                          >
                              Gerenciar Contas
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as ViewMode)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
              {item.label}
            </button>
          );
        })}

        {showOdonto && (
            <>
                <div className="my-2 border-t border-gray-100 mx-4"></div>
                <button
                    onClick={() => onChangeView('ODONTO')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                        currentView === 'ODONTO'
                        ? 'bg-sky-50 text-sky-600 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                    <SmilePlus className={`w-5 h-5 ${currentView === 'ODONTO' ? 'text-sky-600' : 'text-sky-400'}`} />
                    Módulo Odonto
                </button>
            </>
        )}
        
        <div className="pt-4 mt-4 border-t border-gray-100">
            <button
                onClick={() => onChangeView('SETTINGS')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                    currentView === 'SETTINGS'
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
                <Settings className="w-5 h-5" />
                Configurações
            </button>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100 mt-auto">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
