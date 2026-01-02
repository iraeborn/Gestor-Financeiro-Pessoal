
import React, { useState, useEffect } from 'react';
import { ViewMode, User, AppSettings } from '../types';
import { 
  LayoutDashboard, List, Calendar, CreditCard, Users, 
  Settings, LogOut, Briefcase, ShieldCheck, SmilePlus, 
  ShoppingBag, Wrench, FileText, UserCog, Package, Bell, 
  Glasses, Eye, Activity, ChevronLeft, Menu, X
} from 'lucide-react';
import { logout } from '../services/storageService';
import ProfileModal from './ProfileModal';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  currentUser: User;
  onUserUpdate: (u: User) => void;
  onOpenCollab?: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, onChangeView, currentUser, 
    onOpenNotifications, notificationCount = 0, onUserUpdate
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMobileShowText, setIsMobileShowText] = useState(false);

  // No mobile, o comportamento é um pouco diferente: 
  // starts collapsed, can expand via toggle.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const familyId = currentUser.familyId || (currentUser as any).family_id;
  const workspaces = currentUser.workspaces || [];
  const currentWorkspace = workspaces.find(w => w.id === familyId);
  const isAdmin = currentUser.id === familyId || currentWorkspace?.role === 'ADMIN'; 
  
  const workspaceSettings: AppSettings = currentWorkspace?.ownerSettings || currentUser.settings || { includeCreditCardsInTotal: true };
  const activeModules = workspaceSettings.activeModules || {};

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const menuItems = [
    { 
      section: 'Financeiro', 
      items: [
        { id: 'FIN_DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'FIN_TRANSACTIONS', label: 'Extrato', icon: List },
        { id: 'FIN_CALENDAR', label: 'Agenda Fin', icon: Calendar },
        { id: 'FIN_ACCOUNTS', label: 'Contas', icon: Briefcase }, 
        { id: 'FIN_CARDS', label: 'Cartões', icon: CreditCard },
      ]
    },
    ...(activeModules.services ? [{ 
      section: 'Vendas e OS', 
      items: [
        { id: 'SRV_OS', label: activeModules.optical ? 'Laboratório' : 'Ordens de Serviço', icon: Wrench },
        { id: 'SRV_SALES', label: 'Vendas', icon: ShoppingBag },
        { id: 'SRV_CATALOG', label: 'Estoque', icon: Package },
      ]
    }] : []),
    ...((activeModules.optical || activeModules.odonto) ? [{
      section: 'Profissional',
      items: [
        ...(activeModules.optical ? [
          { id: 'OPTICAL_RX', label: 'Receitas RX', icon: Eye },
        ] : []),
        ...(activeModules.odonto ? [
          { id: 'ODONTO_AGENDA', label: 'Agenda Clínica', icon: Calendar },
          { id: 'ODONTO_PATIENTS', label: 'Prontuários', icon: SmilePlus },
        ] : [])
      ]
    }] : []),
    { 
      section: 'Ajustes', 
      items: [
        { id: 'SYS_ACCESS', label: 'Equipe', icon: ShieldCheck },
        { id: 'SYS_SETTINGS', label: 'Configurações', icon: Settings },
      ]
    }
  ];

  const handleToggle = () => {
      setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`flex flex-col h-full bg-white border-r border-gray-100 shadow-sm overflow-hidden transition-all duration-300 ease-in-out relative z-[100] ${isCollapsed ? 'w-20' : 'w-72'}`}>
        
        {/* Toggle Button - Desktop & Mobile */}
        <button 
            onClick={handleToggle}
            className="absolute top-16 -right-3 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 shadow-sm z-[110] transition-transform"
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
            <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Header / Logo + Notificação (Sempre visível) */}
        <div className={`p-6 flex flex-col items-center gap-4 flex-shrink-0 transition-all border-b border-gray-50/50 mb-2 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className={`flex items-center w-full transition-all ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-lg shrink-0">F</div>
                    {!isCollapsed && <span className="font-bold text-xl text-gray-800 tracking-tight animate-fade-in truncate">FinManager</span>}
                </div>
            </div>
            
            {/* Ícone de Notificação Mantido Fora do Check de isCollapsed para estar sempre acessível */}
            <button 
                onClick={onOpenNotifications} 
                className={`relative p-2.5 rounded-xl transition-all border shrink-0 ${notificationCount > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-indigo-600'}`}
                title="Notificações"
            >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white">
                        {notificationCount}
                    </span>
                )}
            </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-4 scrollbar-none">
            {menuItems.map((section, idx) => (
                section.items.length > 0 && (
                    <div key={idx}>
                        {!isCollapsed ? (
                            <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 animate-fade-in truncate">{section.section}</p>
                        ) : (
                            <div className="h-px bg-gray-100 mx-2 mb-4"></div>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item: any) => (
                                <button
                                    key={item.id}
                                    onClick={() => onChangeView(item.id as ViewMode)}
                                    title={isCollapsed ? item.label : ''}
                                    className={`w-full flex items-center rounded-xl text-sm font-medium transition-all group ${isCollapsed ? 'justify-center py-3' : 'px-4 py-2.5 gap-3'} ${currentView === item.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                                >
                                    <item.icon className={`shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} ${currentView === item.id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`} />
                                    {!isCollapsed && <span className="truncate animate-fade-in">{item.label}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            ))}
        </div>

        {/* User / Workspace Area */}
        <div className={`p-4 border-t border-gray-100 bg-gray-50/50 transition-all ${isCollapsed ? 'flex justify-center' : ''}`}>
             <button 
                onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)} 
                className={`flex items-center gap-3 w-full p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200 text-left ${isCollapsed ? 'justify-center' : ''}`}
             >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  {!isCollapsed && (
                      <div className="flex-1 overflow-hidden animate-fade-in">
                          <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name || 'Usuário'}</p>
                          <p className="text-xs text-gray-500 truncate">{isAdmin ? 'Administrador' : 'Membro'}</p>
                      </div>
                  )}
             </button>
             {isWorkspaceDropdownOpen && (
                 <div className={`absolute bottom-16 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-[120] transition-all ${isCollapsed ? 'left-20 w-48' : 'left-4 right-4'}`}>
                     <button onClick={() => {setIsProfileModalOpen(true); setIsWorkspaceDropdownOpen(false);}} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg flex items-center gap-2 font-medium text-gray-700"><UserCog className="w-4 h-4" /> Perfil</button>
                     <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium"><LogOut className="w-4 h-4" /> Sair</button>
                 </div>
             )}
        </div>

        <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} currentUser={currentUser} onUserUpdate={onUserUpdate} />
    </div>
  );
};

export default Sidebar;
