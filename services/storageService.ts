
import { AppState, Account, Transaction, FinancialGoal, AuthResponse, User, AppSettings, Contact, Category, EntityType, SubscriptionPlan, CompanyProfile, Member, ServiceClient, ServiceItem, ServiceAppointment, AuditLog, NotificationLog, OpticalRx } from '../types';

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

export const logout = () => { 
    localStorage.removeItem('token'); 
    localStorage.removeItem('user'); 
};

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

export const loginWithGoogle = async (credential: string, entityType?: EntityType, pjPayload?: any): Promise<AuthResponse> => {
  const data = await handleResponse(await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, entityType, pjPayload })
  }));
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
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

export const loadInitialData = async (): Promise<AppState> => 
    handleResponse(await fetch(`${API_URL}/initial-data`, { headers: getHeaders() }));

export const updateSettings = async (settings: AppSettings): Promise<User> => {
    await handleResponse(await fetch(`${API_URL}/settings`, { 
        method: 'POST', 
        headers: getHeaders(), 
        body: JSON.stringify({ settings }) 
    }));
    return await refreshUser();
};

export const updateProfile = async (data: { name: string; email: string; currentPassword?: string; newPassword?: string }): Promise<User> => {
    const res = await handleResponse(await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }));
    return res.user;
};

export const getAuditLogs = async (): Promise<AuditLog[]> => handleResponse(await fetch(`${API_URL}/audit-logs`, { headers: getHeaders() }));
export const getNotificationLogs = async (): Promise<NotificationLog[]> => handleResponse(await fetch(`${API_URL}/notification-logs`, { headers: getHeaders() }));

export const getPublicOrder = async (token: string): Promise<any> => handleResponse(await fetch(`${API_URL}/services/public/order/${token}`));
export const updatePublicOrderStatus = async (token: string, status: string): Promise<any> => handleResponse(await fetch(`${API_URL}/services/public/order/${token}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }));

export const consultCnpj = async (cnpj: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/consult-cnpj/${cnpj}`, { headers: getHeaders() }));
};

export const createPagarMeSession = async (planId: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/billing/create-pagarme-session`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId })
    }));
};

export const createInvite = async (role?: string): Promise<{ code: string }> => {
    return handleResponse(await fetch(`${API_URL}/invites`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ role })
    }));
};

export const joinFamily = async (code: string): Promise<User> => {
    const data = await handleResponse(await fetch(`${API_URL}/invites/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code })
    }));
    return data.user;
};

export const getFamilyMembers = async (): Promise<Member[]> => {
    return handleResponse(await fetch(`${API_URL}/members`, { headers: getHeaders() }));
};

export const getAdminStats = async (): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/admin/stats`, { headers: getHeaders() }));
};

export const getAdminUsers = async (): Promise<any[]> => {
    return handleResponse(await fetch(`${API_URL}/admin/users`, { headers: getHeaders() }));
};

export const restoreRecord = async (entity: string, entityId: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/restore`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ entity, entityId })
    }));
};

export const revertLogChange = async (logId: number): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/revert-log`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ logId })
    }));
};

export const updateMemberRole = async (memberId: string, role: string, permissions: string[]): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/members/${memberId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role, permissions })
    }));
};

export const removeMember = async (memberId: string): Promise<any> => {
    return handleResponse(await fetch(`${API_URL}/members/${memberId}`, {
        method: 'DELETE',
        headers: getHeaders()
    }));
};

export const api = {
    saveTransaction: async (t: Transaction) => handleResponse(await fetch(`${API_URL}/transactions`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(t) })),
    deleteTransaction: async (id: string) => handleResponse(await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveAccount: async (a: Account) => handleResponse(await fetch(`${API_URL}/accounts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(a) })),
    deleteAccount: async (id: string) => handleResponse(await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveGoal: async (g: FinancialGoal) => handleResponse(await fetch(`${API_URL}/goals`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(g) })),
    deleteGoal: async (id: string) => handleResponse(await fetch(`${API_URL}/goals/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveContact: async (c: Contact) => handleResponse(await fetch(`${API_URL}/contacts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(c) })),
    deleteContact: async (id: string) => handleResponse(await fetch(`${API_URL}/contacts/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveCategory: async (c: Category) => handleResponse(await fetch(`${API_URL}/categories`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(c) })),
    deleteCategory: async (id: string) => handleResponse(await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE', headers: getHeaders() })),
    
    // Ótica
    saveOpticalRx: async (rx: OpticalRx) => handleResponse(await fetch(`${API_URL}/optical/rx`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(rx) })),
    deleteOpticalRx: async (id: string) => handleResponse(await fetch(`${API_URL}/optical/rx/${id}`, { method: 'DELETE', headers: getHeaders() })),

    saveCatalogItem: async (i: Partial<ServiceItem>) => handleResponse(await fetch(`${API_URL}/modules/services`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(i) })),
    deleteCatalogItem: async (id: string) => handleResponse(await fetch(`${API_URL}/modules/services/${id}`, { method: 'DELETE', headers: getHeaders() })),

    saveServiceClient: async (c: any) => handleResponse(await fetch(`${API_URL}/modules/clients`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(c) })),
    deleteServiceClient: async (id: string) => handleResponse(await fetch(`${API_URL}/modules/clients/${id}`, { method: 'DELETE', headers: getHeaders() })),
    
    saveAppointment: async (a: any) => handleResponse(await fetch(`${API_URL}/modules/appointments`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(a) })),
    deleteAppointment: async (id: string) => handleResponse(await fetch(`${API_URL}/modules/appointments/${id}`, { method: 'DELETE', headers: getHeaders() })),

    saveOS: async (os: any) => handleResponse(await fetch(`${API_URL}/services/os`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(os) })),
    deleteOS: async (id: string) => handleResponse(await fetch(`${API_URL}/services/os/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveOrder: async (o: any) => handleResponse(await fetch(`${API_URL}/services/orders`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(o) })),
    deleteOrder: async (id: string) => handleResponse(await fetch(`${API_URL}/services/orders/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveContract: async (c: any) => handleResponse(await fetch(`${API_URL}/services/contracts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(c) })),
    deleteContract: async (id: string) => handleResponse(await fetch(`${API_URL}/services/contracts/${id}`, { method: 'DELETE', headers: getHeaders() })),
    saveInvoice: async (i: any) => handleResponse(await fetch(`${API_URL}/services/invoices`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(i) })),
    deleteInvoice: async (id: string) => handleResponse(await fetch(`${API_URL}/services/invoices/${id}`, { method: 'DELETE', headers: getHeaders() })),
    
    savePJEntity: async (type: string, payload: any) => {
        const endpoint = type === 'company' ? '/api/settings/company' : `/api/pj/${type}`;
        return handleResponse(await fetch(endpoint, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }));
    },
    deletePJEntity: async (type: string, id: string) => {
        return handleResponse(await fetch(`/api/pj/${type}/${id}`, { method: 'DELETE', headers: getHeaders() }));
    },

    importInvoiceXml: async (xmlFile: File): Promise<any> => {
        const formData = new FormData();
        formData.append('xml', xmlFile);
        return handleResponse(await fetch(`${API_URL}/services/invoices/import-xml`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        }));
    },

    shareOrder: async (orderId: string, channel: string) => handleResponse(await fetch(`${API_URL}/services/orders/${orderId}/share`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ channel })
    }))
};
