import React, { useState, useEffect } from 'react';
import { User, Member, EntityType, ROLE_DEFINITIONS, Contact } from '../types';
import { getFamilyMembers, createInvite, updateMemberRole, removeMember, joinFamily, loadInitialData } from '../services/storageService';
import { Users, Copy, CheckCircle, ShieldCheck, Trash2, Edit, RefreshCw, X, Shield, LayoutDashboard, Wallet, Calendar, CreditCard, PieChart, BrainCircuit, SmilePlus, Settings, ScrollText, UserPlus, ArrowRight, UserCog, AlertTriangle, Loader2, Link as LinkIcon, Share2, Target, ShoppingBag, Package, BadgeDollarSign, Store, MessageSquare, Eye, Microscope, Monitor, BookOpen, Link2 } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface AccessViewProps {
    currentUser: User;
    refreshTrigger?: number;
}

const PERMISSION_GROUPS = [
    {
        name: 'Financeiro',
        items: [
            { id: 'FIN_DASHBOARD', label: 'Dashboard' },
            { id: 'FIN_TRANSACTIONS', label: 'Extrato' },
            { id: 'FIN_CALENDAR', label: 'Calendário Financeiro' },
            { id: 'FIN_ACCOUNTS', label: 'Contas' },
            { id: 'FIN_CARDS', label: 'Cartões' },
            { id: 'FIN_GOALS', label: 'Metas' },
            { id: 'FIN_REPORTS', label: 'Projeções e Relatórios' },
            { id: 'FIN_ADVISOR', label: 'Consultor IA' },
            { id: 'FIN_CATEGORIES', label: 'Categorias' },
        ]
    },
    {
        name: 'Operacional',
        items: [
            { id: 'SRV_CATALOG', label: 'Produtos e Serviços' },
            { id: 'SRV_SALES', label: 'Vendas / PDV' },
            { id: 'SRV_PURCHASES', label: 'Compras / Entradas' },
            { id: 'SRV_CONTRACTS', label: 'Contratos' },
            { id: 'SRV_NF', label: 'Notas Fiscais' },
            { id: 'FIN_CONTACTS', label: 'Contatos / Clientes' },
            { id: 'SRV_CLIENTS', label: 'Prontuários / Fichas' },
            { id: 'SRV_BRANCH_SCHEDULE', label: 'Agenda de Unidade' },
            { id: 'SYS_SALESPEOPLE', label: 'Vendedores' },
            { id: 'SYS_BRANCHES', label: 'Filiais' },
            { id: 'SYS_SALES_SCHEDULE', label: 'Escala de Trabalho' },
        ]
    },
    {
        name: 'Comunicação',
        items: [
            { id: 'SYS_CHAT', label: 'Chat Equipe' },
        ]
    },
    {
        name: 'Especialidades',
        items: [
            { id: 'OPTICAL_RX', label: 'Receitas RX' },
            { id: 'OPTICAL_SALES', label: 'Vendas Óticas' },
            { id: 'OPTICAL_LABS_MGMT', label: 'Laboratórios' },
            { id: 'OPTICAL_LAB', label: 'Montagem (OS)' },
        ]
    },
    {
        name: 'Inteligência e Diagnósticos',
        requiredModule: 'intelligence',
        items: [
            { id: 'DIAG_HUB', label: 'Hub de Diagnósticos' },
            { id: 'DIAG_HEALTH', label: 'Saúde do Caixa' },
            { id: 'DIAG_RISK', label: 'Radar de Riscos' },
            { id: 'DIAG_INVEST', label: 'Oportunidades' },
        ]
    },
    {
        name: 'Configuração',
        items: [
            { id: 'SYS_ACCESS', label: 'Equipe / Acessos' },
            { id: 'SYS_LOGS', label: 'Auditoria & Logs' },
            { id: 'SYS_SETTINGS', label: 'Ajustes' },
            { id: 'SYS_HELP', label: 'Central de Ajuda' },
        ]
    }
];

const AccessView: React.FC<AccessViewProps> = ({ currentUser, refreshTrigger = 0 }) => {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirm();
    const [members, setMembers] = useState<Member[]>([]);
    const [allContacts, setAllContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [generatingInvite, setGeneratingInvite] = useState(false);

    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);
    
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editRole, setEditRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
    const [selectedProfileId, setSelectedProfileId] = useState<string>('CUSTOM');
    const [editPermissions, setEditPermissions] = useState<string[]>([]);
    const [editContactId, setEditContactId] = useState<string>('');

    const isPJ = currentUser.entityType === EntityType.BUSINESS;
    const workspace = currentUser.workspaces?.find(w => w.id === currentUser.familyId);
    const isAdmin = workspace?.role === 'ADMIN';

    // Fix: Added missing getInviteUrl function to generate the invitation URL
    const getInviteUrl = () => {
        if (!inviteCode) return '';
        const url = new URL(window.location.origin);
        url.searchParams.set('joinCode', inviteCode);
        return url.toString();
    };

    const normalizePermissions = (perms: string[] | string | undefined): string[] => {
        if (!perms) return [];
        if (typeof perms === 'string') {
            try {
                const parsed = JSON.parse(perms);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) { return []; }
        }
        return perms;
    };

    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [list, data] = await Promise.all([
                getFamilyMembers(),
                loadInitialData()
            ]);
            setMembers(list);
            setAllContacts(data.contacts || []);
        } catch (e) {
            console.error("Failed to load access data", e);
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
            showAlert("Sucesso! A página será recarregada.", "success");
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
        } catch (e: any) { showAlert(e.message || "Erro ao remover membro", "error"); }
    };

    const openEditModal = (member: Member) => {
        setEditingMember(member);
        setEditRole(member.role as 'ADMIN' | 'MEMBER');
        const perms = normalizePermissions(member.permissions);
        setEditPermissions(perms);
        setSelectedProfileId(findMatchingProfile(perms));
        setEditContactId(member.contactId || '');

        // Sugestão Automática de Vínculo por E-mail se não houver vínculo
        if (!member.contactId) {
            const matchedContact = allContacts.find(c => c.email?.toLowerCase() === member.email.toLowerCase());
            if (matchedContact) setEditContactId(matchedContact.id);
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

    const handleProfileChange = (profileId: string) => {
        setSelectedProfileId(profileId);
        if (profileId === 'CUSTOM') return;
        const template = ROLE_DEFINITIONS.find(r => r.id === profileId);
        if (template) setEditPermissions([...template.defaultPermissions]);
    };

    const handleSavePermissions = async () => {
        if (!editingMember) return;
        try {
            await updateMemberRole(editingMember.id, editRole, editPermissions, editContactId);
            setMembers(members.map(m => m.id === editingMember.id ? { ...m, role: editRole, permissions: editPermissions, contactId: editContactId } : m));
            setEditingMember(null);
            showAlert("Permissões e Vínculo CRM atualizados.", "success");
        } catch (e: any) { showAlert(e.message || "Erro ao atualizar permissões", "error"); }
    };

    const togglePermission = (perm: string) => {
        let newPerms = editPermissions.includes(perm) ? editPermissions.filter(p => p !== perm) : [...editPermissions, perm];
        setEditPermissions(newPerms);
        setSelectedProfileId(findMatchingProfile(newPerms));
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-6xl pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                    Gestão de Acesso & Equipe
                </h1>
                <p className="text-gray-500">{isPJ ? "Gerencie convites, sócios e permissões de acesso da organização." : "Gerencie quem tem acesso às finanças da família."}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isAdmin && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b border-gray-50 bg-gray-50/50"><h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Convidar Membro</h2></div>
                        <div className="p-6 flex-1 flex flex-col justify-center">
                            <p className="text-sm text-gray-600 mb-6">Gere um link para que o novo membro entre automaticamente na sua equipe.</p>
                            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-100 border-dashed min-h-[160px]">
                                {!inviteCode ? (
                                    <button onClick={handleCreateInvite} disabled={generatingInvite} className="bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2 disabled:opacity-50">
                                        {generatingInvite ? <RefreshCw className="w-4 h-4 animate-spin"/> : <LinkIcon className="w-4 h-4" />} {generatingInvite ? 'Gerando...' : 'Gerar Link de Convite'}
                                    </button>
                                ) : (
                                    <div className="w-full animate-fade-in text-center space-y-4">
                                        <div className="bg-white p-4 rounded-xl border border-indigo-100">
                                            <p className="text-[10px] text-indigo-500 font-black uppercase mb-2">Link de Acesso Rápido</p>
                                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <span className="flex-1 text-xs font-mono text-slate-500 truncate text-left">{getInviteUrl()}</span>
                                                <button onClick={() => { navigator.clipboard.writeText(getInviteUrl()); showAlert("Link copiado!", "success"); }} className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm"><Copy className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                        <button onClick={() => setInviteCode(null)} className="text-[10px] font-black uppercase text-gray-400 hover:text-gray-600">Gerar novo link</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50"><h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><ArrowRight className="w-5 h-5 text-emerald-600" /> Entrar Manualmente</h2></div>
                    <div className="p-6 flex-1 flex flex-col justify-center">
                        <p className="text-sm text-gray-600 mb-6">Digite o código de 6 dígitos para acessar a organização.</p>
                        <form onSubmit={handleJoinFamily} className="flex gap-2">
                            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" className="flex-1 rounded-xl border border-gray-200 px-4 py-3 font-mono text-center uppercase tracking-[0.5em] focus:ring-2 focus:ring-emerald-500 outline-none font-black" maxLength={6} />
                            <button type="submit" disabled={joining || joinCode.length < 3} className="bg-emerald-600 text-white px-6 rounded-xl font-bold disabled:opacity-50 transition-all shadow-lg">{joining ? '...' : 'Entrar'}</button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50"><h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-600" /> Membros Ativos</h2></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr><th className="px-6 py-4">Membro</th><th className="px-6 py-4">Função</th><th className="px-6 py-4">Vínculo CRM</th><th className="px-6 py-4 text-right">Ações</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {members.map(member => {
                                const linkedContact = allContacts.find(c => c.id === member.contactId);
                                return (
                                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-indigo-100 text-indigo-600">{member.name?.charAt(0).toUpperCase()}</div>
                                            <div><p className="font-semibold text-gray-900">{member.name}</p><p className="text-xs text-gray-500">{member.email}</p></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600">{member.role}</span></td>
                                    <td className="px-6 py-4">
                                        {linkedContact ? (
                                            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs"><Link2 className="w-3.5 h-3.5" /> {linkedContact.name}</div>
                                        ) : (
                                            <span className="text-gray-300 text-xs italic">Não vinculado</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {member.email !== currentUser.email && (
                                                <><button onClick={() => openEditModal(member)} className="p-1.5 text-gray-400 hover:text-indigo-600"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleRemoveMember(member.id)} className="p-1.5 text-gray-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button></>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingMember && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><UserCog className="w-5 h-5 text-indigo-600" /> Editar Membro: {editingMember.name}</h2>
                            <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-2 ml-1">Função Principal</label>
                                <select value={editRole} onChange={e => setEditRole(e.target.value as any)} className="w-full border border-gray-200 rounded-xl p-3 bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm">
                                    <option value="MEMBER">Membro</option><option value="ADMIN">Administrador</option>
                                </select>
                            </div>

                            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 space-y-4">
                                <div className="flex items-center gap-2 text-indigo-700 font-black text-[10px] uppercase tracking-widest"><Link2 className="w-4 h-4" /> Vínculo CRM (Identidade)</div>
                                <select 
                                    value={editContactId} 
                                    onChange={e => setEditContactId(e.target.value)} 
                                    className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-sm font-bold outline-none"
                                >
                                    <option value="">Nenhum vínculo (Anônimo)</option>
                                    {allContacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                                </select>
                                <p className="text-[10px] text-indigo-400 leading-tight">Vincular a um contato permite associar comissões e ações operacionais ao registro físico da pessoa, independente de ser Admin ou Membro.</p>
                            </div>

                            {editRole === 'MEMBER' && (
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-3 ml-1">Permissões de Tela</label>
                                    <div className="space-y-4">
                                        {PERMISSION_GROUPS.map((group) => (
                                            <div key={group.name} className="border border-gray-100 rounded-xl overflow-hidden">
                                                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100"><span className="text-[10px] font-black text-gray-400 uppercase">{group.name}</span></div>
                                                <div className="p-3 grid grid-cols-2 gap-2">
                                                    {group.items.map(perm => (
                                                        <label key={perm.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-all">
                                                            <input type="checkbox" checked={editPermissions.includes(perm.id)} onChange={() => togglePermission(perm.id)} className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
                                                            <span className="text-xs font-bold text-gray-600">{perm.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {editRole === 'ADMIN' && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                                    <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">Administradores possuem acesso total a todos os módulos e configurações do sistema, dispensando a seleção individual de permissões.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                            <button onClick={() => setEditingMember(null)} className="px-4 py-2 text-gray-600 font-bold uppercase text-xs">Cancelar</button>
                            <button onClick={handleSavePermissions} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-indigo-100">Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccessView;