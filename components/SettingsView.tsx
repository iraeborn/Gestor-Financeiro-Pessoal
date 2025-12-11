
import React from 'react';
import { User, AppSettings } from '../types';
import { CreditCard, Users, Shield } from 'lucide-react';
import { updateSettings } from '../services/storageService';

interface SettingsViewProps {
  user: User;
  onUpdateSettings: (s: AppSettings) => void;
  onOpenCollab: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateSettings, onOpenCollab }) => {
  const settings = user.settings || { includeCreditCardsInTotal: true };

  const handleToggleCreditCard = async () => {
    const newSettings = { ...settings, includeCreditCardsInTotal: !settings.includeCreditCardsInTotal };
    try {
        await updateSettings(newSettings);
        onUpdateSettings(newSettings);
    } catch (e) {
        alert("Erro ao salvar configuração.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie suas preferências e colaborações.</p>
      </div>

      <div className="space-y-6">
        
        {/* Seção de Preferências de Cálculo */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    Preferências de Cálculo
                </h2>
            </div>
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Incluir Cartões no Saldo Total</h3>
                            <p className="text-sm text-gray-500 max-w-md mt-1">
                                Se ativado, o saldo (positivo ou negativo) dos cartões de crédito será somado ao seu "Saldo Real" e "Saldo Projetado". Desative se preferir ver apenas o dinheiro em conta.
                            </p>
                        </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={settings.includeCreditCardsInTotal}
                            onChange={handleToggleCreditCard}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
        </div>

        {/* Seção de Família */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Família e Colaboração
                </h2>
            </div>
            <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h3 className="font-semibold text-gray-900">Gerenciar Grupo Familiar</h3>
                        <p className="text-sm text-gray-500 max-w-md mt-1">
                            Convide pessoas para visualizar e gerenciar as mesmas finanças que você ou entre em um grupo existente.
                        </p>
                    </div>
                    <button 
                        onClick={onOpenCollab}
                        className="px-5 py-2.5 bg-indigo-50 text-indigo-700 font-semibold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200"
                    >
                        Abrir Colaboração
                    </button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsView;
