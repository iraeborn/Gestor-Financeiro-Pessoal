
import React, { useState, useEffect } from 'react';
import { ViewMode, User, AppSettings } from '../types';
import { 
  LayoutDashboard, List, CreditCard, Users, MessageSquare, 
  Settings, LogOut, Briefcase, Eye, Activity, ChevronLeft, ChevronRight,
  Menu, X, Share2, HelpCircle, Bell, Package, Wrench, ShoppingBag, 
  Store, BadgeDollarSign, Sparkles, BrainCircuit, PanelLeftClose, PanelLeftOpen, Microscope, BookOpen
} from 'lucide-react';
import { logout, switchContext } from '../services/storageService';
import { useHelp } from './GuidedHelp';
import ProfileModal from './ProfileModal';
import { useAlert } from './AlertSystem';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  currentUser: User;
  onUserUpdate: (u: User) => void;
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
  const { isTrackerVisible, setIsTrackerVisible } = useHelp();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
      else setIsCollapsed(false);
      
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    // Inicializa correto baseando-se no tamanho atual
    handleResize(); 
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const familyId = currentUser.familyId || (currentUser as any).family_id;
  const workspaces = currentUser.workspaces || [];
  const currentWorkspace = workspaces.find(w => w.id === familyId);
  const isAdmin = currentUser.id === familyId || currentWorkspace?.role === 'ADMIN'; 
  const userPermissions = Array.isArray(currentWorkspace?.permissions) ? currentWorkspace?.permissions : [];
  const activeSettings: AppSettings = currentWorkspace?.ownerSettings || currentUser.settings || { includeCreditCardsInTotal: true, activeModules: {} };
  const activeModules = activeSettings.activeModules || {};

  const handleShareCurrentView = () => {
    const url = new URL(window.location.origin);
    url.searchParams.set('view', currentView);
    navigator.clipboard.writeText(url.toString()).then(() => showAlert("Link copiado!", "success"));
  };

  const menuSections = [
    { section: 'Financeiro', items: [
        { id: 'FIN_DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'FIN_TRANSACTIONS', label: 'Extrato', icon: List },
        { id: 'FIN_ACCOUNTS', label: 'Contas', icon: Briefcase }, 
        { id: 'FIN_CARDS', label: 'Cartões', icon: CreditCard },
    ]},
    { section: 'Comunicação', items: [
        { id: 'SYS_CHAT', label: 'Chat Equipe', icon: MessageSquare },
    ]},
    { section: 'Especialidade', enabled: !!activeModules.optical, items: [
        { id: 'OPTICAL_RX', label: 'Receitas RX', icon: Eye },
        { id: 'OPTICAL_LABS_MGMT', label: 'Laboratórios', icon: Microscope },
        { id: 'OPTICAL_LAB', label: 'Montagem (OS)', icon: Monitor },
    ]},
    { section: 'Configuração', items: [
        { id: 'FIN_CONTACTS', label: 'Contatos', icon: Users },
        { id: 'SYS_SALESPEOPLE', label: 'Vendedores', icon: BadgeDollarSign, enabled: isAdmin },
        { id: 'SYS_BRANCHES', label: 'Filiais', icon: Store },
        { id: 'SYS_SETTINGS', label: 'Ajustes', icon: Settings },
        { id: 'SYS_HELP', label: 'Central de Ajuda', icon: BookOpen },
    ]}
  ];

  const filteredMenuItems = menuSections
    .filter(section => section.enabled === undefined || section.enabled)
    .map(section => ({
        ...section,
        items: section.items.filter(item => {
            if ((item as any).enabled !== undefined && !(item as any).enabled) return false;
            if (item.id === 'SYS_HELP') return true; // Help is always visible
            if (isAdmin) return true;
            return userPermissions.includes(item.id);
        })
    }))
    .filter(section => section.items.length > 0);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <>
        {isMobileOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] md:hidden" onClick={() => setIsMobileOpen(false)}/>}
        
        <div className={`fixed inset-y-0 left-0 md:relative flex flex-col h-full bg-white border-r border-gray-100 shadow-xl transition-all duration-300 ease-in-out z-[150] ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'} ${isCollapsed ? 'md:w-20' : 'md:w-72'}`}>
            
            {/* Desktop Toggle Button - Absolute Positioned on Border */}
            <button 
                onClick={toggleCollapse}
                className="hidden md:flex absolute -right-3 top-9 bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 p-1.5 rounded-full shadow-sm z-50 transition-all hover:scale-110"
                title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
            >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            </button>

            {/* Header */}
            <div className={`p-6 flex flex-col gap-4 border-b border-gray-50 mb-2 ${isCollapsed && !isMobileOpen ? 'items-center' : ''}`}>
                <div className={`flex items-center w-full ${isCollapsed && !isMobileOpen ? 'justify-center' : 'justify-between'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-indigo-200">F</div>
                        {(!isCollapsed || isMobileOpen) && <span className="font-black text-lg text-gray-800 tracking-tighter animate-fade-in">FinManager</span>}
                    </div>
                    {/* Mobile Close Button */}
                    <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-gray-400"><X className="w-6 h-6" /></button>
                </div>
                
                {/* Utility Buttons: Stack Vertical if collapsed */}
                <div className={`flex gap-2 transition-all ${isCollapsed && !isMobileOpen ? 'flex-col w-full mt-2' : 'flex-row items-center w-full'}`}>
                    <button 
                        onClick={() => setIsTrackerVisible(!isTrackerVisible)} 
                        className={`p-2.5 rounded-xl border transition-all flex justify-center ${isTrackerVisible ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-indigo-600'}`}
                        title="Ajuda do Gestor"
                    >
                        <HelpCircle className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={onOpenNotifications} 
                        className={`relative p-2.5 rounded-xl border flex justify-center ${notificationCount > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-indigo-600'}`} 
                        title="Notificações"
                    >
                        <Bell className="w-5 h-5" />
                        {notificationCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{notificationCount}</span>}
                    </button>
                    <button 
                        onClick={handleShareCurrentView} 
                        className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 hover:text-indigo-600 flex justify-center" 
                        title="Compartilhar Link"
                    >
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-4 scrollbar-thin">
                {filteredMenuItems.map((section, idx) => (
                    <div key={idx}>
                        {(!isCollapsed || isMobileOpen) ? (
                            <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 animate-fade-in">{section.section}</p>
                        ) : (
                            <div className="h-px bg-gray-100 mx-2 mb-4"></div>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item: any) => (
                                <button 
                                    key={item.id} 
                                    onClick={() => { onChangeView(item.id as ViewMode); if(isMobileOpen) setIsMobileOpen(false); }} 
                                    className={`w-full flex items-center rounded-xl text-sm font-medium transition-all group relative
                                        ${isCollapsed && !isMobileOpen ? 'justify-center py-3' : 'px-4 py-2.5 gap-3'} 
                                        ${currentView === item.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}
                                    `}
                                    title={isCollapsed ? item.label : undefined}
                                >
                                    <item.icon className={`shrink-0 transition-colors ${isCollapsed && !isMobileOpen ? 'w-6 h-6' : 'w-5 h-5'} ${currentView === item.id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                    
                                    {(!isCollapsed || isMobileOpen) && (
                                        <span className="truncate text-left animate-fade-in">{item.label}</span>
                                    )}
                                    
                                    {/* Tooltip for collapsed mode */}
                                    {isCollapsed && !isMobileOpen && (
                                        <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                            {item.label}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Profile Footer */}
            <div className={`p-4 border-t border-gray-100 bg-gray-50/50`}>
                <button 
                    onClick={() => setIsProfileModalOpen(true)} 
                    className={`flex items-center w-full p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200 text-left ${isCollapsed && !isMobileOpen ? 'justify-center' : 'gap-3'}`}
                >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                        {currentUser.name?.charAt(0).toUpperCase()}
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                        <div className="flex-1 overflow-hidden animate-fade-in">
                            <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name || 'Usuário'}</p>
                            <p className="text-[10px] font-bold text-indigo-500 uppercase truncate">{currentWorkspace?.name || 'Negócio'}</p>
                        </div>
                    )}
                </button>
            </div>
            
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} currentUser={currentUser} onUserUpdate={onUserUpdate} />
        </div>
    </>
  );
};

const Monitor = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
);

export default Sidebar;
