
import React, { useState, useEffect } from 'react';
import { ViewMode, User, AppSettings } from '../types';
import { 
  LayoutDashboard, List, Calendar, CreditCard, Users, 
  Settings, LogOut, Briefcase, ShieldCheck, SmilePlus, 
  ShoppingBag, Wrench, FileText, UserCog, Package, Bell, 
  Glasses, Eye, Activity, ChevronLeft, Menu, X, Share2,
  Building2, Check, ScrollText, Sparkles, BrainCircuit, Store
} from 'lucide-react';
import { logout, switchContext } from '../services/storageService';
import ProfileModal from './ProfileModal';
import { useAlert } from './AlertSystem';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  currentUser: User;
  onUserUpdate: (u: User) => void;
  onOpenCollab?: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, onChangeView, currentUser, 
    onOpenNotifications, notificationCount = 0, onUserUpdate,
    isMobileOpen, setIsMobileOpen
}) => {
  const { showAlert } = useAlert();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const familyId = currentUser.familyId || (currentUser as any).family_id;
  const workspaces = currentUser.workspaces || [];
  const currentWorkspace = workspaces.find(w => w.id === familyId);
  const isAdmin = currentUser.id === familyId || currentWorkspace?.role === 'ADMIN'; 
  
  const userPermissions = Array.isArray(currentWorkspace?.permissions) ? currentWorkspace?.permissions : [];
  const workspaceSettings: AppSettings = currentWorkspace?.ownerSettings || currentUser.settings || { includeCreditCardsInTotal: true };
  const activeModules = workspaceSettings.activeModules || {};

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const handleSwitchWorkspace = async (id: string) => {
    if (id === familyId) return;
    try {
        await switchContext(id);
        window.location.reload();
    } catch (e) {
        showAlert("Erro ao trocar de negócio.", "error");
    }
  };

  const handleViewChange = (view: ViewMode) => {
      onChangeView(view);
      if (window.innerWidth < 768) setIsMobileOpen(false);
  };

  const handleShareCurrentView = () => {
    const url = new URL(window.location.origin);
    url.searchParams.set('view', currentView);
    navigator.clipboard.writeText(url.toString())
      .then(() => showAlert("Link da página copiado!", "success"))
      .catch(() => showAlert("Erro ao copiar link.", "error"));
  };

  const menuSections = [
    { 
      section: 'Financeiro', 
      items: [
        { id: 'FIN_DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'FIN_TRANSACTIONS', label: 'Extrato', icon: List },
        { id: 'FIN_ACCOUNTS', label: 'Contas', icon: Briefcase }, 
        { id: 'FIN_CARDS', label: 'Cartões', icon: CreditCard },
        { id: 'FIN_GOALS', label: 'Metas', icon: Check },
      ]
    },
    {
      section: 'Inteligência',
      enabled: !!activeModules.intelligence,
      items: [
        { id: 'DIAG_HUB', label: 'Estrategista IA', icon: BrainCircuit },
        { id: 'FIN_ADVISOR', label: 'Consultor IA', icon: Sparkles },
      ]
    },
    { 
      section: 'Operacional', 
      enabled: !!activeModules.services,
      items: [
        { id: 'SRV_OS', label: activeModules.optical ? 'Laboratório' : 'Ordens de Serviço', icon: Wrench },
        { id: 'SRV_SALES', label: activeModules.optical ? 'Vendas Óculos' : 'Vendas', icon: ShoppingBag },
        { id: 'SRV_CATALOG', label: 'Estoque', icon: Package },
      ]
    },
    {
      section: 'Especialidade',
      enabled: !!(activeModules.optical || activeModules.odonto),
      items: [
        { id: 'OPTICAL_RX', label: 'Receitas RX', icon: Eye, enabled: !!activeModules.optical },
        { id: 'ODONTO_AGENDA', label: 'Agenda Clínica', icon: Calendar, enabled: !!activeModules.odonto },
        { id: 'ODONTO_PATIENTS', label: 'Prontuários', icon: SmilePlus, enabled: !!activeModules.odonto },
      ]
    },
    { 
      section: 'Configuração', 
      items: [
        { id: 'FIN_CONTACTS', label: 'Contatos', icon: Users },
        { id: 'SYS_BRANCHES', label: 'Filiais & Unidades', icon: Store },
        { id: 'SYS_ACCESS', label: 'Equipe / Usuários', icon: ShieldCheck },
        { id: 'SYS_LOGS', label: 'Auditoria', icon: ScrollText },
        { id: 'SYS_SETTINGS', label: 'Ajustes', icon: Settings },
      ]
    }
  ];

  const filteredMenuItems = menuSections
    .filter(section => section.enabled === undefined || section.enabled)
    .map(section => {
        const visibleItems = section.items.filter(item => {
            if ((item as any).enabled !== undefined && !(item as any).enabled) return false;
            if (isAdmin) return true;
            return userPermissions.includes(item.id);
        });
        return { ...section, items: visibleItems };
    })
    .filter(section => section.items.length > 0);

  const handleToggle = () => setIsCollapsed(!isCollapsed);

  return (
    <>
        {isMobileOpen && (
            <div 
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] md:hidden transition-opacity duration-300"
                onClick={() => setIsMobileOpen(false)}
            />
        )}

        <div className={`
            fixed inset-y-0 left-0 md:relative flex flex-col h-full bg-white border-r border-gray-100 shadow-xl md:shadow-sm 
            transition-all duration-300 ease-in-out z-[150]
            ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
            ${isCollapsed ? 'md:w-20' : 'md:w-72'}
        `}>
            <button 
                onClick={handleToggle}
                className="hidden md:flex absolute top-14 -right-3 w-7 h-7 bg-white border border-gray-200 rounded-full items-center justify-center text-gray-400 hover:text-indigo-600 shadow-md z-[160] transition-transform"
                style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            <div className={`p-6 flex flex-col items-center gap-4 flex-shrink-0 transition-all border-b border-gray-50/50 mb-2 ${isCollapsed && !isMobileOpen ? 'justify-center' : ''}`}>
                <div className={`flex items-center w-full transition-all ${isCollapsed && !isMobileOpen ? 'justify-center' : 'justify-between'}`}>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg shrink-0">F</div>
                        {(!isCollapsed || isMobileOpen) && (
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-black text-lg text-gray-800 tracking-tighter animate-fade-in truncate leading-tight">FinManager</span>
                                <span className="text-[10px] font-bold text-indigo-500 uppercase truncate">{currentWorkspace?.name || 'Pessoal'}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setIsMobileOpen(false)} className="md:hidden p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className={`flex items-center gap-2 ${isCollapsed && !isMobileOpen ? 'hidden' : 'flex'}`}>
                    <button onClick={onOpenNotifications} className={`relative p-2.5 rounded-xl transition-all border shrink-0 ${notificationCount > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-indigo-600'}`} title="Notificações">
                        <Bell className="w-5 h-5" />
                        {notificationCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{notificationCount}</span>}
                    </button>
                    <button onClick={handleShareCurrentView} className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0" title="Compartilhar Link desta Página">
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-4 scrollbar-none">
                {filteredMenuItems.map((section, idx) => (
                    <div key={idx}>
                        {(!isCollapsed || isMobileOpen) ? (
                            <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 animate-fade-in truncate">{section.section}</p>
                        ) : (
                            <div className="h-px bg-gray-100 mx-2 mb-4"></div>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item: any) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleViewChange(item.id as ViewMode)}
                                    title={isCollapsed && !isMobileOpen ? item.label : ''}
                                    className={`w-full flex items-center rounded-xl text-sm font-medium transition-all group ${isCollapsed && !isMobileOpen ? 'justify-center py-3' : 'px-4 py-2.5 gap-3'} ${currentView === item.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                                >
                                    <item.icon className={`shrink-0 ${isCollapsed && !isMobileOpen ? 'w-6 h-6' : 'w-5 h-5'} ${currentView === item.id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`} />
                                    {(!isCollapsed || isMobileOpen) && <span className="truncate animate-fade-in">{item.label}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className={`p-4 border-t border-gray-100 bg-gray-50/50 transition-all ${isCollapsed && !isMobileOpen ? 'flex justify-center' : ''} relative`}>
                <div className="w-full">
                    <button 
                        onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)} 
                        className={`flex items-center gap-3 w-full p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200 text-left ${isCollapsed && !isMobileOpen ? 'justify-center' : ''}`}
                    >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        {(!isCollapsed || isMobileOpen) && (
                            <div className="flex-1 overflow-hidden animate-fade-in">
                                <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name || 'Usuário'}</p>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase truncate">{currentWorkspace?.name || 'Meu Negócio'}</p>
                            </div>
                        )}
                    </button>

                    {isWorkspaceDropdownOpen && (
                        <div 
                            className={`absolute bottom-full left-4 mb-2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[200] transition-all overflow-hidden ${isCollapsed && !isMobileOpen ? 'w-64' : 'right-4'}`}
                        >
                            {workspaces.length > 1 && (
                                <div className="mb-2 pb-2 border-b border-gray-100">
                                    <p className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alternar Negócio</p>
                                    <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-none">
                                        {workspaces.map(ws => (
                                            <button key={ws.id} onClick={() => handleSwitchWorkspace(ws.id)} className={`w-full text-left px-4 py-3 text-sm rounded-xl flex items-center justify-between transition-all ${ws.id === familyId ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                                                <div className="flex items-center gap-3 truncate"><Building2 className={`w-4 h-4 shrink-0 ${ws.id === familyId ? 'text-indigo-600' : 'text-gray-400'}`} /><span className="truncate">{ws.name}</span></div>
                                                {ws.id === familyId && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1">
                                <button onClick={() => {setIsProfileModalOpen(true); setIsWorkspaceDropdownOpen(false);}} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-xl flex items-center gap-3 font-medium text-gray-700"><UserCog className="w-4 h-4 text-gray-400" /> Perfil</button>
                                <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-3 font-medium"><LogOut className="w-4 h-4" /> Sair</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} currentUser={currentUser} onUserUpdate={onUserUpdate} />
        </div>
    </>
  );
};

export default Sidebar;
