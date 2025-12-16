
import { AppState, Account, Transaction, FinancialGoal, AuthResponse, User, AppSettings, Contact, Category, EntityType, SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project, AuditLog, ServiceClient, ServiceItem, ServiceAppointment, Member, NotificationLog, ServiceOrder, CommercialOrder, Contract, Invoice } from '../types';

const API_URL = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro na requisição: ${res.status}`);
    }
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return await res.json();
    }
    return null; 
};

export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const refreshUser = async (): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
    const data = await handleResponse(res);
    if (data && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
    }
    throw new Error("Failed to refresh user data");
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await handleResponse(res);
  
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
};

// Updated to accept companyData
export const register = async (name: string, email: string, password: string, entityType: EntityType, plan: SubscriptionPlan, companyData?: Partial<CompanyProfile>): Promise<AuthResponse> => {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, entityType, plan, companyData })
    });
    const data = await handleResponse(res);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
};

export const loginWithGoogle = async (credential: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credential })
    });
    const data = await handleResponse(res);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
};

export const updateProfile = async (data: any): Promise<User> => {
    const res = await fetch(`${API_URL}/profile`, { // Fixed endpoint
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    const response = await handleResponse(res);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response.user;
};

export const updateSettings = async (settings: AppSettings): Promise<User> => {
    const res = await fetch(`${API_URL}/settings`, { // Fixed endpoint
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ settings })
    });
    return await refreshUser();
};

export const switchContext = async (workspaceId: string) => {
    const res = await fetch(`${API_URL}/switch-context`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetFamilyId: workspaceId }) // Fixed param name
    });
    const data = await handleResponse(res);
    if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
    }
};

export const loadInitialData = async (): Promise<AppState> => {
    const res = await fetch(`${API_URL}/initial-data`, { headers: getHeaders() });
    return await handleResponse(res);
};

export const consultCnpj = async (cnpj: string) => {
    const res = await fetch(`${API_URL}/consult-cnpj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj })
    });
    return await handleResponse(res);
};

// Collaboration
export const createInvite = async (roleTemplate?: string): Promise<{ code: string }> => {
    const res = await fetch(`${API_URL}/invites`, { 
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ roleTemplate })
    });
    return await handleResponse(res);
};

export const joinFamily = async (code: string): Promise<User> => {
    const res = await fetch(`${API_URL}/invite/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code })
    });
    const data = await handleResponse(res);
    if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
    }
    throw new Error('Join failed');
};

export const getFamilyMembers = async (): Promise<Member[]> => {
    const res = await fetch(`${API_URL}/family/members`, { headers: getHeaders() });
    return await handleResponse(res);
};

export const removeMember = async (memberId: string) => {
    const res = await fetch(`${API_URL}/family/members/${memberId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return await handleResponse(res);
};

export const updateMemberRole = async (memberId: string, role: string, permissions: string[]) => {
    const res = await fetch(`${API_URL}/family/members/${memberId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role, permissions })
    });
    return await handleResponse(res);
};

// Admin
export const getAdminStats = async () => {
    const res = await fetch(`${API_URL}/admin/stats`, { headers: getHeaders() });
    return await handleResponse(res);
};

export const getAdminUsers = async () => {
    const res = await fetch(`${API_URL}/admin/users`, { headers: getHeaders() });
    return await handleResponse(res);
};

// Logs
export const getAuditLogs = async (): Promise<AuditLog[]> => {
    const res = await fetch(`${API_URL}/audit-logs`, { headers: getHeaders() });
    return await handleResponse(res);
};

export const getNotificationLogs = async (): Promise<NotificationLog[]> => {
    const res = await fetch(`${API_URL}/notification-logs`, { headers: getHeaders() });
    return await handleResponse(res);
};

export const restoreRecord = async (entity: string, id: string) => {
    const res = await fetch(`${API_URL}/restore`, { // Fixed endpoint
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ entity, id })
    });
    return await handleResponse(res);
};

export const revertLogChange = async (logId: number) => {
    const res = await fetch(`${API_URL}/revert-change`, { // Fixed endpoint
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ logId })
    });
    return await handleResponse(res);
};

// API Object for CRUD
export const api = {
    saveTransaction: async (t: Transaction) => {
        const res = await fetch(`${API_URL}/transactions`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(t)
        });
        return await handleResponse(res);
    },
    deleteTransaction: async (id: string) => {
        const res = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE', headers: getHeaders()
        });
        return await handleResponse(res);
    },
    saveAccount: async (a: Account) => {
        const res = await fetch(`${API_URL}/accounts`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(a)
        });
        return await handleResponse(res);
    },
    deleteAccount: async (id: string) => {
        const res = await fetch(`${API_URL}/accounts/${id}`, {
            method: 'DELETE', headers: getHeaders()
        });
        return await handleResponse(res);
    },
    saveContact: async (c: Contact) => {
        const res = await fetch(`${API_URL}/contacts`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(c)
        });
        return await handleResponse(res);
    },
    deleteContact: async (id: string) => {
        const res = await fetch(`${API_URL}/contacts/${id}`, {
            method: 'DELETE', headers: getHeaders()
        });
        return await handleResponse(res);
    },
    saveCategory: async (c: Category) => {
        const res = await fetch(`${API_URL}/categories`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(c)
        });
        return await handleResponse(res);
    },
    deleteCategory: async (id: string) => {
        const res = await fetch(`${API_URL}/categories/${id}`, {
            method: 'DELETE', headers: getHeaders()
        });
        return await handleResponse(res);
    },
    saveGoal: async (g: FinancialGoal) => {
        const res = await fetch(`${API_URL}/goals`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(g)
        });
        return await handleResponse(res);
    },
    deleteGoal: async (id: string) => {
        const res = await fetch(`${API_URL}/goals/${id}`, {
            method: 'DELETE', headers: getHeaders()
        });
        return await handleResponse(res);
    },
    // PJ
    saveCompanyProfile: async (data: CompanyProfile) => {
        const res = await fetch(`${API_URL}/company`, { // Fixed endpoint
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    saveBranch: async (data: Branch) => {
        const res = await fetch(`${API_URL}/branches`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteBranch: async (id: string) => {
        const res = await fetch(`${API_URL}/branches/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    saveCostCenter: async (data: CostCenter) => {
        const res = await fetch(`${API_URL}/cost-centers`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteCostCenter: async (id: string) => {
        const res = await fetch(`${API_URL}/cost-centers/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    saveDepartment: async (data: Department) => {
        const res = await fetch(`${API_URL}/departments`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteDepartment: async (id: string) => {
        const res = await fetch(`${API_URL}/departments/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    saveProject: async (data: Project) => {
        const res = await fetch(`${API_URL}/projects`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteProject: async (id: string) => {
        const res = await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    // Modules (Fixing paths to match server)
    saveServiceClient: async (data: ServiceClient) => {
        const res = await fetch(`${API_URL}/modules/clients`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteServiceClient: async (id: string) => {
        const res = await fetch(`${API_URL}/modules/clients/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    saveServiceItem: async (data: ServiceItem) => {
        const res = await fetch(`${API_URL}/modules/services`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteServiceItem: async (id: string) => {
        const res = await fetch(`${API_URL}/modules/services/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    saveServiceAppointment: async (data: ServiceAppointment) => {
        const res = await fetch(`${API_URL}/modules/appointments`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteServiceAppointment: async (id: string) => {
        const res = await fetch(`${API_URL}/modules/appointments/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    // NEW SERVICE MODULE
    saveServiceOrder: async (data: ServiceOrder) => {
        const res = await fetch(`${API_URL}/services/os`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteServiceOrder: async (id: string) => {
        const res = await fetch(`${API_URL}/services/os/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    saveCommercialOrder: async (data: CommercialOrder) => {
        const res = await fetch(`${API_URL}/services/orders`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteCommercialOrder: async (id: string) => {
        const res = await fetch(`${API_URL}/services/orders/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    saveContract: async (data: Contract) => {
        const res = await fetch(`${API_URL}/services/contracts`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteContract: async (id: string) => {
        const res = await fetch(`${API_URL}/services/contracts/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    },
    saveInvoice: async (data: Invoice) => {
        const res = await fetch(`${API_URL}/services/invoices`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        return await handleResponse(res);
    },
    deleteInvoice: async (id: string) => {
        const res = await fetch(`${API_URL}/services/invoices/${id}`, { method: 'DELETE', headers: getHeaders() });
        return await handleResponse(res);
    }
};
