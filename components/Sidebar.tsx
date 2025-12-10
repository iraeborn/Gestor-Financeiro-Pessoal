
import React from 'react';
import { LayoutDashboard, Receipt, PieChart, BrainCircuit, Wallet, LogOut, CalendarDays, Users } from 'lucide-react';
import { ViewMode } from '../types';
import { logout } from '../services/storageService';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onOpenCollab: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onOpenCollab }) => {
  const menuItems = [
    { id: 'DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'TRANSACTIONS', label: 'Lançamentos', icon: Receipt },
    { id: 'CALENDAR', label: 'Calendário', icon: CalendarDays },
    { id: 'REPORTS', label: 'Relatórios', icon: PieChart },
    { id: 'ADVISOR', label: 'Consultor IA', icon: BrainCircuit },
  ];

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-6 flex items-center gap-2 border-b border-gray-100">
        <Wallet className="w-8 h-8 text-indigo-600" />
        <span className="text-xl font-bold text-gray-800">FinManager</span>
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
        
        <div className="pt-4 mt-4 border-t border-gray-100">
            <button
                onClick={onOpenCollab}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition-colors font-medium"
            >
                <Users className="w-5 h-5" />
                Família
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
