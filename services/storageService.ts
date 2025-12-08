import { AppState, AccountType, TransactionType, TransactionStatus } from '../types';

const STORAGE_KEY = 'finance_manager_data_v1';

const INITIAL_DATA: AppState = {
  accounts: [
    { id: '1', name: 'Carteira Física', type: AccountType.WALLET, balance: 150.00 },
    { id: '2', name: 'Nubank', type: AccountType.BANK, balance: 3500.00 },
    { id: '3', name: 'Investimentos XP', type: AccountType.INVESTMENT, balance: 15000.00 },
    { id: '4', name: 'Cartão Black', type: AccountType.CARD, balance: -1200.00 }, 
  ],
  transactions: [
    {
      id: 't1',
      description: 'Salário Mensal',
      amount: 5000,
      type: TransactionType.INCOME,
      category: 'Salário',
      date: new Date().toISOString().split('T')[0],
      status: TransactionStatus.PAID,
      accountId: '2',
      isRecurring: true,
      recurrenceFrequency: 'MONTHLY'
    },
    {
      id: 't2',
      description: 'Supermercado',
      amount: 650,
      type: TransactionType.EXPENSE,
      category: 'Alimentação',
      date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], 
      status: TransactionStatus.PAID,
      accountId: '2',
      isRecurring: false
    },
    {
      id: 't3',
      description: 'Aluguel',
      amount: 1800,
      type: TransactionType.EXPENSE,
      category: 'Moradia',
      date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], 
      status: TransactionStatus.PENDING,
      accountId: '2',
      isRecurring: true,
      recurrenceFrequency: 'MONTHLY',
      recurrenceEndDate: '2025-12-31'
    },
    {
      id: 't4',
      description: 'Freelance Design',
      amount: 1200,
      type: TransactionType.INCOME,
      category: 'Extra',
      date: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
      status: TransactionStatus.PENDING,
      accountId: '2',
      isRecurring: false
    }
  ],
  goals: [
    {
      id: 'g1',
      name: 'Reserva de Emergência',
      targetAmount: 20000,
      currentAmount: 15000,
      deadline: '2024-12-31'
    }
  ]
};

export const loadState = (): AppState => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return INITIAL_DATA;
    }
    return JSON.parse(serialized);
  } catch (e) {
    console.error("Failed to load state", e);
    return INITIAL_DATA;
  }
};

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
};