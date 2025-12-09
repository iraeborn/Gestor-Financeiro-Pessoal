
import { AppState, Account, Transaction, FinancialGoal, AuthResponse } from '../types';

// API Base URL - relative because of Nginx proxy
const API_URL = '/api';

const INITIAL_EMPTY_STATE: AppState = {
  accounts: [],
  transactions: [],
  goals: []
};

// --- Auth Functions ---

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  // Mock login implementation
  const mockUser = {
    id: '1',
    name: 'Usuário Demo',
    email: email
  };
  const response = {
    token: 'demo-token-' + Date.now(),
    user: mockUser
  };
  localStorage.setItem('token', response.token);
  localStorage.setItem('user', JSON.stringify(response.user));
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return response;
};

export const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  // Mock register implementation
  const mockUser = {
    id: crypto.randomUUID(),
    name,
    email
  };
  const response = {
    token: 'demo-token-' + Date.now(),
    user: mockUser
  };
  localStorage.setItem('token', response.token);
  localStorage.setItem('user', JSON.stringify(response.user));
  
  await new Promise(resolve => setTimeout(resolve, 500));
  return response;
};

export const loginWithGoogle = async (credential: string): Promise<AuthResponse> => {
  // Mock Google login implementation
  const mockUser = {
    id: 'google-user-' + Date.now(),
    name: 'Google User',
    email: 'user@gmail.com',
    googleId: 'google-id-sample'
  };
  const response = {
    token: 'google-token-' + Date.now(),
    user: mockUser
  };
  localStorage.setItem('token', response.token);
  localStorage.setItem('user', JSON.stringify(response.user));
  
  await new Promise(resolve => setTimeout(resolve, 500));
  return response;
};

// --- Fetch Functions ---

export const loadInitialData = async (): Promise<AppState> => {
  try {
    const response = await fetch(`${API_URL}/initial-data`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Failed to load initial data from API:", error);
    return INITIAL_EMPTY_STATE;
  }
};

export const api = {
  saveAccount: async (account: Account) => {
    await fetch(`${API_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account)
    });
  },

  deleteAccount: async (id: string) => {
    await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE' });
  },

  saveTransaction: async (transaction: Transaction) => {
    await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
  },

  deleteTransaction: async (id: string) => {
    await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' });
  },

  // Stub functions for future implementation if needed, or handled via full state reload
  saveGoal: async (goal: FinancialGoal) => {
     // TODO: Implement Goal endpoint
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// Deprecated synchronous functions to satisfy Typescript interfaces if any remaining, 
// but App.tsx will be updated to remove usage.
export const loadState = () => INITIAL_EMPTY_STATE;
export const saveState = () => {};
