
import React, { useState } from 'react';
import { ViewMode, User, EntityType } from '../types';
import { 
  LayoutDashboard, List, Calendar, CreditCard, PieChart, 
  Tag, Users, BrainCircuit, Settings, LogOut, Briefcase, 
  ShieldCheck, ScrollText, SmilePlus, ShoppingBag, Wrench, 
  FileText, FileSignature, UserCog
} from 'lucide-react';
import { logout } from '../services/storageService';
import ProfileModal from './ProfileModal';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  currentUser: User;
  onUserUpdate: (u: User) => void;
  onOpenCollab?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, currentUser, onUserUpdate, onOpenCollab }) => {
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const activeModules = currentUser.settings?.activeModules || {};
  const hasOdonto = activeModules.odonto;
  const hasServices = activeModules.services;

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const menuItems = [
    { section: 'Financeiro', items: [
        { id: 'FIN_DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
        { id: 'FIN_TRANSACTIONS', label: 'Lançamentos', icon: List },
        { id: 'FIN_CALENDAR', label: 'Calendário', icon: Calendar },
        { id: 'FIN_ACCOUNTS', label: 'Contas', icon: Briefcase }, 
        { id: 'FIN_CARDS', label: 'Cartões', icon: CreditCard },
        { id: 'FIN_GOALS', label: 'Metas', icon: PieChart },
        { id: 'FIN_REPORTS', label: 'Relatórios', icon: FileText },
        { id: 'FIN_ADVISOR', label: 'Consultor IA', icon: BrainCircuit, highlight: true },
        { id: 'FIN_CATEGORIES', label: 'Categorias', icon: Tag },
        { id: 'FIN_CONTACTS', label: 'Contatos', icon: Users },
    ]},
    ...(hasServices ? [{ section: 'Serviços & Vendas', items: [
        { id: 'SRV_OS', label: 'Ordens de Serviço', icon: Wrench },
        { id: 'SRV_SALES', label: 'Vendas', icon: ShoppingBag },
        { id: 'SRV_PURCHASES', label: 'Compras', icon: ShoppingBag },
        { id: 'SRV_CONTRACTS', label: 'Contratos', icon: FileSignature },
        { id: 'SRV_NF', label: 'Notas Fiscais', icon: FileText },
    ]}] : []),
    ...(hasOdonto ? [{ section: 'Odontologia', items: [
        { id: 'ODONTO_AGENDA', label: 'Agenda', icon: Calendar },
        { id: 'ODONTO_PATIENTS', label: 'Pacientes', icon: SmilePlus },
        { id: 'ODONTO_PROCEDURES', label: 'Procedimentos', icon: List },
    ]}] : []),
    { section: 'Sistema', items: [
        { id: 'SYS_ACCESS', label: 'Acesso & Equipe', icon: ShieldCheck },
        { id: 'SYS_LOGS', label: 'Logs & Auditoria', icon: ScrollText },
        { id: 'SYS_SETTINGS', label: 'Configurações', icon: Settings },
    ]}
  ];

  return (
    <>
    <div className="flex flex-col h-full bg-white border-r border-gray-100 shadow-sm">
        <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-lg">F</div>
            <span className="font-bold text-xl text-gray-800 tracking-tight">FinManager</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-4 scrollbar-thin">
            {menuItems.map((section, idx) => (
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
            ))}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
             <div className="relative">
                  <button 
                    onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                    className="flex items-center gap-3 w-full p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200 text-left hover:shadow-sm"
                  >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name}</p>
                          <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                      </div>
                      <Settings className="w-4 h-4 text-gray-400" />
                  </button>

                  {isWorkspaceDropdownOpen && (
                      <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-scale-up z-50">
                          <div className="p-1">
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
