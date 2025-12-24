
import React, { useState } from 'react';
import { ViewMode, User, EntityType, AppSettings } from '../types';
import { 
  LayoutDashboard, List, Calendar, CreditCard, PieChart, 
  Tag, Users, BrainCircuit, Settings, LogOut, Briefcase, 
  ShieldCheck, ScrollText, SmilePlus, ShoppingBag, Wrench, 
  FileText, FileSignature, UserCog, Check, Building, Package, Bell,
  Sparkles, ShieldAlert, HeartPulse
} from 'lucide-react';
import { logout, switchContext } from '../services/storageService';
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
    onOpenCollab, onOpenNotifications, notificationCount = 0, onUserUpdate
}) => {
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Normalização para garantir detecção do contexto independente do mapeamento snake/camel
  const userId = currentUser.id;
  const familyId = currentUser.familyId || (currentUser as any).family_id;
  const workspaces = currentUser.workspaces || [];

  const currentWorkspace = workspaces.find(w => w.id === familyId);
  const isOwner = userId === familyId;
  const isAdmin = isOwner || currentWorkspace?.role === 'ADMIN'; 
  
  let userPermissions = currentWorkspace?.permissions || [];
  if (typeof userPermissions === 'string') {
      try {
          userPermissions = JSON.parse(userPermissions);
      } catch (e) {
          userPermissions = [];
      }
  }

  // Fallback de configurações
  const workspaceSettings: AppSettings = currentWorkspace?.ownerSettings || currentUser.settings || { includeCreditCardsInTotal: true };
  const activeModules = workspaceSettings.activeModules || {};
  const hasOdonto = activeModules.odonto;
  const hasServices = activeModules.services;
  const hasIntelligence = activeModules.intelligence;

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const handleSwitchWorkspace = async (wsId: string) => {
      if (wsId === familyId) return;
      setSwitching(true);
      try {
          await switchContext(wsId);
          window.location.reload();
      } catch (e) {
          setSwitching(false);
      }
  };

  const canView = (permissionId: string) => {
      // Donos e Admins vêem tudo por padrão
      if (isAdmin) return true;
      // Membros dependem do array de permissões. Se o array estiver vazio mas o usuário logou, permitimos o Dashboard
      if (permissionId === 'FIN_DASHBOARD') return true;
      return Array.isArray(userPermissions) && userPermissions.includes(permissionId);
  };

  const menuItems = [
    { 
      section: 'Financeiro', 
      items: [
        { id: 'FIN_DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
        { id: 'FIN_TRANSACTIONS', label: 'Lançamentos', icon: List },
        { id: 'FIN_CALENDAR', label: 'Calendário', icon: Calendar },
        { id: 'FIN_ACCOUNTS', label: 'Contas', icon: Briefcase }, 
        { id: 'FIN_CARDS', label: 'Cartões', icon: CreditCard },
        { id: 'FIN_GOALS', label: 'Metas', icon: PieChart },
        { id: 'FIN_REPORTS', label: 'Relatórios', icon: FileText },
        { id: 'FIN_CATEGORIES', label: 'Categorias', icon: Tag },
        { id: 'FIN_CONTACTS', label: 'Contatos', icon: Users },
      ].filter(i => canView(i.id)) 
    },
    ...(hasIntelligence ? [{
      section: 'Inteligência',
      items: [
        { id: 'DIAG_HUB', label: 'Gestor de Elite', icon: BrainCircuit, highlight: true },
        { id: 'FIN_ADVISOR', label: 'Consultor IA', icon: Sparkles },
      ].filter(i => canView('FIN_ADVISOR'))
    }] : []),
    ...(hasServices ? [{ 
      section: 'Serviços & Vendas', 
      items: [
        { id: 'SRV_OS', label: 'Ordens de Serviço', icon: Wrench },
        { id: 'SRV_SALES', label: 'Vendas', icon: ShoppingBag },
        { id: 'SRV_PURCHASES', label: 'Compras', icon: ShoppingBag },
        { id: 'SRV_CATALOG', label: 'Catálogo', icon: Package },
        { id: 'SRV_CONTRACTS', label: 'Contratos', icon: FileSignature },
        { id: 'SRV_NF', label: 'Notas Fiscais', icon: FileText },
        { id: 'SRV_CLIENTS', label: 'Clientes', icon: Users },
      ].filter(i => canView(i.id))
    }] : []),
    ...(hasOdonto ? [{ 
      section: 'Odontologia', 
      items: [
        { id: 'ODONTO_AGENDA', label: 'Agenda', icon: Calendar },
        { id: 'ODONTO_PATIENTS', label: 'Pacientes', icon: SmilePlus },
        { id: 'ODONTO_PROCEDURES', label: 'Procedimentos', icon: List },
      ].filter(i => canView(i.id))
    }] : []),
    { 
      section: 'Sistema', 
      items: [
        { id: 'SYS_CONTACTS', label: 'Todos Contatos', icon: Users }, 
        { id: 'SYS_ACCESS', label: 'Acesso & Equipe', icon: ShieldCheck },
        { id: 'SYS_LOGS', label: 'Logs & Auditoria', icon: ScrollText },
        { id: 'SYS_SETTINGS', label: 'Configurações', icon: Settings },
      ].filter(i => canView(i.id))
    }
  ];

  return (
    <>
    <div className="flex flex-col h-full bg-white border-r border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-lg">F</div>
                <span className="font-bold text-xl text-gray-800 tracking-tight">FinManager</span>
            </div>
            
            <button 
                onClick={onOpenNotifications}
                className="relative p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white">
                        {notificationCount}
                    </span>
                )}
            </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-4 scrollbar-thin">
            {menuItems.map((section, idx) => (
                section.items.length > 0 && (
                    <div key={idx}>
                        <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{section.section}</p>
                        <div className="space-y-1">
                            {section.items.map((item: any) => (
                                <button
                                    key={item.id}
                                    onClick={() => onChangeView(item.id as ViewMode)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                        currentView === item.id 
                                        ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-indigo-600' : 'text-gray-400'} ${item.highlight ? 'text-indigo-500' : ''}`} />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            ))}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
             <div className="relative">
                  <button 
                    onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                    disabled={switching}
                    className="flex items-center gap-3 w-full p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200 text-left hover:shadow-sm"
                  >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name || 'Usuário'}</p>
                          <p className="text-xs text-gray-500 truncate">
                              {switching ? 'Trocando...' : (isAdmin ? 'Administrador' : 'Membro')}
                          </p>
                      </div>
                      <Settings className="w-4 h-4 text-gray-400" />
                  </button>

                  {isWorkspaceDropdownOpen && (
                      <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-scale-up z-50 max-h-[300px] overflow-y-auto">
                          <div className="p-1">
                              {workspaces.length > 0 && (
                                  <>
                                      <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                                          Meus Ambientes
                                      </div>
                                      {workspaces.map(ws => (
                                          <button
                                              key={ws.id}
                                              onClick={() => handleSwitchWorkspace(ws.id)}
                                              className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-2 rounded-lg transition-colors ${ws.id === familyId ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                          >
                                              <div className="flex items-center gap-2 overflow-hidden">
                                                  {ws.entityType === 'PJ' ? <Briefcase className="w-3 h-3 flex-shrink-0" /> : <Building className="w-3 h-3 flex-shrink-0" />}
                                                  <span className="truncate">{ws.name}</span>
                                              </div>
                                              {ws.id === familyId && <Check className="w-3 h-3 text-indigo-600" />}
                                          </button>
                                      ))}
                                      <div className="h-px bg-gray-100 my-1"></div>
                                  </>
                              )}

                              <button 
                                onClick={() => { if (onOpenCollab) onOpenCollab(); setIsWorkspaceDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 rounded-lg transition-colors"
                              >
                                  <Users className="w-4 h-4" />
                                  Convidar / Entrar
                              </button>
                              <button 
                                onClick={() => { setIsProfileModalOpen(true); setIsWorkspaceDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 rounded-lg transition-colors"
                              >
                                  <UserCog className="w-4 h-4" />
                                  Meu Perfil
                              </button>
                              <div className="h-px bg-gray-100 my-1"></div>
                              <button 
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 rounded-lg transition-colors"
                              >
                                  <LogOut className="w-4 h-4" />
                                  Sair
                              </button>
                          </div>
                      </div>
                  )}
             </div>
        </div>
    </div>

    <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onUserUpdate={onUserUpdate}
    />
    </>
  );
};

export default Sidebar;
