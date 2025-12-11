
import React, { useEffect, useState } from 'react';
import { getAdminStats, getAdminUsers, logout } from '../services/storageService';
import { LogOut, Users, DollarSign, Activity, Briefcase } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
        const statsData = await getAdminStats();
        const usersData = await getAdminUsers();
        setStats(statsData);
        setUsers(usersData);
    } catch (e) {
        console.error(e);
        alert('Erro ao carregar dados administrativos');
    } finally {
        setLoading(false);
    }
  };

  const handleLogout = () => {
      logout();
      window.location.reload();
  };

  if (loading) return <div className="p-8 text-center">Carregando painel admin...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-inter">
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Super Admin Dashboard</h1>
                <button onClick={handleLogout} className="flex items-center gap-2 text-rose-600 bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-rose-50">
                    <LogOut className="w-4 h-4" /> Sair
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-bold uppercase">Total Usuários</h3>
                        <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats?.totalUsers}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-bold uppercase">Assinantes Ativos</h3>
                        <Activity className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats?.active}</p>
                    <p className="text-xs text-gray-400 mt-1">{stats?.trial} em trial</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-bold uppercase">Distribuição</h3>
                        <Briefcase className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex gap-4">
                        <div>
                            <p className="text-xl font-bold text-gray-900">{stats?.pf}</p>
                            <p className="text-xs text-gray-400">PF</p>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div>
                            <p className="text-xl font-bold text-gray-900">{stats?.pj}</p>
                            <p className="text-xs text-gray-400">PJ</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-bold uppercase">MRR Estimado</h3>
                        <DollarSign className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.revenue || 0)}
                    </p>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="font-bold text-gray-800">Últimos Cadastros</h2>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="px-6 py-3">Nome</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Tipo</th>
                            <th className="px-6 py-3">Plano</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Data</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                                <td className="px-6 py-4 text-gray-600">{u.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${u.entity_type === 'PJ' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {u.entity_type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600">{u.plan}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {u.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
