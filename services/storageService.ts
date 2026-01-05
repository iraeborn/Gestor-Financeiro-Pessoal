
import { AppState, Account, Transaction, FinancialGoal, AuthResponse, User, AppSettings, Contact, Category, EntityType, SubscriptionPlan, CompanyProfile, Member, ServiceClient, ServiceItem, ServiceAppointment, AuditLog, NotificationLog, OpticalRx, Salesperson, Laboratory, SalespersonSchedule } from '../types';
import { localDb } from './localDb';
import { syncService } from './syncService';

const API_URL = '/api';
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

const getActiveUserFamilyId = (): string | null => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return String(payload.familyId || payload.id);
    } catch (e) {
        return null;
    }
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
    await localDb.clearAllStores();
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
    await localDb.clearAllStores();
    return data;
};

export const logout = async () => {
    localStorage.removeItem('token');
    await localDb.clearAllStores();
};

export const refreshUser = async (): Promise<{ user: User }> => {
    const res = await fetch(`${API_URL}/auth/me`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Sessão expirada');
    return await res.json();
};

export const register = async (name: string, email: string, password: string, entityType: EntityType, plan: SubscriptionPlan, pjPayload?: any): Promise<AuthResponse> => {
    await localDb.clearAllStores();
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
    await localDb.clearAllStores();
    return data;
};

export const loginWithGoogle = async (credential: string, entityType?: EntityType, pjPayload?: any): Promise<AuthResponse> => {
    await localDb.clearAllStores();
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
    await localDb.clearAllStores();
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
    await localDb.clearAllStores();
    return data;
};

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
    const currentFamilyId = getActiveUserFamilyId();

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
        'opticalRxs', 'salespeople', 'salespersonSchedules', 'laboratories'
    ];

    const results: any = {};
    for (const store of stores) {
        const rawData = await localDb.getAll(store) || [];
        results[store] = rawData.filter((item: any) => {
            const itemFamilyId = String(item.familyId || item.family_id || '');
            if (!currentFamilyId) return true;
            return itemFamilyId === currentFamilyId;
        });
    }
    
    const companyProfiles = await localDb.getAll('companyProfile');
    results.companyProfile = companyProfiles.find((p: any) => {
        const pFamilyId = String(p.familyId || p.family_id || '');
        return pFamilyId === currentFamilyId;
    }) || null;

    return results as AppState;
};

export interface ApiClient {
    saveLocallyAndQueue: (store: string, data: any) => Promise<{ success: boolean; id: string }>;
    deleteLocallyAndQueue: (store: string, id: string) => Promise<{ success: boolean }>;
    saveTransaction: (t: Transaction, newContact?: Contact, newCategory?: Category) => Promise<{ success: boolean; id: string }>;
    deleteTransaction: (id: string) => Promise<{ success: boolean }>;
    saveAccount: (a: Account) => Promise<{ success: boolean; id: string }>;
    deleteAccount: (id: string) => Promise<{ success: boolean }>;
    saveGoal: (g: FinancialGoal) => Promise<{ success: boolean; id: string }>;
    deleteGoal: (id: string) => Promise<{ success: boolean }>;
    saveContact: (c: Contact) => Promise<{ success: boolean; id: string }>;
    deleteContact: (id: string) => Promise<{ success: boolean }>;
    saveCategory: (c: Category) => Promise<{ success: boolean; id: string }>;
    deleteCategory: (id: string) => Promise<{ success: boolean }>;
    saveOpticalRx: (rx: OpticalRx) => Promise<{ success: boolean; id: string }>;
    deleteOpticalRx: (id: string) => Promise<{ success: boolean }>;
    saveCatalogItem: (i: Partial<ServiceItem>) => Promise<{ success: boolean; id: string }>;
    deleteCatalogItem: (id: string) => Promise<{ success: boolean }>;
    saveServiceClient: (c: any) => Promise<{ success: boolean; id: string }>;
    deleteServiceClient: (id: string) => Promise<{ success: boolean }>;
    saveAppointment: (a: any) => Promise<{ success: boolean; id: string }>;
    deleteAppointment: (id: string) => Promise<{ success: boolean }>;
    saveOS: (os: any) => Promise<{ success: boolean; id: string }>;
    deleteOS: (id: string) => Promise<{ success: boolean }>;
    saveOrder: (o: any) => Promise<{ success: boolean; id: string }>;
    deleteOrder: (id: string) => Promise<{ success: boolean }>;
    savePJEntity: (type: string, payload: any) => Promise<{ success: boolean; id?: string }>;
    deletePJEntity: (type: string, id: string) => Promise<{ success: boolean }>;
    saveLaboratory: (lab: Laboratory) => Promise<{ success: boolean; id: string }>;
    deleteLaboratory: (id: string) => Promise<{ success: boolean }>;
    saveSalespersonSchedule: (s: SalespersonSchedule) => Promise<{ success: boolean; id: string }>;
    deleteSalespersonSchedule: (id: string) => Promise<{ success: boolean }>;
}

export const api: ApiClient = {
    saveLocallyAndQueue: async (store: string, data: any) => {
        const id = data.id || crypto.randomUUID();
        const familyId = getActiveUserFamilyId();
        
        if (!familyId) throw new Error("Sessão inválida: familyId ausente.");

        const payload = { 
            ...data, 
            id, 
            familyId, 
            family_id: familyId
        };
        
        await localDb.put(store, payload);
        await syncService.enqueue('SAVE', store, payload);
        return { success: true, id };
    },

    deleteLocallyAndQueue: async (store: string, id: string) => {
        await localDb.delete(store, id);
        await syncService.enqueue('DELETE', store, { id });
        return { success: true };
    },

    saveTransaction: async (t: Transaction, newContact?: Contact, newCategory?: Category) => {
        // CORREÇÃO: Se houver novo contato ou categoria, salvamos e enfileiramos eles PRIMEIRO.
        // Isso garante que no enfileiramento do Sync, as dependências tenham timestamps anteriores
        // e cheguem ao servidor antes da transação, evitando erro de Foreign Key.
        if (newContact) {
            await api.saveContact(newContact);
        }
        if (newCategory) {
            await api.saveCategory(newCategory);
        }
        return api.saveLocallyAndQueue('transactions', t);
    },

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
    deleteCatalogItem: async (id: string) => api.deleteLocallyAndQueue('serviceItems', id),
    saveServiceClient: async (c: any) => api.saveLocallyAndQueue('serviceClients', c),
    deleteServiceClient: async (id: string) => api.deleteLocallyAndQueue('serviceClients', id),
    saveAppointment: async (a: any) => api.saveLocallyAndQueue('serviceAppointments', a),
    deleteAppointment: async (id: string) => api.deleteLocallyAndQueue('serviceAppointments', id),
    saveOS: async (os: any) => api.saveLocallyAndQueue('serviceOrders', os),
    deleteOS: async (id: string) => api.deleteLocallyAndQueue('serviceOrders', id),
    saveOrder: async (o: any) => api.saveLocallyAndQueue('commercialOrders', o),
    deleteOrder: async (id: string) => api.deleteLocallyAndQueue('commercialOrders', id),
    saveLaboratory: async (lab: Laboratory) => api.saveLocallyAndQueue('laboratories', lab),
    deleteLaboratory: async (id: string) => api.deleteLocallyAndQueue('laboratories', id),
    saveSalespersonSchedule: async (s: SalespersonSchedule) => api.saveLocallyAndQueue('salespersonSchedules', s),
    deleteSalespersonSchedule: async (id: string) => api.deleteLocallyAndQueue('salespersonSchedules', id),

    savePJEntity: async (type: string, payload: any) => {
        const storeMap: any = { branch: 'branches', costCenter: 'costCenters', department: 'departments', project: 'projects' };
        const store = storeMap[type];
        if (store) return api.saveLocallyAndQueue(store, payload);
        
        const familyId = getActiveUserFamilyId();
        const profile = { ...payload, familyId, family_id: familyId };
        await localDb.put('companyProfile', profile);
        return { success: true };
    },
    deletePJEntity: async (type: string, id: string) => {
        const storeMap: any = { branch: 'branches', costCenter: 'costCenters', department: 'departments', project: 'projects' };
        return api.deleteLocallyAndQueue(storeMap[type], id);
    },
};
