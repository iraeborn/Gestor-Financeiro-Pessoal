
import React, { useState, useEffect } from 'react';
import { User, Member, EntityType, ROLE_DEFINITIONS } from '../types';
import { getFamilyMembers, createInvite, updateMemberRole, removeMember, joinFamily } from '../services/storageService';
import { Users, Copy, CheckCircle, ShieldCheck, Trash2, Edit, RefreshCw, X, Shield, LayoutDashboard, Wallet, Calendar, CreditCard, PieChart, BrainCircuit, SmilePlus, Settings, ScrollText, UserPlus, ArrowRight, UserCog, AlertTriangle, Loader2 } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface AccessViewProps {
    currentUser: User;
    refreshTrigger?: number; // Gatilho de re-sincronização via WebSocket
}

const PERMISSION_GROUPS = [
    {
        name: 'Financeiro',
        items: [
            { id: 'FIN_DASHBOARD', label: 'Dashboard' },
            { id: 'FIN_TRANSACTIONS', label: 'Extrato' },
            { id: 'FIN_ACCOUNTS', label: 'Contas' },
            { id: 'FIN_CARDS', label: 'Cartões' },
            { id: 'FIN_GOALS', label: 'Metas' },
        ]
    },
    {
        name: 'Inteligência',
        requiredModule: 'intelligence',
        items: [
            { id: 'DIAG_HUB', label: 'Estrategista IA' },
            { id: 'FIN_ADVISOR', label: 'Consultor IA' },
        ]
    },
    {
        name: 'Operacional',
        requiredModule: 'services',
        items: [
            { id: 'SRV_OS', label: 'Laboratório / Ordens de Serviço' },
            { id: 'SRV_SALES', label: 'Vendas / Orçamentos' },
            { id: 'SRV_CATALOG', label: 'Estoque' },
        ]
    },
    {
        name: 'Ótica',
        requiredModule: 'optical',
        items: [
            { id: 'OPTICAL_RX', label: 'Receitas RX' },
        ]
    },
    {
        name: 'Odontologia',
        requiredModule: 'odonto',
        items: [
            { id: 'ODONTO_AGENDA', label: 'Agenda Clínica' },
            { id: 'ODONTO_PATIENTS', label: 'Prontuários' },
        ]
    },
    {
        name: 'Configuração',
        items: [
            { id: 'FIN_CONTACTS', label: 'Contatos' },
            { id: 'SYS_ACCESS', label: 'Equipe / Usuários' },
            { id: 'SYS_LOGS', label: 'Auditoria' },
            { id: 'SYS_SETTINGS', label: 'Ajustes' },
        ]
    }
];

const AccessView: React.FC<AccessViewProps> = ({ currentUser, refreshTrigger = 0 }) => {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [generatingInvite, setGeneratingInvite] = useState(false);

    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);
    
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editRole, setEditRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
    const [selectedProfileId, setSelectedProfileId] = useState<string>('CUSTOM');
    const [editPermissions, setEditPermissions] = useState<string[]>([]);

    const isPJ = currentUser.entityType === EntityType.BUSINESS;
    const workspace = currentUser.workspaces?.find(w => w.id === currentUser.familyId);
    const isAdmin = workspace?.role === 'ADMIN';

    const normalizePermissions = (perms: string[] | string | undefined): string[] => {
        if (!perms) return [];
        if (typeof perms === 'string') {
            try {
                const parsed = JSON.parse(perms);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        return perms;
    };

    // Reatividade: Recarrega sempre que o refreshTrigger mudar (WebSocket) ou no mount
    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    const loadData = async () => {
        setLoading(true);
        try {
            const list = await getFamilyMembers();
            setMembers(list);
        } catch (e) {
            console.error("Failed to load members", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvite = async () => {
        setGeneratingInvite(true);
        try {
            const data = await createInvite();
            setInviteCode(data.code);
            // Log de auditoria local (opcional)
        } catch (e) {
            console.error(e);
            showAlert("Erro ao gerar convite.", "error");
        } finally {
            setGeneratingInvite(false);
        }
    };

    const handleJoinFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode) return;
        setJoining(true);
        try {
            await joinFamily(joinCode);
            showAlert("Você entrou na nova equipe com sucesso! A página será recarregada.", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            showAlert("Erro ao entrar: " + e.message, "error");
        } finally {
            setJoining(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        const confirm = await showConfirm({
            title: "Remover Membro",
            message: "Tem certeza que deseja remover este membro? Ele perderá o acesso imediatamente.",
            variant: "danger"
        });
        if (!confirm) return;

        try {
            await removeMember(memberId);
            setMembers(members.filter(m => m.id !== memberId));
            showAlert("Membro removido com sucesso.", "success");
        } catch (e: any) {
            showAlert(e.message || "Erro ao remover membro", "error");
        }
    };

    const findMatchingProfile = (perms: string[] | string | undefined) => {
        const normalized = normalizePermissions(perms);
        if (normalized.length === 0) return 'CUSTOM';
        
        const sortedPerms = [...normalized].sort();
        const jsonPerms = JSON.stringify(sortedPerms);

        const match = ROLE_DEFINITIONS.find(r => {
            if (r.id === 'ADMIN') return false;
            const sortedDef = [...r.defaultPermissions].sort();
            return JSON.stringify(sortedDef) === jsonPerms;
        });

        return match ? match.id : 'CUSTOM';
    };

    const availableRoles = ROLE_DEFINITIONS.filter(r => {
        if (r.id === 'ADMIN') return false; 
        if (r.requiredModule) {
            const activeModules = (workspace?.ownerSettings || currentUser.settings)?.activeModules as any;
            if (!activeModules?.[r.requiredModule]) return false;
        }
        return true;
    });

    const openEditModal = (member: Member) => {
        setEditingMember(member);
        setEditRole(member.role as 'ADMIN' | 'MEMBER');
        const perms = normalizePermissions(member.permissions);
        setEditPermissions(perms);
        setSelectedProfileId(findMatchingProfile(perms));
    };

    const handleProfileChange = (profileId: string) => {
        setSelectedProfileId(profileId);
        if (profileId === 'CUSTOM') return;

        const template = ROLE_DEFINITIONS.find(r => r.id === profileId);
        if (template) {
            setEditPermissions([...template.defaultPermissions]);
        }
    };

    const handleSavePermissions = async () => {
        if (!editingMember) return;
        try {
            await updateMemberRole(editingMember.id, editRole, editPermissions);
            setMembers(members.map(m => m.id === editingMember.id ? { ...m, role: editRole, permissions: editPermissions } : m));
            setEditingMember(null);
            showAlert("Permissões atualizadas com sucesso.", "success");
        } catch (e: any) {
            showAlert(e.message || "Erro ao atualizar permissões", "error");
        }
    };

    const togglePermission = (perm: string) => {
        let newPerms;
        if (editPermissions.includes(perm)) {
            newPerms = editPermissions.filter(p => p !== perm);
        } else {
            newPerms = [...editPermissions, perm];
        }
        setEditPermissions(newPerms);
        const match = findMatchingProfile(newPerms);
        setSelectedProfileId(match);
    };

    const countPermissions = (perms: string[] | string | undefined) => {
        return normalizePermissions(perms).length;
    };

    const filteredPermissionGroups = PERMISSION_GROUPS.filter(group => {
        if (!group.requiredModule) return true;
        const activeModules = (workspace?.ownerSettings || currentUser.settings)?.activeModules as any;
        return activeModules?.[group.requiredModule] === true;
    });

    return (
        <div className="space-y-8 animate-fade-in max-w-6xl pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                    Gestão de Acesso & Equipe
                </h1>
                <p className="text-gray-500">
                    {isPJ 
                        ? "Gerencie convites, sócios e permissões de acesso da organização."
                        : "Gerencie quem tem acesso às finanças da família."}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isAdmin && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-600" />
                                Convidar Novo Membro
                            </h2>
                        </div>
                        <div className="p-6 flex-1 flex flex-col justify-center">
                            <p className="text-sm text-gray-600 mb-6">
                                Gere um código temporário para adicionar um novo membro à sua equipe/família. O código expira em 24 horas.
                            </p>
                            
                            <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-100 border-dashed min-h-[120px]">
                                {!inviteCode ? (
                                    <button 
                                        onClick={handleCreateInvite}
                                        disabled={generatingInvite}
                                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {generatingInvite ? <RefreshCw className="w-4 h-4 animate-spin"/> : <UserPlus className="w-4 h-4" />}
                                        {generatingInvite ? 'Gerando...' : 'Gerar Código de Convite'}
                                    </button>
                                ) : (
                                    <div className="w-full animate-fade-in text-center">
                                        <p className="text-xs text-indigo-500 font-bold uppercase mb-2">Compartilhe este código</p>
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            <span className="text-3xl font-mono font-bold text-gray-800 tracking-widest">{inviteCode}</span>
                                            <button 
                                                onClick={() => { navigator.clipboard.writeText(inviteCode); showAlert("Código copiado!", "info"); }}
                                                className="p-2 hover:bg-white rounded-lg text-indigo-600 transition-colors"
                                                title="Copiar"
                                            >
                                                <Copy className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <button 
                                            onClick={() => setInviteCode(null)}
                                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                                        >
                                            Gerar outro código
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <ArrowRight className="w-5 h-5 text-emerald-600" />
                            Entrar em Outra Equipe
                        </h2>
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-center">
                        <p className="text-sm text-gray-600 mb-6">
                            Tem um código de convite? Digite-o abaixo para acessar uma nova conta empresarial ou familiar.
                        </p>
                        
                        <form onSubmit={handleJoinFamily} className="flex gap-2">
                            <input 
                                type="text" 
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="Código (ex: A1B2C3)"
                                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 font-mono text-center uppercase tracking-widest focus:ring-2 focus:ring-emerald-500 outline-none"
                                maxLength={10}
                            />
                            <button 
                                type="submit"
                                disabled={joining || joinCode.length < 3}
                                className="bg-emerald-600 text-white px-6 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50"
                            >
                                {joining ? '...' : 'Entrar'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-600" />
                        Membros Ativos
                    </h2>
                    <button onClick={loadData} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Membro</th>
                                <th className="px-6 py-4">Função</th>
                                <th className="px-6 py-4">Acesso Permitido</th>
                                {isAdmin && <th className="px-6 py-4 text-right">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {members.map(member => (
                                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${member.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                                                {member.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{member.name} {member.email === currentUser.email && <span className="text-gray-400 font-normal">(Você)</span>}</p>
                                                <p className="text-xs text-gray-500">{member.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${member.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {member.role === 'ADMIN' ? 'Administrador' : 'Membro'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {member.role === 'ADMIN' ? (
                                            <span className="text-xs text-gray-400 italic font-medium">Acesso Total</span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-indigo-500 rounded-full" 
                                                        style={{ width: `${Math.min(100, (countPermissions(member.permissions) / 15) * 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-medium text-gray-700">
                                                    {countPermissions(member.permissions)} telas
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {member.email !== currentUser.email && (
                                                    <>
                                                        <button 
                                                            onClick={() => openEditModal(member)} 
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Editar Permissões"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRemoveMember(member.id)} 
                                                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                            title="Remover Membro"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {loading && members.length === 0 && (
                                <tr>
                                    <td colSpan={isAdmin ? 4 : 3} className="px-6 py-10 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-300" />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Permissions Modal */}
            {editingMember && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <UserCog className="w-5 h-5 text-indigo-600" />
                                Editar Membro: {editingMember.name}
                            </h2>
                            <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Função Principal</label>
                                <select 
                                    value={editRole} 
                                    onChange={e => setEditRole(e.target.value as any)}
                                    className="w-full border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="MEMBER">Membro</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    {editRole === 'ADMIN' 
                                        ? 'Administradores têm acesso total a todas as telas, configurações e podem gerenciar a equipe.'
                                        : 'Membros têm acesso restrito conforme as permissões abaixo.'}
                                </p>
                            </div>

                            {editRole === 'ADMIN' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-amber-800">
                                        <strong>Atenção:</strong> Usuários Administradores podem visualizar e editar todos os dados, excluir registros e gerenciar outros membros. Use com cautela.
                                    </p>
                                </div>
                            )}

                            {editRole === 'MEMBER' && (
                                <div className="space-y-6">
                                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                        <label className="block text-xs font-bold text-indigo-700 uppercase mb-2">Perfil de Acesso (Template)</label>
                                        <select 
                                            value={selectedProfileId}
                                            onChange={e => handleProfileChange(e.target.value)}
                                            className="w-full border border-indigo-200 rounded-lg p-2 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="CUSTOM">Personalizado</option>
                                            {availableRoles.map(role => (
                                                <option key={role.id} value={role.id}>{role.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">Páginas Permitidas</label>
                                        <div className="space-y-4">
                                            {filteredPermissionGroups.map((group) => (
                                                <div key={group.name} className="border border-gray-100 rounded-xl overflow-hidden">
                                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                                                        <span className="text-xs font-bold text-gray-500 uppercase">{group.name}</span>
                                                    </div>
                                                    <div className="p-3 grid grid-cols-2 gap-2">
                                                        {group.items.map(perm => (
                                                            <label key={perm.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={editPermissions.includes(perm.id)}
                                                                    onChange={() => togglePermission(perm.id)}
                                                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                                />
                                                                <span className="text-sm text-gray-700">{perm.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex justify-end gap-2">
                            <button 
                                onClick={() => setEditingMember(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSavePermissions}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccessView;
