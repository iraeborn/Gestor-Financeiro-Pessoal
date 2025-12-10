
import { AppState, Account, Transaction, FinancialGoal, AuthResponse, User } from '../types';

const API_URL = '/api';

const INITIAL_EMPTY_STATE: AppState = {
  accounts: [],
  transactions: [],
  goals: []
};

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// --- Auth ---

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// --- Collab (Family) ---

export const createInvite = async () => {
    const res = await fetch(`${API_URL}/invite/create`, {
        method: 'POST',
        headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data; // { code, expiresAt }
};

export const joinFamily = async (code: string) => {
    const res = await fetch(`${API_URL}/invite/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
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
  try {
    const res = await fetch(`${API_URL}/initial-data`, { headers: getHeaders() });
    if (res.status === 401 || res.status === 403) {
        logout();
        return INITIAL_EMPTY_STATE;
    }
    if (!res.ok) throw new Error('Failed');
    return await res.json();
  } catch (error) {
    console.error(error);
    return INITIAL_EMPTY_STATE;
  }
};

export const api = {
  saveAccount: async (account: Account) => {
    await fetch(`${API_URL}/accounts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(account) });
  },
  deleteAccount: async (id: string) => {
    await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE', headers: getHeaders() });
  },
  saveTransaction: async (transaction: Transaction) => {
    await fetch(`${API_URL}/transactions`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(transaction) });
  },
  deleteTransaction: async (id: string) => {
    await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE', headers: getHeaders() });
  },
  saveGoal: async (goal: FinancialGoal) => {}
};
