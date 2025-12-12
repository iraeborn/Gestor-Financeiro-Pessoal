
import { AppState, Account, Transaction, FinancialGoal, AuthResponse, User, AppSettings, Contact, Category, EntityType, SubscriptionPlan, CompanyProfile, Branch, CostCenter, Department, Project, AuditLog, ServiceClient, ServiceItem, ServiceAppointment, Member } from '../types';

const API_URL = '/api';

const INITIAL_EMPTY_STATE: AppState = {
  accounts: [],
  transactions: [],
  goals: [],
  contacts: [],
  categories: [],
  branches: [],
  costCenters: [],
  departments: [],
  projects: []
};

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

// --- Auth ---

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

export const register = async (name: string, email: string, password: string, entityType: EntityType, plan: SubscriptionPlan): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, entityType, plan })
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
    body: JSON.stringify({ credential })
  });
  const data = await handleResponse(res);
  
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const switchContext = async (targetFamilyId: string): Promise<User> => {
    const res = await fetch(`${API_URL}/switch-context`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetFamilyId })
    });
    const data = await handleResponse(res);
    
    // Update local storage with new token (if backend rotates it) and user state
    if (data.token) localStorage.setItem('token', data.token);
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
    
    return data.user;
};

export const updateSettings = async (settings: AppSettings) => {
    const res = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ settings })
    });
    await handleResponse(res);
    // Update local user object
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        user.settings = settings;
        localStorage.setItem('user', JSON.stringify(user));
    }
};

// --- Admin ---
export const getAdminStats = async () => {
    const res = await fetch(`${API_URL}/admin/stats`, { headers: getHeaders() });
    return await handleResponse(res);
};

export const getAdminUsers = async () => {
    const res = await fetch(`${API_URL}/admin/users`, { headers: getHeaders() });
    return await handleResponse(res);
};

// --- Collab (Family) ---

export const createInvite = async () => {
    const res = await fetch(`${API_URL}/admin/invite/create`, {
        method: 'GET',
        headers: getHeaders()
    });
    return await handleResponse(res);
};

export const joinFamily = async (code: string) => {
    const res = await fetch(`${API_URL}/invite/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code })
    });
    const data = await handleResponse(res);
    // Token update needed because familyId changed
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
};

export const getFamilyMembers = async (): Promise<Member[]> => {
    const res = await fetch(`${API_URL}/family/members`, { headers: getHeaders() });
    if (!res.ok) return [];
    return await res.json();
};

export const updateMemberRole = async (memberId: string, role: string, permissions: string[]) => {
    const res = await fetch(`${API_URL}/family/members/${memberId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role, permissions })
    });
    return await handleResponse(res);
};

export const removeMember = async (memberId: string) => {
    const res = await fetch(`${API_URL}/family/members/${memberId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return await handleResponse(res);
};

// --- Data ---

export const loadInitialData = async (): Promise<AppState> => {
    const res = await fetch(`${API_URL}/initial-data`, { headers: getHeaders() });
    
    if (res.status === 401 || res.status === 403) {
        throw new Error("Unauthorized");
    }
    
    return await handleResponse(res);
};

// --- Logs & Restore ---
export const getAuditLogs = async (): Promise<AuditLog[]> => {
    const res = await fetch(`${API_URL}/audit-logs`, { headers: getHeaders() });
    return await handleResponse(res);
};

export const restoreRecord = async (entity: string, id: string) => {
    const res = await fetch(`${API_URL}/restore`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ entity, id })
    });
    return await handleResponse(res);
};

export const revertLogChange = async (logId: number) => {
    const res = await fetch(`${API_URL}/revert-change`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ logId })
    });
    return await handleResponse(res);
};

export const api = {
  saveAccount: async (account: Account) => {
    const res = await fetch(`${API_URL}/accounts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(account) });
    await handleResponse(res);
  },
  deleteAccount: async (id: string) => {
    const res = await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE', headers: getHeaders() });
    await handleResponse(res);
  },
  saveContact: async (contact: Contact) => {
      const res = await fetch(`${API_URL}/contacts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(contact) });
      await handleResponse(res);
  },
  deleteContact: async (id: string) => {
    const res = await fetch(`${API_URL}/contacts/${id}`, { method: 'DELETE', headers: getHeaders() });
    await handleResponse(res);
  },
  saveCategory: async (category: Category) => {
      const res = await fetch(`${API_URL}/categories`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(category) });
      await handleResponse(res);
  },
  deleteCategory: async (id: string) => {
      const res = await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE', headers: getHeaders() });
      await handleResponse(res);
  },
  saveTransaction: async (transaction: Transaction) => {
    const res = await fetch(`${API_URL}/transactions`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(transaction) });
    await handleResponse(res);
  },
  deleteTransaction: async (id: string) => {
    const res = await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE', headers: getHeaders() });
    await handleResponse(res);
  },
  saveGoal: async (goal: FinancialGoal) => {},
  
  // PJ Methods
  saveCompanyProfile: async (company: CompanyProfile) => {
      const res = await fetch(`${API_URL}/company`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(company) });
      await handleResponse(res);
  },
  saveBranch: async (branch: Branch) => {
      const res = await fetch(`${API_URL}/branches`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(branch) });
      await handleResponse(res);
  },
  deleteBranch: async (id: string) => {
      const res = await fetch(`${API_URL}/branches/${id}`, { method: 'DELETE', headers: getHeaders() });
      await handleResponse(res);
  },
  saveCostCenter: async (cc: CostCenter) => {
      const res = await fetch(`${API_URL}/cost-centers`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(cc) });
      await handleResponse(res);
  },
  deleteCostCenter: async (id: string) => {
      const res = await fetch(`${API_URL}/cost-centers/${id}`, { method: 'DELETE', headers: getHeaders() });
      await handleResponse(res);
  },
  saveDepartment: async (dept: Department) => {
      const res = await fetch(`${API_URL}/departments`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(dept) });
      await handleResponse(res);
  },
  deleteDepartment: async (id: string) => {
      const res = await fetch(`${API_URL}/departments/${id}`, { method: 'DELETE', headers: getHeaders() });
      await handleResponse(res);
  },
  saveProject: async (project: Project) => {
      const res = await fetch(`${API_URL}/projects`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(project) });
      await handleResponse(res);
  },
  deleteProject: async (id: string) => {
      const res = await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE', headers: getHeaders() });
      await handleResponse(res);
  },

  // Generic Module Methods (Replaces Odonto)
  saveServiceClient: async (client: ServiceClient) => {
      const res = await fetch(`${API_URL}/modules/clients`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(client) });
      await handleResponse(res);
  },
  deleteServiceClient: async (id: string) => {
      const res = await fetch(`${API_URL}/modules/clients/${id}`, { method: 'DELETE', headers: getHeaders() });
      await handleResponse(res);
  },
  saveServiceItem: async (item: ServiceItem) => {
      const res = await fetch(`${API_URL}/modules/services`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(item) });
      await handleResponse(res);
  },
  deleteServiceItem: async (id: string) => {
      const res = await fetch(`${API_URL}/modules/services/${id}`, { method: 'DELETE', headers: getHeaders() });
      await handleResponse(res);
  },
  saveServiceAppointment: async (appt: ServiceAppointment) => {
      const res = await fetch(`${API_URL}/modules/appointments`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(appt) });
      await handleResponse(res);
  },
  deleteServiceAppointment: async (id: string) => {
      const res = await fetch(`${API_URL}/modules/appointments/${id}`, { method: 'DELETE', headers: getHeaders() });
      await handleResponse(res);
  }
};
