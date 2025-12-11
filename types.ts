
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER'
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

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  googleId?: string;
  familyId?: string;
  settings?: AppSettings;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Invite {
  code: string;
  expiresAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  userId?: string;
}

export interface Contact {
  id: string;
  name: string;
  userId?: string;
}

export interface Transaction {
  id: string;
  description: string; // Mantemos como fallback ou nota extra
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  status: TransactionStatus;
  accountId: string;
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  userId?: string;
  destinationAccountId?: string;
  interestRate?: number;
  contactId?: string; // Novo relacionamento
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  userId?: string;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  goals: FinancialGoal[];
  contacts: Contact[]; // Nova lista no estado global
}

export type ViewMode = 'DASHBOARD' | 'TRANSACTIONS' | 'REPORTS' | 'ADVISOR' | 'CALENDAR' | 'SETTINGS';

declare global {
  interface Window {
    google: any;
    GOOGLE_CLIENT_ID?: string;
  }
}
