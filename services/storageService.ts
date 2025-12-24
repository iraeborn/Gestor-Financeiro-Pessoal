
import { AppState, Account, Transaction, FinancialGoal, AuthResponse, User, AppSettings, Contact, Category, EntityType, SubscriptionPlan, CompanyProfile, Member } from '../types';

const API_URL = '/api';
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro: ${res.status}`);
    }
    return await res.json();
};

export const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); };

export const refreshUser = async (): Promise<User> => {
    const data = await handleResponse(await fetch(`${API_URL}/auth/me`, { headers: getHeaders() }));
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const data = await handleResponse(await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  }));
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
};

// Fix: Added missing register export
export const register = async (name: string, email: string, password: string, entityType: EntityType, plan: SubscriptionPlan, pjPayload?: any): Promise<AuthResponse> => {
  const data = await handleResponse(await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, entityType, plan, pjPayload })
  }));
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
};

// Fix: Added missing loginWithGoogle export
export const loginWithGoogle = async (credential: string): Promise<AuthResponse> => {
  const data = await handleResponse(await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  }));
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
};

// Fix: Added missing consultCnpj export
export const consultCnpj = async (cnpj: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/consult-cnpj/${cnpj}`, { headers: getHeaders() }));
};

// Fix: Added missing createInvite export
export const createInvite = async (role?: string): Promise<{ code: string }> => {
    return handleResponse(await fetch(`${API_URL}/invites`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ role })
    }));
};

// Fix: Added missing joinFamily export
export const joinFamily = async (code: string): Promise<User> => {
    const data = await handleResponse(await fetch(`${API_URL}/invites/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code })
    }));
    return data.user;
};

// Fix: Added missing getFamilyMembers export
export const getFamilyMembers = async (): Promise<Member[]> => {
    return handleResponse(await fetch(`${API_URL}/members`, { headers: getHeaders() }));
};

// Fix: Added missing updateMemberRole export
export const updateMemberRole = async (memberId: string, role: string, permissions: string[]): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/members/${memberId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role, permissions })
    }));
};

// Fix: Added missing removeMember export
export const removeMember = async (memberId: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/members/${memberId}`, {
        method: 'DELETE',
        headers: getHeaders()
    }));
};

// Fix: Added missing getAdminStats export
export const getAdminStats = async (): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/admin/stats`, { headers: getHeaders() }));
};

// Fix: Added missing getAdminUsers export
export const getAdminUsers = async (): Promise<any[]> => {
    return handleResponse(await fetch(`${API_URL}/admin/users`, { headers: getHeaders() }));
};

// Fix: Added missing getAuditLogs export
export const getAuditLogs = async (): Promise<any[]> => {
    return handleResponse(await fetch(`${API_URL}/audit-logs`, { headers: getHeaders() }));
};

// Fix: Added missing getNotificationLogs export
export const getNotificationLogs = async (): Promise<any[]> => {
    return handleResponse(await fetch(`${API_URL}/notification-logs`, { headers: getHeaders() }));
};

// Fix: Added missing restoreRecord export
export const restoreRecord = async (entity: string, entityId: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/restore`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ entity, entityId })
    }));
};

// Fix: Added missing revertLogChange export
export const revertLogChange = async (logId: number): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/revert/${logId}`, {
        method: 'POST',
        headers: getHeaders()
    }));
};

// Fix: Added missing updateProfile export
export const updateProfile = async (data: { name: string; email: string; currentPassword?: string; newPassword?: string }): Promise<User> => {
    const res = await handleResponse(await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }));
    return res.user;
};

// Fix: Added missing getPublicOrder export
export const getPublicOrder = async (token: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/services/public/order/${token}`));
};

// Fix: Added missing updatePublicOrderStatus export
export const updatePublicOrderStatus = async (token: string, status: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/services/public/order/${token}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    }));
};

export const switchContext = async (workspaceId: string) => {
    const data = await handleResponse(await fetch(`${API_URL}/auth/switch-context`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetFamilyId: workspaceId }) 
    }));
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
};

export const loadInitialData = async (): Promise<AppState> => handleResponse(await fetch(`${API_URL}/initial-data`, { headers: getHeaders() }));

export const updateSettings = async (settings: AppSettings): Promise<User> => {
    await handleResponse(await fetch(`${API_URL}/settings`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ settings }) }));
    return await refreshUser();
};

export const api = {
    saveTransaction: async (t: Transaction) => handleResponse(await fetch(`${API_URL}/transactions`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(t) })),
    deleteTransaction: async (id: string) => handleResponse(await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveAccount: async (a: Account) => handleResponse(await fetch(`${API_URL}/accounts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(a) })),
    deleteAccount: async (id: string) => handleResponse(await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveGoal: async (g: FinancialGoal) => handleResponse(await fetch(`${API_URL}/goals`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(g) })),
    deleteGoal: async (id: string) => handleResponse(await fetch(`${API_URL}/goals/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveContact: async (c: Contact) => handleResponse(await fetch(`${API_URL}/contacts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(c) })),
    saveCategory: async (c: Category) => handleResponse(await fetch(`${API_URL}/categories`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(c) })),
    saveBranch: async (d: any) => handleResponse(await fetch(`${API_URL}/branches`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(d) })),
    deleteBranch: async (id: string) => handleResponse(await fetch(`${API_URL}/branches/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveCompanyProfile: async (d: any) => handleResponse(await fetch(`${API_URL}/company`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(d) })),
    // Fix: Added missing shareOrder method to api object
    shareOrder: async (orderId: string, channel: string) => handleResponse(await fetch(`${API_URL}/services/orders/${orderId}/share`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ channel })
    })),
    // Fix: Added missing importInvoiceXml method to api object
    importInvoiceXml: async (file: File) => {
        const formData = new FormData();
        formData.append('xml', file);
        return handleResponse(await fetch(`${API_URL}/services/invoices/import-xml`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        }));
    }
};
