
import React, { useState, useEffect } from 'react';
import { User, Member, EntityType } from '../types';
import { getFamilyMembers, createInvite, updateMemberRole, removeMember } from '../services/storageService';
import { Users, Copy, CheckCircle, ShieldCheck, Trash2, Edit, RefreshCw, X, Shield } from 'lucide-react';

interface AccessViewProps {
    currentUser: User;
}

const AccessView: React.FC<AccessViewProps> = ({ currentUser }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [generatingInvite, setGeneratingInvite] = useState(false);
    
    // Edit Permissions Modal
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editRole, setEditRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
    const [editPermissions, setEditPermissions] = useState<string[]>([]);

    const isPJ = currentUser.entityType === EntityType.BUSINESS;
    
    // Check if current user is admin of the current workspace
    const workspace = currentUser.workspaces?.find(w => w.id === currentUser.familyId);
    const isAdmin = workspace?.role === 'ADMIN';

    useEffect(() => {
        loadData();
    }, []);

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
        } catch (e) {
            console.error(e);
            alert("Erro ao gerar convite");
        } finally {
            setGeneratingInvite(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm("Tem certeza que deseja remover este membro? Ele perderá o acesso imediatamente.")) return;
        try {
            await removeMember(memberId);
            setMembers(members.filter(m => m.id !== memberId));
        } catch (e: any) {
            alert(e.message || "Erro ao remover membro");
        }
    };

    const openEditModal = (member: Member) => {
        setEditingMember(member);
        setEditRole(member.role);
        setEditPermissions(member.permissions || []);
    };

    const handleSavePermissions = async () => {
        if (!editingMember) return;
        try {
            await updateMemberRole(editingMember.id, editRole, editPermissions);
            setMembers(members.map(m => m.id === editingMember.id ? { ...m, role: editRole, permissions: editPermissions } : m));
            setEditingMember(null);
        } catch (e: any) {
            alert(e.message || "Erro ao atualizar permissões");
        }
    };

    const togglePermission = (perm: string) => {
        if (editPermissions.includes(perm)) {
            setEditPermissions(editPermissions.filter(p => p !== perm));
        } else {
            setEditPermissions([...editPermissions, perm]);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                    Gestão de Acesso & Equipe
                </h1>
                <p className="text-gray-500">
                    {isPJ 
                        ? "Gerencie os sócios, funcionários e suas permissões na organização."
                        : "Gerencie quem tem acesso às finanças da família."}
                </p>
            </div>

            {/* Invite Section */}
            {isAdmin && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            Convidar Novo Membro
                        </h2>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-gray-600 mb-4 max-w-2xl">
                            Gere um código de acesso único. Compartilhe este código com quem você deseja adicionar. 
                            O código é válido por 24 horas.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            {!inviteCode ? (
                                <button 
                                    onClick={handleCreateInvite}
                                    disabled={generatingInvite}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                                >
                                    {generatingInvite ? 'Gerando...' : 'Gerar Código de Convite'}
                                </button>
                            ) : (
                                <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-100 rounded-xl p-2 px-4 animate-fade-in">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-indigo-500 font-bold uppercase">Código Gerado</span>
                                        <span className="text-2xl font-mono font-bold text-gray-800 tracking-widest">{inviteCode}</span>
                                    </div>
                                    <div className="h-8 w-px bg-indigo-200"></div>
                                    <button 
                                        onClick={() => { navigator.clipboard.writeText(inviteCode); alert('Copiado!'); }}
                                        className="p-2 hover:bg-white rounded-lg text-indigo-600 transition-colors"
                                        title="Copiar"
                                    >
                                        <Copy className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => setInviteCode(null)}
                                        className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                        title="Fechar"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Members List */}
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
                                <th className="px-6 py-4">Permissões Especiais</th>
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
                                        <div className="flex flex-wrap gap-1">
                                            {member.role === 'ADMIN' ? (
                                                <span className="text-xs text-gray-400 italic">Acesso Total</span>
                                            ) : (
                                                member.permissions?.length > 0 ? (
                                                    member.permissions.map(p => (
                                                        <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-100 font-medium">
                                                            {p.replace('_', ' ')}
                                                        </span>
                                                    ))
                                                ) : <span className="text-xs text-gray-400 italic">Básico</span>
                                            )}
                                        </div>
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
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Permissions Modal */}
            {editingMember && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">
                                Editar Membro: {editingMember.name}
                            </h2>
                            <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Função</label>
                                <select 
                                    value={editRole} 
                                    onChange={e => setEditRole(e.target.value as any)}
                                    className="w-full border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="MEMBER">Membro</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Administradores têm acesso total e podem gerenciar outros membros.</p>
                            </div>

                            {editRole === 'MEMBER' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Permissões Específicas</label>
                                    <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                                        {[
                                            { id: 'FIN_VIEW', label: 'Ver Financeiro' },
                                            { id: 'FIN_EDIT', label: 'Editar Financeiro' },
                                            { id: 'ODONTO_VIEW', label: 'Ver Odonto' },
                                            { id: 'ODONTO_EDIT', label: 'Editar Odonto' },
                                        ].map(perm => (
                                            <label key={perm.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded-md transition-colors">
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
                            )}

                            <div className="pt-2">
                                <button 
                                    onClick={handleSavePermissions}
                                    className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccessView;
