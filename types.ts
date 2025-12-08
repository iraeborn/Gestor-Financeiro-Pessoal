export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export enum AccountType {
  WALLET = 'WALLET',
  BANK = 'BANK',
  CARD = 'CARD',
  INVESTMENT = 'INVESTMENT'
}

export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number; // Current real balance
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO Date string
  status: TransactionStatus;
  accountId: string;
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string; // ISO Date string (optional)
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  goals: FinancialGoal[];
}

export type ViewMode = 'DASHBOARD' | 'TRANSACTIONS' | 'REPORTS' | 'ADVISOR';