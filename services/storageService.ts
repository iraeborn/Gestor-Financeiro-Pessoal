
import { AppState, Account, Transaction, FinancialGoal, AuthResponse, User, AppSettings, Contact, Category, EntityType, SubscriptionPlan, CompanyProfile, Member, ServiceClient, ServiceItem, ServiceAppointment, AuditLog, NotificationLog, OpticalRx } from '../types';
import { localDb } from './localDb';
import { syncService } from './syncService';

const API_URL = '/api';
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// --- Authentication & Account Functions ---

export const login = async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha no login');
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    return data;
};

export const logout = () => {
    localStorage.removeItem('token');
};

export const refreshUser = async (): Promise<{ user: User }> => {
    const res = await fetch(`${API_URL}/auth/me`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Sessão expirada');
    return await res.json();
};

export const register = async (name: string, email: string, password: string, entityType: EntityType, plan: SubscriptionPlan, pjPayload?: any): Promise<AuthResponse> => {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, entityType, plan, pjPayload })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha no registro');
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    return data;
};

export const loginWithGoogle = async (credential: string, entityType?: EntityType, pjPayload?: any): Promise<AuthResponse> => {
    const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, entityType, pjPayload })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha no login Google');
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    return data;
};

export const switchContext = async (targetFamilyId: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_URL}/auth/switch-context`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetFamilyId })
    });
    if (!res.ok) throw new Error('Falha ao trocar contexto');
    const data = await res.json();
    localStorage.setItem('token', data.token);
    return data;
};

// --- Profile & System Settings ---

export const updateSettings = async (settings: AppSettings): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ settings })
    });
    if (!res.ok) throw new Error('Falha ao atualizar configurações');
    return await res.json();
};

export const updateProfile = async (profileData: any): Promise<User> => {
    const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(profileData)
    });
    if (!res.ok) throw new Error('Falha ao atualizar perfil');
    const data = await res.json();
    return data.user;
};

export const getAuditLogs = async (): Promise<AuditLog[]> => {
    const res = await fetch(`${API_URL}/audit-logs`, { headers: getHeaders() });
    if (!res.ok) return [];
    return await res.json();
};

export const getNotificationLogs = async (): Promise<NotificationLog[]> => {
    return [];
};

export const restoreRecord = async (entity: string, entityId: string): Promise<any> => {
    return { success: true };
};

export const revertLogChange = async (logId: number): Promise<any> => {
    return { success: true };
};

// --- Team & Collaboration ---

export const getFamilyMembers = async (): Promise<Member[]> => {
    const res = await fetch(`${API_URL}/members`, { headers: getHeaders() });
    if (!res.ok) return [];
    return await res.json();
};

export const createInvite = async (role?: string): Promise<{ code: string }> => {
    const res = await fetch(`${API_URL}/invites`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ role })
    });
    if (!res.ok) throw new Error('Falha ao criar convite');
    return await res.json();
};

export const joinFamily = async (code: string): Promise<User> => {
    const res = await fetch(`${API_URL}/invites/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha ao entrar na equipe');
    }
    const data = await res.json();
    return data.user;
};

export const updateMemberRole = async (memberId: string, role: string, permissions: string[]): Promise<any> => {
    const res = await fetch(`${API_URL}/members/${memberId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role, permissions })
    });
    if (!res.ok) throw new Error('Falha ao atualizar membro');
    return await res.json();
};

export const removeMember = async (memberId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/members/${memberId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Falha ao remover membro');
    return await res.json();
};

// --- Admin & External Tools ---

export const getAdminStats = async (): Promise<any> => {
    return { totalUsers: 0, active: 0, trial: 0, pf: 0, pj: 0, revenue: 0 };
};

export const getAdminUsers = async (): Promise<any[]> => {
    return [];
};

export const consultCnpj = async (cnpj: string): Promise<any> => {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!res.ok) return null;
    return await res.json();
};

export const createPagarMeSession = async (planId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/create-pagarme-session`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId })
    });
    return await res.json();
};

export const getPublicOrder = async (token: string): Promise<any> => {
    const res = await fetch(`${API_URL}/services/public/order/${token}`);
    if (!res.ok) throw new Error('Orçamento não encontrado');
    return await res.json();
};

export const updatePublicOrderStatus = async (token: string, status: string): Promise<any> => {
    const res = await fetch(`${API_URL}/services/public/order/${token}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Falha ao atualizar status público');
    return await res.json();
};

export const loadInitialData = async (): Promise<AppState> => {
    if (navigator.onLine) {
        try {
            await syncService.pullFromServer();
        } catch (e) {
            console.error("Sync pull failed:", e);
        }
    }

    const stores = [
        'accounts', 'transactions', 'goals', 'contacts', 'categories',
        'branches', 'costCenters', 'departments', 'projects',
        'serviceClients', 'serviceItems', 'serviceAppointments',
        'serviceOrders', 'commercialOrders', 'contracts', 'invoices',
        'opticalRxs'
    ];

    const results: any = {};
    for (const store of stores) {
        results[store] = await localDb.getAll(store) || [];
    }
    
    const companyProfiles = await localDb.getAll('companyProfile');
    results.companyProfile = companyProfiles[0] || null;

    return results as AppState;
};

export const api = {
    saveLocallyAndQueue: async (store: string, data: any) => {
        const id = data.id || crypto.randomUUID();
        const payload = { ...data, id };
        await localDb.put(store, payload);
        await syncService.enqueue('SAVE', store, payload);
        return { success: true, id };
    },

    deleteLocallyAndQueue: async (store: string, id: string) => {
        await localDb.delete(store, id);
        await syncService.enqueue('DELETE', store, { id });
        return { success: true };
    },

    saveTransaction: async (t: Transaction) => api.saveLocallyAndQueue('transactions', t),
    deleteTransaction: async (id: string) => api.deleteLocallyAndQueue('transactions', id),
    
    saveAccount: async (a: Account) => api.saveLocallyAndQueue('accounts', a),
    deleteAccount: async (id: string) => api.deleteLocallyAndQueue('accounts', id),
    
    saveGoal: async (g: FinancialGoal) => api.saveLocallyAndQueue('goals', g),
    deleteGoal: async (id: string) => api.deleteLocallyAndQueue('goals', id),
    
    saveContact: async (c: Contact) => api.saveLocallyAndQueue('contacts', c),
    deleteContact: async (id: string) => api.deleteLocallyAndQueue('contacts', id),
    
    saveCategory: async (c: Category) => api.saveLocallyAndQueue('categories', c),
    deleteCategory: async (id: string) => api.deleteLocallyAndQueue('categories', id),

    saveOpticalRx: async (rx: OpticalRx) => api.saveLocallyAndQueue('opticalRxs', rx),
    deleteOpticalRx: async (id: string) => api.deleteLocallyAndQueue('opticalRxs', id),

    saveCatalogItem: async (i: Partial<ServiceItem>) => api.saveLocallyAndQueue('serviceItems', i),
    deleteCatalogItem: async (id: string) => api.deleteCatalogItem(id),

    saveServiceClient: async (c: any) => api.saveLocallyAndQueue('serviceClients', c),
    deleteServiceClient: async (id: string) => api.deleteLocallyAndQueue('serviceClients', id),
    
    saveAppointment: async (a: any) => api.saveLocallyAndQueue('serviceAppointments', a),
    deleteAppointment: async (id: string) => api.deleteLocallyAndQueue('serviceAppointments', id),

    saveOS: async (os: any) => api.saveLocallyAndQueue('serviceOrders', os),
    deleteOS: async (id: string) => api.deleteLocallyAndQueue('serviceOrders', id),
    
    saveOrder: async (o: any) => api.saveLocallyAndQueue('commercialOrders', o),
    deleteOrder: async (id: string) => api.deleteLocallyAndQueue('commercialOrders', id),

    savePJEntity: async (type: string, payload: any) => {
        const storeMap: any = { branch: 'branches', costCenter: 'costCenters', department: 'departments', project: 'projects' };
        const store = storeMap[type];
        if (store) return api.saveLocallyAndQueue(store, payload);
        await localDb.put('companyProfile', payload);
        return { success: true };
    },
    deletePJEntity: async (type: string, id: string) => {
        const storeMap: any = { branch: 'branches', costCenter: 'costCenters', department: 'departments', project: 'projects' };
        return api.deleteLocallyAndQueue(storeMap[type], id);
    },
};
