
import React, { useState, useEffect } from 'react';
import { X, Users, Copy, CheckCircle, ArrowRight, UserPlus, Briefcase } from 'lucide-react';
import { createInvite, joinFamily, getFamilyMembers } from '../services/storageService';
import { User, EntityType } from '../types';

interface CollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserUpdate: (u: User) => void;
}

const CollaborationModal: React.FC<CollaborationModalProps> = ({ isOpen, onClose, currentUser, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState<'INVITE' | 'JOIN'>('INVITE');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [members, setMembers] = useState<Partial<User>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isPJ = currentUser.entityType === EntityType.BUSINESS;

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  const loadMembers = async () => {
    try {
        const list = await getFamilyMembers();
        setMembers(list || []);
    } catch (e) {
        console.error("Failed to load members", e);
    }
  };

  const handleCreateInvite = async () => {
    setLoading(true);
    try {
        const data = await createInvite();
        setInviteCode(data.code);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
        const updatedUser = await joinFamily(joinCode);
        onUserUpdate(updatedUser);
        setSuccessMsg(isPJ ? "Você entrou na organização com sucesso!" : "Você entrou no grupo familiar com sucesso!");
        setTimeout(() => {
            onClose();
            window.location.reload(); // Recarregar para pegar dados da nova família
        }, 1500);
    } catch (err: any) {
        setError(err.message || 'Erro ao entrar.');
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Textos Dinâmicos
  const texts = {
      title: isPJ ? "Gestão de Acesso & Equipe" : "Colaboração Familiar",
      inviteTab: isPJ ? "Convidar Sócio/Membro" : "Convidar Familiar",
      joinTab: isPJ ? "Entrar em Organização" : "Entrar em Família",
      inviteDesc: isPJ 
        ? "Gere um código de acesso para permitir que sócios ou colaboradores visualizem e gerenciem o fluxo de caixa desta empresa."
        : "Gere um código para que seu parceiro(a) ou familiar possa ver e editar as mesmas finanças que você em tempo real.",
      membersTitle: isPJ ? "Membros da Organização" : "Membros da Família",
      joinTitle: isPJ ? "Unir-se a uma Empresa" : "Unir Contas Familiares",
      joinDesc: isPJ
        ? "Ao entrar com um código corporativo, você passará a visualizar os dados financeiros da empresa convidada."
        : "Ao entrar em um grupo, seus dados atuais serão mesclados ou substituídos pela visualização da família.",
      joinBtn: isPJ ? "Entrar na Organização" : "Entrar na Família"
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {isPJ ? <Briefcase className="w-5 h-5 text-indigo-600" /> : <Users className="w-5 h-5 text-indigo-600" />}
            {texts.title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button
                    onClick={() => setActiveTab('INVITE')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${activeTab === 'INVITE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {texts.inviteTab}
                </button>
                <button
                    onClick={() => setActiveTab('JOIN')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${activeTab === 'JOIN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {texts.joinTab}
                </button>
            </div>

            {activeTab === 'INVITE' && (
                <div className="space-y-6">
                    <div className="text-center">
                        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                            {texts.inviteDesc}
                        </p>
                        
                        {!inviteCode ? (
                            <button 
                                onClick={handleCreateInvite}
                                disabled={loading}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                            >
                                {loading ? 'Gerando...' : 'Gerar Código de Acesso'}
                            </button>
                        ) : (
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 animate-fade-in">
                                <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-2">Código de Acesso</p>
                                <div className="flex items-center justify-center gap-3">
                                    <span className="text-3xl font-mono font-bold text-gray-800 tracking-widest">{inviteCode}</span>
                                    <button 
                                        onClick={() => { navigator.clipboard.writeText(inviteCode); alert('Copiado!'); }}
                                        className="p-2 hover:bg-white rounded-lg text-indigo-600 transition-colors"
                                        title="Copiar"
                                    >
                                        <Copy className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-xs text-indigo-400 mt-2">Válido por 24 horas</p>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{texts.membersTitle}</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {members.length === 0 ? (
                                <p className="text-sm text-gray-400 italic text-center">Nenhum membro encontrado.</p>
                            ) : members.map((m, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${m.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                                        {m.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">
                                            {m.name} {m.email === currentUser.email && <span className="text-gray-400 font-normal">(Você)</span>}
                                        </p>
                                        <p className="text-xs text-gray-500">{m.email}</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase text-gray-400 bg-white px-2 py-1 rounded border border-gray-200">
                                        {m.role === 'ADMIN' ? 'Admin' : 'Membro'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'JOIN' && (
                <form onSubmit={handleJoin} className="space-y-4">
                    <div className="text-center mb-4">
                         <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600">
                             <UserPlus className="w-6 h-6" />
                         </div>
                         <h3 className="text-gray-900 font-bold">{texts.joinTitle}</h3>
                         <p className="text-sm text-gray-500 mt-1 leading-relaxed">{texts.joinDesc}</p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Código do Convite</label>
                        <input
                            type="text"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="Ex: A1B2C3"
                            maxLength={10}
                            className="text-center uppercase tracking-widest font-mono text-lg block w-full rounded-xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {error && <p className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100 flex items-center gap-2"><ArrowRight className="w-4 h-4"/> {error}</p>}
                    {successMsg && <p className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> {successMsg}</p>}

                    <button
                        type="submit"
                        disabled={loading || joinCode.length < 3}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Entrando...' : texts.joinBtn}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default CollaborationModal;
