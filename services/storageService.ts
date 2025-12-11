
import { AppState, Account, Transaction, FinancialGoal, AuthResponse, User, AppSettings, Contact } from '../types';

const API_URL = '/api';

const INITIAL_EMPTY_STATE: AppState = {
  accounts: [],
  transactions: [],
  goals: [],
  contacts: []
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

export const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
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

// --- Collab (Family) ---

export const createInvite = async () => {
    const res = await fetch(`${API_URL}/invite/create`, {
        method: 'POST',
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

export const getFamilyMembers = async () => {
    const res = await fetch(`${API_URL}/family/members`, { headers: getHeaders() });
    if (!res.ok) return [];
    return await res.json();
};

// --- Data ---

export const loadInitialData = async (): Promise<AppState> => {
    const res = await fetch(`${API_URL}/initial-data`, { headers: getHeaders() });
    
    if (res.status === 401 || res.status === 403) {
        throw new Error("Unauthorized");
    }
    
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
  saveTransaction: async (transaction: Transaction) => {
    const res = await fetch(`${API_URL}/transactions`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(transaction) });
    await handleResponse(res);
  },
  deleteTransaction: async (id: string) => {
    const res = await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE', headers: getHeaders() });
    await handleResponse(res);
  },
  saveGoal: async (goal: FinancialGoal) => {}
};
