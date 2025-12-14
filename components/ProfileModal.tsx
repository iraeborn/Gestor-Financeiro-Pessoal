
import React, { useState } from 'react';
import { X, User, Mail, Lock, ShieldCheck, CheckCircle, AlertCircle } from 'lucide-react';
import { User as UserType } from '../types';
import { updateProfile } from '../services/storageService';
import { useAlert } from './AlertSystem';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  onUserUpdate: (u: UserType) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, currentUser, onUserUpdate }) => {
  const { showAlert } = useAlert();
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  
  // Password State
  const [changePassword, setChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (changePassword) {
        if (newPassword !== confirmPassword) {
            setError('A nova senha e a confirmação não conferem.');
            setLoading(false);
            return;
        }
        if (newPassword.length < 6) {
            setError('A nova senha deve ter pelo menos 6 caracteres.');
            setLoading(false);
            return;
        }
        if (!currentPassword && !currentUser.googleId) {
             // Google Users don't necessarily have a password, but if they want to set one?
             // Logic handles it in backend, but for standard users, current is required.
             setError('Senha atual é obrigatória.');
             setLoading(false);
             return;
        }
    }

    try {
        const updatedUser = await updateProfile({
            name,
            email,
            currentPassword: changePassword ? currentPassword : undefined,
            newPassword: changePassword ? newPassword : undefined
        });
        
        onUserUpdate(updatedUser);
        showAlert("Perfil atualizado com sucesso!", "success");
        onClose();
    } catch (err: any) {
        setError(err.message || 'Erro ao atualizar perfil.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            Meu Perfil
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Dados Básicos */}
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nome Completo</label>
                    <div className="relative">
                        <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                    <div className="relative">
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                            type="email" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>
                </div>
            </div>

            {/* Seção de Segurança */}
            <div className="border-t border-gray-100 pt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                    <input 
                        type="checkbox" 
                        checked={changePassword}
                        onChange={e => setChangePassword(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold text-gray-700 flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4 text-gray-500" /> Alterar Senha
                    </span>
                </label>

                {changePassword && (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-xl animate-fade-in">
                        {!currentUser.googleId && (
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Senha Atual</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                    <input 
                                        type="password" 
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Nova Senha</label>
                            <input 
                                type="password" 
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Confirmar Nova Senha</label>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                placeholder="Repita a senha"
                            />
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-lg border border-rose-100">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-70 flex justify-center gap-2 items-center"
            >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
                {!loading && <CheckCircle className="w-4 h-4" />}
            </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
