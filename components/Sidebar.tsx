import React from 'react';
import { LayoutDashboard, Receipt, PieChart, BrainCircuit, Wallet, LogOut } from 'lucide-react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const menuItems = [
    { id: 'DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'TRANSACTIONS', label: 'Lançamentos', icon: Receipt },
    { id: 'REPORTS', label: 'Relatórios', icon: PieChart },
    { id: 'ADVISOR', label: 'Consultor IA', icon: BrainCircuit },
  ];

  return (
    <div className="w-64 bg-white h-screen border-r border-gray-200 flex flex-col fixed left-0 top-0 hidden md:flex z-50">
      <div className="p-6 flex items-center gap-2 border-b border-gray-100">
        <Wallet className="w-8 h-8 text-indigo-600" />
        <span className="text-xl font-bold text-gray-800">FinManager</span>
      </div>

      <nav className="flex-1 p-4 space-y-2">
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
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
